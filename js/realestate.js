// ───────── 5단계: 임대 · 매매 · 내 가게 · 건물주 ─────────
import { $, toast, openSheet, closeSheet, bindActs, row, bigMsg } from './ui.js';
import { won } from './config.js';
import { seeded } from './geo.js';
import { planFloor, tenantMap, floorLabel, clearTenants } from './bplan.js';
import { homeVacant } from './floorview.js';
import { TYPES, SHOP_NAMES, NAMES_BY_TYPE, OVERRIDES, unitKey } from './tenants.js';
import * as ST from './state.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const MONTH = 30;   // 30일마다 월세
export const pyeong = (r) => Math.max(5, Math.round((r.x1 - r.x0) * (r.z1 - r.z0) * 0.85 / 3.3));
const won2 = (v) => v >= 1e8 ? `${(v / 1e8).toFixed(v % 1e8 ? 2 : 0).replace(/\.?0+$/, '')}억` : v >= 1e4 ? `${Math.round(v / 1e4).toLocaleString()}만` : `${v}`;
export { won2 };
const GM = { A: 1.3, B: 1.0, C: 0.72 };

// 집 시세 (평 기준)
export function homePrices(kind, py, grade) {
  const per = { villa: 1300e4, apt: 2500e4, tower: 3600e4 }[kind] || 2000e4;
  const buy = Math.round(per * py * GM[grade] / 1e6) * 1e6;
  const jeonse = Math.round(buy * (kind === 'villa' ? 0.72 : 0.58) / 1e6) * 1e6;
  const deposit = Math.round(Math.max(500e4, jeonse * 0.1) / 1e6) * 1e6;
  const rent = Math.round(((jeonse - deposit) * 0.055 / 12) / 1e4) * 1e4;
  return { buy, jeonse, deposit, rent, fee: Math.round(py * 0.75) * 1e4 };
}
// 상가 임대료 (㎡ 기준)
export function shopPrices(n, area, grade, kind) {
  const per = n === 1 ? 32000 : n < 0 ? 9000 : n <= 3 ? 15000 : 11000;
  const rent = Math.round(area * per * GM[grade] * (kind === 'mall' ? 1.3 : 1) / 1e4) * 1e4;
  return { rent, deposit: rent * 10, fee: Math.round(area * 2500 / 1e3) * 1e3 };
}
const homeCls = (py, kind) => kind === 'tower' || py >= 45 ? 'pent' : py >= 16 ? 'apt' : 'oneroom';

// 업종별 하루 장사 (손님 수 · 객단가 · 인테리어 비용)
export const BIZ = {
  cafe: { cust: 160, spend: 6500, setup: 4500e4 }, bakery: { cust: 140, spend: 9000, setup: 6000e4 }, bunsik: { cust: 120, spend: 9000, setup: 3000e4 },
  chicken: { cust: 45, spend: 26000, setup: 4000e4 }, pizza: { cust: 40, spend: 28000, setup: 4500e4 }, burger: { cust: 150, spend: 9500, setup: 7000e4 },
  hansik: { cust: 110, spend: 11000, setup: 4000e4 }, chinese: { cust: 100, spend: 12000, setup: 4500e4 }, japanese: { cust: 70, spend: 16000, setup: 5500e4 },
  bbq: { cust: 50, spend: 48000, setup: 8000e4 }, dessert: { cust: 90, spend: 9000, setup: 3500e4 }, karaoke: { cust: 35, spend: 18000, setup: 9000e4 },
  pcbang: { cust: 80, spend: 7000, setup: 1.5e8 }, salon: { cust: 18, spend: 35000, setup: 5000e4 }, nail: { cust: 10, spend: 45000, setup: 2500e4 },
  flower: { cust: 25, spend: 22000, setup: 2000e4 }, studycafe: { cust: 60, spend: 6000, setup: 8000e4 }, laundry: { cust: 30, spend: 9000, setup: 3000e4 },
};
const COGS = { cafe: 0.3, bakery: 0.38, bunsik: 0.35, chicken: 0.42, pizza: 0.4, burger: 0.38, hansik: 0.38, chinese: 0.36, japanese: 0.42, bbq: 0.45, dessert: 0.3, karaoke: 0.1, pcbang: 0.15, salon: 0.12, nail: 0.15, flower: 0.45, studycafe: 0.08, laundry: 0.2 };

export class RealEstate {
  constructor(ctx) { this.c = ctx; }   // { S, city, audio, persist, setupHome, enterHomeUnit, refreshSpec(spec), setSign(slot, name, color) }
  get S() { return this.c.S; }
  specOf(bid) { return this.c.city.bldgs.find(s => s.seed === bid); }
  get credit() { return this.S.credit ?? (this.S.credit = 750); }
  addCredit(d) { this.S.credit = Math.max(300, Math.min(1000, this.credit + d)); }

  // ─ 매물 ─
  listings() {
    const S = this.S, week = Math.floor(ST.day(S) / 7);
    if (this._list && this._week === week) return this._list;
    const R = seeded(week * 7919 + 13);
    const city = this.c.city, out = [];
    const res = city.bldgs.filter(s => s.bkind === 'apt' || s.bkind === 'villa' || s.bkind === 'tower');
    const shops = city.bldgs.filter(s => s.bkind === 'shop' || s.bkind === 'mall');
    let guard = 0;
    while (out.filter(l => l.kind === 'home').length < 14 && guard++ < 200) {
      const s = res[Math.floor(R() * res.length)], B = city.bldgOf(s);
      const fl = B.floors.filter(f => !f.roof && !f.parking && f.n > (B.kind === 'villa' ? 1 : 0) && !(B.kind === 'tower' && f.n < 4));
      const f = fl[Math.floor(R() * fl.length)]; if (!f) continue;
      const p = planFloor(B, f.n);
      const units = p.rooms.filter(r => r.home && homeVacant(B, f.n, r.k));
      if (!units.length) continue;
      const r = units[Math.floor(R() * units.length)];
      if (out.some(l => l.bid === B.id && l.n === f.n && l.k === r.k)) continue;
      const py = pyeong(r);
      const pr = homePrices(B.kind, py, B.grade);
      const deals = B.kind === 'villa' ? ['wolse', 'jeonse'] : B.kind === 'tower' ? ['buy', 'jeonse', 'wolse'] : ['wolse', 'jeonse', 'buy'];
      out.push({ id: `h${B.id}_${f.n}_${r.k}`, kind: 'home', bid: B.id, n: f.n, k: r.k, num: r.num, name: `${B.name} ${r.num || ''}`, py, cls: homeCls(py, B.kind), bkind: B.kind, grade: B.grade, age: B.age, pr, deals });
    }
    guard = 0;
    while (out.filter(l => l.kind === 'shop').length < 10 && guard++ < 300) {
      const s = shops[Math.floor(R() * shops.length)], B = city.bldgOf(s);
      const tm = tenantMap(B);
      const vac = [...tm.entries()].filter(([, t]) => t.vacant);
      if (!vac.length) continue;
      const [key] = vac[Math.floor(R() * vac.length)];
      const [n, k] = key.split(':').map(Number);
      const r = planFloor(B, n).rooms.find(q => q.kind === 'unit' && q.k === k); if (!r) continue;
      if (out.some(l => l.bid === B.id && l.n === n && l.k === k)) continue;
      const area = Math.round((r.x1 - r.x0) * (r.z1 - r.z0));
      out.push({ id: `s${B.id}_${n}_${k}`, kind: 'shop', bid: B.id, n, k, name: `${B.name} ${floorLabel(n, B)}`, area, py: Math.round(area / 3.3), w: r.x1 - r.x0, grade: B.grade, age: B.age, bkind: B.kind, pr: shopPrices(n, area, B.grade, B.kind) });
    }
    guard = 0;
    while (out.filter(l => l.kind === 'bldg').length < 4 && guard++ < 50) {
      const s = shops[Math.floor(R() * shops.length)], B = city.bldgOf(s);
      if (B.kind !== 'shop' || out.some(l => l.bid === B.id)) continue;
      const inc = this.buildingIncome(B);
      const price = Math.round(inc.gross * 12 / 0.045 / 1e7) * 1e7;
      out.push({ id: `b${B.id}`, kind: 'bldg', bid: B.id, name: B.name, floors: B.top, grade: B.grade, age: B.age, price, inc });
    }
    this._list = out; this._week = week;
    return out;
  }
  buildingIncome(B) {
    let gross = 0, units = 0, occ = 0;
    for (const [key, t] of tenantMap(B)) {
      const [n, k] = key.split(':').map(Number);
      const r = planFloor(B, n).rooms.find(q => q.kind === 'unit' && q.k === k); if (!r) continue;
      units++;
      if (t.vacant) continue;
      occ++;
      gross += shopPrices(n, (r.x1 - r.x0) * (r.z1 - r.z0), B.grade, B.kind).rent;
    }
    return { gross, units, occ, net: Math.round(gross * 0.88) };
  }

  // ─ 부동산 사무소 ─
  office(name = '부동산', extra = []) {
    const S = this.S;
    openSheet({
      icon: '🏘️', title: name, sub: `"어서 오세요~ 어떤 매물 찾으세요?" · 내 신용점수 ${this.credit}점`,
      html: row({ icon: '🏠', title: '집 구하기', desc: '월세 · 전세 · 매매', btn: '보기', action: 'go:home' }) +
        row({ icon: '🏪', title: '가게 자리 구하기', desc: '내 가게 차리기', btn: '보기', action: 'go:shop' }) +
        row({ icon: '🏢', title: '건물 매매', desc: '건물주 되기 · 매달 월세 수입', btn: '보기', action: 'go:bldg' }) +
        row({ icon: '📄', title: '내 계약 · 대출', desc: `${(S.contracts || []).length}건`, btn: '보기', action: 'mine' }) +
        extra.map((e, i) => row({ icon: e.icon, title: e.title, desc: e.desc || '', btn: e.btn || '보기', action: 'x:' + i })).join(''),
      bind: (b) => bindActs(b, { go: (k) => this.listSheet(k), mine: () => this.myContracts(), x: (i) => extra[+i].fn() }),
    });
  }
  listSheet(kind, filter = null) {
    const L = this.listings().filter(l => l.kind === kind && !(this.S.contracts || []).some(c => c.lid === l.id));
    const label = { wolse: '월세', jeonse: '전세', buy: '매매' };
    const html = L.length ? L.map(l => {
      if (kind === 'home') return row({ icon: { apt: '🏢', villa: '🏘️', tower: '🌆' }[l.bkind], title: l.name, desc: `${l.py}평 · ${l.age}년차(${l.grade}) · ${l.deals.map(d => d === 'wolse' ? `월세 ${won2(l.pr.deposit)}/${won2(l.pr.rent)}` : d === 'jeonse' ? `전세 ${won2(l.pr.jeonse)}` : `매매 ${won2(l.pr.buy)}`).join(' · ')}`, btn: '상세', action: 'd:' + l.id });
      if (kind === 'shop') return row({ icon: '🏪', title: l.name, desc: `${l.py}평 · 보증금 ${won2(l.pr.deposit)} / 월 ${won2(l.pr.rent)}`, btn: '상세', action: 'd:' + l.id });
      return row({ icon: '🏢', title: l.name, desc: `${l.floors}층 · ${l.age}년차 · 임대 ${l.inc.occ}/${l.inc.units}칸 · 월 수입 ${won2(l.inc.net)}`, price: won2(l.price), btn: '상세', action: 'd:' + l.id });
    }).join('') : '<p class="note">이번 주 매물이 없어요. 다음 주에 다시 와 보세요.</p>';
    void label; void filter;
    openSheet({ icon: kind === 'home' ? '🏠' : kind === 'shop' ? '🏪' : '🏢', title: kind === 'home' ? '집 매물' : kind === 'shop' ? '상가 매물' : '건물 매물', sub: '매주 새 매물이 나와요', html, bind: (b) => bindActs(b, { d: (id) => this.detail(this.listings().find(l => l.id === id)) }) });
  }
  detail(l) {
    const S = this.S;
    const deals = l.kind === 'home' ? l.deals : l.kind === 'shop' ? ['wolse'] : ['buy'];
    const line = (d) => d === 'wolse' ? `보증금 ${won(l.pr.deposit)} · 월세 ${won(l.pr.rent)}` : d === 'jeonse' ? `전세 보증금 ${won(l.pr.jeonse)}` : `매매가 ${won(l.price || l.pr.buy)}`;
    openSheet({
      icon: '📋', title: l.name, sub: l.kind === 'home' ? `${l.py}평 · 지은 지 ${l.age}년 · ${l.grade}등급` : l.kind === 'shop' ? `${l.py}평 (${l.area}㎡) · ${l.grade}등급` : `${l.floors}층 건물 · 임대 수입 월 ${won(l.inc.net)} (관리비 제외)`,
      html: `${l.kind === 'home' ? `<p class="note">관리비 월 약 ${won(l.pr.fee)} · 이사하면 이 집이 우리 집이 돼요</p>` : l.kind === 'shop' ? `<p class="note">관리비 월 ${won(l.pr.fee)} · 계약하면 업종과 이름을 정해 가게를 열어요</p>` : '<p class="note">건물주는 매달 세입자들의 월세를 받아요 (빈 칸은 부동산이 채워 줘요)</p>'}` +
        deals.map(d => row({ icon: d === 'wolse' ? '📅' : d === 'jeonse' ? '🔑' : '🏷️', title: { wolse: '월세', jeonse: '전세', buy: '매매' }[d], desc: line(d), btn: '계약', btnClass: 'green', action: 'c:' + d })).join('') +
        (l.kind !== 'bldg' ? row({ icon: '📍', title: '집 보러 가기', desc: '공동현관을 열어 드려요 (오늘 하루) · 길안내', btn: '가기', action: 'v' }) : row({ icon: '📍', title: '건물 보러 가기', btn: '길안내', action: 'v' })),
      bind: (b) => bindActs(b, {
        c: (d) => this.contract(l, d),
        v: () => {
          const spec = this.specOf(l.bid), d = this.c.city.bdoors.find(q => q.spec === spec && (q.lobby || q.door?.secure)) || this.c.city.bdoors.find(q => q.spec === spec);
          S.viewing = { bid: l.bid, until: S.minutes + 1440 }; S.codes = S.codes || {}; S.codes[l.bid] = 'view';
          if (d) S.waypoint = { x: d.x, z: d.z, name: l.name };
          closeSheet(); toast(`📍 ${l.name} 길안내 시작 · 공동현관 비밀번호를 받았어요 (오늘만)`, 'good', 3600);
        },
      }),
    });
  }
  // ─ 계약 ─
  contract(l, deal) {
    const S = this.S;
    const need = deal === 'wolse' ? l.pr.deposit + l.pr.rent : deal === 'jeonse' ? l.pr.jeonse : (l.price || l.pr.buy);
    const fee = Math.round(need * (deal === 'wolse' ? 0.005 : 0.004) / 1000) * 1000;   // 중개수수료
    const total = need + fee;
    const loanMax = deal === 'wolse' ? 0 : Math.round(need * (deal === 'jeonse' ? 0.8 : 0.7) / 1e6) * 1e6;
    const canLoan = this.credit >= 600 && loanMax > 0 && !(S.loans || []).some(q => q.kind === deal);
    const short = Math.max(0, total - S.money);
    openSheet({
      icon: '✍️', title: '계약서', sub: l.name,
      html: `<div class="doc"><h3>${{ wolse: '월세', jeonse: '전세', buy: '매매' }[deal]} 계약서</h3>
        소재지: ${l.name}<br>${deal === 'wolse' ? `보증금 ${won(l.pr.deposit)} / 차임 월 ${won(l.pr.rent)} (매 30일 자동이체)` : deal === 'jeonse' ? `전세 보증금 ${won(l.pr.jeonse)} (계약 끝나면 돌려받음)` : `매매 대금 ${won(need)}`}<br>
        중개수수료 ${won(fee)}<br>${deal !== 'buy' ? '월세를 2번 연속 못 내면 계약이 해지되고 신용점수가 떨어져요.' : '소유권이 이전돼요.'}</div>
        <div class="grid2" style="margin:10px 0"><div class="stat"><span>필요한 돈</span><b>${won(total)}</b></div><div class="stat"><span>통장 잔액</span><b>${won(S.money)}</b></div></div>
        ${short > 0 ? (canLoan && short <= loanMax ? `<p class="note">💳 ${won(short)}이 모자라요 · ${deal === 'jeonse' ? '전세자금대출' : '주택담보대출'}로 빌릴 수 있어요 (연 4.8%, 매달 이자)</p><button class="btn wide" data-act="loan">대출 받고 계약하기 (${won(short)})</button>` : `<p class="note" style="color:var(--bad)">돈이 ${won(short)} 모자라요${this.credit < 600 ? ' · 신용점수가 낮아 대출이 안 돼요' : loanMax ? ` · 대출 한도 ${won(loanMax)}` : ''}</p>`) : ''}
        <button class="btn wide green" data-act="sign" ${short > 0 ? 'disabled' : ''}>✍️ 서명하기</button>`,
      bind: (b) => bindActs(b, {
        sign: () => this.sign(l, deal, total, 0),
        loan: () => this.sign(l, deal, total, short),
      }),
    });
  }
  sign(l, deal, total, loan) {
    const S = this.S;
    if (loan > 0) { S.loans = S.loans || []; S.loans.push({ id: 'L' + Date.now(), kind: deal, label: deal === 'jeonse' ? '전세자금대출' : deal === 'buy' ? '주택담보대출' : '대출', principal: loan, rate: 0.048, start: ST.day(S), lastPaid: ST.day(S), missed: 0 }); S.money += loan; }
    if (S.money < total) { toast('돈이 모자라요', 'bad'); return; }
    S.money -= total;
    this.c.flash?.(false);
    S.contracts = S.contracts || [];
    const day = ST.day(S);
    const c = { id: 'C' + Date.now(), lid: l.id, kind: l.kind, deal, bid: l.bid, n: l.n, k: l.k, name: l.name, num: l.num, py: l.py, cls: l.cls, deposit: deal === 'wolse' ? l.pr.deposit : deal === 'jeonse' ? l.pr.jeonse : 0, rent: deal === 'wolse' ? l.pr.rent : 0, fee: l.pr?.fee || 0, start: day, nextDue: day + MONTH, missed: 0, price: deal === 'buy' ? (l.price || l.pr.buy) : 0 };
    S.contracts.push(c);
    closeSheet();
    this.c.audio.chime?.();
    this.addCredit(5);
    if (l.kind === 'home') {
      this.moveIn(c);
    } else if (l.kind === 'shop') {
      bigMsg('🏪 가게 자리 계약!', '이제 업종과 이름을 정해서 가게를 열어요', 3200);
      setTimeout(() => this.setupShop(c), 800);
    } else {
      S.ownedBldgs = S.ownedBldgs || []; S.ownedBldgs.push(l.bid);
      bigMsg('🏢 건물주가 됐어요!', `${l.name} · 매달 월세 수입 약 ${won(l.inc.net)}`, 3600);
    }
    this._list = null;
    this.c.persist();
  }
  moveIn(c) {
    const S = this.S;
    // 예전에 살던 월세·전세 집은 정리 (보증금 돌려받기)
    const old = (S.contracts || []).find(q => q !== c && q.kind === 'home' && q.living);
    if (old) this.endContract(old, true);
    c.living = true;
    S.homeUnit = { bid: c.bid, n: c.n, k: c.k, num: c.num, name: c.name, cls: c.cls };
    S.homeBldg = c.bid;
    if (!S.homes.includes(c.cls)) S.homes.push(c.cls);
    S.home = c.cls;
    this.c.setupHome?.();
    bigMsg('🏡 이사 완료!', `${c.name} · 휴대폰 지도에서 🏠를 찾아가세요`, 3600);
    this.c.checkGoals?.();
  }
  endContract(c, silent) {
    const S = this.S;
    const back = Math.max(0, c.deposit - (c.arrears || 0));
    if (back) { S.money += back; if (!silent) toast(`🏦 보증금 ${won(back)}을 돌려받았어요`, 'good'); }
    if (c.deal === 'buy') { S.money += Math.round(c.price * 0.97); toast(`🏷️ 집을 팔았어요 · ${won(Math.round(c.price * 0.97))}`, 'good'); }
    if (c.kind === 'shop' && c.shop) this.closeShop(c);
    if (c.living) { c.living = false; if (S.homeUnit?.bid === c.bid && S.homeUnit.n === c.n && S.homeUnit.k === c.k) { S.homeUnit = null; S.homeBldg = null; S.home = 'oneroom'; this.c.setupHome?.(); } }
    S.contracts = S.contracts.filter(q => q !== c);
  }
  myContracts() {
    const S = this.S, day = ST.day(S);
    const cs = S.contracts || [], ls = S.loans || [];
    openSheet({
      icon: '📄', title: '내 계약 · 대출', sub: `신용점수 ${this.credit}점`,
      html: (cs.length ? cs.map(c => row({ icon: c.kind === 'home' ? '🏠' : c.kind === 'shop' ? '🏪' : '🏢', title: `${c.name}${c.living ? ' (거주 중)' : ''}${c.shop ? ` · ${c.shop.name}` : ''}`, desc: `${{ wolse: '월세', jeonse: '전세', buy: '소유' }[c.deal]}${c.rent ? ` · 월 ${won(c.rent)} · 다음 납부 ${c.nextDue - day}일 뒤` : ''}${c.arrears ? ` · ⚠️ 연체 ${won(c.arrears)}` : ''}`, btn: c.kind === 'shop' && c.shop ? '가게 관리' : c.deal === 'buy' ? '팔기' : '계약 끝내기', btnClass: 'gray', action: (c.kind === 'shop' && c.shop ? 'shop:' : 'end:') + c.id })).join('') : '<p class="note">계약한 곳이 없어요.</p>') +
        (ls.length ? '<div class="note" style="color:#ddd;margin-top:10px">대출</div>' + ls.map(q => row({ icon: '🏦', title: q.label, desc: `잔액 ${won(q.principal)} · 연 ${(q.rate * 100).toFixed(1)}% · 월 이자 ${won(Math.round(q.principal * q.rate / 12))}${q.missed ? ` · ⚠️ ${q.missed}달 연체` : ''}`, btn: '갚기', action: 'repay:' + q.id })).join('') : '') +
        ((S.ownedBldgs || []).length ? `<p class="note">🏢 내 건물 ${S.ownedBldgs.length}채 · 매달 임대 수입이 들어와요</p>` : ''),
      bind: (b) => bindActs(b, {
        end: (id) => { const c = cs.find(q => q.id === id); if (c.living && !confirmMove()) return; this.endContract(c); closeSheet(); this.c.persist(); },
        shop: (id) => this.manageShop(cs.find(q => q.id === id)),
        repay: (id) => this.repaySheet(ls.find(q => q.id === id)),
      }),
    });
    const confirmMove = () => { toast('🏠 살고 있는 집 계약이 끝나면 원룸으로 돌아가요'); return true; };
  }
  repaySheet(L) {
    const S = this.S;
    openSheet({
      icon: '🏦', title: L.label, sub: `잔액 ${won(L.principal)}`,
      html: [1e6, 1e7, 5e7, L.principal].filter((v, i, a) => v <= L.principal && a.indexOf(v) === i).map(v => row({ icon: '💸', title: `${won(v)} 갚기`, btn: '갚기', action: 'p:' + v, disabled: S.money < v })).join(''),
      bind: (b) => bindActs(b, { p: (v) => { v = +v; if (S.money < v) return; S.money -= v; L.principal -= v; if (L.principal <= 0) { S.loans = S.loans.filter(q => q !== L); this.addCredit(20); toast('🎉 대출을 다 갚았어요! 신용점수 +20', 'good'); } else toast(`🏦 ${won(v)} 갚았어요`, 'good'); closeSheet(); this.c.persist(); } }),
    });
  }

  // ─ 매달 정산 (월세 · 이자 · 건물 수입) · 하루 정산 (내 가게) ─
  dailyCheck() {
    const S = this.S, day = ST.day(S);
    if (S.reDay === day) return;
    const prev = S.reDay ?? day; S.reDay = day;
    for (let d = prev + 1; d <= day; d++) this.dayTick(d);
  }
  dayTick(day) {
    const S = this.S;
    for (const c of [...(S.contracts || [])]) {
      if (c.kind === 'shop' && c.shop) this.shopDay(c, day);
      if (!c.rent && c.kind !== 'shop') continue;
      if (day < c.nextDue) continue;
      c.nextDue += MONTH;
      const rent = Math.round((c.rent || 0) * (S.mayor?.pledge === 'rent' && c.kind === 'home' ? 0.9 : 1) / 100) * 100;
      const due = rent + (c.arrears || 0);
      if (!c.rent) continue;
      if (S.money >= due) { S.money -= due; if (c.arrears) toast(`🏦 밀린 월세까지 ${won(due)} 냈어요`, 'good'); else toast(`🏦 ${c.name} 월세 ${won(rent)} 자동이체${rent < c.rent ? ' (시 월세 지원 10%)' : ''}`, '', 3000); c.arrears = 0; c.missed = 0; this.addCredit(3); }
      else {
        c.arrears = due; c.missed = (c.missed || 0) + 1; this.addCredit(-40);
        toast(`⚠️ 잔액 부족! ${c.name} 월세 ${won(c.rent)} 연체 (${c.missed}번째) · 신용점수 하락`, 'bad', 5000);
        if (c.missed >= 2) {
          this.addCredit(-150);
          bigMsg('📄 계약 해지', `${c.name} 월세를 2번 못 내서 계약이 끝났어요 · 보증금에서 밀린 돈을 뺐어요`, 4200);
          this.endContract(c);
        }
      }
    }
    // 대출 이자 (30일마다)
    for (const L of [...(S.loans || [])]) {
      if (day - L.lastPaid < MONTH) continue;
      L.lastPaid = day;
      const it = Math.round(L.principal * L.rate / 12 / 10) * 10;
      if (S.money >= it) { S.money -= it; L.missed = 0; toast(`🏦 ${L.label} 이자 ${won(it)} 납부`, '', 3000); }
      else {
        L.missed++; this.addCredit(-60);
        toast(`⚠️ ${L.label} 이자 연체 (${L.missed}달) · 신용점수 하락`, 'bad', 4500);
        if (L.missed >= 3) this.seize(L);
      }
    }
    // 건물 임대 수입
    if ((S.ownedBldgs || []).length && day % MONTH === 0) {
      let sum = 0;
      for (const bid of S.ownedBldgs) { const s = this.specOf(bid); if (s) sum += this.buildingIncome(this.c.city.bldgOf(s)).net; }
      if (sum) { S.money += sum; S.totalEarned = (S.totalEarned || 0) + sum; toast(`🏢 이번 달 임대 수입 +${won(sum)}`, 'good', 4000); }
    }
  }
  seize(L) {
    const S = this.S;
    // 압류: 가진 집·건물을 팔아서 갚아요
    const owned = (S.contracts || []).find(c => c.deal === 'buy');
    if (owned) { bigMsg('⚖️ 압류', `${owned.name}이(가) 경매로 넘어갔어요`, 4200); const got = Math.round(owned.price * 0.75); this.endContract(owned, true); S.money -= Math.round(owned.price * 0.97); S.money += got; }
    else if ((S.ownedBldgs || []).length) { const bid = S.ownedBldgs.pop(); bigMsg('⚖️ 압류', '건물이 경매로 넘어갔어요', 4200); S.money += Math.round(L.principal * 0.4); }
    const pay = Math.min(S.money, L.principal);
    S.money -= pay; L.principal -= pay;
    if (L.principal <= 0) S.loans = S.loans.filter(q => q !== L);
    else { L.missed = 0; toast(`⚖️ 아직 ${won(L.principal)} 남았어요 · 통장이 압류돼 버는 돈의 절반이 빠져나가요`, 'bad', 5000); S.garnish = true; }
    this.addCredit(-200);
  }

  // ─ 내 가게 ─
  setupShop(c) {
    const S = this.S, s = this.specOf(c.bid), B = this.c.city.bldgOf(s);
    const r = planFloor(B, c.n).rooms.find(q => q.kind === 'unit' && q.k === c.k);
    const w = r ? r.x1 - r.x0 : 8;
    const lk = c.n < 0 ? 'B' : c.n === 1 ? '1' : c.n <= 3 ? 'L' : 'U';
    const types = Object.keys(BIZ).filter(t => TYPES[t] && TYPES[t].loc.includes(lk) && (TYPES[t].minW || 0) <= w + 0.5);
    openSheet({
      icon: '🏪', title: '어떤 가게를 열까요?', sub: `${c.name} · ${c.py}평 (${floorLabel(c.n, B)})`,
      html: types.map(t => row({ icon: TYPES[t].icon, title: TYPES[t].label, desc: `인테리어 ${won2(Math.round(BIZ[t].setup * Math.max(0.6, c.py / 25)))}원 · 손님 객단가 ${won(BIZ[t].spend)}`, btn: '선택', action: 't:' + t })).join('') || '<p class="note">이 자리에 맞는 업종이 없어요</p>',
      bind: (b) => bindActs(b, { t: (t) => this.nameShop(c, t) }),
    });
  }
  nameShop(c, type) {
    const S = this.S;
    const cost = Math.round(BIZ[type].setup * Math.max(0.6, c.py / 25));
    const fr = (NAMES_BY_TYPE[type] || []).filter(i => SHOP_NAMES[i][3]);
    const indie = ['행복한', '오늘의', '골목', '한빛', '달빛', '우리'].map(a => `${a} ${TYPES[type].label}`);
    openSheet({
      icon: '✏️', title: '가게 이름', sub: `${TYPES[type].label} · 인테리어 ${won(cost)}`,
      html: `<p class="note">개인 가게는 이름을 직접 짓고, 프랜차이즈는 가맹비(인테리어 +30%)를 내는 대신 손님이 많아요.</p>
        <input id="shopName" maxlength="12" placeholder="가게 이름 (최대 12자)" style="width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);background:#0e1218;color:#fff;font-size:16px;margin-bottom:8px">
        <div class="tabs">${indie.slice(0, 4).map((n, i) => `<button data-act="nm:${i}">${n}</button>`).join('')}</div>
        <button class="btn wide green" data-act="indie" style="margin-top:8px">🏪 개인 가게로 열기 · ${won(cost)}</button>
        ${fr.map(i => row({ icon: '🏷️', title: `${SHOP_NAMES[i][0]} 가맹점`, desc: '프랜차이즈 · 손님 +25%', price: won(Math.round(cost * 1.3)), btn: '가맹', action: 'fr:' + i })).join('')}`,
      bind: (b) => {
        bindActs(b, {
          nm: (i) => { b.querySelector('#shopName').value = indie[+i]; },
          indie: () => { const nm = (b.querySelector('#shopName').value || indie[0]).trim().slice(0, 12); this.openShop(c, type, nm, null, cost); },
          fr: (i) => this.openShop(c, type, SHOP_NAMES[+i][0], +i, Math.round(cost * 1.3)),
        });
      },
    });
  }
  openShop(c, type, name, slot, cost) {
    const S = this.S;
    if (S.money < cost) { toast(`💸 인테리어 비용 ${won(cost)}이 모자라요`, 'bad'); return; }
    S.money -= cost;
    S.shopsOpened = (S.shopsOpened || 0) + 1;
    S.customSlots = S.customSlots || {};
    let sl = slot;
    if (sl == null) {
      // 직접 지은 이름은 간판 빈 칸에 그려요
      const used = new Set(Object.values(S.customSlots).map(q => q.slot));
      for (let i = 110; i < 128; i++) if (!used.has(i)) { sl = i; break; }
      S.customSlots[c.id] = { slot: sl, name, color: pick(['#c0392b', '#2e7d32', '#1565c0', '#6a1b9a', '#ef6c00', '#00838f', '#4e342e']) };
      this.c.setSign?.(sl, name, S.customSlots[c.id].color);
    }
    c.shop = { type, name, slot: sl, fr: slot != null, price: 1, staff: 0, rating: 3, opened: ST.day(S), totalProfit: 0, days: 0, color: slot != null ? SHOP_NAMES[slot][1] : S.customSlots[c.id].color };
    this.applyOverride(c);
    closeSheet();
    bigMsg(`🎉 ${name} 개업!`, '직원을 뽑거나, 직접 카운터에서 일해요 · 매일 밤 정산돼요', 3800);
    this.c.missions?.event?.('openshop');
    this.c.persist();
  }
  applyOverride(c) {
    const sh = c.shop;
    OVERRIDES.set(unitKey(c.bid, c.n, c.k), { slot: sh.slot, type: sh.type, name: sh.name, color: sh.color, mine: true, contract: c.id });
    clearTenants(c.bid);
    const s = this.specOf(c.bid); if (s) this.c.refreshSpec?.(s);
  }
  closeShop(c) {
    OVERRIDES.set(unitKey(c.bid, c.n, c.k), { vacant: true });
    clearTenants(c.bid);
    if (this.S.customSlots) delete this.S.customSlots[c.id];
    c.shop = null;
    const s = this.specOf(c.bid); if (s) this.c.refreshSpec?.(s);
  }
  // 저장된 내 가게들을 다시 도시에 반영
  restore() {
    const S = this.S;
    for (const [id, q] of Object.entries(S.customSlots || {})) this.c.setSign?.(q.slot, q.name, q.color);
    for (const c of S.contracts || []) if (c.shop) { OVERRIDES.set(unitKey(c.bid, c.n, c.k), { slot: c.shop.slot, type: c.shop.type, name: c.shop.name, color: c.shop.color, mine: true, contract: c.id }); clearTenants(c.bid); }
  }
  manageShop(c) {
    const S = this.S, sh = c.shop;
    const est = this.estimate(c);
    openSheet({
      icon: TYPES[sh.type]?.icon || '🏪', title: sh.name, sub: `${c.name} · 개업 ${ST.day(S) - sh.opened}일째 · 평판 ${'⭐'.repeat(Math.round(sh.rating))}`,
      html: `<div class="grid2" style="margin-bottom:10px"><div class="stat"><span>하루 예상 손님</span><b>${est.cust}명</b></div><div class="stat"><span>하루 예상 이익</span><b style="color:${est.profit >= 0 ? 'var(--good)' : 'var(--bad)'}">${won(est.profit)}</b></div><div class="stat"><span>누적 이익</span><b>${won(sh.totalProfit)}</b></div><div class="stat"><span>월세</span><b>${won(c.rent)}</b></div></div>
        <div class="note" style="color:#ddd">가격</div><div class="tabs">${[[0.85, '저렴하게'], [1, '보통'], [1.2, '비싸게']].map(([v, n]) => `<button data-act="pr:${v}" class="${sh.price === v ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="note" style="color:#ddd;margin-top:8px">직원 (하루 8시간 · 1명당 ${won(10320 * 8)})</div><div class="tabs">${[0, 1, 2, 3].map(v => `<button data-act="st:${v}" class="${sh.staff === v ? 'on' : ''}">${v}명</button>`).join('')}</div>
        <p class="note">직원이 없으면 내가 카운터에서 일한 시간에만 장사해요. 내가 직접 일하면 평판이 올라가요.</p>
        <div class="note" style="color:#ddd;margin-top:8px">📝 손님 리뷰 ${sh.reviews?.length ? `· 평균 ${(sh.reviews.reduce((a, r) => a + r.st, 0) / sh.reviews.length).toFixed(1)}점` : ''}</div>
        ${(sh.reviews || []).slice(0, 5).map(r => `<div class="row"><div class="ic">${r.st >= 4 ? '😊' : r.st === 3 ? '🙂' : '😞'}</div><div class="info"><b>${'⭐'.repeat(r.st)}</b><span>${r.who} · "${r.text}" · ${ST.day(S) - r.day === 0 ? '오늘' : ST.day(S) - r.day + '일 전'}</span></div></div>`).join('') || '<p class="note">아직 리뷰가 없어요 · 하루가 지나면 손님 리뷰가 달려요</p>'}
        <button class="btn wide red" data-act="close">폐업하기 (자리 계약도 끝남)</button>`,
      bind: (b) => bindActs(b, {
        pr: (v) => { sh.price = +v; this.manageShop(c); this.c.persist(); },
        st: (v) => { sh.staff = +v; this.manageShop(c); this.c.persist(); },
        close: () => { this.endContract(c); closeSheet(); bigMsg('😢 폐업', `${sh.name} 문을 닫았어요`, 3000); this.c.persist(); },
      }),
    });
  }
  estimate(c, worked = 0) {
    const sh = c.shop, biz = BIZ[sh.type];
    const s = this.specOf(c.bid), B = s && this.c.city.bldgOf(s);
    const loc = (c.n === 1 ? 1.35 : c.n < 0 ? 0.75 : c.n <= 3 ? 0.9 : 0.75) * (B ? { A: 1.15, B: 1, C: 0.85 }[B.grade] : 1) * (B?.kind === 'mall' ? 1.25 : 1);
    const priceF = sh.price < 1 ? 1.25 : sh.price > 1 ? 0.72 : 1;
    const rateF = 0.55 + sh.rating * 0.15;
    const hoursF = Math.min(1, (sh.staff * 8 + worked) / 12);
    const cust = Math.round(biz.cust * loc * priceF * rateF * (sh.fr ? 1.25 : 1) * hoursF * Math.min(1, c.py / 20 + 0.4));
    const rev = cust * biz.spend * sh.price;
    const cost = rev * COGS[sh.type] + sh.staff * 10320 * 8 + Math.round((c.fee || 0) / 30) + 25000 + (sh.fr ? rev * 0.04 : 0);
    return { cust, rev: Math.round(rev), profit: Math.round(rev - cost - c.rent / 30) };
  }
  shopDay(c, day) {
    const S = this.S, sh = c.shop;
    const worked = sh.workedDay === day - 1 ? sh.workedHours || 0 : 0;
    const est = this.estimate(c, worked);
    const noise = 0.75 + Math.random() * 0.5;
    const rev = Math.round(est.rev * noise / 10) * 10;
    const profit = Math.round((est.profit + c.rent / 30) * noise - c.rent / 30 * 0) ;   // 월세는 따로 자동이체
    sh.days++;
    sh.totalProfit += profit;
    S.money += profit;
    if (worked > 0) sh.rating = Math.min(5, sh.rating + 0.08);
    if (sh.staff === 0 && !worked) sh.rating = Math.max(1, sh.rating - 0.05);
    // 손님 리뷰: 가격 · 직원 · 사장님이 직접 일했는지에 따라 별점이 달라져요 → 평판에 반영
    const nRev = est.cust > 0 ? 1 + Math.floor(Math.random() * 2) : 0;
    sh.reviews = sh.reviews || [];
    for (let i = 0; i < nRev; i++) {
      let st = 3.4 + (sh.price < 1 ? 0.7 : sh.price > 1 ? -0.9 : 0) + (worked > 0 ? 0.8 : 0) + (sh.staff >= 2 ? 0.3 : sh.staff === 0 ? -0.6 : 0) + (Math.random() - 0.5) * 1.6;
      st = Math.max(1, Math.min(5, Math.round(st)));
      const T = {
        5: ['사장님이 너무 친절해요! 단골 할게요 😊', '가성비 최고예요. 또 올게요', '분위기도 좋고 맛있어요 👍'],
        4: ['괜찮았어요. 다음에 또 들를게요', '깔끔하고 좋네요', '직원분들이 친절해요'],
        3: ['무난해요', '평범했어요', '나쁘지 않아요'],
        2: ['가격에 비해 아쉬워요', '오래 기다렸어요…', '조금 불친절했어요'],
        1: ['너무 비싸요 😞', '문이 닫혀 있어서 헛걸음했어요', '다시는 안 올 것 같아요'],
      }[st];
      sh.reviews.unshift({ day, st, text: T[Math.floor(Math.random() * T.length)], who: ['김**', '이**', '박**', '최**', '정**', '한**'][Math.floor(Math.random() * 6)] });
      sh.rating = Math.max(1, Math.min(5, sh.rating + (st - sh.rating) * 0.06));
    }
    if (sh.reviews.length > 12) sh.reviews.length = 12;
    sh.workedHours = 0;
    if (est.cust > 0 || profit !== 0) toast(`${TYPES[sh.type]?.icon || '🏪'} ${sh.name} 어제 정산 · 손님 ${Math.round(est.cust * noise)}명 · 매출 ${won(rev)} · ${profit >= 0 ? '이익' : '손해'} ${won(Math.abs(profit))}`, profit >= 0 ? 'good' : 'bad', 5000);
  }
  // 내 가게에서 직접 일하기 (카운터)
  myShopOf(bid, n, k) { return (this.S.contracts || []).find(c => c.shop && c.bid === bid && c.n === n && c.k === k); }
}

// ───────── 8단계: 경제 (관리비 · 공과금 · 예금 · 적금 · 주식) ─────────
import { toast, openSheet, closeSheet, bindActs, row, bigMsg } from './ui.js';
import { won } from './config.js';
import { seeded } from './geo.js';
import { seasonOf, tempAt } from './weather.js';
import * as ST from './state.js';

const BILL_DAYS = 30;
// 요금 (원)
const PRICE = { elec1: 120, elec2: 215, elecTier: 300, gas: 1000, water: 1200 };
const HOME_FEE = { oneroom: 50000, apt: 180000, pent: 600000 };
// 예금 · 적금 (게임 1년 = 28일)
const FIXED = [{ days: 7, rate: 0.028 }, { days: 14, rate: 0.032 }, { days: 28, rate: 0.036 }];
const SAVING = { rate: 0.045, weeks: [4, 8, 12], amounts: [50000, 100000, 300000, 500000] };
// 상장 회사 (가상)
export const STOCKS = [
  { id: 'hbe', name: '한빛전자', icon: '📱', p0: 72000, vol: 0.012, sector: '전자' },
  { id: 'pfood', name: '푸른식품', icon: '🍜', p0: 38000, vol: 0.007, sector: '식품' },
  { id: 'sky', name: '스카이항공', icon: '✈️', p0: 21000, vol: 0.016, sector: '항공' },
  { id: 'nxg', name: '넥스트게임즈', icon: '🎮', p0: 54000, vol: 0.022, sector: '게임' },
  { id: 'aurb', name: '오로라바이오', icon: '🧬', p0: 115000, vol: 0.03, sector: '바이오' },
  { id: 'core', name: '코어건설', icon: '🏗️', p0: 18500, vol: 0.011, sector: '건설' },
  { id: 'green', name: '그린에너지', icon: '⚡', p0: 46000, vol: 0.014, sector: '에너지' },
  { id: 'hbt', name: '한빛교통', icon: '🚌', p0: 9800, vol: 0.009, sector: '운송' },
];
const HEADLINES = {
  up: ['신제품 반응 폭발', '분기 실적 깜짝 흑자', '대형 수출 계약 체결', '기관 투자자 매수세', '신기술 특허 등록', '해외 진출 성공'],
  down: ['실적 쇼크', '리콜 사태', '경쟁사 공세에 점유율 하락', '공장 가동 중단', '대주주 지분 매각', '신제품 출시 연기'],
};
const fee = (v) => Math.max(100, Math.round(v * 0.001 / 10) * 10);
function gauss(R) { const u = Math.max(1e-6, R()), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); }
export function marketOpen(minutes) {
  const day = Math.floor(minutes / 1440) + 1, h = (minutes % 1440) / 60;
  return (day - 1) % 7 < 5 && h >= 9 && h < 15.5;
}

export class Economy {
  constructor(ctx) { this.c = ctx; }   // { S, audio, persist, flash, life(), homeKind(), livingContract(), interior() }
  get S() { return this.c.S; }
  day() { return ST.day(this.S); }
  ensure() {
    const S = this.S;
    S.util = S.util || { elec: 0, gas: 0, water: 0 };
    S.bank = S.bank || { products: [], bills: [], nextBill: Math.max(BILL_DAYS, Math.ceil(this.day() / BILL_DAYS) * BILL_DAYS) };
    if (!S.stocks) {
      S.stocks = { p: {}, hist: {}, hold: {}, hour: -1, drift: {} };
      for (const s of STOCKS) { S.stocks.p[s.id] = s.p0; S.stocks.hist[s.id] = [s.p0]; }
    }
    return S;
  }

  // ─ 사용량 (매 프레임, 게임 분 단위) ─
  tick(gm, { home, light, cooking, temp }) {
    if (gm <= 0) return;
    const u = this.ensure().util;
    u.elec += gm * 0.0015;                       // 냉장고 · 대기전력
    if (home) {
      if (light) u.elec += gm * 0.006;
      u.elec += gm * 0.002;                      // TV · 충전 등
      if (temp > 27) u.elec += gm * 0.02;        // 에어컨
      if (temp < 5) u.gas += gm * 0.004;         // 난방
      if (cooking) { u.gas += gm * 0.01; u.water += gm * 0.002; }
    }
  }
  homeFee() {
    const c = this.c.livingContract?.();
    if (c?.fee) return c.fee;
    return HOME_FEE[this.S.home] ?? 50000;
  }
  billCalc(u) {
    const e = Math.round(u.elec), g = Math.round(u.gas * 10) / 10, w = Math.round(u.water * 10) / 10;
    const ec = e <= PRICE.elecTier ? e * PRICE.elec1 : PRICE.elecTier * PRICE.elec1 + (e - PRICE.elecTier) * PRICE.elec2;
    const items = [
      { icon: '🏢', name: '관리비', amt: this.homeFee() },
      { icon: '💡', name: `전기 ${e}kWh${e > PRICE.elecTier ? ' (누진)' : ''}`, amt: Math.round(ec / 10) * 10 },
      { icon: '🔥', name: `가스 ${g}㎥`, amt: Math.round(g * PRICE.gas / 10) * 10 },
      { icon: '💧', name: `수도 ${w}㎥`, amt: Math.round(w * PRICE.water / 10) * 10 },
    ];
    return { items, total: items.reduce((a, b) => a + b.amt, 0) };
  }

  // ─ 하루마다 ─
  dailyCheck() {
    const S = this.ensure(), day = this.day();
    if (S.ecoDay === day) return;
    const prev = S.ecoDay ?? day - 1; S.ecoDay = day;
    for (let d = prev + 1; d <= day; d++) this.dayTick(d);
  }
  dayTick(day) {
    const S = this.S, u = S.util, T = tempAt((day - 1) * 1440 + 3 * 60);
    // 매일 기본 사용량 (씻기 · 밤새 냉난방)
    u.water += 0.12; u.elec += 0.8;
    if (T < 3) u.gas += 0.7; if (seasonOf(day).id === 'summer') u.elec += 2;
    // 적금 자동이체 · 만기
    for (const p of [...S.bank.products]) {
      if (p.kind === 'saving' && p.paid < p.weeks && day >= p.start + p.paid * 7) {
        if (S.money >= p.amount) { S.money -= p.amount; p.paid++; p.principal += p.amount; toast(`🏦 적금 ${p.paid}회차 ${won(p.amount)} 자동이체`, '', 2600); }
        else { p.missed = (p.missed || 0) + 1; p.paid++; toast('⚠️ 잔액 부족으로 적금 이번 회차를 못 냈어요', 'bad', 3200); }
      }
      if (day >= p.end) this.mature(p);
    }
    // 고지서
    if (S.bank.nextBill - day === 3) toast(`🧾 3일 뒤 관리비·공과금 자동이체 · 지금까지 약 ${won(this.billCalc(u).total)}`, '', 3600);
    if (day >= S.bank.nextBill) {
      S.bank.nextBill += BILL_DAYS;
      const b = this.billCalc(u);
      const prevUnpaid = S.bank.bills.filter(x => !x.paid);
      const late = prevUnpaid.reduce((a, x) => a + x.total, 0);
      const lateFee = Math.round(late * 0.05 / 10) * 10;
      const bill = { day, items: b.items, total: b.total, paid: false, usage: { ...u } };
      S.util = { elec: 0, gas: 0, water: 0 };
      S.bank.bills.push(bill);
      if (S.bank.bills.length > 12) S.bank.bills.shift();
      const due = b.total + late + lateFee;
      if (S.money >= due) {
        S.money -= due; bill.paid = true; for (const x of prevUnpaid) x.paid = true;
        toast(`🧾 이번 달 관리비·공과금 ${won(due)} 자동이체${late ? ` (밀린 요금 + 연체료 ${won(lateFee)} 포함)` : ''}`, '', 4200);
      } else {
        S.mood = ST.clamp(S.mood - 5);
        this.c.credit?.(-30);
        const n = prevUnpaid.length + 1;
        toast(`⚠️ 잔액 부족! 관리비·공과금 ${won(due)} 연체 (${n}달째)${n >= 2 ? ' · 단전·단수 예고장이 왔어요' : ''}`, 'bad', 5000);
      }
      this.c.flash?.(false);
    }
    // 주식 뉴스 (평일 아침)
    if ((day - 1) % 7 < 5) this.stockNews(day);
  }
  mature(p) {
    const S = this.S;
    S.bank.products = S.bank.products.filter(q => q !== p);
    let interest;
    if (p.kind === 'fixed') interest = Math.round(p.principal * p.rate * p.days / 28 / 10) * 10;
    else interest = Math.round(p.amount * (p.paid - (p.missed || 0)) * SAVING.rate * (p.weeks * 7 / 2) / 28 / 10) * 10;
    S.money += p.principal + interest; S.totalEarned = (S.totalEarned || 0) + interest;
    bigMsg('🏦 만기!', `${p.kind === 'fixed' ? '정기예금' : '적금'} ${won(p.principal)} + 이자 ${won(interest)}`, 3600);
    this.c.flash?.(true);
  }
  cancel(p) {
    const S = this.S, days = this.day() - p.start;
    const interest = Math.round(p.principal * 0.005 * Math.max(0, days) / 28 / 10) * 10;
    S.bank.products = S.bank.products.filter(q => q !== p);
    S.money += p.principal + interest;
    toast(`🏦 중도 해지 · ${won(p.principal)} + 이자 ${won(interest)} (중도해지 이율 0.5%)`, '', 3600);
    this.c.flash?.(true); this.c.persist();
  }

  // ─ 은행 화면 (휴대폰 앱 · 창구 공용) ─
  bankHtml(tab = 'home') {
    const S = this.ensure(), day = this.day();
    const tabs = [['home', '계좌'], ['save', '예금·적금'], ['bill', '고지서']].map(([k, n]) => `<button class="btn ${tab === k ? '' : 'gray'}" data-act="tab:${k}" style="flex:1">${n}</button>`).join('');
    let body = '';
    const prods = S.bank.products;
    const inProd = prods.reduce((a, p) => a + p.principal, 0);
    const stockVal = STOCKS.reduce((a, s) => a + (S.stocks.hold[s.id]?.n || 0) * S.stocks.p[s.id], 0);
    if (tab === 'home') {
      body = `<div class="ph-widget"><div style="font-size:13px;opacity:.8">보통예금 잔액 (카드·간편결제)</div><div class="big">${won(S.money)}</div><div style="font-size:13px;opacity:.8">💵 지갑 현금 ${won(S.cash || 0)} · 현금은 ATM에서 뽑아요</div></div>
        <div class="grid2"><div class="stat"><span>예금·적금</span><b>${won(inProd)}</b></div><div class="stat"><span>주식 평가액</span><b>${won(stockVal)}</b></div>
        <div class="stat"><span>총 자산</span><b>${won(S.money + (S.cash || 0) + inProd + stockVal)}</b></div><div class="stat"><span>신용점수</span><b>${S.credit ?? 750}점</b></div>
        <div class="stat"><span>지금까지 번 돈</span><b>${won(S.totalEarned || 0)}</b></div><div class="stat"><span>다음 고지서</span><b>${S.bank.nextBill - day}일 뒤</b></div></div>`;
    } else if (tab === 'save') {
      body = `<p class="note">게임 1년 = 28일 · 이자는 만기 때 한꺼번에 들어와요</p>` +
        FIXED.map((f, i) => row({ icon: '🔒', title: `정기예금 ${f.days}일`, desc: `연 ${(f.rate * 100).toFixed(1)}% · 100만 원 넣으면 이자 약 ${won(1000000 * f.rate * f.days / 28)}`, btn: '가입', action: 'fx:' + i })).join('') +
        SAVING.weeks.map(w => row({ icon: '🐷', title: `적금 ${w}주`, desc: `연 ${(SAVING.rate * 100).toFixed(1)}% · 7일마다 자동이체`, btn: '가입', action: 'sv:' + w })).join('') +
        (prods.length ? `<div class="ph-sub" style="margin:10px 0 6px;font-weight:700">내 상품</div>` + prods.map((p, i) => row({ icon: p.kind === 'fixed' ? '🔒' : '🐷', title: p.kind === 'fixed' ? `정기예금 ${won(p.principal)}` : `적금 ${won(p.amount)} × ${p.weeks}주`, desc: `${p.kind === 'saving' ? `${p.paid}/${p.weeks}회 · 모은 돈 ${won(p.principal)} · ` : ''}만기 ${Math.max(0, p.end - day)}일 뒤`, btn: '해지', btnClass: 'gray', action: 'cx:' + i })).join('') : '');
    } else {
      const u = S.util, b = this.billCalc(u);
      body = `<div class="ph-widget"><b>이번 달 예상 (${BILL_DAYS - (S.bank.nextBill - day)}일째)</b><div class="big">${won(b.total)}</div>${b.items.map(i => `<div style="font-size:13px;opacity:.85">${i.icon} ${i.name} · ${won(i.amt)}</div>`).join('')}</div>
        <p class="note">💡 불 끄기, 에어컨·난방 줄이기로 아낄 수 있어요 · 매달 자동이체</p>` +
        [...S.bank.bills].reverse().map(x => row({ icon: x.paid ? '✅' : '⚠️', title: `${x.day}일차 고지서 · ${won(x.total)}`, desc: x.items.map(i => `${i.icon}${won(i.amt)}`).join(' '), btn: x.paid ? '' : '납부', action: 'pay:' + S.bank.bills.indexOf(x) })).join('');
    }
    return `<div style="display:flex;gap:6px;margin-bottom:10px">${tabs}</div>${body}`;
  }
  bindBank(el, rerender) {
    const S = this.S;
    bindActs(el, {
      tab: (k) => rerender(k),
      fx: (i) => this.c.closePhone?.() || this.amountPick('정기예금', (amt) => { const f = FIXED[+i]; S.money -= amt; S.bank.products.push({ kind: 'fixed', principal: amt, rate: f.rate, days: f.days, start: this.day(), end: this.day() + f.days }); toast(`🔒 정기예금 ${won(amt)} 가입 · ${f.days}일 뒤 만기`, 'good'); this.c.flash?.(false); this.c.persist(); rerender('save'); }),
      sv: (w) => this.c.closePhone?.() || this.savingPick(+w, (amt) => { S.money -= amt; S.bank.products.push({ kind: 'saving', amount: amt, weeks: +w, paid: 1, principal: amt, start: this.day(), end: this.day() + (+w) * 7 }); toast(`🐷 적금 가입 · 첫 회 ${won(amt)} 넣었어요`, 'good'); this.c.flash?.(false); this.c.persist(); rerender('save'); }),
      cx: (i) => { this.cancel(S.bank.products[+i]); rerender('save'); },
      pay: (i) => { const x = S.bank.bills[+i]; if (!x || x.paid) return; if (S.money < x.total) { toast('잔액이 부족해요', 'bad'); return; } S.money -= x.total; x.paid = true; toast('🧾 밀린 고지서를 냈어요', 'good'); this.c.flash?.(false); this.c.persist(); rerender('bill'); },
    });
  }
  amountPick(title, done) {
    const S = this.S, opts = [100000, 500000, 1000000, 5000000, 10000000, 50000000].filter(v => v <= S.money);
    if (!opts.length) { toast('💳 잔액이 10만 원 이상 있어야 해요', 'bad'); return; }
    openSheet({ icon: '🔒', title, sub: `잔액 ${won(S.money)} · 얼마를 넣을까요?`, html: opts.map(v => row({ icon: '💰', title: won(v), btn: '넣기', action: 'a:' + v })).join(''), bind: (b) => bindActs(b, { a: (v) => { closeSheet(); done(+v); } }) });
  }
  savingPick(weeks, done) {
    const S = this.S;
    openSheet({ icon: '🐷', title: `적금 ${weeks}주`, sub: '매주 얼마씩 넣을까요?', html: SAVING.amounts.map(v => row({ icon: '🐷', title: `매주 ${won(v)}`, desc: `만기 원금 ${won(v * weeks)}`, btn: '가입', action: 'a:' + v, disabled: S.money < v })).join(''), bind: (b) => bindActs(b, { a: (v) => { closeSheet(); done(+v); } }) });
  }
  // 은행 창구
  counter(atm) {
    const open = (tab = 'home') => openSheet({ icon: '🏦', title: '한빛은행 창구', sub: '"어떤 업무 보러 오셨어요?"', html: this.bankHtml(tab) + `<button class="btn wide gray" data-act="atm" style="margin-top:10px">🏧 현금 입금·출금 (ATM)</button>`, bind: (b) => { this.bindBank(b, (t) => open(t)); bindActs(b, { atm: () => { closeSheet(); atm?.(); } }); } });
    open();
  }

  // ─ 주식 ─
  stockNews(day) {
    const S = this.S, R = seeded(day * 911 + 5);
    if (S.stocks.newsDay === day) return; S.stocks.newsDay = day;
    const n = 1 + (R() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const s = STOCKS[Math.floor(R() * STOCKS.length)], up = R() < 0.55;
      const h = (up ? HEADLINES.up : HEADLINES.down)[Math.floor(R() * 6)];
      S.stocks.drift[s.id] = { d: (up ? 1 : -1) * (0.004 + R() * 0.006), until: (day - 1) * 1440 + 15.5 * 60 + (R() < 0.5 ? 1440 : 0) };
      this.c.life?.()?.news(up ? '📈' : '📉', `[증시] ${s.name} ${h}`, `${s.sector} 업종 · 투자는 신중하게!`, 'stock');
    }
  }
  // 시간이 흐르면 장중 가격 변동
  updateStocks() {
    const S = this.ensure(), st = S.stocks, hour = Math.floor(S.minutes / 30);   // 30분 단위
    if (st.hour < 0) { st.hour = hour; return; }
    if (hour === st.hour) return;
    const from = Math.max(st.hour + 1, hour - 400);
    for (let t = from; t <= hour; t++) {
      const m = t * 30; if (!marketOpen(m)) continue;
      const day = Math.floor(m / 1440) + 1, sea = seasonOf(day).id;
      STOCKS.forEach((s, i) => {
        const R = seeded(t * 31 + i * 977 + 3);
        let drift = 0.00015;
        const dr = st.drift[s.id]; if (dr && m < dr.until) drift += dr.d;
        if (s.id === 'sky' && sea === 'summer') drift += 0.0008;
        if (s.id === 'green' && (sea === 'summer' || sea === 'winter')) drift += 0.0006;
        if (s.id === 'hbt' && S.mayor?.pledge === 'fare') drift -= 0.0004;
        if (s.id === 'core' && S.mayor?.pledge === 'rent') drift += 0.0004;
        const p = st.p[s.id] * Math.exp(drift + s.vol * gauss(R) * 0.6);
        st.p[s.id] = Math.max(500, Math.round(p / 50) * 50);
        const h = st.hist[s.id]; h.push(st.p[s.id]); if (h.length > 60) h.shift();
      });
    }
    st.hour = hour;
  }
  spark(id) {
    const h = this.S.stocks.hist[id]; if (h.length < 2) return '';
    const mn = Math.min(...h), mx = Math.max(...h), W = 90, H = 28;
    const pts = h.map((v, i) => `${(i / (h.length - 1) * W).toFixed(1)},${(H - (v - mn) / ((mx - mn) || 1) * H).toFixed(1)}`).join(' ');
    const up = h[h.length - 1] >= h[0];
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="flex:0 0 auto"><polyline points="${pts}" fill="none" stroke="${up ? '#ff5a5a' : '#4a8cff'}" stroke-width="2"/></svg>`;
  }
  stockHtml(sel = null) {
    const S = this.ensure(), st = S.stocks, open = marketOpen(S.minutes);
    this.updateStocks();
    let total = 0, cost = 0;
    for (const s of STOCKS) { const h = st.hold[s.id]; if (h?.n) { total += h.n * st.p[s.id]; cost += h.n * h.avg; } }
    const pl = total - cost;
    const list = STOCKS.map(s => {
      const h = st.hist[s.id], p = st.p[s.id], base = h[0], ch = (p - base) / base * 100, hd = st.hold[s.id];
      return `<div class="row" data-act="sel:${s.id}" style="cursor:pointer;${sel === s.id ? 'outline:2px solid #46d1ff' : ''}"><div class="ic">${s.icon}</div><div class="info"><b>${s.name}</b><span>${s.sector}${hd?.n ? ` · 보유 ${hd.n}주` : ''}</span></div>${this.spark(s.id)}<div style="text-align:right;min-width:78px"><b>${p.toLocaleString()}</b><br><small style="color:${ch >= 0 ? '#ff6b6b' : '#5c9bff'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}%</small></div></div>`;
    }).join('');
    let trade = '';
    if (sel) {
      const s = STOCKS.find(q => q.id === sel), p = st.p[sel], hd = st.hold[sel] || { n: 0, avg: 0 };
      const maxBuy = Math.floor(S.money / (p * 1.001));
      trade = `<div class="ph-widget" style="margin-top:10px"><b>${s.icon} ${s.name} · ${won(p)}</b><div style="font-size:13px;opacity:.85;margin:4px 0 8px">보유 ${hd.n}주${hd.n ? ` · 평균 ${won(hd.avg)} · ${p >= hd.avg ? '+' : ''}${won((p - hd.avg) * hd.n)}` : ''} · 수수료 0.1%</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${[1, 10, 100].map(n => `<button class="btn red" data-act="buy:${n}" ${!open || maxBuy < n ? 'disabled' : ''}>${n}주 사기</button>`).join('')}<button class="btn red" data-act="buy:${maxBuy}" ${!open || maxBuy < 1 ? 'disabled' : ''}>최대</button>
        ${[1, 10, 100].map(n => `<button class="btn" data-act="sell:${n}" ${!open || hd.n < n ? 'disabled' : ''} style="background:#2f6fd6">${n}주 팔기</button>`).join('')}<button class="btn" data-act="sell:${hd.n}" ${!open || !hd.n ? 'disabled' : ''} style="background:#2f6fd6">전부</button></div></div>`;
    }
    return `<div class="ph-title">📈 한빛증권</div>
      <div class="ph-widget"><div style="font-size:13px;opacity:.8">${open ? '🟢 장 열림 (평일 09:00~15:30)' : '🔴 장 마감 · 평일 09:00~15:30에 거래해요'}</div><div class="big">${won(total)}</div><div style="font-size:13px;color:${pl >= 0 ? '#ff8a8a' : '#8ab4ff'}">평가손익 ${pl >= 0 ? '+' : ''}${won(pl)}${cost ? ` (${(pl / cost * 100).toFixed(1)}%)` : ''}</div></div>
      <p class="note" style="color:#ccc">회사를 누르면 사고팔 수 있어요 · 뉴스에 따라 오르내려요</p>${list}${trade}`;
  }
  bindStock(el, rerender, sel) {
    const S = this.S, st = S.stocks;
    bindActs(el, {
      sel: (id) => rerender(id),
      buy: (n) => {
        n = +n; const p = st.p[sel], amt = p * n, f = fee(amt);
        if (!marketOpen(S.minutes) || n < 1 || S.money < amt + f) return;
        S.money -= amt + f;
        const h = st.hold[sel] || { n: 0, avg: 0 };
        h.avg = Math.round((h.avg * h.n + amt) / (h.n + n)); h.n += n; st.hold[sel] = h;
        this.c.audio.play?.('pay'); toast(`📈 ${STOCKS.find(q => q.id === sel).name} ${n}주 매수 · ${won(amt)} (수수료 ${won(f)})`, 'good');
        this.c.flash?.(false); this.c.persist(); rerender(sel);
      },
      sell: (n) => {
        n = +n; const h = st.hold[sel]; if (!h || n < 1 || n > h.n || !marketOpen(S.minutes)) return;
        const p = st.p[sel], amt = p * n, f = fee(amt), gain = (p - h.avg) * n;
        S.money += amt - f; h.n -= n; if (!h.n) delete st.hold[sel];
        if (gain > 0) S.totalEarned = (S.totalEarned || 0) + gain;
        S.stockGain = (S.stockGain || 0) + gain;
        this.c.audio.coin?.(); toast(`📉 ${n}주 매도 · ${won(amt - f)} 입금 (${gain >= 0 ? '수익' : '손실'} ${won(Math.abs(gain))})`, gain >= 0 ? 'good' : 'bad', 3200);
        this.c.flash?.(gain >= 0); this.c.persist(); rerender(sel);
      },
    });
  }
}

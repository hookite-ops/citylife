import { TYPES } from './tenants.js';
import { MENUS, GOODS, SERVICES, ORDER_STYLE, SIDES, SIDE_SETS, CASH_ONLY, menuTag } from './shopdata.js';
import { $, toast, openSheet, closeSheet, sheetOpen, bindActs, row, fade, wait, bigMsg } from './ui.js';
import { isOpenType, hoursLabel } from './bldggame.js';
import { won } from './config.js';
import { seeded } from './geo.js';
import * as ST from './state.js';

// ───────── 4단계: 가게 이용 (주문 · 결제 · 먹기 · 서비스) ─────────
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const FOOD_FAMS = new Set(['bbq', 'hansik', 'chinese', 'japanese', 'chicken', 'pizza', 'burger', 'cafe', 'bakery', 'bunsik', 'dessert']);
const GOODS_OF = { pharmacy: 'pharmacy', flower: 'flower', grocer: 'fruit', butcher: 'butcher', deli: 'deli', bookstore: 'bookstore', optician: 'optician', phone: 'phone', petshop: 'petshop', mart: 'mart' };
export const menuId = (type, id) => `m:${type}:${id}`;
export function menuFood(id) {
  const [k, type, mid] = id.split(':');
  if (k === 'm') { const m = (MENUS[type] || []).find(q => q.id === mid); if (m) return { ...m, tag: menuTag(type, m) }; }
  if (k === 's') { const sd = SIDES[type]; if (sd) return { ...sd, price: 0 }; }
  if (k === 'g') { const g = (GOODS[type] || []).find(q => q.id === mid); if (g?.food) return { name: g.name, icon: g.icon, ...g.food, tag: type === 'fruit' ? 'dessert' : 'veg' }; }
  return null;
}

export class ShopGame {
  constructor(ctx) {
    this.c = ctx;   // { S, audio, player, human, checkout, payCash, persist, passTime, eatMeal, foodInfo, seat(spot|null), restyle, updateHUD, missions, setBusy }
    this.sess = null; this.seatedAt = null;
  }
  get S() { return this.c.S; }
  hour() { return ST.hour(this.S) % 24; }
  wd() { return (ST.day(this.S) - 1) % 7; }
  open(t) { return isOpenType(t.type, this.hour(), this.wd()); }
  key(unit) { return unit; }
  session(z) {
    if (!this.sess || this.sess.unit !== z.unit) {
      if (this.sess && this.sess.owed > 0) return this.sess;  // 계산 안 한 곳이 있으면 그대로
      const t = z.tenant, R = seeded(Math.floor(this.S.minutes / 1440) * 7 + (z.unit.k || 0) * 13 + (t.slot || 0));
      this.sess = { unit: z.unit, t, type: t.type, fam: TYPES[t.type]?.fam, stage: 'none', bill: [], owed: 0, basket: {}, items: [], cashOnly: R() < (CASH_ONLY[t.type] || 0) };
    }
    return this.sess;
  }
  cashNote(s) { return s.cashOnly ? '<p class="note" style="color:var(--warn)">💵 이 가게는 현금만 받아요</p>' : ''; }

  // ───────── 존 → 버튼 ─────────
  action(z, bldg) {
    const t = z.tenant;
    if (!t || t.vacant) {
      if (z.kind === 'vacant' || z.kind === 'inshop') return { label: '🏷️ 빈 가게 · 임대 문의', fn: () => this.c.vacantInfo ? this.c.vacantInfo(z.unit, bldg) : toast('🏷️ 비어 있는 가게예요 · 부동산에 문의하세요') };
      return null;
    }
    const s = this.session(z);
    this.bldg = bldg;
    if (z.kind === 'jobpost') return this.c.jobs?.postAction(z, s, bldg) || null;
    // 앉아 있는 동안은 자리 메뉴
    if (this.seatedAt) return this.seatAction(s);
    if (!this.open(t)) {
      if (z.kind === 'inshop' || z.kind === 'counter' || z.kind === 'reception') return { label: `🔒 영업 준비 중 · ${hoursLabel(t.type)}`, fn: () => toast(`🔒 ${t.name}: 영업시간이 아니에요 (${hoursLabel(t.type)})`, 'bad') };
      return null;
    }
    const fam = s.fam, style = ORDER_STYLE[fam];
    switch (z.kind) {
      case 'counter': case 'reception': case 'teller':
        return this.counterAction(z, s, style);
      case 'pickup': return this.pickupAction(z, s);
      case 'kiosk': return { label: '🖥️ 키오스크로 주문하기', fn: () => this.menuSheet(s, { kiosk: true }), green: true };
      case 'seat': return this.seatZone(z, s, style);
      case 'tray': return s.tray ? { label: '🍽 쟁반 들고 있어요 · 빵을 담아요', fn: () => {} } : { label: '🍽 쟁반 · 집게 들기', fn: () => { s.tray = true; this.c.audio.play?.('pick'); toast('🍽 쟁반이랑 집게를 들었어요 · 진열대에서 빵을 담아요'); }, green: true };
      case 'shelf':
        if (z.bread) return { label: '🥐 빵 담기', fn: () => s.tray ? this.breadSheet(s) : toast('🍽 입구 옆에서 쟁반과 집게부터 들어요', 'bad'), green: !!s.tray };
        return { label: `🛒 둘러보기 · 장바구니 ${this.count(s)}개`, fn: () => this.goodsSheet(s, z.goods || GOODS_OF[fam]) };
      case 'krroom': return this.karaokeRoom(z, s);
      case 'pcseat': return this.pcSeat(z, s);
      case 'desk': return this.studyDesk(z, s);
      case 'class': if (s.fam === 'academy') { const ca = this.c.career?.classAction(s); if (ca) return ca; } return this.serviceSpot(z, s);
      case 'chair': case 'service': case 'exam': case 'equip': case 'play': return this.serviceSpot(z, s);
      case 'atm': return { label: '🏧 은행 ATM (영업시간 수수료 없음)', fn: () => this.c.atm?.(0) };
      case 'ticket': return { label: '🎫 번호표 뽑기', fn: () => { s.ticket = 100 + Math.floor(Math.random() * 80); s.wait = 1 + Math.floor(Math.random() * 4); toast(`🎫 ${s.ticket}번 · 앞에 ${s.wait}명 대기 중`); } };
      case 'water': return { label: '💧 물 마시기 (셀프)', fn: () => { this.S.mood = ST.clamp(this.S.mood + 1); toast('💧 시원한 물 한 잔'); } };
      case 'wait': return null;
      case 'pets': return { label: '🐶 강아지 · 고양이 구경', fn: () => this.c.petShop ? this.c.petShop(s) : toast(pick(['🐶 꼬리를 흔들어요!', '🐱 하품을 해요', '🐶 유리창에 코를 대요'])) };
      case 'snack': return { label: '☕ 커피 머신 (무료)', fn: () => { this.S.energy = ST.clamp(this.S.energy + 6); toast('☕ 무료 커피 한 잔 · 에너지 +6'); } };
      case 'inshop': return null;
    }
    return null;
  }
  count(s) { return Object.values(s.basket).reduce((a, b) => a + b, 0); }

  // ───────── 카운터 ─────────
  counterAction(z, s, style) {
    const fam = s.fam;
    const ja = this.c.jobs?.counterAction(z, s, this.bldg); if (ja) return ja;
    if (this.c.jobs?.onShift) return { label: '🧑‍💼 다른 가게에서 근무 중이에요', fn: () => {} };
    if (s.owed > 0) return { label: `🧾 계산하기 · ${won(s.owed)}`, fn: () => this.payBill(s), green: true };
    if (s.stage === 'ready' && (style === 'counter' || style === 'kiosk')) return this.pickupAction(z, s);
    if (style === 'table') return { label: '🙋 직원: "편한 자리에 앉으세요~"', fn: () => toast('🪑 빈 테이블에 앉으면 주문을 받아요') };
    if (style === 'counter' || style === 'kiosk') {
      if (s.stage === 'waiting') return { label: `⏳ 주문번호 ${s.num} · 조리 중`, fn: () => toast(`⏳ 조금만 기다려 주세요 · ${Math.max(1, Math.ceil(s.readyAt - this.S.minutes))}분`) };
      return { label: style === 'kiosk' ? '💬 카운터에서 주문 (현금 가능)' : '📋 주문하기', fn: () => this.menuSheet(s, {}), green: true };
    }
    if (style === 'tray') {
      if (this.count(s)) return { label: `🧾 계산하기 · ${won(this.basketTotal(s, 'bakery'))}`, fn: () => this.payBread(s), green: true };
      return { label: '🥐 쟁반에 빵을 담아 오세요', fn: () => toast('🍽 입구 옆 쟁반을 들고 빵을 담아요') };
    }
    const gk = GOODS_OF[fam];
    if (gk && this.count(s)) return { label: `🧾 계산하기 · ${this.count(s)}개 ${won(this.basketTotal(s, gk))}`, fn: () => this.payGoods(s, gk), green: true };
    if (gk && fam === 'pharmacy' && this.S.rx) return { label: '💊 처방전 내기', fn: () => this.fillRx(s), green: true };
    if (gk) return { label: `🛒 진열대에서 골라 오세요`, fn: () => this.goodsSheet(s, gk) };
    if (SERVICES[s.type] || SERVICES[fam]) return { label: `📋 ${fam === 'clinic' || fam === 'dental' || fam === 'vet' ? '접수하기' : '이용 안내 · 결제'}`, fn: () => this.serviceSheet(s), green: true };
    if (fam === 'bank') return { label: '🏦 은행 업무 보기', fn: () => this.c.bank ? this.c.bank(s) : this.bankBasic(s), green: true };
    if (fam === 'realty') return { label: '🏘️ 매물 상담', fn: () => this.c.realty ? this.c.realty(s) : toast('🏘️ "요즘 전세가 귀해요~"'), green: true };
    if (fam === 'office') return { label: '🗂️ 상담 문의', fn: () => toast(pick(['🗂️ "예약하고 오셔야 해요~"', '🗂️ "명함 드릴게요, 연락 주세요"', '🗂️ "지금 상담 중이라 잠시만요"'])) };
    return null;
  }
  pickupAction(z, s) {
    if (s.stage === 'waiting') return { label: `⏳ ${s.bell ? '📳 진동벨' : '주문번호'} ${s.num} · 기다리는 중`, fn: () => toast(`⏳ 조금만 기다려 주세요 · 약 ${Math.max(1, Math.ceil(s.readyAt - this.S.minutes))}분`) };
    if (s.stage !== 'ready') return null;
    return {
      label: s.bell ? `📳 진동벨 반납하고 받기` : `🍽 ${s.num}번 음식 받기`, green: true,
      fn: () => {
        this.c.audio.play?.('pick');
        if (s.takeout) {
          for (const it of s.items) this.S.inventory.food[menuId(s.type, it.id)] = (this.S.inventory.food[menuId(s.type, it.id)] || 0) + it.n;
          toast(`🛍️ 포장 완료! 가방에 넣었어요 (${s.items.map(i => i.icon).join('')})`, 'good');
          this.reset(s);
        } else { s.stage = 'have'; toast('🍽 받았어요 · 빈 자리에 앉아서 먹어요', 'good'); }
      },
    };
  }
  reset(s) { s.stage = 'none'; s.items = []; s.bell = false; s.num = null; s.takeout = false; s.tray = false; s.basket = {}; s.grilled = false; }

  // ───────── 자리 ─────────
  seatZone(z, s, style) {
    if (style === 'table') {
      if (s.stage === 'none' || s.stage === 'done') return { label: '🪑 자리에 앉기', fn: () => this.sit(z, s, 'table'), green: true };
      return { label: '🪑 내 자리로 돌아가 앉기', fn: () => this.sit(z, s, 'table') };
    }
    if (s.stage === 'have') return { label: '🪑 앉아서 먹기', fn: () => this.sit(z, s, 'eat'), green: true };
    if (style === 'tray' && s.paidBread) return { label: '🪑 앉아서 먹기', fn: () => this.sit(z, s, 'eat'), green: true };
    return { label: '🪑 잠깐 앉아 쉬기', fn: () => this.sit(z, s, 'rest') };
  }
  sit(z, s, why) {
    const spot = this.c.nearestSeat?.(z) || null;
    this.seatedAt = { z, why, spot };
    this.c.seat?.(spot);
    if (why === 'table' && s.stage === 'none') {
      s.stage = 'seated'; s.table = z.table;
      const fast = Math.random() < 0.6;
      setTimeout(() => { if (this.sess === s && s.stage === 'seated' && !sheetOpen()) { toast(fast ? '🙋 직원: "주문하시겠어요?"' : '🙋 직원: "물이랑 메뉴판 드릴게요~"'); this.menuSheet(s, { table: true }); } }, fast ? 1200 : 2600);
    }
    if (why === 'eat') this.eatNow(s);
    if (why === 'rest') toast('🪑 잠깐 앉았어요');
  }
  stand() { this.seatedAt = null; this.c.seat?.(null); }
  // 건물을 나가거나 층을 옮길 때
  onExitBuilding() { if (this.seatedAt) this.stand(); if (this.sess && this.sess.owed <= 0) this.sess = null; }
  seatAction(s) {
    const why = this.seatedAt.why;
    if (why === 'rest' || s.stage === 'done' || s.stage === 'none') return { label: '🚶 일어나기', fn: () => this.stand() };
    switch (s.stage) {
      case 'seated': return { label: '📋 주문하기', fn: () => this.menuSheet(s, { table: true }), green: true };
      case 'ordered': {
        const left = Math.max(0, Math.ceil(s.readyAt - this.S.minutes));
        return { label: `⏳ 음식 준비 중… 약 ${left}분`, fn: () => toast(pick(['🍳 주방에서 지글지글 소리가 나요', '⏳ 조금만 기다리면 나와요', '📱 휴대폰을 보며 기다려요'])) };
      }
      case 'served':
        if (s.fam === 'bbq' && !s.grilled) return { label: '🔥 고기 굽기', fn: () => this.grill(s), green: true };
        return { label: '🍽 먹기', fn: () => this.eatNow(s), green: true };
      case 'ate': return {
        label: s.owed > 0 ? `🧾 다 먹었어요 · ${won(s.owed)}` : '🚶 일어나기', green: true,
        fn: () => openSheet({ icon: '🍽', title: '다 먹었어요', sub: s.owed > 0 ? `계산할 금액 ${won(s.owed)}` : '', html: row({ icon: '📋', title: '추가 주문', btn: '메뉴판', action: 'more' }) + row({ icon: '🚶', title: '일어나기', desc: s.owed > 0 ? '나가기 전에 카운터에서 계산해요' : '', btn: '일어나기', action: 'up' }),
          bind: (b) => bindActs(b, { more: () => this.menuSheet(s, { table: true }), up: () => { closeSheet(); this.stand(); if (s.owed > 0) toast('🧾 카운터에서 계산해요'); } }) }),
      };
      case 'have': return { label: '🍽 먹기', fn: () => this.eatNow(s), green: true };
    }
    return { label: '🚶 일어나기', fn: () => this.stand() };
  }

  // ───────── 메뉴판 · 주문 ─────────
  menuSheet(s, o = {}) {
    const menu = MENUS[s.type] || [];
    const cart = {};
    let place = o.table ? 'in' : null;
    const total = () => Object.entries(cart).reduce((a, [id, n]) => a + menu.find(m => m.id === id).price * n, 0);
    const render = () => {
      const note = o.kiosk ? '<p class="note">🖥️ 키오스크는 카드·간편결제만 돼요 · 현금은 카운터에서</p>' : '';
      return note + this.cashNote(s) + menu.map(m => row({ icon: m.icon, title: m.name, desc: `${m.min ? `${m.min}인분부터 · ` : ''}배고픔 +${m.hunger}${m.energy ? ` · 에너지 +${m.energy}` : ''}${m.adult ? ' · 🔞' : ''}`, price: won(m.price), extra: cart[m.id] ? `<button class="btn gray" data-act="minus:${m.id}">−</button><b style="min-width:22px;text-align:center">${cart[m.id]}</b>` : '', btn: '+', action: 'add:' + m.id })).join('') +
        (o.table ? '' : `<div class="tabs" style="margin-top:8px"><button data-act="pl:in" class="${place === 'in' ? 'on' : ''}">🍽 매장에서 먹기</button><button data-act="pl:out" class="${place === 'out' ? 'on' : ''}">🛍️ 포장</button></div>`) +
        `<button class="btn wide green" data-act="go" ${total() && (place || o.table) ? '' : 'disabled'}>${o.table ? '주문하기' : '결제하기'} · ${won(total())}</button>`;
    };
    const open = () => openSheet({
      icon: o.kiosk ? '🖥️' : '📋', title: `${s.t.name} 메뉴`, sub: o.table ? '주문하면 자리로 가져다 드려요 · 계산은 나갈 때' : o.kiosk ? '터치해서 고르세요' : '선불이에요',
      html: render(),
      bind: (b) => bindActs(b, {
        add: (id) => { const m = menu.find(q => q.id === id); cart[id] = (cart[id] || 0) + (cart[id] ? 1 : (m.min || 1)); this.c.audio.play?.('pick'); open(); },
        minus: (id) => { const m = menu.find(q => q.id === id); cart[id] -= 1; if (cart[id] < (m.min || 1)) delete cart[id]; open(); },
        pl: (p) => { place = p; open(); },
        go: () => {
          const items = Object.entries(cart).map(([id, n]) => ({ ...menu.find(m => m.id === id), n }));
          const tot = total();
          if (o.table) {
            closeSheet();
            s.items = [...(s.stage === 'ate' ? [] : s.items), ...items];
            s.owed += tot;
            s.stage = 'ordered';
            s.readyAt = this.S.minutes + (s.fam === 'bbq' ? 4 : 8 + Math.random() * 6);
            this.c.audio.play?.('pick');
            toast(`📝 주문했어요 · ${items.map(i => `${i.icon}${i.n > 1 ? '×' + i.n : ''}`).join(' ')}`, 'good');
            return;
          }
          this.c.checkout(tot, { icon: o.kiosk ? '🖥️' : '🧾', title: o.kiosk ? '키오스크 결제' : '계산하기', sub: `${s.t.name} · ${place === 'out' ? '포장' : '매장'}`, cardOnly: !!o.kiosk, cashOnly: !o.kiosk && s.cashOnly }, () => {
            s.items = items; s.takeout = place === 'out';
            s.num = 10 + Math.floor(Math.random() * 89);
            s.bell = s.fam === 'cafe' || s.fam === 'dessert';
            s.stage = 'waiting';
            s.readyAt = this.S.minutes + (s.fam === 'cafe' ? 3 + Math.random() * 3 : s.fam === 'burger' ? 3 + Math.random() * 2 : 6 + Math.random() * 6);
            this.c.missions?.event?.('shop');
            toast(s.bell ? `📳 진동벨을 받았어요 (${s.num}번) · 울리면 받으러 가요` : `🧾 주문번호 ${s.num}번 · 부르면 받으러 가요`, 'good', 3200);
          });
        },
      }),
    });
    open();
  }
  // 계산 (후불)
  payBill(s) {
    const lines = s.items.map(i => row({ icon: i.icon, title: `${i.name} ×${i.n}`, price: won(i.price * i.n) })).join('');
    this.c.checkout(s.owed, { icon: '🧾', title: `${s.t.name} 계산`, sub: '직원: "맛있게 드셨어요?"', lines: lines + this.cashNote(s), cashOnly: s.cashOnly }, () => {
      s.owed = 0; this.reset(s); s.stage = 'done';
      this.c.missions?.event?.('shop');
      toast('😊 "감사합니다~ 또 오세요!"', 'good');
    });
  }

  // ───────── 음식 나오기 · 먹기 ─────────
  update(dt) {
    const s = this.sess; if (!s) return;
    if ((s.stage === 'ordered' || s.stage === 'waiting') && this.S.minutes >= s.readyAt) {
      if (s.stage === 'ordered') {
        s.stage = 'served';
        this.c.audio.play?.('pick');
        toast(s.fam === 'bbq' ? '🥩 "고기 나왔습니다~ 불 올려 드릴게요!"' : `🍽 "${s.items[0]?.name || '음식'} 나왔습니다~"`, 'good', 3000);
        this.c.tableFood?.(s);
      } else {
        s.stage = 'ready';
        this.c.audio.play?.('ding');
        if (s.bell) { try { navigator.vibrate?.([220, 120, 220, 120, 220]); } catch (e) { } toast(`📳📳 진동벨이 울려요! (${s.num}번) · 픽업대로 가요`, 'good', 4200); }
        else toast(`🔔 "${s.num}번 손님~ 음식 나왔습니다!"`, 'good', 4000);
      }
    }
  }
  async eatNow(s) {
    const S = this.S, inv = S.inventory.food;
    const ids = [];
    for (const it of s.items) { const id = menuId(s.type, it.id); inv[id] = (inv[id] || 0) + it.n; for (let k = 0; k < it.n; k++) ids.push(id); }
    // 반찬
    for (const sd of SIDE_SETS[s.fam] || []) { const id = 's:' + sd; inv[id] = (inv[id] || 0) + 1; ids.push(id); }
    const uniq = [...new Set(ids)];
    s.items = [];
    const r = await this.c.eatMeal(uniq, { place: `${s.t.name}`, minutes: 15 + uniq.length * 3, moodBonus: 3 });
    // 남긴 반찬 정리
    for (const id of uniq) if (id.startsWith('s:')) delete inv[id];
    s.stage = s.owed > 0 ? 'ate' : 'done';
    if (s.stage === 'done') this.stand();
    if (r?.bites) this.c.missions?.event?.('eat_out');
  }

  // ───────── 고깃집: 고기 굽기 미니게임 ─────────
  grill(s) {
    const meats = s.items.filter(i => i.grill);
    const n = Math.min(8, Math.max(2, meats.reduce((a, i) => a + i.n * 2, 0)));
    const mg = $('mg'); mg.classList.remove('hidden', 'soft');
    const pieces = Array.from({ length: n }, (_, i) => ({ i, side: 0, t: [0, 0], burnt: false, done: false, icon: meats[i % meats.length]?.icon || '🥓' }));
    mg.innerHTML = `<div class="mg-box"><div class="mg-top"><span>🔥 ${s.t.name} · 고기 굽기</span><span class="t" id="gScore"></span></div>
      <div id="grill" style="position:relative;height:230px;border-radius:50%;background:radial-gradient(circle,#3a3a3a 0 40%,#222 41% 60%,#555 61% 63%,#2a2a2a 64%);display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:30px 40px"></div>
      <p class="note" id="gMsg" style="text-align:center">노릇노릇해지면 눌러서 뒤집어요 · 양쪽 다 익으면 가위로 잘라요</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn gray" id="gAuto">🙋 직원에게 구워 달라기</button><button class="btn green" id="gDone" disabled>✂️ 잘라서 먹기</button></div></div>`;
    const grillEl = $('grill');
    const els = pieces.map(p => { const b = document.createElement('button'); b.style.cssText = 'font-size:34px;border-radius:14px;border:0;background:#b54a3a;transition:background .3s'; b.textContent = p.icon; grillEl.appendChild(b); b.onclick = () => flip(p); return b; });
    const col = (p) => { const c = p.t[p.side]; return p.burnt ? '#1a1410' : c < 0.45 ? '#c0584a' : c < 0.85 ? '#d48a4a' : c < 1.15 ? '#b8743a' : '#5a3a20'; };
    let last = performance.now(), ended = false, auto = false;
    const flip = (p) => {
      if (p.done || p.burnt) return;
      this.c.audio.play?.('pick');
      if (p.t[0] >= 0.85 && p.t[1] >= 0.85) { p.done = true; els[p.i].style.opacity = 0.6; els[p.i].textContent = '✅'; check(); return; }
      p.side = 1 - p.side;
    };
    const check = () => { if (pieces.every(p => p.done || p.burnt)) { $('gDone').disabled = false; if (auto && !ended) setTimeout(() => !ended && finish(), 600); } };
    $('gAuto').onclick = () => { auto = true; $('gMsg').textContent = '🙋 직원이 능숙하게 구워 줘요'; };
    $('gDone').onclick = () => finish();
    this.grillHook = { pieces, finish: () => finish() };
    const step = (now) => {
      if (ended || !$('gScore')) { ended = true; return; }
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      for (const p of pieces) {
        if (p.done || p.burnt) continue;
        p.t[p.side] += dt * (0.22 + p.i * 0.01);
        if (auto && p.t[p.side] >= 0.95) { if (p.t[1 - p.side] >= 0.85) { p.done = true; els[p.i].textContent = '✅'; els[p.i].style.opacity = 0.6; } else p.side = 1 - p.side; }
        if (p.t[p.side] > 1.45) { p.burnt = true; els[p.i].textContent = '💨'; this.S.mood = ST.clamp(this.S.mood - 1); $('gMsg').textContent = '앗, 탔어요!'; }
        els[p.i].style.background = col(p);
        els[p.i].style.transform = `scale(${0.92 + Math.sin(now / 90 + p.i) * 0.03})`;
      }
      check();
      const good = pieces.filter(p => p.done).length;
      $('gScore').textContent = `잘 익음 ${good}/${n}`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    const finish = () => {
      ended = true; mg.classList.add('hidden'); mg.innerHTML = '';
      const good = pieces.filter(p => p.done).length, burnt = pieces.filter(p => p.burnt).length;
      s.grilled = true;
      if (good === n && !auto) { this.S.mood = ST.clamp(this.S.mood + 5); toast('👨‍🍳 완벽하게 구웠어요! 기분 +5', 'good'); }
      else if (burnt) toast(`🔥 ${burnt}점은 좀 탔어요…`, 'bad');
      this.c.passTime(10, 'idle');
      this.eatNow(s);
    };
  }

  // ───────── 빵집 ─────────
  breadSheet(s) {
    const menu = MENUS.bakery;
    const open = () => openSheet({
      icon: '🥐', title: '집게로 빵 담기', sub: `쟁반 ${this.count(s)}개 · ${won(this.basketTotal(s, 'bakery'))}`,
      html: menu.map(m => row({ icon: m.icon, title: m.name, desc: `배고픔 +${m.hunger}`, price: won(m.price), extra: s.basket[m.id] ? `<button class="btn gray" data-act="minus:${m.id}">−</button><b style="min-width:22px;text-align:center">${s.basket[m.id]}</b>` : '', btn: '담기', action: 'add:' + m.id })).join(''),
      bind: (b) => bindActs(b, { add: (id) => { s.basket[id] = (s.basket[id] || 0) + 1; this.c.audio.play?.('pick'); open(); }, minus: (id) => { s.basket[id]--; if (s.basket[id] <= 0) delete s.basket[id]; open(); } }),
    });
    open();
  }
  basketTotal(s, key) {
    const list = key === 'bakery' ? MENUS.bakery : key === 'mart' ? (this.c.martGoods?.() || []) : GOODS[key] || [];
    return Object.entries(s.basket).reduce((a, [id, n]) => a + (list.find(g => g.id === id)?.price || 0) * n, 0);
  }
  payBread(s) {
    const tot = this.basketTotal(s, 'bakery');
    let place = 'out';
    const open = () => openSheet({
      icon: '🥐', title: '계산하기', sub: '"봉투에 담아 드릴까요?"',
      html: `<div class="tabs"><button data-act="pl:out" class="${place === 'out' ? 'on' : ''}">🛍️ 포장</button><button data-act="pl:in" class="${place === 'in' ? 'on' : ''}">🍽 먹고 갈게요</button></div><button class="btn wide green" data-act="go">결제하기 · ${won(tot)}</button>`,
      bind: (b) => bindActs(b, {
        pl: (p) => { place = p; open(); },
        go: () => this.c.checkout(tot, { icon: '🥐', title: '빵집 계산', sub: s.t.name, cashOnly: s.cashOnly }, () => {
          const inv = this.S.inventory.food;
          if (place === 'out') { for (const [id, n] of Object.entries(s.basket)) inv[menuId('bakery', id)] = (inv[menuId('bakery', id)] || 0) + n; toast('🛍️ 빵을 봉투에 담았어요 · 가방에 넣었어요', 'good'); this.reset(s); }
          else { s.items = Object.entries(s.basket).map(([id, n]) => ({ ...MENUS.bakery.find(m => m.id === id), n })); s.basket = {}; s.stage = 'have'; s.paidBread = true; toast('🍽 빈 자리에 앉아서 먹어요', 'good'); }
        }),
      }),
    });
    open();
  }

  // ───────── 물건 가게 ─────────
  goodsSheet(s, key) {
    const list = key === 'mart' ? (this.c.martGoods?.() || []) : GOODS[key] || [];
    if (!list.length) { toast('🛒 둘러봤어요'); return; }
    const open = () => openSheet({
      icon: TYPES[s.type]?.icon || '🛒', title: s.t.name, sub: `장바구니 ${this.count(s)}개 · ${won(this.basketTotal(s, key))} · 계산은 카운터에서`,
      html: list.map(g => row({ icon: g.icon, title: g.name, desc: g.desc || (g.food ? `${g.n || 1}개 · 배고픔 +${g.food.hunger}` : g.ing ? '요리 재료' : ''), price: won(g.price), extra: s.basket[g.id] ? `<button class="btn gray" data-act="minus:${g.id}">−</button><b style="min-width:22px;text-align:center">${s.basket[g.id]}</b>` : '', btn: '담기', action: 'add:' + g.id })).join(''),
      bind: (b) => bindActs(b, { add: (id) => { s.basket[id] = (s.basket[id] || 0) + 1; this.c.audio.play?.('pick'); open(); }, minus: (id) => { s.basket[id]--; if (s.basket[id] <= 0) delete s.basket[id]; open(); } }),
    });
    open();
  }
  payGoods(s, key) {
    const list = key === 'mart' ? (this.c.martGoods?.() || []) : GOODS[key] || [];
    const tot = this.basketTotal(s, key);
    const lines = Object.entries(s.basket).map(([id, n]) => { const g = list.find(q => q.id === id); return row({ icon: g.icon, title: `${g.name} ×${n}`, price: won(g.price * n) }); }).join('');
    this.c.checkout(tot, { icon: '🧾', title: `${s.t.name} 계산`, lines: lines + this.cashNote(s), cashOnly: s.cashOnly }, () => {
      for (const [id, n] of Object.entries(s.basket)) this.c.applyGoods?.(key, list.find(q => q.id === id), n);
      s.basket = {};
      this.c.missions?.event?.('shop');
      toast('🛍️ 결제 완료! 가방에 넣었어요', 'good');
      this.c.persist();
    });
  }
  fillRx(s) {
    const rx = this.S.rx;
    this.c.checkout(3000, { icon: '💊', title: '처방약 (약값 본인부담)', sub: rx.label }, () => {
      this.S.rx = null; this.S.meds = (this.S.meds || 0) + 3;
      toast('💊 약을 받았어요 · 하루 3번 먹으면 금방 나아요 (가방 → 약)', 'good', 3600);
      this.c.persist();
    });
  }

  // ───────── 서비스 ─────────
  serviceSheet(s) {
    const list = SERVICES[s.type] || SERVICES[s.fam] || [];
    const S = this.S;
    openSheet({
      icon: TYPES[s.type]?.icon || '📋', title: s.t.name, sub: `${TYPES[s.type]?.label} · ${hoursLabel(s.type)}`,
      html: list.map(v => row({ icon: v.icon, title: v.name, desc: v.desc || (v.min ? `약 ${v.min >= 60 ? Math.round(v.min / 60 * 10) / 10 + '시간' : v.min + '분'}` : v.days ? `${v.days}번 수업 + 시험` : ''), price: won(v.price), btn: '선택', action: 'sel:' + v.id })).join('') + this.cashNote(s),
      bind: (b) => bindActs(b, {
        sel: (id) => {
          const v = list.find(q => q.id === id);
          if (v.pet && !S.pet) { toast('🐾 반려동물이 있어야 받을 수 있어요', 'bad'); return; }
          if (v.cash) { closeSheet(); if (this.c.payCash(v.price)) this.bought(s, v); return; }
          this.c.checkout(v.price, { icon: v.icon, title: v.name, sub: s.t.name, cashOnly: s.cashOnly }, () => this.bought(s, v));
        },
      }),
    });
  }
  bought(s, v) {
    const S = this.S;
    s.service = v; s.servicePaid = true;
    this.c.missions?.event?.('shop');
    if (v.pass) { S.passes = S.passes || {}; S.passes[s.type] = S.minutes + v.pass * 1440; toast(`🗓️ ${v.name} 등록 완료!`, 'good'); return; }
    if (v.cert) { S.courses = S.courses || {}; S.courses[v.cert] = { name: v.name, left: v.days, total: v.days, shop: s.t.name }; toast(`📚 ${v.name} 수강 등록! 수업 ${v.days}번 → 시험`, 'good', 3600); this.c.persist(); return; }
    if (v.item) { S.items = S.items || {}; }
    if (v.id === 'dry') { S.items = S.items || {}; S.items.suitClean = ST.day(S) + 1; toast('👔 내일 찾아가세요 · 깨끗한 정장은 면접에 좋아요', 'good'); return; }
    if (s.type === 'karaoke') { s.room = null; s.until = S.minutes + (v.min || 0); s.songs = v.songs || 0; toast(v.songs ? '🪙 동전을 넣었어요 · 코인 방으로 가요' : `🎤 ${1 + Math.floor(Math.random() * 6)}번 방으로 가세요 · 1시간`, 'good'); return; }
    if (s.type === 'pcbang') { s.until = S.minutes + v.min; toast(`🖥️ ${v.name} 충전 · 빈 자리에 앉아요`, 'good'); return; }
    if (s.fam === 'reading' || s.fam === 'studycafe') { s.until = S.minutes + v.min; toast('📖 빈 자리에 앉아서 공부해요', 'good'); return; }
    if (s.fam === 'gym') { s.until = S.minutes + v.min; toast('🏋️ 운동 기구를 이용하세요', 'good'); return; }
    if (s.fam === 'kidscafe') { s.until = S.minutes + v.min; toast('🧸 놀이 공간으로 들어가요', 'good'); return; }
    if (s.fam === 'clinic' || s.fam === 'dental' || s.fam === 'vet') { s.ticketNum = 1 + Math.floor(Math.random() * 30); s.wait = Math.floor(Math.random() * 3); toast(`📋 접수 완료 · 대기 ${s.wait}명 · 이름을 부르면 진료실로`, 'good', 3200); if (!s.wait) setTimeout(() => toast('🩺 "○○○님, 진료실로 들어오세요~"', 'good'), 1500); else setTimeout(() => { s.wait = 0; toast('🩺 "○○○님, 진료실로 들어오세요~"', 'good'); }, 6000); return; }
    toast(`✅ ${v.name} · ${s.fam === 'salon' || s.fam === 'nail' ? '의자에 앉아요' : s.fam === 'photo' ? '촬영 자리로 가요' : '이용해 주세요'}`, 'good');
  }
  serviceSpot(z, s) {
    const S = this.S, v = s.service;
    const fam = s.fam;
    if (fam === 'gym') {
      const ok = (S.passes?.gym || 0) > S.minutes || (s.until || 0) > S.minutes;
      if (!ok) return { label: '🏋️ 이용권이 필요해요 (카운터)', fn: () => this.serviceSheet(s) };
      return { label: z.eq === 'treadmill' ? '🏃 러닝머신 30분' : '🏋️ 벤치프레스 하기', fn: () => this.workout(z, s), green: true };
    }
    if (fam === 'kidscafe') { if ((s.until || 0) <= S.minutes) return { label: '🧸 입장권이 필요해요 (카운터)', fn: () => this.serviceSheet(s) }; return { label: '🧸 신나게 놀기', fn: () => this.doService(s, { name: '키즈카페 놀이', min: 40, mood: 14 }), green: true }; }
    if (!v || !s.servicePaid) return { label: `📋 먼저 ${fam === 'clinic' || fam === 'dental' ? '접수' : '결제'}해요 (카운터)`, fn: () => this.serviceSheet(s) };
    if ((fam === 'clinic' || fam === 'dental' || fam === 'vet') && s.wait > 0) return { label: '⏳ 차례를 기다려요', fn: () => toast('⏳ 대기실에서 기다려 주세요') };
    if (z.kind === 'exam' && fam === 'clinic') return { label: '🩺 진료 받기', fn: () => this.clinic(s), green: true };
    return { label: `${v.icon} ${v.name} 받기`, fn: () => this.doService(s, v), green: true };
  }
  async doService(s, v) {
    const S = this.S;
    if (s.fam === 'salon' && v.hair) return this.hairPicker(s, v);
    this.c.setBusy(true);
    await this.progress(`${v.icon} ${v.name}`, Math.min(5, 1.5 + (v.min || 20) / 30));
    this.c.passTime(v.min || 20, v.fit ? 'gym' : 'rest');
    if (v.mood) S.mood = ST.clamp(S.mood + v.mood);
    if (v.fit) S.fitness = (S.fitness || 0) + v.fit;
    if (v.item === 'idphoto') { S.items = S.items || {}; S.items.idphoto = (S.items.idphoto || 0) + 6; toast('🪪 증명사진 6장을 받았어요 · 이력서·자격증 서류에 써요', 'good', 3400); }
    else if (v.clean) { S.items = S.items || {}; S.items.cleanClothes = ST.day(S) + 3; toast('🧺 뽀송뽀송! 깨끗한 옷은 3일 동안 기분 +', 'good'); }
    else if (v.buff === 'flu') { S.buffs = S.buffs || {}; S.buffs.flu = S.minutes + 1440 * 120; toast('💉 독감 예방주사 · 이번 겨울은 감기에 덜 걸려요', 'good'); }
    else toast(`✨ ${v.name} 끝! ${v.mood ? `기분 +${v.mood}` : ''}`, 'good');
    s.service = null; s.servicePaid = false;
    this.c.setBusy(false);
    this.c.persist();
  }
  hairPicker(s, v) {
    const S = this.S, look = S.look;
    const styles = [['short', '숏컷'], ['long', '긴 생머리'], ['bun', '똥머리'], ['spiky', '삐죽머리']];
    const colors = [[0x1c1410, '흑발'], [0x4a2a14, '다크 브라운'], [0x8a5a2a, '밀크 브라운'], [0xe8c060, '금발'], [0xd8302a, '레드'], [0x2a7ae8, '블루'], [0xff8ab8, '핑크'], [0xb8b8c0, '애쉬 그레이']];
    let st = look.hairStyle, col = look.hair;
    const canColor = v.hair === 'dye', canStyle = v.hair === true || v.hair === 'perm';
    const open = () => openSheet({
      icon: '💇', title: `${s.t.name} · ${v.name}`, sub: '디자이너: "어떻게 해 드릴까요?"',
      html: (canStyle ? `<div class="note" style="color:#ddd">스타일</div><div class="tabs">${styles.map(([k, n]) => `<button data-act="st:${k}" class="${st === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : '') +
        (canColor ? `<div class="note" style="color:#ddd;margin-top:8px">색</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${colors.map(([c, n]) => `<button class="btn ${col === c ? 'green' : 'gray'}" data-act="co:${c}" style="padding:8px 4px"><i style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#${c.toString(16).padStart(6, '0')};vertical-align:middle"></i> ${n}</button>`).join('')}</div>` : '') +
        `<button class="btn wide green" style="margin-top:10px" data-act="go">이렇게 해 주세요</button>`,
      bind: (b) => bindActs(b, {
        st: (k) => { st = k; open(); }, co: (c) => { col = +c; open(); },
        go: async () => {
          closeSheet();
          this.c.setBusy(true);
          await this.progress(`💇 ${v.name} 중… (${v.min}분)`, 3.2);
          this.c.passTime(v.min, 'rest');
          look.hairStyle = st; look.hair = col;
          this.c.restyle?.();
          S.mood = ST.clamp(S.mood + 8);
          this.c.setBusy(false);
          s.service = null; s.servicePaid = false;
          toast('💇 "마음에 드세요?" 거울 속 내가 달라졌어요! 기분 +8', 'good', 3600);
          this.c.persist();
        },
      }),
    });
    open();
  }
  async clinic(s) {
    const S = this.S;
    openSheet({
      icon: '🩺', title: '진료실', sub: '의사: "어디가 불편하세요?"',
      html: row({ icon: '🤧', title: '감기 기운이 있어요', btn: '말하기', action: 'd:cold' }) + row({ icon: '🤢', title: '속이 안 좋아요', btn: '말하기', action: 'd:stomach' }) + row({ icon: '😴', title: '너무 피곤해요', btn: '말하기', action: 'd:tired' }) + row({ icon: '📋', title: '건강 검진 받고 싶어요', btn: '말하기', action: 'd:check' }),
      bind: (b) => bindActs(b, {
        d: async (k) => {
          closeSheet();
          this.c.setBusy(true);
          await this.progress('🩺 진찰 중…', 2.4);
          this.c.passTime(15, 'idle');
          this.c.setBusy(false);
          const sick = S.sick;
          if (k === 'cold') { if (sick) { S.rx = { med: 'coldmed', label: '감기약 3일분' }; toast('🩺 "감기네요. 처방전 드릴게요 · 약국에서 약 받아 가세요"', 'good', 3800); } else { toast('🩺 "열은 없어요. 따뜻하게 쉬세요~"', '', 3200); } }
          else if (k === 'stomach') { S.rx = { med: 'digest', label: '소화제' }; toast('🩺 "과식하셨네요. 소화제 처방해 드릴게요"', '', 3200); }
          else if (k === 'tired') { toast('🩺 "잠을 7시간 이상 주무시고, 끼니 거르지 마세요"', '', 3600); S.mood = ST.clamp(S.mood + 3); }
          else { toast(`🩺 건강 검진 결과: 체력 레벨 ${S.fitness || 0} · ${S.fitness > 5 ? '아주 튼튼해요!' : '운동을 조금 더 해 보세요'}`, 'good', 4000); }
          s.service = null; s.servicePaid = false;
          this.c.persist();
        },
      }),
    });
  }
  async workout(z, s) {
    const S = this.S;
    if (S.energy < 15) { toast('⚡ 너무 피곤해서 운동을 못 하겠어요', 'bad'); return; }
    this.c.setBusy(true);
    await this.progress(z.eq === 'treadmill' ? '🏃 달리는 중… 헉헉' : '🏋️ 하나, 둘… 영차!', 2.6);
    this.c.passTime(30, 'gym');
    S.fitness = (S.fitness || 0) + 0.5; S.mood = ST.clamp(S.mood + 6);
    this.c.setBusy(false);
    toast(`💪 운동 완료 · 체력 ${(S.fitness).toFixed(1)}`, 'good');
  }
  studyDesk(z, s) {
    const S = this.S;
    if ((s.until || 0) <= S.minutes) return { label: '📖 이용권이 필요해요 (카운터 · 키오스크)', fn: () => this.serviceSheet(s) };
    return {
      label: '📖 공부하기 (1시간)', green: true,
      fn: async () => {
        if (S.energy < 12) { toast('😪 너무 졸려요… 쉬었다 해요', 'bad'); return; }
        this.c.setBusy(true);
        await this.progress('📖 집중해서 공부 중…', 2.6);
        this.c.passTime(60, 'idle');
        S.energy = ST.clamp(S.energy - 4); S.studyExp = (S.studyExp || 0) + 2;
        for (const c of Object.values(S.courses || {})) c.study = (c.study || 0) + 1;
        this.c.setBusy(false);
        toast('📖 공부 1시간 · 시험 준비 +1', 'good');
      },
    };
  }

  // ───────── 노래방 ─────────
  karaokeRoom(z, s) {
    const S = this.S;
    const ok = (s.until || 0) > S.minutes || s.songs > 0;
    if (!ok) return { label: `🎤 ${z.label} · 카운터에서 결제해요`, fn: () => this.serviceSheet(s) };
    return { label: `🎤 노래 부르기${s.songs ? ` (남은 곡 ${s.songs})` : ` · ${Math.max(0, Math.ceil(s.until - S.minutes))}분 남음`}`, fn: () => this.karaoke(s), green: true };
  }
  karaoke(s) {
    const SONGS = [
      { t: '한빛 블루스', a: '도시생활 밴드', l: ['네온사인 아래 걷는 밤', '오늘도 수고했어 나에게', '버스 창에 비친 내 얼굴', '내일은 조금 더 웃을래'] },
      { t: '퇴근길 치킨', a: '야근요정', l: ['칼퇴의 꿈은 오늘도 멀고', '엘리베이터는 왜 이리 느려', '현관문 열면 기다리는 너', '바삭바삭 치킨 한 마리'] },
      { t: '별빛 고백', a: '호수공원', l: ['호숫가 벤치에 앉아서', '말하지 못한 그 한마디', '별빛이 대신 전해 줄래', '오늘 밤은 너에게 갈게'] },
      { t: '월요일 아침', a: '알람시계', l: ['5분만 더 5분만 더', '알람은 세 번째 울리고', '커피 한 잔에 정신 차려', '그래도 힘내 보자 월요일'] },
    ];
    openSheet({
      icon: '🎤', title: '노래 고르기', sub: '번호를 눌러요',
      html: SONGS.map((g, i) => row({ icon: '🎵', title: g.t, desc: g.a, btn: '예약', action: 'p:' + i })).join(''),
      bind: (b) => bindActs(b, { p: (i) => { closeSheet(); this.sing(s, SONGS[+i]); } }),
    });
  }
  sing(s, song) {
    const mg = $('mg'); mg.classList.remove('hidden', 'soft');
    let beat = 0, hits = 0, ended = false, last = performance.now(), pos = 0, line = 0;
    const total = song.l.length * 4;
    mg.innerHTML = `<div class="mg-box" style="background:linear-gradient(160deg,#1a0a3a,#3a0a4a)"><div class="mg-top"><span>🎤 ${song.t} · ${song.a}</span><span class="t" id="kScore">0점</span></div>
      <div id="kLyric" style="font-size:22px;font-weight:800;text-align:center;min-height:64px;color:#fff;text-shadow:0 0 12px #ff4ae0;margin:10px 0"></div>
      <div style="position:relative;height:46px;border-radius:23px;background:rgba(255,255,255,.08);overflow:hidden"><i style="position:absolute;left:44%;width:12%;top:0;bottom:0;background:rgba(80,255,160,.35)"></i><i id="kDot" style="position:absolute;top:8px;width:30px;height:30px;border-radius:50%;background:#ff4ae0;box-shadow:0 0 14px #ff4ae0"></i></div>
      <p class="note" style="text-align:center">🎵 공이 초록 칸에 오면 눌러요 (박자 맞추기)</p>
      <button class="btn wide green" id="kHit" style="font-size:20px;padding:16px">🎤 흥!</button></div>`;
    const lyric = $('kLyric'), dot = $('kDot');
    lyric.textContent = song.l[0];
    $('kHit').onclick = () => {
      if (ended) return;
      const ok = pos > 0.4 && pos < 0.6;
      if (ok && !this._hitBeat) { hits++; this._hitBeat = true; this.c.audio.play?.('pick'); dot.style.background = '#5aff9a'; }
      else if (!ok) { dot.style.background = '#ff5a5a'; }
    };
    const step = (now) => {
      if (ended || !$('kLyric')) { ended = true; return; }
      const dt = (now - last) / 1000; last = now;
      pos += dt * 0.9;
      if (pos >= 1) { pos = 0; beat++; this._hitBeat = false; dot.style.background = '#ff4ae0'; if (beat % 4 === 0) { line++; if (line < song.l.length) lyric.textContent = song.l[line]; } }
      dot.style.left = `calc(${pos * 100}% - 15px)`;
      $('kScore').textContent = Math.round(hits / Math.max(1, total) * 100) + '점';
      if (beat >= total) return end();
      requestAnimationFrame(step);
    };
    const end = () => {
      ended = true;
      const score = Math.min(100, Math.round(hits / total * 100) + Math.floor(Math.random() * 8));
      mg.classList.add('hidden'); mg.innerHTML = '';
      this.c.passTime(4, 'fun');
      this.S.mood = ST.clamp(this.S.mood + 4 + Math.round(score / 20));
      if (s.songs > 0) s.songs--;
      bigMsg(score >= 90 ? `🎉 ${score}점!` : `🎤 ${score}점`, score >= 90 ? '와! 가수 데뷔해도 되겠어요 · 서비스 10분!' : score >= 60 ? '박수 짝짝짝 👏' : '다음엔 더 잘할 수 있어요!', 2600);
      if (score >= 90 && s.until) s.until += 10;
      this.c.audio.play?.(score >= 90 ? 'coin' : 'pick');
    };
    requestAnimationFrame(step);
  }

  // ───────── PC방 ─────────
  pcSeat(z, s) {
    const S = this.S;
    if ((s.until || 0) <= S.minutes) return { label: '🖥️ 카운터에서 시간 충전해요', fn: () => this.serviceSheet(s) };
    return { label: `🖥️ 게임하기 · ${Math.max(0, Math.ceil((s.until - S.minutes) / 6) / 10)}시간 남음`, fn: () => this.pcGame(s), green: true, alt: { label: '🍜 자리에서 라면 주문 (4,500원)', fn: () => this.c.checkout(4500, { icon: '🍜', title: '자리 주문 · 라면' }, () => { S.inventory.food['m:bunsik:ramyeon'] = (S.inventory.food['m:bunsik:ramyeon'] || 0) + 1; toast('🍜 라면이 자리로 왔어요 · 가방에서 꺼내 먹어요', 'good'); }) } };
  }
  pcGame(s) {
    const mg = $('mg'); mg.classList.remove('hidden', 'soft');
    let hits = 0, miss = 0, t = 25, ended = false, last = performance.now(), spawnT = 0;
    mg.innerHTML = `<div class="mg-box" style="background:#0a0e18"><div class="mg-top"><span>🎯 에임 랭크전</span><span class="t" id="pT">25</span></div>
      <div id="pArena" style="position:relative;height:260px;border-radius:14px;background:radial-gradient(circle at 50% 120%,#1a3a5a,#0a0e18);overflow:hidden;border:1px solid #2a3a5a"></div>
      <p class="note" style="text-align:center" id="pInfo">나타나는 적을 빠르게 눌러요!</p></div>`;
    const arena = $('pArena');
    arena.onclick = (e) => { if (e.target === arena) miss++; };
    const spawn = () => {
      const b = document.createElement('button');
      b.textContent = pick(['👾', '🤖', '👹']);
      b.style.cssText = `position:absolute;font-size:34px;background:none;border:0;left:${8 + Math.random() * 80}%;top:${8 + Math.random() * 75}%;transition:transform .15s`;
      b.onclick = (e) => { e.stopPropagation(); hits++; b.remove(); this.c.audio.play?.('pick'); };
      arena.appendChild(b);
      setTimeout(() => { if (b.parentNode) { b.remove(); miss++; } }, 1300);
    };
    const step = (now) => {
      if (ended || !$('pT')) { ended = true; return; }
      const dt = (now - last) / 1000; last = now;
      t -= dt; spawnT -= dt;
      if (spawnT <= 0) { spawnT = 0.7; spawn(); }
      $('pT').textContent = Math.ceil(t);
      $('pInfo').textContent = `처치 ${hits} · 놓침 ${miss}`;
      if (t <= 0) return end();
      requestAnimationFrame(step);
    };
    const end = () => {
      ended = true; mg.classList.add('hidden'); mg.innerHTML = '';
      const win = hits >= 16 && hits > miss;
      this.c.passTime(30, 'fun');
      this.S.mood = ST.clamp(this.S.mood + (win ? 10 : 3));
      this.S.pcRank = (this.S.pcRank || 1000) + (win ? 25 : -18);
      bigMsg(win ? '🏆 승리!' : '💀 패배…', `랭크 점수 ${this.S.pcRank} (${win ? '+25' : '-18'})`, 2400);
    };
    requestAnimationFrame(step);
  }

  bankBasic(s) {
    const S = this.S;
    if (s.ticket && s.wait > 0) { toast(`🎫 ${s.ticket}번 · 앞에 ${s.wait}명 · 조금만 기다려요`); s.wait = Math.max(0, s.wait - 1 - Math.floor(Math.random() * 2)); return; }
    this.c.atm?.(0, true);
  }

  // ───────── 진행 막대 ─────────
  progress(label, sec) {
    return new Promise(res => {
      const mg = $('mg');
      mg.classList.remove('hidden'); mg.classList.add('soft');
      mg.innerHTML = `<div class="prog"><b>${label}</b><div class="pbar"><i id="pfill"></i></div></div>`;
      let t = 0, last = performance.now();
      const step = (now) => {
        const dt = Math.min(0.25, (now - last) / 1000); last = now; t += dt;
        const f = $('pfill'); if (f) f.style.width = Math.min(100, t / sec * 100) + '%';
        if (t >= sec) { mg.classList.add('hidden'); mg.classList.remove('soft'); mg.innerHTML = ''; res(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ───────── 가게를 떠날 때 (먹튀 방지) ─────────
  onLeaveUnit(unit) {
    const jg = this.c.jobs;
    if (jg?.onShift && jg.shift.s.unit === unit) {
      openSheet({ icon: '🏃', title: '조퇴할까요?', sub: '근무 시간이 아직 남았어요', html: `<p class="note">지금 나가면 일한 시간만큼만 받고 경고를 받아요.</p><button class="btn wide red" data-act="go">조퇴하기</button><button class="btn wide gray" data-act="stay">계속 일하기</button>`, bind: (b) => bindActs(b, { go: () => { closeSheet(); jg.clockOut(true); }, stay: () => closeSheet() }) });
      return true;
    }
    const s = this.sess;
    if (!s || s.unit !== unit) return false;
    if (s.owed > 0) {
      toast('🙋 직원: "손님! 계산 안 하셨어요~"', 'bad', 3000);
      this.payBill(s);
      return true;
    }
    if (this.count(s) && GOODS_OF[s.fam]) {
      toast('🚨 계산 안 한 물건은 제자리에 두고 나왔어요', '', 2600);
      s.basket = {};
    }
    if (s.stage === 'waiting' || s.stage === 'ready') toast(s.bell ? '📳 진동벨을 들고 나가면 안 돼요! (돌아가서 기다려요)' : '🧾 주문한 음식이 아직 안 나왔어요', 'bad', 2600);
    if (s.stage === 'waiting' || s.stage === 'ready') return true;
    s.tray = false;
    return false;
  }
  hud(r, t) {
    const s = this.sess;
    if (!s || s.unit !== r) return '';
    const S = this.S;
    if (s.owed > 0 && s.stage !== 'ate') return `🧾 주문 ${won(s.owed)} · ${s.stage === 'ordered' ? '음식 준비 중' : s.stage === 'served' ? '음식 나왔어요!' : '식사 중'}`;
    if (s.stage === 'ate' && s.owed > 0) return `🧾 나갈 때 계산 · ${won(s.owed)}`;
    if (s.stage === 'waiting') return `${s.bell ? '📳 진동벨' : '🧾 주문번호'} ${s.num} · 약 ${Math.max(1, Math.ceil(s.readyAt - S.minutes))}분`;
    if (s.stage === 'ready') return `🔔 ${s.num}번 · 음식 받으러 가요`;
    if (s.until > S.minutes) return `⏱️ 남은 시간 ${Math.ceil(s.until - S.minutes)}분`;
    if (this.count(s)) return `🧺 장바구니 ${this.count(s)}개 · 카운터에서 계산`;
    if (s.tray) return '🍽 쟁반 들고 빵 고르는 중';
    return '';
  }
}

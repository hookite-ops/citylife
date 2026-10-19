import * as THREE from 'three';
import { PRODUCTS, P, CATS, SHIFTS } from './products.js';
import { WAGE_MART, won } from './config.js';
import * as ST from './state.js';
import { $, toast, openSheet, closeSheet, bigMsg, fade, wait, row, bindActs } from './ui.js';

// 편의점: 쇼핑 · 계산 · 알바 근무
export class MartGame {
  constructor(ctx) {
    this.c = ctx;            // { S, room, player, human, audio, earn, pay, eatFood, persist, setBusy, scale }
    this.spawnT = 3;
    this.spillT = 40;
    this.carry = null;       // 들고 있는 상자: 진열 카테고리 or 'delivery'
  }
  get S() { return this.c.S; }
  get M() {
    const S = this.S;
    if (!S.mart) S.mart = { hired: false, slot: null, warnings: 0, ratings: [], raise: 0, weekHours: 0, shifts: 0, basket: {}, lastCheckDay: 0, firedUntil: 0, failedInterviewDay: -1, worked: {} };
    return S.mart;
  }
  get room() { return this.c.room; }
  get onShift() { return !!this.M.shift; }
  wage() { return WAGE_MART + (this.M.raise || 0); }

  // ───────── 입장/퇴장 ─────────
  onEnter() {
    const r = this.room;
    r.clearNpcs();
    r.refreshStock();
    r.staff.root.visible = !this.onShift;
    this.spawnT = 2;
    // 손님 한두 명은 이미 있음
    for (let k = 0; k < 2; k++) { const c = r.spawnCustomer(); c.pos.set(0.8 + k * 2, 0, -1.1 - k * 3); r.go(c, c.visits[0].spot); c.state = 'toShelf'; }
  }
  basketCount() { return Object.values(this.M.basket).reduce((a, b) => a + b, 0); }
  basketTotal() { return Object.entries(this.M.basket).reduce((a, [id, n]) => a + P[id].price * n, 0); }

  // 나갈 수 있는지 (계산 안 한 물건)
  tryExit(leave) {
    if (this.onShift) {
      openSheet({
        icon: '🏃', title: '조퇴할까요?', sub: '근무 시간이 아직 남았어요',
        html: `<p class="note">지금 나가면 일한 시간만큼만 받고 <b>평점이 크게 깎여요</b>.</p><button class="btn wide red" data-act="go">조퇴하고 나가기</button><button class="btn wide gray" data-act="stay">계속 일하기</button>`,
        bind: (b) => bindActs(b, { go: () => { closeSheet(); this.endShift(true).then(leave); }, stay: () => closeSheet() }),
      });
      return;
    }
    if (this.basketCount()) {
      openSheet({
        icon: '🚨', title: '계산 안 한 물건이 있어요', sub: `장바구니 ${this.basketCount()}개 · ${won(this.basketTotal())}`,
        html: `<p class="note">그냥 나가면 도난 경보가 울려요. 계산대에서 계산하거나 물건을 제자리에 두세요.</p><button class="btn wide" data-act="put">물건 제자리에 두고 나가기</button><button class="btn wide gray" data-act="stay">계산하러 가기</button>`,
        bind: (b) => bindActs(b, { put: () => { this.M.basket = {}; closeSheet(); leave(); }, stay: () => closeSheet() }),
      });
      return;
    }
    leave();
  }

  // ───────── 상호작용 버튼 ─────────
  action(zone) {
    const M = this.M;
    if (!zone) return null;
    switch (zone.id) {
      case 'exit': return { label: '🚪 밖으로 나가기', fn: () => this.c.exit() };
      case 'shelf':
        if (this.onShift && this.carry && this.carry !== 'delivery') {
          if (this.carry === zone.cat) return { label: `📦 ${zone.label}에 진열하기`, fn: () => this.restock(zone.cat), green: true };
          return { label: `📦 ${CATS[this.carry].name} 상자를 들고 있어요`, fn: () => toast(`이 상자는 ${CATS[this.carry].name} 코너에 진열해요`) };
        }
        if (this.onShift && zone.cat === 'chill' && M.shift.expiryDue) return { label: '🗓 유통기한 확인하기', fn: () => this.expiryGame(), green: true };
        if (this.onShift) return { label: `${CATS[zone.cat].icon} ${zone.label} · 재고 ${Math.round(this.room.stock[zone.cat] * 100)}%`, fn: () => this.shopSheet(zone) };
        return { label: `🛒 ${zone.label} 둘러보기`, fn: () => this.shopSheet(zone) };
      case 'counter':
        if (this.basketCount()) return { label: `💳 계산하기 · ${won(this.basketTotal())}`, fn: () => this.checkoutSheet(), green: true };
        if (this.onShift) return null;
        if (!M.hired) return { label: '🧑‍💼 알바 문의하기', fn: () => this.interviewSheet() };
        return { label: '🗓 내 알바 일정', fn: () => this.scheduleSheet() };
      case 'pos':
        if (this.onShift) {
          const q = this.room.queue || [];
          if (q[0] && q[0].state === 'queue') return { label: `🧾 손님 계산하기 (${q.length}명 대기)`, fn: () => this.posGame(q[0]), green: true };
          return { label: '🧾 계산대 · 손님 기다리는 중', fn: () => toast('손님이 오면 여기서 계산해요') };
        }
        if (M.hired) {
          const st = this.shiftStatus();
          if (st.canClockIn) return { label: `🕐 출근하기 · ${SHIFTS[M.slot].name} ${fmtH(SHIFTS[M.slot].start)}~${fmtH(SHIFTS[M.slot].end)}`, fn: () => this.clockIn(), green: true };
          return { label: `🕐 ${st.msg}`, fn: () => this.scheduleSheet() };
        }
        return { label: '🚫 직원 전용 구역', fn: () => toast('계산대 안쪽은 직원만 들어갈 수 있어요') };
      case 'storage':
        if (!this.onShift) return { label: '🚫 직원 전용 · 창고', fn: () => toast('창고는 직원만 들어갈 수 있어요') };
        if (this.carry === 'delivery') return { label: '📦 물류 상자 창고에 넣기', fn: () => this.storeDelivery(), green: true };
        if (this.carry) return { label: '📦 상자 다시 내려놓기', fn: () => this.setCarry(null) };
        return { label: '📦 창고에서 상자 꺼내기', fn: () => this.storageSheet() };
      case 'hot': return { label: '♨️ 온수기 · 전자레인지', fn: () => this.hotSheet() };
      case 'eat': return { label: '🍽 앉아서 먹기', fn: () => this.eatSheet() };
    }
    return null;
  }
  // 바닥 닦기 / 물류 상자 (구역과 별개)
  extraAction(pos) {
    if (!this.onShift) return null;
    for (const s of this.room.spills) if (Math.hypot(pos.x - s.x, pos.z - s.z) < 1.1) return { label: '🧽 바닥 닦기', fn: () => this.cleanSpill(s), green: true };
    if (!this.carry) {
      const b = this.room.deliveryBoxes.find(b => b.visible && Math.hypot(pos.x - b.position.x, pos.z - b.position.z) < 1.3);
      if (b) return { label: '📦 물류 상자 들기', fn: () => { b.visible = false; this.setCarry('delivery'); }, green: true };
    }
    return null;
  }

  // ───────── 쇼핑 ─────────
  shopSheet(zone) {
    const M = this.M;
    const render = () => {
      const list = PRODUCTS.filter(p => p.cat === zone.cat);
      const stock = this.room.stock[zone.cat];
      return `<p class="note">장바구니 <b>${this.basketCount()}개 · ${won(this.basketTotal())}</b> · 계산대에서 계산해요${stock < 0.15 ? '<br><b style="color:var(--bad)">물건이 거의 다 팔렸어요</b>' : ''}</p>` +
        list.map(p => row({
          icon: p.icon, title: p.name, desc: desc(p), price: won(p.price),
          extra: M.basket[p.id] ? `<button class="btn gray" data-act="minus:${p.id}">−</button><b style="min-width:22px;text-align:center">${M.basket[p.id]}</b>` : '',
          btn: '담기', action: 'add:' + p.id, disabled: stock < 0.03,
        })).join('');
    };
    const open = () => openSheet({
      icon: CATS[zone.cat].icon, title: zone.label, sub: '원하는 만큼 담으세요',
      html: render(),
      bind: (b) => bindActs(b, {
        add: (id) => { M.basket[id] = (M.basket[id] || 0) + 1; this.c.audio.play('pick'); open(); },
        minus: (id) => { M.basket[id]--; if (M.basket[id] <= 0) delete M.basket[id]; open(); },
      }),
    });
    open();
  }
  checkoutSheet() {
    const M = this.M;
    const items = Object.entries(M.basket);
    let bag = false;
    const render = () => {
      const total = this.basketTotal() + (bag ? 100 : 0);
      return items.map(([id, n]) => row({ icon: P[id].icon, title: `${P[id].name} ×${n}`, desc: won(P[id].price) + ' / 개', price: won(P[id].price * n) })).join('') +
        `<div class="row"><div class="ic">🛍️</div><div class="info"><b>봉투</b><span>종량제 봉투 100원</span></div><button class="btn ${bag ? 'green' : 'gray'}" data-act="bag">${bag ? '넣음' : '필요해요'}</button></div>
        <div class="row" style="background:rgba(70,209,255,0.1)"><div class="info"><b>합계</b></div><div class="price" style="font-size:18px">${won(total)}</div></div>
        <button class="btn wide green" data-act="pay">💳 카드로 결제하기</button>`;
    };
    const open = () => openSheet({
      icon: '💳', title: '계산하기', sub: this.onShift ? '직원 할인은 없어요' : '알바생: "어서오세요~ 봉투 필요하세요?"',
      html: render(),
      bind: (b) => bindActs(b, {
        bag: () => { bag = !bag; open(); },
        pay: () => {
          const total = this.basketTotal() + (bag ? 100 : 0);
          if (!this.c.pay(total)) return;
          const S = this.S;
          for (const [id, n] of items) {
            const p = P[id];
            if (p.ing) for (const [k, v] of Object.entries(p.ing)) S.inventory.ing[k] = (S.inventory.ing[k] || 0) + v * n;
            else S.inventory.food[id] = (S.inventory.food[id] || 0) + n;
          }
          M.basket = {};
          closeSheet();
          this.c.audio.play('pay');
          toast(`🧾 결제 완료 ${won(total)} · 산 물건은 가방에 들어갔어요`, 'good');
          this.c.persist();
        },
      }),
    });
    open();
  }

  // ───────── 온수기 · 전자레인지 · 취식 ─────────
  hotSheet() {
    const S = this.S;
    const inv = S.inventory.food;
    const cups = Object.keys(inv).filter(id => inv[id] > 0 && P[id]?.needWater);
    const heats = Object.keys(inv).filter(id => inv[id] > 0 && P[id]?.heat);
    openSheet({
      icon: '♨️', title: '온수기 · 전자레인지', sub: '계산한 음식만 쓸 수 있어요',
      html: (cups.map(id => row({ icon: P[id].icon, title: `${P[id].name}에 뜨거운 물 붓기`, desc: '3분 기다렸다가 먹어요 · 보유 ' + inv[id], btn: '물 붓기', action: 'cup:' + id })).join('') +
        heats.map(id => row({ icon: P[id].icon, title: `${P[id].name} 데우기`, desc: '전자레인지 1분 30초 · 따뜻하면 더 맛있어요', btn: '데우기', action: 'heat:' + id })).join('')) ||
        '<p class="note">컵라면이나 도시락을 먼저 사서 계산해 주세요.</p>',
      bind: (b) => bindActs(b, {
        cup: (id) => { closeSheet(); this.prepare(id, 3, '컵라면 익는 중', 'cup'); },
        heat: (id) => { closeSheet(); this.prepare(id, 1.5, '전자레인지 돌아가는 중', 'micro'); },
      }),
    });
  }
  async prepare(id, minutes, label, kind) {
    const S = this.S;
    this.c.setBusy(true);
    this.c.audio.play(kind === 'cup' ? 'pour' : 'microwave');
    const r = this.room;
    const pos = kind === 'cup' ? [6.5, 1.7, 4.05] : [6.3, 1.4, 4.8];
    r.puff(...pos);
    await this.progress(label, 2.2, () => { if (Math.random() < 0.08) r.puff(...pos); });
    ST.passTime(S, minutes, 'idle');
    if (kind === 'micro') this.c.audio.play('ding');
    S.inventory.food[id]--;
    S.inventory.food[id + '#hot'] = (S.inventory.food[id + '#hot'] || 0) + 1;
    this.c.setBusy(false);
    toast(`✅ 다 됐어요! 취식대에 앉아서 먹어요`, 'good');
    this.eatSheet();
  }
  eatSheet() {
    const S = this.S, inv = S.inventory.food;
    const ready = Object.keys(inv).filter(id => inv[id] > 0 && !P[id]?.needWater);
    openSheet({
      icon: '🍽', title: '창가 취식대', sub: '앉아서 먹으면 기분이 조금 더 좋아요',
      html: ready.length ? ready.map(id => { const f = this.c.foodInfo(id); return row({ icon: f.icon, title: `${f.name} ×${inv[id]}`, desc: `배고픔 +${f.hunger}${f.energy ? ` · 에너지 +${f.energy}` : ''}`, btn: '먹기', action: 'eat:' + id }); }).join('')
        : '<p class="note">바로 먹을 수 있는 음식이 없어요. 컵라면은 온수기에서 물부터 부어야 해요.</p>',
      bind: (b) => bindActs(b, { eat: (id) => { closeSheet(); this.sitAndEat(id); } }),
    });
  }
  async sitAndEat(id) {
    const { human, player } = this.c;
    const r = this.room;
    const stool = r.stools.reduce((a, s) => Math.hypot(s[0] - player.pos.x, s[1] - player.pos.z) < Math.hypot(a[0] - player.pos.x, a[1] - player.pos.z) ? s : a);
    this.c.setBusy(true);
    const old = player.pos.clone();
    human.root.position.set(stool[0], 0.28, stool[1]); human.root.rotation.y = 0;
    human.setPose('sit');
    if (id.endsWith('#hot') || id.startsWith('cupramen')) r.puff(stool[0], 1.15, stool[1] + 0.45);
    await this.progress('냠냠 먹는 중', 2.4, () => {});
    this.c.eatFood(id, { minutes: 12, moodBonus: 3 });
    human.setPose('stand');
    player.pos.set(stool[0], 0, stool[1] - 0.7);
    human.root.position.copy(player.pos);
    this.c.setBusy(false);
  }

  // 진행 막대 (실제 초)
  progress(label, sec, tick) {
    return new Promise(res => {
      const mg = $('mg');
      mg.classList.remove('hidden'); mg.classList.add('soft');
      mg.innerHTML = `<div class="prog"><b>${label}</b><div class="pbar"><i id="pfill"></i></div></div>`;
      let t = 0, last = performance.now();
      const step = (now) => {
        const dt = Math.min(0.25, (now - last) / 1000); last = now; t += dt;
        tick?.(t);
        $('pfill').style.width = Math.min(100, t / sec * 100) + '%';
        if (t >= sec) { mg.classList.add('hidden'); mg.classList.remove('soft'); mg.innerHTML = ''; res(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ───────── 알바: 면접 ─────────
  interviewSheet() {
    const M = this.M, S = this.S;
    const today = ST.day(S);
    if (M.firedUntil && today < M.firedUntil) return openSheet({ icon: '🙅', title: '점장님', sub: '', html: `<p class="note">"저번에 무단결근이 너무 많았잖아요… ${M.firedUntil - today}일 뒤에 다시 얘기해요."</p>` });
    if (M.failedInterviewDay === today) return openSheet({ icon: '🙅', title: '점장님', sub: '', html: '<p class="note">"오늘 면접은 이미 봤죠? 내일 다시 와 보세요."</p>' });
    openSheet({
      icon: '🧑‍💼', title: '24 마트 아르바이트 모집', sub: '점장님과 짧은 면접',
      html: `<div class="grid2" style="margin-bottom:10px"><div class="stat"><span>시급</span><b>${won(WAGE_MART)}</b></div><div class="stat"><span>근무</span><b>평일 · 4시간</b></div><div class="stat"><span>야간 (23~3시)</span><b>시급 1.5배</b></div><div class="stat"><span>주 15시간 이상</span><b>주휴수당</b></div></div>
        <p class="note">하는 일: 계산 · 진열 · 매장 청소 · 유통기한 확인 · 물류 정리<br>무단결근 3번이면 해고돼요.</p>
        <button class="btn wide green" data-act="go">면접 보기</button>`,
      bind: (b) => bindActs(b, { go: () => this.interview() }),
    });
  }
  interview() {
    const Q = [
      { q: '"편의점 일 해 본 적 있어요?"', a: [['처음이지만 빨리 배우겠습니다!', 1], ['네, 많이 해 봤어요 (거짓말)', 0], ['딱히 하고 싶진 않은데요…', -1]] },
      { q: '"손님이 계산 실수를 따지면 어떻게 할 거예요?"', a: [['정중하게 사과하고 다시 확인해요', 1], ['손님이 잘못 본 거라고 말해요', -1], ['점장님한테 바로 전화해요', 0]] },
      { q: '"근무 시간에 늦을 것 같으면요?"', a: [['미리 연락드리고 최대한 빨리 가요', 1], ['조용히 늦게 들어가요', -1], ['그냥 안 가요', -2]] },
    ];
    let i = 0, score = 0;
    const ask = () => {
      const q = Q[i];
      openSheet({
        icon: '🧑‍💼', title: `면접 ${i + 1}/3`, sub: '점장님',
        html: `<p class="note" style="font-size:16px;color:var(--tx)">${q.q}</p>` + q.a.map(([t], k) => `<button class="btn wide gray" data-act="ans:${k}" style="text-align:left">${t}</button>`).join(''),
        bind: (b) => bindActs(b, {
          ans: (k) => {
            score += q.a[+k][1]; i++;
            if (i < Q.length) return ask();
            this.c.persist();
            if (score >= 2) this.chooseSlot(true);
            else { this.M.failedInterviewDay = ST.day(this.S); openSheet({ icon: '🙅', title: '불합격', sub: '', html: '<p class="note">"음… 이번엔 같이 일하기 어려울 것 같아요. 내일 다시 와 보세요."</p>' }); }
          },
        }),
      });
    };
    ask();
  }
  chooseSlot(first) {
    openSheet({
      icon: '🗓', title: first ? '합격! 근무 시간을 골라요' : '근무 시간 바꾸기', sub: '평일(월~금)에 매일 같은 시간에 출근해요',
      html: Object.entries(SHIFTS).map(([k, s]) => row({ icon: s.night ? '🌙' : '☀️', title: `${s.name} ${fmtH(s.start)} ~ ${fmtH(s.end)}`, desc: s.night ? '시급 1.5배 · 물류 정리가 있어요 · 손님은 적어요' : k === 'evening' ? '퇴근길 손님이 많아요' : k === 'morning' ? '출근길 손님 · 유통기한 확인' : '한가한 편이에요', btn: '선택', btnClass: 'green', action: 'pick:' + k })).join(''),
      bind: (b) => bindActs(b, {
        pick: (k) => {
          const M = this.M;
          const wasHired = M.hired;
          M.hired = true; M.slot = k; M.warnings = wasHired ? M.warnings : 0; M.hiredDay = ST.day(this.S);
          M.hiredMin = this.S.minutes;
          closeSheet();
          this.c.audio.play('success');
          if (!wasHired) bigMsg('🎉 24 마트 알바 합격!', `${SHIFTS[k].name} ${fmtH(SHIFTS[k].start)}~${fmtH(SHIFTS[k].end)} · 평일 출근`, 3200);
          else toast('근무 시간을 바꿨어요');
          this.c.persist();
        },
      }),
    });
  }
  scheduleSheet() {
    const M = this.M;
    const s = SHIFTS[M.slot];
    const st = this.shiftStatus();
    const avg = M.ratings.length ? M.ratings.reduce((a, b) => a + b, 0) / M.ratings.length : 0;
    openSheet({
      icon: '🗓', title: '내 알바 일정', sub: `24 마트 · ${s.name} ${fmtH(s.start)}~${fmtH(s.end)} · 평일`,
      html: `<div class="grid2" style="margin-bottom:10px"><div class="stat"><span>시급</span><b>${won(this.wage())}${s.night ? ' ×1.5' : ''}</b></div><div class="stat"><span>평균 평점</span><b>${avg ? stars(avg) : '-'}</b></div><div class="stat"><span>이번 주 근무</span><b>${M.weekHours.toFixed(1)}시간</b></div><div class="stat"><span>경고</span><b style="color:${M.warnings ? 'var(--bad)' : 'inherit'}">${M.warnings}/3</b></div></div>
        <p class="note">${st.msg}<br>근무 시작 30분 전부터 계산대 안쪽에서 출근할 수 있어요. 6분 넘게 늦으면 지각이에요.</p>
        <button class="btn wide gray" data-act="slot">근무 시간 바꾸기</button><button class="btn wide red" data-act="quit">알바 그만두기</button>`,
      bind: (b) => bindActs(b, {
        slot: () => this.chooseSlot(false),
        quit: () => { if (confirm('정말 그만둘까요?')) { this.M.hired = false; this.M.slot = null; closeSheet(); toast('점장님: "그동안 수고했어요!"'); this.c.persist(); } },
      }),
    });
  }

  // 지금 출근 가능한지 / 다음 근무
  shiftStatus() {
    const M = this.M, S = this.S;
    const s = SHIFTS[M.slot];
    const dayIdx = Math.floor(S.minutes / 1440);
    const now = S.minutes;
    for (let k = -1; k <= 7; k++) {
      const d = dayIdx + k;
      if (d % 7 >= 5) continue;               // 주말 휴무
      const start = d * 1440 + s.start * 60, end = d * 1440 + s.end * 60;
      if (M.worked[d]) continue;
      if (now > start + 60) continue;
      if (now >= start - 30 && now <= start + 60) return { canClockIn: true, start, end, day: d };
      const left = start - now;
      const h = Math.floor(left / 60), m = Math.floor(left % 60);
      return { canClockIn: false, msg: `다음 근무: ${d + 1}일차 ${['월', '화', '수', '목', '금', '토', '일'][d % 7]}요일 ${fmtH(s.start)} (${h ? h + '시간 ' : ''}${m}분 뒤)` };
    }
    return { canClockIn: false, msg: '이번 주 근무가 없어요' };
  }

  // ───────── 출근 · 근무 ─────────
  async clockIn() {
    const st = this.shiftStatus();
    if (!st.canClockIn) return;
    const M = this.M, S = this.S;
    const late = S.minutes > st.start + 6;
    M.worked[st.day] = true;
    M.shift = {
      start: Math.max(S.minutes, st.start), end: st.end, slot: M.slot, day: st.day, score: late ? 3.0 : 3.6,
      sales: 0, served: 0, angry: 0, cashDiff: 0, events: [], expiryDue: M.slot === 'morning' || M.slot === 'evening',
      deliveryAt: M.slot === 'night' ? st.start + 60 + Math.random() * 90 : (Math.random() < 0.5 ? st.start + 60 + Math.random() * 120 : null),
      late,
    };
    this.c.setBusy(true);
    await fade(true);
    const { human, player } = this.c;
    human.applyUniform?.(true);
    this.room.staff.root.visible = false;
    player.pos.set(-5.75, 0, 2.6); player.heading = Math.PI / 2;
    human.root.position.copy(player.pos); human.root.rotation.y = player.heading;
    await fade(false);
    this.c.setBusy(false);
    this.c.audio.play('clockin');
    bigMsg(late ? '😅 지각했어요' : '🕐 출근 완료!', `${SHIFTS[M.slot].name} 근무 ${fmtH(SHIFTS[M.slot].start)}~${fmtH(SHIFTS[M.slot].end)} · 손님이 오면 계산대에서 계산해요`, 3200);
    if (late) toast('점장님: "다음부턴 늦지 마요~" (평점 -)', 'bad', 3500);
    if (M.shift.expiryDue) setTimeout(() => toast('🗓 도시락 매대 유통기한 확인해 주세요'), 4000);
    this.spawnT = 2;
    this.spillT = 30 + Math.random() * 30;
    this.c.persist();
  }
  async endShift(early) {
    const M = this.M, S = this.S, sh = M.shift;
    if (!sh) return;
    M.shift = null;
    this.setCarry(null);
    const worked = Math.max(0, Math.min(S.minutes, sh.end) - sh.start) / 60;
    const night = SHIFTS[sh.slot].night;
    let score = sh.score - (early ? 1.5 : 0) - this.room.spills.length * 0.3 - (Object.values(this.room.stock).filter(v => v < 0.2).length * 0.2);
    score = Math.max(0.5, Math.min(5, score));
    M.ratings.push(score); if (M.ratings.length > 20) M.ratings.shift();
    M.shifts++; M.weekHours += worked;
    const base = this.wage() * worked * (night ? 1.5 : 1);
    const pay = Math.max(0, Math.round((base - sh.cashDiff) / 10) * 10);
    this.room.staff.root.visible = true;
    this.c.human.applyUniform?.(false);
    for (const s of [...this.room.spills]) this.room.removeSpill(s);
    this.room.deliveryBoxes.forEach(b => b.visible = false);
    if (pay > 0) this.c.earn(pay, `24 마트 ${SHIFTS[sh.slot].name} 근무 ${worked.toFixed(1)}시간`);
    // 평가
    let note = '';
    if (score >= 4.3) note = '점장님: "오늘 진짜 잘했어요! 👍"';
    else if (score >= 3.3) note = '점장님: "수고했어요~"';
    else if (score >= 2) note = '점장님: "오늘은 좀 아쉬웠어요."';
    else { note = '점장님: "이러면 곤란해요… (경고 1회)"'; M.warnings++; }
    // 시급 인상
    if (M.shifts % 5 === 0) {
      const recent = M.ratings.slice(-5), avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (avg >= 4 && (M.raise || 0) < 1500) { M.raise = (M.raise || 0) + 300; setTimeout(() => bigMsg('📈 시급 인상!', `점장님이 시급을 ${won(this.wage())}으로 올려 줬어요`, 3200), 3500); }
    }
    openSheet({
      icon: '🧾', title: early ? '조퇴 정산' : '퇴근! 오늘 근무 정산', sub: `${SHIFTS[sh.slot].name} ${fmtH(SHIFTS[sh.slot].start)}~${fmtH(SHIFTS[sh.slot].end)}`,
      html: `<div class="grid2" style="margin-bottom:10px">
        <div class="stat"><span>근무 시간</span><b>${worked.toFixed(1)}시간</b></div><div class="stat"><span>오늘 평점</span><b>${stars(score)}</b></div>
        <div class="stat"><span>계산한 손님</span><b>${sh.served}명</b></div><div class="stat"><span>화난 손님</span><b>${sh.angry}명</b></div>
        <div class="stat"><span>기본급${night ? ' (야간 1.5배)' : ''}</span><b>${won(base)}</b></div><div class="stat"><span>시재 차이</span><b style="color:${sh.cashDiff ? 'var(--bad)' : 'inherit'}">${sh.cashDiff ? '-' + won(sh.cashDiff) : '없음'}</b></div></div>
        <p class="note">${note}${M.warnings ? `<br>누적 경고 ${M.warnings}/3` : ''}</p>`,
    });
    this.checkFired();
    this.c.persist();
  }
  checkFired() {
    const M = this.M;
    if (M.warnings >= 3 && M.hired) {
      M.hired = false; M.slot = null; M.warnings = 0; M.firedUntil = ST.day(this.S) + 3;
      setTimeout(() => bigMsg('📵 해고됐어요', '경고가 3번 쌓였어요. 3일 뒤에 다시 지원할 수 있어요', 3600), 600);
    }
  }

  // 무단결근 · 주휴수당 (어디 있든 주기적으로 호출)
  dailyCheck() {
    const M = this.M, S = this.S;
    if (!M.hired || M.shift) return;
    const s = SHIFTS[M.slot];
    const today = Math.floor(S.minutes / 1440);
    const from = Math.max(M.lastCheckDay || 0, Math.floor((M.hiredMin ?? S.minutes) / 1440));
    for (let d = from; d <= today; d++) {
      if (d % 7 >= 5) continue;
      const end = d * 1440 + s.end * 60;
      const start = d * 1440 + s.start * 60;
      if (S.minutes < end) continue;
      if ((M.hiredMin ?? 0) > start) continue;
      if (!M.worked[d] && !M.absentNoted?.[d]) {
        M.absentNoted = M.absentNoted || {}; M.absentNoted[d] = true;
        M.warnings++;
        toast(`📵 ${d + 1}일차 무단결근! 점장님 경고 ${M.warnings}/3`, 'bad', 4500);
        this.checkFired();
      }
    }
    M.lastCheckDay = today;
    // 주 바뀌면 주휴수당
    const week = Math.floor(today / 7);
    if (M.week === undefined) M.week = week;
    if (week > M.week) {
      if (M.weekHours >= 15) {
        const bonus = this.wage() * Math.min(8, M.weekHours / 40 * 8);
        this.c.earn(bonus, `주휴수당 (주 ${M.weekHours.toFixed(1)}시간 근무)`);
      }
      M.week = week; M.weekHours = 0;
    }
  }

  // 근무 중 매 프레임
  update(dt) {
    const M = this.M, S = this.S, r = this.room;
    // 손님 생성
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const h = ST.hour(S);
      const busy = (h >= 7 && h < 9) || (h >= 12 && h < 13.5) || (h >= 18 && h < 21);
      const nightTime = h >= 23 || h < 6;
      const max = this.onShift ? (busy ? 5 : nightTime ? 2 : 4) : 3;
      if (r.npcs.length < max) r.spawnCustomer();
      this.spawnT = this.onShift ? (busy ? 5 : nightTime ? 13 : 8) * (0.7 + Math.random() * 0.6) : 14 + Math.random() * 10;
    }
    if (!this.onShift) return;
    const sh = M.shift;
    // 흘림 사고
    this.spillT -= dt;
    if (this.spillT <= 0) { this.spillT = 40 + Math.random() * 40; if (r.addSpill()) { toast('🧽 손님이 음료를 쏟았어요! 닦아 주세요'); this.c.audio.play('spill'); } }
    for (const s of r.spills) { s.age = (s.age || 0) + dt; if (s.age > 30) { sh.score -= dt * 0.01; } }
    // 진열 부족
    for (const k in r.stock) if (r.stock[k] < 0.15) sh.score -= dt * 0.004;
    // 물류 도착
    if (sh.deliveryAt && S.minutes >= sh.deliveryAt) {
      sh.deliveryAt = null; sh.deliveryLeft = 3;
      r.deliveryBoxes.forEach(b => b.visible = true);
      toast('🚚 물류 차량 도착! 입구의 상자 3개를 창고에 넣어 주세요', '', 4000);
      this.c.audio.play('truck');
    }
    // 퇴근 시간
    if (S.minutes >= sh.end && !this.ending) {
      this.ending = true;
      toast('🕐 근무 끝! 수고했어요');
      setTimeout(() => { this.ending = false; this.endShift(false); }, 600);
    }
  }
  hudText() {
    const M = this.M, S = this.S;
    if (this.onShift) {
      const sh = M.shift;
      const left = Math.max(0, sh.end - S.minutes);
      const tasks = [];
      const q = (this.room.queue || []).length;
      if (q) tasks.push(`🧍 손님 ${q}`);
      const low = Object.keys(this.room.stock).filter(k => this.room.stock[k] < 0.4).length;
      if (low) tasks.push(`📦 진열 ${low}`);
      if (this.room.spills.length) tasks.push(`🧽 청소 ${this.room.spills.length}`);
      if (sh.expiryDue) tasks.push('🗓 유통기한');
      if (sh.deliveryLeft) tasks.push(`🚚 물류 ${sh.deliveryLeft}`);
      return `🧑‍💼 근무 중 · 남은 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} · ${stars(sh.score)}<small>${tasks.join(' · ') || '할 일 없음 · 계산대에서 대기'}${this.carry ? ' · 📦 상자 들고 있음' : ''}</small>`;
    }
    if (this.basketCount()) return `🧺 장바구니 ${this.basketCount()}개 · ${won(this.basketTotal())}<small>계산대 앞에서 계산해요</small>`;
    return '';
  }

  // 손님이 계산대 맨 앞에 섰을 때 (매 프레임)
  atCounter(c, dt) {
    if (!this.onShift) {
      c.serveT = (c.serveT || 0) + dt;
      if (c.serveT > 3) c.state = 'paid';
      return;
    }
    if (c.inPos) return;
    if (!c.icon) this.room.setIcon(c, '💳');
    c.patience -= dt / 45;
    if (c.patience < 0.35 && !c.annoyed) { c.annoyed = true; this.room.setIcon(c, '😤'); toast('😤 손님이 계산을 기다리고 있어요!'); }
    if (c.patience <= 0) {
      c.mood = 0; c.state = 'paid';
      this.M.shift.score -= 0.45; this.M.shift.angry++;
      toast('😠 손님이 기다리다 그냥 나갔어요 (평점 -)', 'bad');
    }
  }

  // ───────── 계산 (POS) 미니게임 ─────────
  posGame(cust) {
    cust.inPos = true;
    this.room.setIcon(cust, null);
    const sh = this.M.shift;
    const items = cust.items.map((p, i) => ({ p, i, scanned: false, fail: Math.random() < 0.15 }));
    const wantBag = Math.random() < 0.3;
    const method = Math.random() < 0.68 ? 'card' : 'cash';
    let bag = false, stage = 'scan', change = 0, given = 0, errors = 0;
    const mg = $('mg');
    mg.classList.remove('hidden');
    const total = () => items.filter(x => x.scanned).reduce((a, x) => a + x.p.price, 0) + (bag ? 100 : 0);
    const say = (t) => { const el = mg.querySelector('#say'); if (el) el.textContent = t; };
    const render = () => {
      const allScanned = items.every(x => x.scanned);
      const tot = total();
      let pay = '';
      if (stage === 'pay') {
        if (method === 'card') pay = `<button class="btn wide green" id="cardBtn">💳 카드 받아서 결제하기</button>`;
        else pay = `<div class="cash"><div>받은 돈 <b>${won(given)}</b> · 거스름돈 <b class="chg">${won(change)}</b></div>
          <div class="coins">${[10000, 5000, 1000, 500, 100].map(v => `<button class="btn gray" data-v="${v}">${v >= 1000 ? '💵' : '🪙'} ${v.toLocaleString()}</button>`).join('')}<button class="btn red" data-v="0">↺</button></div>
          <button class="btn wide green" id="giveBtn">거스름돈 주기</button></div>`;
      }
      mg.innerHTML = `<div class="mg-box pos">
        <div class="mg-top"><span>🧾 POS 계산</span><span style="font-size:13px;color:var(--tx2)">손님 인내심 <i class="pat"><i style="width:${Math.max(0, cust.patience) * 100}%"></i></i></span></div>
        <div class="bubble" id="say">${stage === 'scan' ? (wantBag ? '"봉투 하나 주세요~"' : '"이거 계산이요."') : method === 'card' ? '"카드로 할게요."' : `"현금이요." (💵 ${won(given)} 받음)`}</div>
        <div class="posgrid">
          <div class="belt2">${items.map(x => `<button class="pitem ${x.scanned ? 'done' : ''}" data-i="${x.i}">${x.p.icon}<small>${x.p.name}</small></button>`).join('')}</div>
          <div class="receipt"><b>영수증</b>${items.filter(x => x.scanned).map(x => `<div><span>${x.p.name}</span><span>${x.p.price.toLocaleString()}</span></div>`).join('')}${bag ? '<div><span>봉투</span><span>100</span></div>' : ''}<div class="tot"><span>합계</span><span>${tot.toLocaleString()}원</span></div></div>
        </div>
        ${stage === 'scan' ? `<div class="mg-btns"><button class="btn ${bag ? 'green' : 'gray'}" id="bagBtn">🛍️ 봉투 ${bag ? '추가됨' : '+100원'}</button><button class="btn" id="doneBtn" ${allScanned ? '' : 'disabled'}>결제 요청</button></div>` : pay}
      </div>`;
      mg.querySelectorAll('.pitem').forEach(b => b.addEventListener('click', () => {
        const x = items[+b.dataset.i];
        if (x.scanned) return;
        if (x.fail) { x.fail = false; this.c.audio.play('scanfail'); say('삑— 바코드가 안 읽혀요. 한 번 더!'); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 300); return; }
        x.scanned = true; this.c.audio.play('scan'); render();
      }));
      mg.querySelector('#bagBtn')?.addEventListener('click', () => { bag = !bag; this.c.audio.play('click'); render(); });
      mg.querySelector('#doneBtn')?.addEventListener('click', () => {
        if (wantBag && !bag) { errors++; sh.score -= 0.15; say('"저… 봉투 달라고 했는데요?"'); bag = true; }
        stage = 'pay';
        if (method === 'cash') { const t = total(); given = [1000, 5000, 10000, 50000].find(v => v >= t + (Math.random() < 0.5 ? 0 : 1)) || 50000; if (given === t) given = [5000, 10000, 50000].find(v => v > t); }
        render();
      });
      mg.querySelector('#cardBtn')?.addEventListener('click', async () => {
        this.c.audio.play('card');
        say('결제 중… 💳');
        await wait(700);
        finish();
      });
      mg.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => { const v = +b.dataset.v; change = v ? change + v : 0; this.c.audio.play('coin'); render(); }));
      mg.querySelector('#giveBtn')?.addEventListener('click', () => {
        const need = given - total();
        if (change !== need) {
          errors++;
          const diff = Math.max(0, change - need);
          sh.cashDiff += diff;
          sh.score -= 0.35;
          toast(change > need ? `💸 거스름돈을 ${won(change - need)} 더 줬어요 (시재 차이)` : `😠 손님: "거스름돈 ${won(need - change)} 덜 주셨는데요?"`, 'bad', 3500);
          if (change < need) { change = need; }
        }
        finish();
      });
    };
    const finish = () => {
      mg.classList.add('hidden'); mg.innerHTML = '';
      cust.inPos = false;
      cust.mood = errors ? 0.5 : 1;
      cust.state = 'paid';
      sh.served++; sh.sales += total();
      sh.score += errors ? -0.05 : (cust.patience > 0.5 ? 0.18 : 0.08);
      sh.score = Math.min(5, sh.score);
      if (!errors) toast(`✅ 계산 완료 ${won(total())} · "감사합니다~"`, 'good', 1800);
    };
    render();
    // 인내심은 계산 중에도 천천히 줄어듦
    const iv = setInterval(() => {
      if (!cust.inPos) { clearInterval(iv); return; }
      cust.patience -= 0.006;
      const bar = mg.querySelector('.pat i'); if (bar) bar.style.width = Math.max(0, cust.patience) * 100 + '%';
    }, 250);
  }

  // ───────── 진열 ─────────
  storageSheet() {
    const r = this.room;
    openSheet({
      icon: '📦', title: '창고', sub: '진열할 상품 상자를 하나 들고 나가요',
      html: Object.keys(CATS).map(k => row({ icon: CATS[k].icon, title: `${CATS[k].name} 상자`, desc: `매대 재고 ${Math.round(r.stock[k] * 100)}%${r.stock[k] < 0.4 ? ' · 채워야 해요!' : ''}`, btn: '들기', btnClass: r.stock[k] < 0.4 ? 'green' : 'gray', action: 'take:' + k })).join(''),
      bind: (b) => bindActs(b, { take: (k) => { closeSheet(); this.setCarry(k); toast(`📦 ${CATS[k].name} 상자를 들었어요. 매대로 가세요`); } }),
    });
  }
  setCarry(k) {
    const { human } = this.c;
    this.carry = k;
    const box = this.room.carryBox;
    if (k) { human.root.add(box); box.position.set(0, 1.05, 0.38); human.carry = true; }
    else { human.root.remove(box); human.carry = false; }
  }
  async restock(cat) {
    this.c.setBusy(true);
    this.c.human.work = true;
    this.c.audio.play('restock');
    const r = this.room;
    const from = r.stock[cat];
    await this.progress('상품 진열하는 중', 2.5, (t) => { r.stock[cat] = from + (1 - from) * Math.min(1, t / 2.5); r.refreshStock(); });
    this.c.human.work = false;
    r.stock[cat] = 1; r.refreshStock();
    this.setCarry(null);
    this.M.shift.score += from < 0.4 ? 0.25 : 0.05;
    this.c.setBusy(false);
    toast(`✅ ${CATS[cat].name} 진열 완료!`, 'good');
  }
  storeDelivery() {
    this.setCarry(null);
    const sh = this.M.shift;
    sh.deliveryLeft = Math.max(0, (sh.deliveryLeft || 1) - 1);
    this.c.audio.play('restock');
    if (!sh.deliveryLeft) { sh.score += 0.35; toast('✅ 물류 정리 끝!', 'good'); }
    else toast(`📦 남은 물류 상자 ${sh.deliveryLeft}개`);
  }
  async cleanSpill(s) {
    this.c.setBusy(true);
    this.c.human.work = true;
    this.c.audio.play('mop');
    await this.progress('대걸레로 닦는 중', 2.2, (t) => { s.m.material.opacity = 0.55 * (1 - t / 2.2); });
    s.m.material.opacity = 0.55;
    this.c.human.work = false;
    this.room.removeSpill(s);
    this.M.shift.score += 0.15;
    this.c.setBusy(false);
    toast('✨ 깨끗해졌어요', 'good');
  }

  // ───────── 유통기한 확인 ─────────
  expiryGame() {
    const S = this.S, sh = this.M.shift;
    const now = S.minutes;
    const names = PRODUCTS.filter(p => p.cat === 'chill');
    const list = [];
    for (let k = 0; k < 7; k++) {
      const p = names[Math.floor(Math.random() * names.length)];
      const expired = k < 2 || Math.random() < 0.25;
      const t = expired ? now - (20 + Math.floor(Math.random() * 600)) : now + 30 + Math.floor(Math.random() * 1400);
      list.push({ p, t: Math.round(t / 60) * 60 - (expired ? 60 : 0), sel: false });
    }
    list.forEach(x => x.expired = x.t < now);
    const mg = $('mg');
    mg.classList.remove('hidden');
    const fmt = (m) => `${Math.floor(m / 1440) + 1}일차 ${fmtH((m % 1440) / 60)}`;
    const render = () => {
      mg.innerHTML = `<div class="mg-box"><div class="mg-top"><span>🗓 유통기한 확인 · 지금 ${fmt(now)}</span></div>
        <p class="note">기한이 <b>지난 상품</b>만 골라서 폐기하세요. 폐기 상품은 직원이 먹어도 돼요 😋</p>
        <div class="exp">${list.map((x, i) => `<button class="pitem ${x.sel ? 'sel' : ''}" data-i="${i}">${x.p.icon}<small>${x.p.name}</small><em>~ ${fmt(x.t)}</em></button>`).join('')}</div>
        <div class="mg-btns"><button class="btn green" id="expDone">폐기 처리 완료</button></div></div>`;
      mg.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { list[+b.dataset.i].sel = !list[+b.dataset.i].sel; this.c.audio.play('click'); render(); }));
      mg.querySelector('#expDone').addEventListener('click', () => {
        const right = list.filter(x => x.sel === x.expired).length;
        const got = list.filter(x => x.sel && x.expired);
        mg.classList.add('hidden'); mg.innerHTML = '';
        sh.expiryDue = false;
        const missed = list.length - right;
        sh.score += missed ? -0.2 * missed : 0.35;
        for (const x of got) S.inventory.food[x.p.id] = (S.inventory.food[x.p.id] || 0) + 1;
        if (missed) toast(`⚠️ ${missed}개를 잘못 골랐어요`, 'bad');
        else toast('✅ 완벽해요!', 'good');
        if (got.length) setTimeout(() => toast(`😋 폐기 ${got.map(x => x.p.name).join(', ')} 챙겼어요 (가방)`, 'good', 3500), 600);
      });
    };
    render();
  }
}

function desc(p) {
  if (p.ing) return '요리 재료 · ' + Object.entries(p.ing).map(([k, v]) => `${v}개`).join(', ') + (p.id === 'ramenpack' ? ' (집에서 끓여요)' : '');
  return `배고픔 +${p.hunger}${p.energy ? ` · 에너지 ${p.energy > 0 ? '+' : ''}${p.energy}` : ''}${p.needWater ? ' · 뜨거운 물 필요' : ''}${p.heat ? ' · 데우면 더 맛있어요' : ''}`;
}
export function fmtH(h) { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
export function stars(v) { const n = Math.round(v); return '★'.repeat(Math.max(0, n)) + '☆'.repeat(Math.max(0, 5 - n)); }

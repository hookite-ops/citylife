// ───────── 가게 알바 (실제 업무) ─────────
// 가게마다 면접 → 근무 시간 고르기 → 출근 → 주문이 들어오면 직접 만들기 → 퇴근하면 시급
import { $, toast, openSheet, closeSheet, sheetOpen, bindActs, row, bigMsg } from './ui.js';
import { MENUS } from './shopdata.js';
import { won } from './config.js';
import { unitKey } from './tenants.js';
import * as ST from './state.js';
import { espressoGame } from './minigames.js';
import { gate } from './lifestage.js';

export const MIN_WAGE = 10320;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 업무: 주문 → 레시피(누르는 순서)
const RECIPES = {
  cafe: () => { const m = pick(MENUS.cafe.filter(q => q.recipe)); return { name: m.name, icon: m.icon, steps: m.recipe, pool: ['얼음', '샷', '물', '우유', '시럽', '티', '딸기청', '휘핑'], shot: m.recipe.includes('샷'), latte: m.recipe.includes('우유') && !m.recipe.includes('얼음'), iced: m.recipe.includes('얼음') }; },
  burger: () => { const k = pick(['클래식', '치즈', '불고기']); const steps = k === '치즈' ? ['아래 빵', '패티', '치즈', '피클', '위 빵'] : k === '불고기' ? ['아래 빵', '불고기 패티', '양상추', '마요', '위 빵'] : ['아래 빵', '패티', '양상추', '토마토', '소스', '위 빵']; return { name: `${k} 버거`, icon: '🍔', steps, pool: ['아래 빵', '위 빵', '패티', '불고기 패티', '치즈', '양상추', '토마토', '피클', '소스', '마요'] }; },
  bunsik: () => pick([{ name: '떡볶이', icon: '🌶️', steps: ['떡', '어묵', '고추장 소스', '대파'], pool: ['떡', '어묵', '고추장 소스', '대파', '김', '단무지', '계란'] }, { name: '김밥', icon: '🍙', steps: ['김', '밥', '단무지', '계란', '말기'], pool: ['김', '밥', '단무지', '계란', '말기', '떡', '어묵'] }, { name: '라면', icon: '🍜', steps: ['물', '면', '스프', '계란'], pool: ['물', '면', '스프', '계란', '대파', '떡'] }]),
  chicken: () => { const y = Math.random() < 0.5; return { name: y ? '양념 치킨' : '후라이드 치킨', icon: '🍗', steps: y ? ['반죽 입히기', '튀기기', '양념 버무리기', '포장'] : ['반죽 입히기', '튀기기', '기름 빼기', '포장'], pool: ['반죽 입히기', '튀기기', '양념 버무리기', '기름 빼기', '포장', '치킨무'] }; },
  pizza: () => ({ name: pick(['페퍼로니', '불고기', '포테이토']) + ' 피자', icon: '🍕', steps: ['도우 펴기', '토마토 소스', '치즈', '토핑', '오븐'], pool: ['도우 펴기', '토마토 소스', '치즈', '토핑', '오븐', '피클'] }),
  bbq: () => pick([{ name: '3번 테이블 불판 교체', icon: '🔥', steps: ['장갑 끼기', '불판 빼기', '새 불판'], pool: ['장갑 끼기', '불판 빼기', '새 불판', '집게', '숯'] }, { name: '5번 테이블 반찬 리필', icon: '🥬', steps: ['상추', '쌈장', '김치'], pool: ['상추', '쌈장', '김치', '콩나물', '물'] }, { name: '2번 테이블 고기 서빙', icon: '🥩', steps: ['고기 담기', '숯 넣기', '서빙'], pool: ['고기 담기', '숯 넣기', '서빙', '반찬', '물'] }]),
  bakery: () => pick([{ name: '소금빵 굽기', icon: '🥐', steps: ['반죽', '버터 넣기', '성형', '굽기', '진열'], pool: ['반죽', '버터 넣기', '성형', '굽기', '진열', '크림'] }, { name: '단팥빵 굽기', icon: '🍞', steps: ['반죽', '팥 넣기', '성형', '굽기', '진열'], pool: ['반죽', '팥 넣기', '성형', '굽기', '진열', '버터 넣기'] }]),
  pcbang: () => pick([{ name: '7번 자리 라면', icon: '🍜', steps: ['물 끓이기', '면', '스프', '계란', '서빙'], pool: ['물 끓이기', '면', '스프', '계란', '서빙', '치즈'] }, { name: '12번 자리 정리', icon: '🧹', steps: ['컵 치우기', '키보드 닦기', '의자 정리'], pool: ['컵 치우기', '키보드 닦기', '의자 정리', '라면'] }]),
  karaoke: () => ({ name: `${1 + Math.floor(Math.random() * 8)}번 방 청소`, icon: '🧹', steps: ['쓰레기 치우기', '테이블 닦기', '마이크 소독', '리모컨 정리'], pool: ['쓰레기 치우기', '테이블 닦기', '마이크 소독', '리모컨 정리', '탬버린'] }),
  hansik: () => pick([{ name: '김치찌개 2인분', icon: '🍲', steps: ['김치 볶기', '물', '두부', '대파'], pool: ['김치 볶기', '물', '두부', '대파', '계란', '고기'] }, { name: '반찬 세팅', icon: '🥬', steps: ['김치', '콩나물', '계란말이', '서빙'], pool: ['김치', '콩나물', '계란말이', '서빙', '쌈장'] }]),
};
RECIPES.dessert = RECIPES.cafe; RECIPES.chinese = () => pick([{ name: '짜장면', icon: '🍜', steps: ['면 삶기', '짜장 소스', '오이', '서빙'], pool: ['면 삶기', '짜장 소스', '짬뽕 국물', '오이', '서빙', '단무지'] }, { name: '짬뽕', icon: '🍜', steps: ['면 삶기', '짬뽕 국물', '해물', '서빙'], pool: ['면 삶기', '짜장 소스', '짬뽕 국물', '해물', '서빙'] }]);
RECIPES.japanese = () => ({ name: '모둠 초밥', icon: '🍣', steps: ['밥 쥐기', '와사비', '생선 올리기', '접시'], pool: ['밥 쥐기', '와사비', '생선 올리기', '접시', '간장'] });
export const JOB_TYPES = Object.keys(RECIPES);
const GENERIC = () => pick([{ name: '손님 응대', icon: '🙋', steps: ['인사', '주문 받기', '준비', '계산'], pool: ['인사', '주문 받기', '준비', '계산', '청소', '포장'] }, { name: '매장 정리', icon: '🧹', steps: ['쓸기', '닦기', '진열'], pool: ['쓸기', '닦기', '진열', '계산', '인사'] }]);

// 근무 시간대: 가게 영업시간에서
function slotsFor(type, hours) {
  const [o, c] = hours;
  const out = [];
  const span = Math.min(c, o + 24) - o;
  const n = Math.max(1, Math.min(3, Math.floor(span / 4)));
  for (let i = 0; i < n; i++) { const st = o + i * Math.floor(span / n); out.push({ id: i, start: st, end: Math.min(c, st + 4), name: ['오픈', '미들', '마감'][i] || '추가' }); }
  return out;
}
const fh = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

export class JobGame {
  constructor(ctx) { this.c = ctx; this.shift = null; this.taskT = 0; }   // { S, audio, earn, persist, hoursOf(type), isOpen(type) }
  get S() { return this.c.S; }
  jobs() { return this.S.parttime || (this.S.parttime = {}); }
  keyOf(s, bldg) { return unitKey(bldg.B.id, bldg.n, s.unit.k); }
  get onShift() { return !!this.shift; }

  // 카운터에서: 근무 중이면 업무 버튼
  counterAction(z, s, bldg) {
    const key = this.keyOf(s, bldg);
    const mine = this.c.myShop?.(bldg.B.id, bldg.n, s.unit.k);
    if (mine) {
      if (this.shift && this.shift.key === key) return this.shiftAction();
      if (this.shift) return null;
      return { label: `🧑‍🍳 내 가게 ${mine.shop.name} · 직접 영업하기 (4시간)`, fn: () => this.ownerIn(key, mine, s), green: true, alt: true };
    }
    if (!JOB_TYPES.includes(s.type)) return null;
    const J = this.jobs()[key];
    if (this.shift && this.shift.key === key) return this.shiftAction();
    if (false) {
      const q = this.shift.queue.length;
      if (q) return { label: `🧑‍🍳 ${this.shift.queue[0].icon} ${this.shift.queue[0].name} 처리하기 (대기 ${q})`, fn: () => this.task(), green: true };
      return { label: `🧑‍💼 근무 중 · 주문 기다리는 중`, fn: () => toast('🧑‍💼 손님이 오면 주문이 들어와요') };
    }
    if (J && !this.shift) {
      const st = this.status(J);
      if (st.can) return { label: `🕐 출근하기 · ${J.slotName} ${fh(J.start)}~${fh(J.end)}`, fn: () => this.clockIn(key, J, s), green: true };
    }
    return null;
  }
  shiftAction() {
    const q = this.shift.queue.length;
    if (q) return { label: `🧑‍🍳 ${this.shift.queue[0].icon} ${this.shift.queue[0].name} 처리하기 (대기 ${q})`, fn: () => this.task(), green: true };
    return { label: `🧑‍💼 ${this.shift.J.owner ? '영업' : '근무'} 중 · 주문 기다리는 중`, fn: () => toast('🧑‍💼 손님이 오면 주문이 들어와요') };
  }
  ownerIn(key, c, s) {
    const S = this.S, h = ST.hour(S) % 24;
    const J = { key, name: c.shop.name, type: c.shop.type, start: h, end: Math.min(h + 4, 26), slotName: '사장님', wage: 0, owner: c, warnings: 0, shifts: 0 };
    this.shift = { key, J, s, queue: [], done: 0, mistakes: 0, angry: 0, score: 1, end: S.minutes + 240, earned: 0 };
    this.taskT = 0.5;
    toast(`🧑‍🍳 ${c.shop.name} 영업 시작! 주문이 들어오면 카운터에서 처리해요`, 'good', 3200);
  }
  // 알바 모집 공고
  postAction(z, s, bldg) {
    if (!JOB_TYPES.includes(s.type)) return null;
    const key = this.keyOf(s, bldg), J = this.jobs()[key];
    if (J) return { label: `🗓 내 알바 · ${J.slotName} ${fh(J.start)}~${fh(J.end)}`, fn: () => this.mySheet(key, J) };
    return { label: '📌 알바 모집 공고 보기', fn: () => this.postSheet(key, s, bldg) };
  }
  status(J) {
    const S = this.S, h = ST.hour(S) % 24, day = ST.day(S);
    if (J.lastDay === day) return { can: false, msg: '오늘 근무는 끝났어요' };
    if (h >= J.start - 0.25 && h < J.end - 1) return { can: true };
    return { can: false, msg: `근무 ${fh(J.start)}~${fh(J.end)}` };
  }
  postSheet(key, s, bldg) {
    const S = this.S;
    const hours = this.c.hoursOf(s.type);
    const slots = slotsFor(s.type, hours);
    const cert = { cafe: 'barista', bakery: 'baker', hansik: 'cook', chinese: 'cook', japanese: 'cook' }[s.type];
    const bonus = cert && S.certs?.[cert] ? 1500 : 0;
    const wage = MIN_WAGE + bonus + (s.t.fr ? 0 : 300);
    if ((S.parttimeFired || {})[key] > ST.day(S)) { toast('🙅 사장님: "저번에 너무 자주 빠지셨잖아요…"', 'bad'); return; }
    openSheet({
      icon: '📌', title: `${s.t.name} 아르바이트 모집`, sub: '사장님과 짧은 면접',
      html: `<div class="grid2" style="margin-bottom:10px"><div class="stat"><span>시급</span><b>${won(wage)}</b></div><div class="stat"><span>근무</span><b>하루 4시간</b></div></div>
        ${bonus ? '<p class="note" style="color:var(--good)">🎓 자격증이 있어서 시급이 더 높아요!</p>' : cert ? `<p class="note">자격증(${cert === 'barista' ? '바리스타' : cert === 'baker' ? '제과제빵' : '조리사'})이 있으면 시급 +1,500원</p>` : ''}
        <p class="note">하는 일: 주문 들어오면 순서대로 만들기 · 늦으면 손님이 화나요 · 무단결근 3번이면 해고</p>
        <div class="note" style="color:#ddd">근무 시간 고르기</div>
        ${slots.map(sl => row({ icon: '🕐', title: `${sl.name} ${fh(sl.start)}~${fh(sl.end)}`, btn: '면접 보기', action: 'sl:' + sl.id })).join('')}`,
      bind: (b) => bindActs(b, { sl: (i) => this.interview(key, s, bldg, slots[+i], wage) }),
    });
  }
  interview(key, s, bldg, sl, wage) {
    if (!gate.can('work')) return;
    const Q = [
      { q: '손님이 주문을 잘못 말했다고 화를 내면?', a: ['"죄송합니다, 바로 다시 해 드릴게요!"', '"손님이 잘못 말하셨잖아요"', '못 들은 척한다'], ok: 0 },
      { q: '근무 시간에 갑자기 못 나오게 되면?', a: ['그냥 안 간다', '미리 사장님께 연락한다', '친구를 대신 보낸다'], ok: 1 },
      { q: '바쁜 시간에 주문이 밀리면?', a: ['순서대로 빠르고 정확하게', '쉬운 것만 먼저', '잠깐 쉬었다 한다'], ok: 0 },
    ];
    const qs = [pick(Q), pick(Q)];
    let i = 0, score = 0;
    const ask = () => {
      const q = qs[i];
      openSheet({
        icon: '🧑‍💼', title: `면접 ${i + 1}/2`, sub: q.q,
        html: q.a.map((t, k) => `<button class="btn wide gray" data-act="a:${k}" style="margin-bottom:8px;text-align:left">${t}</button>`).join(''),
        bind: (b) => bindActs(b, { a: (k) => { if (+k === q.ok) score++; i++; if (i < qs.length) ask(); else done(); } }),
      });
    };
    const done = () => {
      closeSheet();
      if (score >= 1 || Math.random() < 0.3) {
        this.jobs()[key] = { key, name: s.t.name, type: s.type, bid: bldg.B.id, bname: bldg.B.name, n: bldg.n, k: s.unit.k, start: sl.start, end: sl.end, slotName: sl.name, wage, warnings: 0, shifts: 0, lastDay: -1, hiredDay: ST.day(this.S) };
        bigMsg('🎉 합격!', `${s.t.name} · ${sl.name} ${fh(sl.start)}~${fh(sl.end)} · 시급 ${won(wage)}`, 3000);
        this.c.persist();
      } else toast('🙅 "이번엔 같이 일하기 어렵겠어요"', 'bad', 3000);
    };
    ask();
  }
  mySheet(key, J) {
    openSheet({
      icon: '🗓', title: `${J.name} 알바`, sub: `${J.bname} ${J.n}층`,
      html: `<div class="grid2"><div class="stat"><span>근무</span><b>${J.slotName} ${fh(J.start)}~${fh(J.end)}</b></div><div class="stat"><span>시급</span><b>${won(J.wage)}</b></div><div class="stat"><span>근무 횟수</span><b>${J.shifts}번</b></div><div class="stat"><span>경고</span><b>${J.warnings}/3</b></div></div><button class="btn wide red" data-act="quit" style="margin-top:10px">그만두기</button>`,
      bind: (b) => bindActs(b, { quit: () => { delete this.jobs()[key]; closeSheet(); toast('👋 알바를 그만뒀어요'); this.c.persist(); } }),
    });
  }
  clockIn(key, J, s) {
    const S = this.S;
    const late = ST.hour(S) % 24 > J.start + 0.1;
    this.shift = { key, J, s, queue: [], done: 0, mistakes: 0, angry: 0, score: 1, end: Math.floor(S.minutes / 1440) * 1440 + J.end * 60, earned: 0 };
    this.taskT = 0.5;
    J.lastDay = ST.day(S);
    if (late) { this.shift.score -= 0.2; toast('⏰ 지각했어요… 사장님 표정이 안 좋아요', 'bad'); }
    else toast(`👋 출근! ${J.slotName} 근무 시작 · 주문이 들어오면 카운터에서 처리해요`, 'good', 3200);
    this.c.audio.play?.('pick');
  }
  // 매 프레임 (근무 중)
  update(dt) {
    const sh = this.shift; if (!sh) return;
    const S = this.S;
    this.taskT -= dt;
    if (this.taskT <= 0) {
      const h = ST.hour(S) % 24;
      const busy = (h >= 11.5 && h < 13.5) || (h >= 18 && h < 20.5);
      this.taskT = (busy ? 9 : 16) * (0.7 + Math.random() * 0.6);
      if (sh.queue.length < 5) { const r = (RECIPES[sh.J.type] || GENERIC)(); r.t = 0; sh.queue.push(r); this.c.audio.play?.('ding'); if (sh.queue.length === 1) toast(`🔔 주문 들어왔어요: ${r.icon} ${r.name}`, '', 2200); }
    }
    for (const q of sh.queue) { q.t += dt; if (q.t > 60 && !q.warned) { q.warned = true; sh.score -= 0.15; sh.angry++; toast('😤 손님이 오래 기다려서 화났어요!', 'bad'); } }
    if (S.minutes >= sh.end) this.clockOut(false);
  }
  task() {
    const sh = this.shift; if (!sh || !sh.queue.length) return;
    const r = sh.queue[0];
    // 커피: 직접 원두 갈고 · 탬핑 · 샷 추출 · 우유 스팀
    if (r.shot) {
      return espressoGame({ name: r.name, icon: r.icon, latte: r.latte, iced: r.iced, audio: this.c.audio }, (sc) => {
        if (sh !== this.shift) return;
        sh.queue.shift(); sh.done++;
        const good = sc >= 0.85;
        if (sc < 0.5) sh.mistakes++;
        sh.score += sc < 0.5 ? -0.08 : good ? 0.06 : 0.02;
        toast(good ? `✨ 완벽한 ${r.name}! 손님: "커피 진짜 맛있어요"` : sc < 0.5 ? `😓 ${r.name} · 손님 표정이 별로예요` : `✅ ${r.name} 완성`, sc < 0.5 ? 'bad' : 'good', 2200);
        if (good && Math.random() < 0.3) { sh.tips = (sh.tips || 0) + 1000; toast('💵 손님이 팁 1,000원을 줬어요', 'good'); }
      });
    }
    const pool = shuffle([...new Set([...r.steps, ...r.pool])]).slice(0, Math.max(r.steps.length + 2, 6));
    for (const st of r.steps) if (!pool.includes(st)) pool[Math.floor(Math.random() * pool.length)] = st;
    const mg = $('mg'); mg.classList.remove('hidden', 'soft');
    let i = 0, miss = 0, t = 0, ended = false, last = performance.now();
    const limit = 6 + r.steps.length * 2.2;
    mg.innerHTML = `<div class="mg-box"><div class="mg-top"><span>${r.icon} ${r.name}</span><span class="t" id="jT"></span></div>
      <div id="jSteps" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:12px">${r.steps.map((st, k) => `<span class="pill" data-k="${k}" style="padding:6px 10px;border-radius:12px;background:rgba(255,255,255,.08);font-size:13px">${k + 1}. ${st}</span>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[...new Set(pool)].map(p => `<button class="btn gray" style="padding:14px 6px;font-size:15px" data-p="${p}">${p}</button>`).join('')}</div>
      <p class="note" style="text-align:center" id="jMsg">순서대로 눌러요</p></div>`;
    const steps = mg.querySelectorAll('#jSteps span');
    mg.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
      if (ended) return;
      if (b.dataset.p === r.steps[i]) { steps[i].style.background = 'rgba(61,220,132,.45)'; i++; this.c.audio.play?.('pick'); if (i >= r.steps.length) end(true); }
      else { miss++; b.style.background = 'rgba(255,80,80,.5)'; setTimeout(() => (b.style.background = ''), 300); $('jMsg').textContent = '앗, 순서가 틀렸어요!'; this.c.audio.bad?.(); }
    }));
    const step = (now) => {
      if (ended || !$('jT')) return;
      t += (now - last) / 1000; last = now;
      $('jT').textContent = Math.max(0, Math.ceil(limit - t)) + '초';
      if (t >= limit) return end(false);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    const end = (ok) => {
      ended = true; mg.classList.add('hidden'); mg.innerHTML = '';
      sh.queue.shift();
      sh.done++; sh.mistakes += miss;
      const good = ok && miss === 0 && t < limit * 0.6;
      sh.score += !ok ? -0.12 : good ? 0.06 : miss ? -0.03 : 0.02;
      if (!ok) toast('⌛ 너무 늦었어요… 다시 만들어 드렸어요', 'bad');
      else toast(good ? `✨ 완벽! ${r.icon} 손님: "와 빠르다!"` : `✅ ${r.name} 완성`, 'good', 1600);
      if (good && Math.random() < 0.25) { sh.tips = (sh.tips || 0) + 1000; toast('💵 손님이 팁 1,000원을 줬어요', 'good'); }
    };
  }
  clockOut(early) {
    const sh = this.shift; if (!sh) return;
    const S = this.S, J = sh.J;
    if (J.owner) {
      const c = J.owner, hrs = Math.max(0.3, (240 - Math.max(0, sh.end - S.minutes)) / 60);
      const biz = { cafe: 6500, bakery: 9000, bunsik: 9000, chicken: 26000, pizza: 28000, burger: 9500, hansik: 11000, chinese: 12000, japanese: 16000, bbq: 48000, dessert: 9000 }[J.type] || 15000;
      const rev = Math.round(sh.done * biz * c.shop.price * 0.62 / 10) * 10;
      this.shift = null;
      c.shop.workedDay = ST.day(S); c.shop.workedHours = (c.shop.workedHours || 0) + hrs;
      c.shop.rating = Math.max(1, Math.min(5, c.shop.rating + (sh.score - 0.9) * 0.4));
      if (rev > 0) this.c.earn(rev, `${c.shop.name} 직접 영업 (손님 ${sh.done}명)`);
      bigMsg('🏪 영업 끝!', `손님 ${sh.done}명 · 평판 ${'⭐'.repeat(Math.round(c.shop.rating))}`, 2800);
      this.c.persist();
      return;
    }
    const startMin = Math.floor(S.minutes / 1440) * 1440 + J.start * 60;
    const hrs = Math.max(0.5, Math.min(J.end - J.start, (S.minutes - startMin) / 60));
    const night = J.end > 22 ? 1.5 : 1;
    const pay = Math.round(hrs * J.wage * (J.end > 22 ? (0.7 + 0.3 * night) : 1) / 10) * 10 + (sh.tips || 0);
    this.shift = null;
    J.shifts++;
    const score = Math.max(0, Math.min(1.2, sh.score));
    if (early) { J.warnings++; toast('🏃 조퇴했어요 · 경고 +1', 'bad'); }
    if (score > 1.05 && J.shifts % 5 === 0) { J.wage += 300; toast('🎉 사장님: "일 잘하네! 시급 300원 올려 줄게"', 'good', 3600); }
    this.c.earn(pay, `${J.name} 알바 ${hrs.toFixed(1)}시간`);
    bigMsg('👋 퇴근!', `처리한 주문 ${sh.done}건 · 실수 ${sh.mistakes} · 화난 손님 ${sh.angry}`, 2800);
    if (J.warnings >= 3) { delete this.jobs()[J.key]; (S.parttimeFired = S.parttimeFired || {})[J.key] = ST.day(S) + 7; toast('🙅 경고 3번… 해고됐어요', 'bad', 4000); }
    this.c.persist();
  }
  // 하루 체크: 무단결근
  dailyCheck() {
    const S = this.S, day = ST.day(S), h = ST.hour(S) % 24;
    for (const J of Object.values(this.jobs())) {
      if (J.hiredDay === day) continue;
      if (J.lastDay !== day && h > J.end && J.checked !== day) {
        J.checked = day; J.warnings++;
        toast(`📞 ${J.name} 사장님: "오늘 왜 안 나왔어요?" (경고 ${J.warnings}/3)`, 'bad', 4000);
        if (J.warnings >= 3) { delete this.jobs()[J.key]; (S.parttimeFired = S.parttimeFired || {})[J.key] = day + 7; toast(`🙅 ${J.name}에서 해고됐어요`, 'bad', 4000); }
      }
    }
  }
  hudText() {
    const sh = this.shift; if (!sh) return '';
    const S = this.S, left = Math.max(0, sh.end - S.minutes);
    return `🧑‍🍳 ${sh.J.name} 근무 중 · 남은 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}<small>주문 대기 ${sh.queue.length} · 처리 ${sh.done}건 · ${'⭐'.repeat(Math.max(1, Math.round(Math.min(1, sh.score) * 5)))}</small>`;
  }
}

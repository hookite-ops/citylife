// ───────── 성장: 아기 → 초등학생 → 중학생 → 고등학생 → 성인 (졸업하면 다음 단계 · 성인에서 멈춤) ─────────
import { createPed } from './human.js';
import { won } from './config.js';
import { toast, bigMsg, openSheet, closeSheet, bindActs, row, fade } from './ui.js';
import * as ST from './state.js';

// 다른 모듈에서 쓰는 문지기 (main이 실제 판정으로 바꿔 끼움)
export const gate = { can: () => true, stage: () => 'adult' };

export const STAGES = {
  baby: { name: '아기', icon: '👶', scale: 0.44, speed: 0.5, next: 'elem' },
  elem: { name: '초등학생', icon: '🧒', scale: 0.66, speed: 0.85, school: 'elem', schoolName: '한빛초등학교', need: 6, next: 'middle', allowance: 3000 },
  middle: { name: '중학생', icon: '🧑', scale: 0.82, speed: 0.95, school: 'middle', schoolName: '한빛중학교', need: 6, next: 'high', allowance: 5000 },
  high: { name: '고등학생', icon: '🧑‍🎓', scale: 0.93, speed: 1, school: 'high', schoolName: '한빛고등학교', need: 6, next: 'adult', allowance: 10000 },
  adult: { name: '성인', icon: '🧑‍💼', scale: 1, speed: 1 },
};
// 어른만 할 수 있는 것 (고등학생은 알바 가능)
const ADULT = { drive: '🚗 운전은 성인이 되면 할 수 있어요', career: '💼 취업은 고등학교를 졸업하고 성인이 되면 할 수 있어요', contract: '🏠 집·가게 계약은 성인이 되면 할 수 있어요',
  univ: '🎓 대학교는 고등학교를 졸업하면 갈 수 있어요', delivery: '🛵 배달 일은 성인이 되면 할 수 있어요', work: '🧑‍🍳 알바는 고등학생부터 할 수 있어요' };
const BABY_CARE = [
  { id: 'milk', icon: '🍼', title: '엄마한테 우유 달라고 하기', desc: '배고픔 +40', grow: 18, min: 20, hunger: 40, mood: 4 },
  { id: 'play', icon: '🧸', title: '엄마랑 까꿍 놀이', desc: '기분 +15', grow: 15, min: 30, mood: 15, energy: -8 },
  { id: 'walk', icon: '👣', title: '걸음마 연습', desc: '아장아장 · 성장 많이', grow: 22, min: 30, energy: -12, mood: 6 },
  { id: 'book', icon: '📖', title: '그림책 읽어 주세요', desc: '말을 배워요', grow: 16, min: 25, mood: 8 },
];

export class LifeStage {
  // ctx: { S, human, audio, persist, updateHUD, homeRoot(), homeDoor(), inHome() }
  constructor(ctx) { this.c = ctx; this.parents = []; }
  get S() { return this.c.S; }
  get id() { return this.S.stage || 'adult'; }
  get st() { return STAGES[this.id]; }
  get minor() { return this.id !== 'adult'; }
  get baby() { return this.id === 'baby'; }
  scale() { return this.st.scale; }

  // 어른만 할 수 있는 일인지 확인 (안 되면 안내하고 false)
  can(kind) {
    const id = this.id;
    if (id === 'adult') return true;
    if (kind === 'work' && id === 'high') return true;
    toast(ADULT[kind] || '🔒 성인이 되면 할 수 있어요', 'bad', 3000);
    return false;
  }
  apply() { this.c.human.root.scale.setScalar(this.scale()); }

  // 매일 아침: 학생은 용돈
  daily() {
    const S = this.S, day = ST.day(S);
    if (S.allowDay === day) return;
    const first = S.allowDay == null;
    S.allowDay = day;
    if (first) return;
    const a = this.st.allowance;
    if (a) { S.cash = (S.cash || 0) + a; toast(`💵 엄마가 용돈 ${won(a)}을 줬어요`, 'good', 2600); }
  }

  // ─ 아기: 집에서 엄마·아빠가 돌봐 줘요 ─
  ensureParents(root, door, show) {
    const want = show && this.minor;
    if (!want) { for (const p of this.parents) p.root.parent?.remove(p.root); this.parents = []; return; }
    if (this.parents.length && this.parents[0].root.parent === root) return;
    for (const p of this.parents) p.root.parent?.remove(p.root);
    this.parents = [];
    const mom = createPed({ skin: 0xf0c8a0, hair: 0x2a1a10, shirt: 0xe07aa0, pants: 0x3a3f5a, shoes: 0x5a3a2a, hairStyle: 'long', face: 'smile' });
    mom.root.position.set(0.4, 0, 0.2);   // 방 가운데 mom.role = 'mom';
    root.add(mom.root); this.parents.push(mom);
  }
  updateParents(dt, pos) {
    for (const p of this.parents) {
      const r = p.root;
      r.rotation.y = Math.atan2(pos.x - r.position.x, pos.z - r.position.z);
      p.act(dt, this.talkT > 0 ? 'talk' : 'idle');
    }
    if (this.talkT > 0) this.talkT -= dt;
  }
  parentAction(pos) {
    const m = this.parents[0];
    if (!m || Math.hypot(pos.x - m.root.position.x, pos.z - m.root.position.z) > 2.0) return null;
    if (this.baby) return { label: '👩 엄마한테 가기 · 돌봐 줘요', fn: () => this.babySheet(), green: true };
    const slot = this.mealSlot();
    if (slot && this.S.mealGot !== slot) return { label: '🍚 엄마가 차려 준 밥 먹기', fn: () => this.homeMeal(slot), green: true };
    return { label: '💬 엄마랑 이야기하기', fn: () => { this.talkT = 3; this.S.mood = ST.clamp(this.S.mood + 4); toast(`👩 엄마: ${['"숙제는 다 했니?"', '"오늘 학교 재밌었어?"', '"일찍 자야 키 큰다~"', '"용돈 아껴 써!"'][Math.floor(Math.random() * 4)]}`, '', 3200); } };
  }
  mealSlot() { const h = ST.hour(this.S) % 24, d = ST.day(this.S); return h >= 7 && h < 9 ? d + 'a' : h >= 12 && h < 13.5 ? d + 'l' : h >= 18 && h < 20.5 ? d + 'd' : null; }
  async homeMeal(slot) {
    const S = this.S;
    S.mealGot = slot;
    this.c.setBusy?.(true); await fade(true);
    ST.passTime(S, 25, 'idle'); S.hunger = ST.clamp(S.hunger + 55); S.mood = ST.clamp(S.mood + 6); S.ateOnce = true;
    this.c.onEat?.({ name: '집밥 백반', hunger: 55 });
    await fade(false); this.c.setBusy?.(false);
    toast('🍚 엄마표 집밥 잘 먹었습니다! (배고픔 +55)', 'good');
    this.c.persist();
  }
  babySheet() {
    const S = this.S, now = S.minutes;
    S.care = S.care || {};
    const g = Math.round(S.grow || 0);
    openSheet({
      icon: '👶', title: '아기 돌보기', sub: `무럭무럭 자라는 중 · 성장 ${g}/100`,
      html: `<div style="height:10px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden;margin-bottom:10px"><i style="display:block;height:100%;width:${g}%;background:#ffb6d2"></i></div>` +
        BABY_CARE.map(c => { const left = Math.max(0, (S.care[c.id] || 0) + 120 - now); return row({ icon: c.icon, title: c.title, desc: left > 0 ? `조금 있다가 (${Math.ceil(left / 60 * 10) / 10}시간)` : c.desc, btn: '응!', action: 'do:' + c.id, disabled: left > 0, btnClass: 'green' }); }).join('') +
        '<p class="note">😴 침대에서 푹 자도 쑥쑥 커요 · 성장이 100이 되면 초등학교에 들어가요</p>',
      bind: (b) => bindActs(b, {
        do: async (id) => {
          const c = BABY_CARE.find(q => q.id === id);
          closeSheet();
          S.care[id] = S.minutes;
          this.talkT = 2.5;
          ST.passTime(S, c.min, 'idle');
          if (c.hunger) S.hunger = ST.clamp(S.hunger + c.hunger);
          if (c.energy) S.energy = ST.clamp(S.energy + c.energy);
          if (c.mood) S.mood = ST.clamp(S.mood + c.mood);
          if (c.hunger) this.c.onEat?.({ name: '우유', hunger: c.hunger });
          this.c.audio?.play?.('pick');
          toast(`${c.icon} ${{ milk: '꿀꺽꿀꺽… 배불러요', play: '까르르~ 신나요!', walk: '아장아장… 한 걸음 더!', book: '"멍멍이!" 새 말을 배웠어요' }[id]}`, 'good');
          this.grow(c.grow);
        },
      }),
    });
  }
  // 아기 성장 (돌봄 · 잠)
  grow(n) {
    const S = this.S;
    if (!this.baby) return;
    S.grow = Math.min(100, (S.grow || 0) + n);
    this.c.updateHUD?.();
    if (S.grow >= 100) setTimeout(() => this.advance(), 600);
    this.c.persist();
  }
  onSleep(hours) { if (this.baby && hours >= 2) { this.grow(Math.min(30, Math.round(hours * 4))); toast('😴 자면서 쑥쑥 컸어요', 'good'); } }

  // ─ 학생: 학교 수업 출석 → 졸업 시험 → 다음 단계 ─
  isStudentOf(level) { return this.st.school === level; }
  stud() { const S = this.S; if (!S.stud || S.stud.lv !== this.id) S.stud = { lv: this.id, n: 0, attended: {}, scores: [], tries: 0 }; return S.stud; }
  // 지금 수업 시간 칸 (오전 · 오후)
  slot() { const S = this.S, h = ST.hour(S) % 24, d = ST.day(S); if (ST.isWeekend(S)) return null; if (h >= 9 && h < 12) return d + 'am'; if (h >= 13 && h < 15.5) return d + 'pm'; return null; }
  seatAction(level, schoolGame) {
    if (!this.isStudentOf(level)) return null;
    const U = this.stud(), st = this.st, k = this.slot();
    if (!k) return { label: `🎒 ${st.name} 내 자리 · 수업은 평일 9시·13시`, fn: () => this.statusSheet() };
    if (U.attended[k]) return { label: '✅ 이번 시간 수업은 들었어요', fn: () => this.statusSheet() };
    if (U.n >= st.need) return { label: `🎓 졸업 시험 보기 (${st.schoolName})`, fn: () => this.gradExam(level, schoolGame, k), green: true };
    return { label: `📖 수업 듣기 (${U.n + 1}/${st.need})`, fn: () => this.lesson(level, schoolGame, k), green: true };
  }
  async lesson(level, sg, k) {
    const U = this.stud(), S = this.S;
    sg.sitAt(sg.room.nearestFreeSeat(sg.c.player.pos));
    U.attended[k] = true;
    const { questions } = await import('./quiz.js');
    const score = await sg.quiz({ title: `📖 ${this.st.schoolName} 수업`, sub: '선생님: "자, 오늘 배운 거 풀어 볼까요?"', qs: questions(level, 4, 0.3), sleepy: S.energy < 30, perQ: 16 });
    ST.passTime(S, 90, 'work');
    U.n++; U.scores.push(score);
    sg.stand();
    toast(`📖 수업 끝! 이해도 ${Math.round(score * 100)}점 · ${U.n}/${this.st.need}`, 'good', 3000);
    if (U.n >= this.st.need) setTimeout(() => toast('🎓 이제 다음 수업 시간에 졸업 시험을 볼 수 있어요!', 'good', 3600), 1400);
    this.c.persist();
  }
  async gradExam(level, sg, k) {
    const U = this.stud(), S = this.S, st = this.st;
    sg.sitAt(sg.room.nearestFreeSeat(sg.c.player.pos));
    U.attended[k] = true;
    const { questions } = await import('./quiz.js');
    const sc = await sg.quiz({ title: `🎓 ${st.schoolName} 졸업 시험`, sub: '6문제 중 3문제 이상 맞히면 졸업!', qs: questions(level, 6, 0.35), perQ: 18 });
    ST.passTime(S, 60, 'work');
    sg.stand();
    if (Math.round(sc * 6) >= 3) { setTimeout(() => this.advance(), 300); }
    else { U.tries++; bigMsg('😢 아쉽게 떨어졌어요', '다음 수업 시간에 다시 볼 수 있어요 · 수업을 더 들으면 도움이 돼요', 3200); this.c.persist(); }
  }
  statusSheet() {
    const U = this.stud(), st = this.st;
    openSheet({
      icon: st.icon, title: `${st.name} · ${st.schoolName}`, sub: `수업 ${Math.min(U.n, st.need)}/${st.need} · 평일 9~12시, 13~15시 30분`,
      html: `<p class="note">수업을 ${st.need}번 들으면 졸업 시험을 볼 수 있어요. 졸업하면 ${STAGES[st.next].name}이(가) 돼요.<br>급식은 학생 무료 · 집에 가면 엄마가 밥을 차려 줘요 · 매일 아침 용돈 ${won(st.allowance)}</p>`,
    });
  }
  // 다음 단계로 (키가 커져요 · 성인에서 멈춤)
  advance() {
    const S = this.S, cur = this.st;
    if (!cur.next) return;
    S.stage = cur.next; S.grow = 0; S.stud = null;
    const nx = this.st;
    this.apply();
    this.c.audio?.play?.('goal');
    if (S.stage === 'adult') {
      S.money = (S.money || 0) + 100000;
      bigMsg('🎉 성인이 됐어요!', '키는 이제 그만 자라요 · 운전·취업·대학·집 계약을 할 수 있어요 · 부모님이 축하금 10만 원을 줬어요', 5200);
    } else if (cur.school) {
      bigMsg(`🎓 ${cur.schoolName} 졸업!`, `이제 ${nx.icon} ${nx.name}이에요 · ${nx.schoolName}에 다녀요 · 키가 쑥 컸어요`, 4200);
    } else {
      bigMsg('🎂 무럭무럭 자랐어요!', `${nx.icon} ${nx.name}이 돼서 ${nx.schoolName}에 입학해요 · 평일 9시까지 등교!`, 4600);
    }
    this.c.onStage?.(S.stage);
    this.c.persist();
  }
  hudLine() {
    if (!this.minor) return '';
    if (this.baby) return `👶 아기 · 성장 <span class="dist">${Math.round(this.S.grow || 0)}/100</span><small>엄마한테 가서 돌봄 받기 · 침대에서 자기</small>`;
    const U = this.stud(), st = this.st;
    return `${st.icon} ${st.name} · ${st.schoolName} <span class="dist">${Math.min(U.n, st.need)}/${st.need}</span><small>${U.n >= st.need ? '수업 시간에 교실 자리에서 졸업 시험' : '평일 9시·13시 교실 자리에서 수업 듣기'}</small>`;
  }
  label() { return `${this.st.icon} ${this.st.name}`; }
}

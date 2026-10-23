import { studyBonus } from './statgame.js';
import { won } from './config.js';
import * as ST from './state.js';
import { $, toast, openSheet, closeSheet, bigMsg, fade, wait, row, bindActs } from './ui.js';
import { questions } from './quiz.js';
import { LEVEL_NAME, emojiSprite } from './school.js';
import { fmtH, stars } from './martgame.js';

const TUITION = 1500000;
const SESSIONS = 8;
const UNI_SLOTS = [10, 14];                 // 대학 수업 시작 (2시간)
const PAY = { elem: 135000, middle: 145000, high: 155000 };
const MAJORS = { edu: { name: '교육학과', desc: '졸업하면 초·중·고 선생님이 될 수 있어요' }, biz: { name: '경영학과', desc: '졸업하면 회사에 사원으로 들어가고 승진이 빨라요' }, med: { name: '의예과', desc: '졸업하면 의사가 될 수 있어요' }, nurse: { name: '간호학과', desc: '졸업하면 간호사가 될 수 있어요' }, pharm: { name: '약학과', desc: '졸업하면 약사가 될 수 있어요' }, police: { name: '경찰행정학과', desc: '경찰 공무원 시험 준비에 좋아요' }, fire: { name: '소방안전학과', desc: '소방 공무원 시험 준비에 좋아요' } };
const MAJOR_ICON = { edu: '🍎', biz: '💼', med: '🩺', nurse: '💉', pharm: '💊', police: '👮', fire: '🚒' };
const MAJOR_SUBJ = { edu: '교육학', biz: '경영학', med: '해부학', nurse: '기본간호학', pharm: '약리학', police: '형사법', fire: '소방학' };
const LESSONS = {
  elem: [['물의 순환', ['증발', '응결', '구름', '비']], ['식물의 한살이', ['씨앗', '싹', '꽃', '열매']], ['덧셈과 뺄셈', ['일의 자리', '받아올림', '십의 자리', '검산']]],
  middle: [['광합성', ['빛 에너지', '이산화탄소 흡수', '포도당 합성', '산소 방출']], ['일차방정식', ['식 세우기', '이항', '계산', '검산']], ['조선 건국', ['위화도 회군', '조선 건국', '한양 천도', '경국대전']]],
  high: [['미분', ['평균변화율', '극한', '미분계수', '도함수']], ['세포 분열', ['간기', '전기', '중기', '후기']], ['근대 국가 수립', ['갑신정변', '동학 농민 운동', '갑오개혁', '대한제국']]],
};

export class SchoolGame {
  constructor(ctx) { this.c = ctx; this.duty = null; }
  get S() { return this.c.S; }
  get room() { return this.c.room; }
  get U() { const S = this.S; if (!S.uni) S.uni = { enrolled: false, major: null, semester: 1, sessions: 0, attended: {}, scores: [], study: 0, grades: [], graduated: false, degree: null, scholarship: false }; return S.uni; }
  get T() { const S = this.S; if (!S.teach) S.teach = { hired: false, level: null, worked: {}, warnings: 0, ratings: [], absent: {}, lastCheck: 0 }; return S.teach; }

  // 지금 학교 시간대
  period(level) {
    const S = this.S, h = ST.hour(S), wd = !ST.isWeekend(S);
    if (!wd) return 'after';
    if (level === 'univ') { if ((h >= 10 && h < 12) || (h >= 14 && h < 16)) return 'class'; if (h >= 12 && h < 13.5) return 'lunch'; if (h >= 9 && h < 18) return 'break'; return 'after'; }
    if (h >= 9 && h < 12) return 'class'; if (h >= 12 && h < 13) return 'lunch'; if (h >= 13 && h < 15.5) return 'class'; if (h >= 8 && h < 17) return 'break'; return 'after';
  }
  isMine(level) { return this.T.hired && this.T.level === level; }

  // 입장 전 확인 (true면 들어감)
  gate(e, enter) {
    const lv = e.school;
    if (lv === 'univ' || this.isMine(lv)) return enter();
    const U = this.U;
    const canApply = U.degree === 'edu' && !this.T.hired;
    openSheet({
      icon: '🛡️', title: `${e.name} 정문`, sub: '학교 보안관',
      html: `<p class="note">"외부인은 방문증을 받고 들어가야 해요."${this.T.hired ? `<br>지금은 ${LEVEL_NAME[this.T.level]} 선생님이시네요.` : ''}</p>
        ${canApply ? row({ icon: '📝', title: '교원 임용 지원하기', desc: '임용 시험 6문제 중 4문제 이상 맞히면 이 학교 선생님이 돼요', btn: '응시', btnClass: 'green', action: 'apply' }) : ''}
        ${!U.degree ? '<p class="note">선생님이 되려면 <b>한빛대학교 교육학과</b>를 졸업해야 해요.</p>' : U.degree !== 'edu' ? '<p class="note">교사 임용은 교육학과 졸업생만 지원할 수 있어요.</p>' : ''}
        <button class="btn wide gray" data-act="visit">방문증 받고 둘러보기</button>`,
      bind: (b) => bindActs(b, { visit: () => { closeSheet(); enter(); }, apply: () => this.teacherExam(e, enter) }),
    });
  }

  onEnter(level) {
    this.lastPeriod = null;
    this.refresh(level, true);
  }
  refresh(level, force) {
    const p = this.period(level);
    const teaching = !!this.duty?.inLesson;
    const key = p + (teaching ? 't' : '');
    if (!force && key === this.lastPeriod) return;
    this.lastPeriod = key;
    this.room.populate(p, { playerTeaching: teaching || (this.duty && p === 'class') });
  }

  // ───────── 버튼 ─────────
  action(zone, level) {
    if (!zone) return null;
    const U = this.U, T = this.T, S = this.S;
    const per = this.period(level);
    switch (zone.id) {
      case 'exit': return { label: '🚪 밖으로 나가기', fn: () => this.c.exit() };
      case 'admin':
        if (!U.enrolled && !U.graduated) return { label: '🎓 입학 신청 · 학사 안내', fn: () => this.admissionSheet(), green: true };
        return { label: '🎓 학사 정보 · 등록', fn: () => this.statusSheet() };
      case 'seat': {
        if (level === 'univ') {
          if (!U.enrolled) return { label: '🪑 빈 강의실 자리', fn: () => toast('입학하면 여기서 수업을 들어요 (행정실)') };
          const slot = this.uniSlot();
          if (slot && U.sessions >= SESSIONS) return { label: '📝 기말고사 보기', fn: () => this.finalExam(slot), green: true };
          if (slot) return { label: `📖 수업 듣기 (${U.sessions + 1}/${SESSIONS}회차)`, fn: () => this.lecture(slot), green: true };
          return { label: '🪑 강의실 · 다음 수업 확인', fn: () => this.statusSheet() };
        }
        return { label: '🪑 교실', fn: () => toast(per === 'class' ? '수업 중이에요. 조용히!' : '학생들 자리예요') };
      }
      case 'board':
        if (this.duty && level === T.level) {
          if (per === 'lunch') return { label: '🍱 지금은 점심시간이에요', fn: () => toast('급식실에서 밥 먹고 오세요') };
          if (this.duty.lessons >= 3) return { label: '✅ 오늘 수업 끝 · 교무실에서 채점', fn: () => toast('교무실 내 자리에서 채점하세요') };
          return { label: `📚 수업하기 (${this.duty.lessons + 1}/3교시)`, fn: () => this.lesson(), green: true };
        }
        return null;
      case 'mydesk':
        if (!this.isMine(level)) return { label: '🧑‍🏫 교무실', fn: () => toast('선생님 자리예요') };
        if (!this.duty) {
          const st = this.dutyStatus();
          if (st.can) return { label: '🕗 출근하기 (교무실)', fn: () => this.clockIn(st), green: true };
          return { label: `🕗 ${st.msg}`, fn: () => this.teachSheet() };
        }
        if (this.duty.lessons >= 3 && !this.duty.graded) return { label: '✏️ 시험지 채점하기', fn: () => this.grading(), green: true };
        if (this.duty.lessons >= 3 && this.duty.graded) return { label: '🕓 퇴근하기', fn: () => this.clockOut(false), green: true };
        return { label: `🧑‍🏫 내 자리 · 수업 ${this.duty.lessons}/3`, fn: () => this.teachSheet() };
      case 'office': return null;
      case 'library':
        if (level === 'univ') return { label: '📚 도서관에서 공부하기', fn: () => this.studySheet() };
        return null;
      case 'cafeteria': {
        const free = level !== 'univ' && (this.isMine(level));
        if (per !== 'lunch' && level !== 'univ') return { label: '🍱 급식실 · 점심시간 12시', fn: () => toast('급식은 점심시간(12~13시)에만 나와요') };
        return { label: free ? '🍱 급식 받기 (교직원 무료)' : `🍱 학식 사 먹기 (${won(4500)})`, fn: () => this.lunch(free), green: true };
      }
      case 'cafeseat': return null;
    }
    return null;
  }

  // ───────── 대학교: 입학 ─────────
  admissionSheet() {
    const U = this.U;
    const tuition = this.tuition();
    openSheet({
      icon: '🎓', title: '한빛대학교 입학', sub: '2학기 과정 · 학기당 수업 8회 + 기말고사',
      html: `<p class="note">평일 <b>오전 10시, 오후 2시</b>에 강의실에서 수업이 있어요 (2시간).<br>8번 들으면 기말고사를 보고, 두 학기를 통과하면 졸업해요.<br>학기 등록금 <b>${won(tuition)}</b> · 돈이 모자라면 학자금 대출을 받을 수 있어요 (번 돈의 20%씩 자동 상환).</p>` +
        Object.entries(MAJORS).map(([k, m]) => row({ icon: MAJOR_ICON[k] || '📘', title: m.name, desc: m.desc, btn: '이 학과로', btnClass: 'green', action: 'pick:' + k })).join(''),
      bind: (b) => bindActs(b, { pick: (k) => this.payTuition(k) }),
    });
  }
  tuition() { return this.U.scholarship ? TUITION / 2 : TUITION; }
  payTuition(major) {
    const S = this.S, U = this.U, t = this.tuition();
    const finish = () => {
      if (major) U.major = major;
      U.enrolled = true; U.sessions = 0; U.attended = {}; U.scores = []; U.study = 0; U.scholarship = false;
      U.enrollMin = S.minutes;
      closeSheet();
      this.c.audio.play('success');
      bigMsg(major ? '🎉 입학을 축하해요!' : '📚 새 학기 등록 완료', `${MAJORS[U.major].name} ${U.semester}학기 · 평일 10시·14시 수업`, 3200);
      this.c.persist();
    };
    if (S.money >= t) { this.c.pay(t); finish(); return; }
    openSheet({
      icon: '💸', title: '등록금이 모자라요', sub: `필요 ${won(t)} · 지금 ${won(S.money)}`,
      html: `<p class="note">학자금 대출을 받으면 등록금을 학교에 바로 내 줘요. 대출금은 앞으로 버는 돈의 20%씩 자동으로 갚아요.</p><button class="btn wide green" data-act="loan">학자금 대출 받기 (${won(t)})</button>`,
      bind: (b) => bindActs(b, { loan: () => { S.loan = (S.loan || 0) + t; toast(`🏦 학자금 대출 ${won(t)}`); finish(); } }),
    });
  }
  statusSheet() {
    const U = this.U;
    const next = this.nextClass();
    openSheet({
      icon: '🎓', title: '학사 정보', sub: U.graduated ? `졸업 · ${MAJORS[U.degree].name} 학사` : U.enrolled ? `${MAJORS[U.major].name} ${U.semester}학기` : '휴학 중',
      html: `<div class="grid2" style="margin-bottom:10px"><div class="stat"><span>이번 학기 수업</span><b>${U.sessions}/${SESSIONS}</b></div><div class="stat"><span>수업 평균</span><b>${U.scores.length ? Math.round(U.scores.reduce((a, b) => a + b, 0) / U.scores.length * 100) + '점' : '-'}</b></div><div class="stat"><span>도서관 공부</span><b>${U.study}시간</b></div><div class="stat"><span>학자금 대출</span><b>${won(this.S.loan || 0)}</b></div></div>
        <p class="note">${U.grades.length ? '성적: ' + U.grades.map((g, i) => `${i + 1}학기 <b>${g}</b>`).join(' · ') + '<br>' : ''}${U.enrolled ? (U.sessions >= SESSIONS ? '📝 수업 시간에 강의실에서 기말고사를 볼 수 있어요' : '다음 수업: ' + next) : ''}</p>
        ${!U.enrolled && !U.graduated && U.major ? `<button class="btn wide green" data-act="reg">${U.semester}학기 등록 (${won(this.tuition())})</button>` : ''}`,
      bind: (b) => bindActs(b, { reg: () => this.payTuition(null) }),
    });
  }
  uniSlot() {
    const S = this.S;
    if (ST.isWeekend(S)) return null;
    const d = Math.floor(S.minutes / 1440), m = S.minutes % 1440;
    for (const h of UNI_SLOTS) {
      const start = h * 60;
      if (m >= start - 20 && m <= start + 15 && !this.U.attended[d + '-' + h]) return { key: d + '-' + h, start: d * 1440 + start, late: m > start + 5 };
    }
    return null;
  }
  nextClass() {
    const S = this.S;
    for (let k = 0; k < 8; k++) {
      const d = Math.floor(S.minutes / 1440) + k;
      if (d % 7 >= 5) continue;
      for (const h of UNI_SLOTS) { const t = d * 1440 + h * 60; if (t + 15 > S.minutes && !this.U.attended[d + '-' + h]) return `${d + 1}일차 ${['월', '화', '수', '목', '금'][d % 7]} ${fmtH(h)}`; }
    }
    return '-';
  }

  // 공통 퀴즈 화면
  quiz({ title, sub, qs, perQ = 14, sleepy = false }) {
    return new Promise((resolve) => {
      const mg = $('mg'); mg.classList.remove('hidden');
      let i = 0, ok = 0, t = perQ, iv;
      const next = () => {
        clearInterval(iv);
        if (i >= qs.length) { mg.classList.add('hidden'); mg.innerHTML = ''; resolve(ok / qs.length); return; }
        const q = qs[i];
        t = perQ;
        const nod = sleepy && Math.random() < 0.35;
        mg.innerHTML = `<div class="mg-box"><div class="mg-top"><span>${title} · ${i + 1}/${qs.length}</span><span class="t" id="qt">${t}</span></div>
          ${sub ? `<p class="note">${sub}</p>` : ''}
          <div class="doc"><h3>[${q.subject}] ${q.q}</h3>${nod ? '<div class="rule" style="color:#c22;font-weight:800">😪 꾸벅… 졸려요! 먼저 정신 차리기를 누르세요</div>' : ''}</div>
          ${nod ? '<button class="btn wide red" id="wake">😳 정신 차리기!</button>' : ''}
          <div class="qopts">${q.opts.map((o, k) => `<button class="btn gray" data-k="${k}" ${nod ? 'disabled' : ''}>${'①②③④'[k]} ${o}</button>`).join('')}</div></div>`;
        mg.querySelector('#wake')?.addEventListener('click', () => { mg.querySelectorAll('[data-k]').forEach(b => b.disabled = false); mg.querySelector('#wake').remove(); mg.querySelector('.rule')?.remove(); });
        mg.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
          const right = +b.dataset.k === q.a;
          if (right) ok++;
          b.classList.remove('gray'); b.classList.add(right ? 'green' : 'red');
          if (!right) mg.querySelector(`[data-k="${q.a}"]`).classList.replace('gray', 'green');
          this.c.audio.play(right ? 'success' : 'bad');
          mg.querySelectorAll('[data-k]').forEach(x => x.disabled = true);
          i++; clearInterval(iv); setTimeout(next, 900);
        }));
        iv = setInterval(() => { t--; const el = $('qt'); if (el) el.textContent = t; if (t <= 0) { i++; next(); } }, 1000);
      };
      next();
    });
  }

  async lecture(slot) {
    const U = this.U, S = this.S;
    const seat = this.room.nearestFreeSeat(this.c.player.pos);
    this.sitAt(seat);
    U.attended[slot.key] = true;
    if (slot.late) toast('😅 지각했어요 (점수 조금 감점)', 'bad');
    const subj = MAJOR_SUBJ[U.major] || '전공';
    const sb = studyBonus(S);
    if (sb.ready) S.notePages--;
    const score = await this.quiz({ title: `📖 ${subj} 강의`, sub: '교수님: "자, 오늘 배운 거 확인해 볼게요."' + (sb.ready ? '<br>📓 공책에 필기해 둬서 문제 풀 시간이 늘었어요' : ''), qs: questions('univ', 5, 0.25), sleepy: S.energy < 30, perQ: 14 + (sb.ready ? 5 : 0) + (sb.postit ? 1 : 0) });
    await this.skip(Math.max(0, slot.start + 120 - S.minutes), 'work');
    U.sessions++; U.scores.push(Math.max(0, score - (slot.late ? 0.1 : 0)));
    this.stand();
    toast(`📖 수업 끝! 이해도 ${Math.round(score * 100)}점 · ${U.sessions}/${SESSIONS}회차`, 'good', 3200);
    if (U.sessions >= SESSIONS) setTimeout(() => toast('📝 다음 수업 시간에 기말고사를 봐요! 도서관에서 공부해 두세요'), 1500);
    this.c.persist();
  }
  async finalExam(slot) {
    const U = this.U, S = this.S;
    this.sitAt(this.room.nearestFreeSeat(this.c.player.pos));
    U.attended[slot.key] = true;
    const sb = studyBonus(S);
    if (sb.ready) S.notePages--;
    const ex = await this.quiz({ title: '📝 기말고사', sub: '시간 안에 풀어요. 도서관 공부를 많이 했으면 점수에 도움이 돼요' + (sb.ready ? '<br>📓 정리한 공책 덕분에 시간이 넉넉해요' : '') + (sb.hili ? ' · 🖍️ 형광펜 +3점' : ''), qs: questions('univ', 8, 0.35), perQ: 15 + (sb.ready ? 5 : 0) });
    await this.skip(Math.max(0, slot.start + 120 - S.minutes), 'work');
    this.stand();
    const avg = U.scores.reduce((a, b) => a + b, 0) / Math.max(1, U.scores.length);
    const total = Math.min(1, 0.12 + avg * 0.33 + ex * 0.5 + Math.min(0.1, U.study * 0.02) + (sb.hili ? 0.03 : 0));
    const g = total >= 0.9 ? 'A+' : total >= 0.85 ? 'A' : total >= 0.8 ? 'B+' : total >= 0.74 ? 'B' : total >= 0.68 ? 'C+' : total >= 0.62 ? 'C' : total >= 0.55 ? 'D' : 'F';
    U.grades.push(g);
    U.enrolled = false;
    if (g === 'F') {
      bigMsg('😱 F 학점…', '이번 학기는 다시 들어야 해요 (행정실에서 재등록)', 3600);
    } else if (U.semester >= 2) {
      U.graduated = true; U.degree = U.major;
      if (U.major === 'biz' && S.officeRank < 1) { S.officeRank = 1; }
      this.c.audio.play('goal');
      bigMsg('🎓 졸업을 축하해요!', `${MAJORS[U.major].name} 학사 · 마지막 학기 ${g}${U.major === 'edu' ? ' · 이제 초·중·고 교원 임용에 지원할 수 있어요' : U.major === 'biz' ? ' · 회사에 사원으로 지원할 수 있어요' : ' · ' + MAJORS[U.major].desc.replace('졸업하면 ', '') + ' (휴대폰 → 한빛잡)'}`, 4600);
    } else {
      U.semester++;
      U.scholarship = g === 'A+';
      bigMsg(`📜 ${U.semester - 1}학기 성적: ${g}`, `${U.scholarship ? '🎖️ 성적 장학금! 다음 학기 등록금 반값 · ' : ''}행정실에서 ${U.semester}학기를 등록하세요`, 4000);
    }
    this.c.persist();
  }
  studySheet() {
    openSheet({
      icon: '📚', title: '도서관', sub: '조용히 공부해요',
      html: row({ icon: '✏️', title: '1시간 공부', desc: '기말고사 점수 보너스 (최대 5시간 반영) · 에너지 소모', btn: '공부', action: 'study:60' }) + row({ icon: '📖', title: '3시간 몰아서 공부', desc: '시험 전날 벼락치기', btn: '공부', action: 'study:180' }),
      bind: (b) => bindActs(b, {
        study: async (m) => {
          closeSheet();
          if (this.S.energy < 15) return toast('너무 피곤해서 집중이 안 돼요', 'bad');
          const t = this.room.zones.find(z => z.id === 'library');
          this.c.setBusy(true); await fade(true);
          ST.passTime(this.S, +m, 'work'); this.U.study += m / 60; this.S.mood = ST.clamp(this.S.mood - m / 60);
          await fade(false); this.c.setBusy(false);
          toast(`✏️ ${m / 60}시간 공부했어요 (누적 ${this.U.study}시간)`, 'good');
          this.c.persist();
        },
      }),
    });
  }
  async lunch(free) {
    if (!free && !this.c.pay(4500)) return;
    const seat = this.room.nearestCafSeat(this.c.player.pos);
    const { human } = this.c;
    this.c.setBusy(true);
    await fade(true);
    if (seat) { human.root.position.set(seat.x, 0.0, seat.z); human.root.rotation.y = seat.face; human.setPose('sit'); }
    await fade(false);
    await wait(1200);
    ST.passTime(this.S, 25, 'idle');
    this.S.hunger = ST.clamp(this.S.hunger + 55); this.S.mood = ST.clamp(this.S.mood + 5);
    this.S.ateOnce = true;
    await fade(true);
    human.setPose('stand'); human.root.position.copy(this.c.player.pos);
    await fade(false);
    this.c.setBusy(false);
    toast('🍱 잘 먹었습니다! (배고픔 +55)', 'good');
  }

  // ───────── 선생님 ─────────
  async teacherExam(e, enter) {
    closeSheet();
    const score = await this.quiz({ title: '📝 교원 임용 시험', sub: '6문제 중 4문제 이상 맞히면 합격', qs: questions(e.school === 'elem' ? 'middle' : 'high', 6, 0.4), perQ: 15 });
    const n = Math.round(score * 6);
    if (n >= 4) {
      const T = this.T; T.hired = true; T.level = e.school; T.hiredMin = this.S.minutes; T.warnings = 0;
      this.c.audio.play('goal');
      bigMsg('🍎 임용 합격!', `${e.name} 선생님이 됐어요 · 평일 8~9시 교무실 출근 · 일당 ${won(PAY[e.school])}`, 4200);
      this.c.persist();
      setTimeout(enter, 800);
    } else {
      bigMsg('😢 불합격', `${n}/6 · 공부하고 다시 도전해요`, 3000);
    }
  }
  teachSheet() {
    const T = this.T, st = this.dutyStatus();
    const avg = T.ratings.length ? T.ratings.reduce((a, b) => a + b, 0) / T.ratings.length : 0;
    openSheet({
      icon: '🧑‍🏫', title: `${LEVEL_NAME[T.level]} 선생님`, sub: `일당 ${won(PAY[T.level])} · 평일 8:00~9:10 출근`,
      html: `<div class="grid2" style="margin-bottom:10px"><div class="stat"><span>평균 평가</span><b>${avg ? stars(avg) : '-'}</b></div><div class="stat"><span>경고</span><b>${T.warnings}/3</b></div></div>
        <p class="note">${this.duty ? `근무 중 · 수업 ${this.duty.lessons}/3 · 채점 ${this.duty.graded ? '완료' : '전'}` : st.msg}<br>하루 일과: 출근 → 교실에서 수업 3번 → 점심 급식 → 교무실에서 채점 → 퇴근</p>
        <button class="btn wide red" data-act="quit">교사 그만두기</button>`,
      bind: (b) => bindActs(b, { quit: () => { if (confirm('정말 그만둘까요?')) { T.hired = false; T.level = null; this.duty = null; closeSheet(); this.c.persist(); } } }),
    });
  }
  dutyStatus() {
    const S = this.S, T = this.T;
    const d = Math.floor(S.minutes / 1440), m = S.minutes % 1440;
    if (d % 7 < 5 && !T.worked[d] && m >= 8 * 60 && m <= 9 * 60 + 10) return { can: true, day: d, late: m > 8 * 60 + 40 };
    for (let k = 0; k < 8; k++) { const dd = d + k; if (dd % 7 >= 5 || T.worked[dd]) continue; if (k === 0 && m > 9 * 60 + 10) continue; return { can: false, msg: `다음 출근: ${dd + 1}일차 ${['월', '화', '수', '목', '금'][dd % 7]} 오전 8:00~9:10` }; }
    return { can: false, msg: '' };
  }
  clockIn(st) {
    this.T.worked[st.day] = true;
    this.duty = { day: st.day, lessons: 0, graded: false, score: st.late ? 3.0 : 3.6, late: st.late };
    this.c.human.applyUniform?.(false);
    this.c.audio.play('clockin');
    bigMsg(st.late ? '😅 지각!' : '🍎 출근 완료', '교실(왼쪽)에서 수업 3번 → 교무실에서 채점 → 퇴근', 3200);
    this.c.persist();
  }
  async clockOut(forced) {
    const T = this.T, d = this.duty;
    if (!d) return;
    this.duty = null;
    let score = d.score - (3 - d.lessons) * 0.8 - (d.graded ? 0 : 0.6);
    score = Math.max(0.5, Math.min(5, score));
    T.ratings.push(score); if (T.ratings.length > 20) T.ratings.shift();
    const pay = Math.round(PAY[T.level] * (0.4 + 0.6 * d.lessons / 3) / 100) * 100;
    if (score < 2) { T.warnings++; }
    this.c.earn(pay, `${LEVEL_NAME[T.level]} 근무`);
    openSheet({
      icon: '🧾', title: forced ? '하루가 끝났어요' : '퇴근! 오늘의 수업', sub: LEVEL_NAME[T.level],
      html: `<div class="grid2"><div class="stat"><span>수업</span><b>${d.lessons}/3</b></div><div class="stat"><span>채점</span><b>${d.graded ? '완료' : '못 함'}</b></div><div class="stat"><span>오늘 평가</span><b>${stars(score)}</b></div><div class="stat"><span>일당</span><b>${won(pay)}</b></div></div>
        <p class="note">${score >= 4.2 ? '교감 선생님: "학생들이 수업이 재밌대요!"' : score >= 3 ? '교감 선생님: "수고하셨어요."' : '교감 선생님: "내일은 좀 더 신경 써 주세요." (경고)'}</p>`,
    });
    this.checkFired();
    this.c.persist();
  }
  checkFired() {
    const T = this.T;
    if (T.warnings >= 3 && T.hired) { T.hired = false; T.level = null; T.warnings = 0; setTimeout(() => bigMsg('📵 직위 해제', '경고가 3번 쌓였어요. 다시 임용 시험을 봐야 해요', 3600), 600); }
  }
  dailyCheck() {
    const T = this.T, S = this.S;
    // 근무 중 시간 넘기면 자동 마감
    if (this.duty && (Math.floor(S.minutes / 1440) > this.duty.day || S.minutes % 1440 > 17.5 * 60)) { this.clockOut(true); return; }
    if (!T.hired) return;
    const today = Math.floor(S.minutes / 1440);
    for (let d = Math.max(T.lastCheck || 0, Math.floor((T.hiredMin ?? S.minutes) / 1440)); d <= today; d++) {
      if (d % 7 >= 5) continue;
      const end = d * 1440 + 9 * 60 + 10;
      if (S.minutes < end || (T.hiredMin ?? 0) > d * 1440 + 8 * 60) continue;
      if (!T.worked[d] && !T.absent[d]) { T.absent[d] = true; T.warnings++; toast(`📵 ${d + 1}일차 무단결근! 교감 선생님 경고 ${T.warnings}/3`, 'bad', 4500); this.checkFired(); }
    }
    T.lastCheck = today;
  }

  // 수업 미니게임: 조용히 시키기 → 판서 → 학생 질문
  async lesson() {
    const d = this.duty, lv = this.T.level;
    d.inLesson = true;
    this.c.refreshPeriod?.();
    const { human, player } = this.c;
    player.pos.set(-11.3, 0, -0.4); player.heading = Math.PI / 2;
    human.root.position.copy(player.pos); human.root.rotation.y = player.heading;
    this.c.setBusy(true);
    const s1 = await this.quietGame(lv);
    const s2 = await this.boardGame(lv);
    const s3 = await this.quiz({ title: '🙋 학생 질문', sub: '학생: "선생님, 이거 답이 뭐예요?"', qs: questions(lv, 1, 0.5), perQ: 12 });
    const sc = (s1 + s2 + s3) / 3;
    await this.skip(50, 'work');
    d.lessons++; d.score += (sc - 0.6) * 0.9;
    d.inLesson = false;
    this.c.setBusy(false);
    toast(`📚 ${d.lessons}교시 끝! 수업 점수 ${Math.round(sc * 100)}점`, sc > 0.7 ? 'good' : '', 3000);
    this.c.persist();
  }
  quietGame(lv) {
    return new Promise((resolve) => {
      const mg = $('mg'); mg.classList.remove('hidden');
      const n = 12, faces = lv === 'elem' ? ['🧒', '👦', '👧'] : ['🧑', '👦', '👧'];
      const noisy = new Array(n).fill(0);
      let t = lv === 'elem' ? 9 : 7, hit = 0, miss = 0, spawn = 0;
      mg.innerHTML = `<div class="mg-box"><div class="mg-top"><span>📢 떠드는 학생 조용히 시키기</span><span class="t" id="qt">${t}</span></div><div class="class-grid">${Array.from({ length: n }, (_, i) => `<button class="kid" data-i="${i}">${faces[i % faces.length]}<i></i></button>`).join('')}</div><p class="note">💬가 뜬 학생을 눌러요</p></div>`;
      const btns = [...mg.querySelectorAll('.kid')];
      btns.forEach((b, i) => b.addEventListener('click', () => { if (noisy[i] > 0) { noisy[i] = 0; hit++; b.classList.remove('noisy'); this.c.audio.play('click'); } }));
      let last = performance.now();
      const iv = setInterval(() => {
        const now = performance.now(), dt = (now - last) / 1000; last = now;
        t -= dt; spawn -= dt;
        $('qt').textContent = Math.max(0, Math.ceil(t));
        if (spawn <= 0) { spawn = lv === 'elem' ? 0.55 : lv === 'middle' ? 0.75 : 0.95; const i = Math.floor(Math.random() * n); if (!noisy[i]) { noisy[i] = 2.2; btns[i].classList.add('noisy'); } }
        noisy.forEach((v, i) => { if (v > 0) { noisy[i] -= dt; if (noisy[i] <= 0) { noisy[i] = 0; miss++; btns[i].classList.remove('noisy'); } } });
        if (t <= 0) { clearInterval(iv); mg.classList.add('hidden'); mg.innerHTML = ''; resolve(hit / Math.max(1, hit + miss)); }
      }, 100);
    });
  }
  boardGame(lv) {
    return new Promise((resolve) => {
      const [topic, steps] = LESSONS[lv][Math.floor(Math.random() * LESSONS[lv].length)];
      const order = [...steps].sort(() => Math.random() - 0.5);
      let next = 0, wrong = 0;
      const mg = $('mg'); mg.classList.remove('hidden');
      const render = () => {
        mg.innerHTML = `<div class="mg-box"><div class="mg-top"><span>✍️ 판서 · 오늘의 주제: ${topic}</span></div>
          <div class="chalk">${steps.slice(0, next).map((s, i) => `<div>${i + 1}. ${s}</div>`).join('') || '<div style="opacity:.5">순서대로 칠판에 적어요</div>'}</div>
          <div class="qopts">${order.map((s, k) => `<button class="btn ${steps.indexOf(s) < next ? 'green' : 'gray'}" data-k="${k}" ${steps.indexOf(s) < next ? 'disabled' : ''}>${s}</button>`).join('')}</div></div>`;
        mg.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
          const s = order[+b.dataset.k];
          if (s === steps[next]) { next++; this.c.audio.play('click'); if (next >= steps.length) { setTimeout(() => { mg.classList.add('hidden'); mg.innerHTML = ''; resolve(Math.max(0, 1 - wrong * 0.25)); }, 500); } render(); }
          else { wrong++; this.c.audio.play('bad'); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 300); }
        }));
      };
      render();
    });
  }
  // 채점: O/X
  grading() {
    return new Promise((resolve) => {
      const lv = this.T.level;
      const qs = questions(lv, 8, 0.7);
      let i = 0, ok = 0, t = 24;
      const mg = $('mg'); mg.classList.remove('hidden');
      this.c.setBusy(true);
      const end = async () => {
        clearInterval(iv); mg.classList.add('hidden'); mg.innerHTML = '';
        await this.skip(60, 'work');
        this.duty.graded = true; this.duty.score += (ok / qs.length - 0.6) * 0.8;
        this.c.setBusy(false);
        toast(`✏️ 채점 끝! 정확도 ${Math.round(ok / qs.length * 100)}% · 이제 퇴근할 수 있어요`, 'good', 3200);
        resolve();
      };
      const render = () => {
        if (i >= qs.length) return end();
        const q = qs[i];
        const correct = Math.random() < 0.55;
        const shown = correct ? q.opts[q.a] : q.opts[(q.a + 1 + Math.floor(Math.random() * 3)) % 4];
        mg.innerHTML = `<div class="mg-box"><div class="mg-top"><span>✏️ 시험지 채점 ${i + 1}/${qs.length}</span><span class="t" id="qt">${t}</span></div>
          <div class="doc"><h3>${q.q}</h3>학생 답: <b style="font-size:20px">${shown}</b></div>
          <div class="mg-btns"><button class="btn red" id="x">✘ 틀림</button><button class="btn green" id="o">⭕ 맞음</button></div></div>`;
        const ans = (v) => { if (v === correct) { ok++; this.c.audio.play('click'); } else this.c.audio.play('bad'); i++; render(); };
        $('o').addEventListener('click', () => ans(true)); $('x').addEventListener('click', () => ans(false));
      };
      const iv = setInterval(() => { t--; const el = $('qt'); if (el) el.textContent = t; if (t <= 0) { i = qs.length; render(); } }, 1000);
      render();
    });
  }

  // ───────── 도우미 ─────────
  sitAt(seat) {
    const { human, player } = this.c;
    if (!seat) return;
    this.seat = seat; seat.taken = true;
    human.root.position.set(seat.x, 0, seat.z); human.root.rotation.y = -Math.PI / 2;
    human.setPose('sit');
    this.c.setBusy(true);
  }
  stand() {
    const { human, player } = this.c;
    human.setPose('stand');
    if (this.seat) { this.seat.taken = false; player.pos.set(this.seat.x + 0.5, 0, this.seat.z); this.seat = null; }
    human.root.position.copy(player.pos);
    this.c.setBusy(false);
  }
  async skip(minutes, mode) {
    if (minutes <= 0) return;
    await fade(true);
    ST.passTime(this.S, minutes, mode);
    await wait(250);
    await fade(false);
  }
  hudText(level) {
    const U = this.U, per = this.period(level);
    const perName = { class: '수업 시간', lunch: '점심시간', break: '쉬는 시간', after: '방과 후' }[per];
    if (this.duty && this.T.level === level) return `🍎 근무 중 · 수업 ${this.duty.lessons}/3 · 채점 ${this.duty.graded ? '✅' : '⬜'}<small>${perName} · 교실(왼쪽) → 교무실(가운데) → 급식실(오른쪽)</small>`;
    if (level === 'univ' && U.enrolled) {
      const s = this.uniSlot();
      return `🎓 ${MAJORS[U.major].name} ${U.semester}학기 · 수업 ${U.sessions}/${SESSIONS}<small>${s ? '지금 수업 시간! 강의실(왼쪽) 빈자리로' : '다음 수업: ' + this.nextClass()}</small>`;
    }
    return `${LEVEL_NAME[level]} · ${perName}`;
  }
}

import { seeded } from './geo.js';
import { won, blockIndex, N } from './config.js';
import { ZONES, lakeR } from './city.js';
import * as ST from './state.js';
import { toast, bigMsg, openSheet, closeSheet, row, bindActs } from './ui.js';

// ───────── 미션 · 경험치 · 지역 발견 · 길거리 대화 ─────────
const AREA_NAME = { A: '아파트 단지', S: '상가 거리', C: '업무지구', T: '주상복합 타운', V: '빌라촌', G: '시청 광장', L: '중앙 호수공원', P: '근린공원', E: '초등학교 동네', M: '한빛중학교 앞', H: '한빛고등학교 앞', U: '한빛대학교 캠퍼스' };
const UNIQUE = new Set(['G', 'L', 'M', 'H', 'U']);
export function areaAt(x, z) {
  const i = blockIndex(x), j = blockIndex(z);
  if (i < 0 || j < 0 || i >= N || j >= N) return null;
  const zone = ZONES[j][i];
  if (UNIQUE.has(zone)) return AREA_NAME[zone];
  const q = (j < N / 2 ? '북' : '남') + (i < N / 2 ? '서' : '동');
  return `${q}쪽 ${AREA_NAME[zone]}`;
}
export const ALL_AREAS = (() => {
  const set = new Set();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const zone = ZONES[j][i];
    set.add(UNIQUE.has(zone) ? AREA_NAME[zone] : `${(j < N / 2 ? '북' : '남') + (i < N / 2 ? '서' : '동')}쪽 ${AREA_NAME[zone]}`);
  }
  return [...set];
})();

const LANDMARKS = [
  { name: '호수공원 전망대', x: 170, z: -164, icon: '🗼' },
  { name: '호수공원 나무다리', x: 0, z: 0, icon: '🌉' },
  { name: '호수 수변 무대', x: 0, z: lakeR(Math.PI / 2) + 14, icon: '🎤' },
];

// 미션 종류: 진행 조건 · 보상
const KINDS = {
  visit: { icon: '📍', make: (R, ctx) => { const t = ctx.visitTargets(R); return { text: `${t.name}에 가 보기`, target: t, need: 1, money: 6000, xp: 30 }; } },
  talk: { icon: '💬', make: (R) => { const n = 2 + Math.floor(R() * 2); return { text: `길에서 사람 ${n}명에게 말 걸기`, need: n, money: 4000, xp: 25 }; } },
  walk: { icon: '🚶', make: (R) => { const n = 500 + Math.floor(R() * 4) * 150; return { text: `걸어서 ${n}m 산책하기`, need: n, money: 3500, xp: 20, unit: 'm' }; } },
  buy_mart: { icon: '🏪', make: () => ({ text: '24 마트에서 물건 사기', need: 1, money: 3000, xp: 20 }) },
  buy_stat: { icon: '✏️', make: () => ({ text: '문구랜드에서 물건 사기', need: 1, money: 3000, xp: 20 }) },
  eat: { icon: '🍙', make: () => ({ text: '밥 두 번 챙겨 먹기', need: 2, money: 3000, xp: 20 }) },
  earn: { icon: '💼', make: () => ({ text: '일해서 돈 벌기 (알바·배달·회사·학교)', need: 1, money: 5000, xp: 40 }) },
  discover: { icon: '🧭', make: () => ({ text: '새로운 지역 발견하기', need: 1, money: 4000, xp: 30 }) },
  errand: { icon: '🙏', make: () => ({ text: '길에서 만난 사람의 부탁 들어주기', need: 1, money: 6000, xp: 40 }) },
  gacha: { icon: '🎰', make: () => ({ text: '문구랜드 뽑기 해 보기', need: 1, money: 1500, xp: 15 }) },
};
const NAMES = ['김민준', '이서연', '박도윤', '최하은', '정시우', '강지아', '조예준', '윤수아', '장하준', '임서윤', '한지호', '오채원', '서은우', '신다은', '권유준', '황지유', '안건우', '송민서', '전서진', '홍예린'];
const ITEMS = ['서류 봉투', '택배 상자', '도시락 가방', '책 한 권', '꽃다발', '우산', '열쇠 꾸러미', '선물 상자'];

export class Missions {
  constructor(ctx) { this.c = ctx; this.lastPos = null; this.areaT = 0; }
  get S() { return this.c.S; }
  init() {
    const S = this.S;
    S.xp = S.xp || 0; S.discovered = S.discovered || []; S.talkedTotal = S.talkedTotal || 0;
    this.ensureDaily();
  }
  level() { let lv = 1, xp = this.S.xp || 0; while (xp >= lv * 100) { xp -= lv * 100; lv++; } return { lv, xp, need: lv * 100 }; }
  addXp(n, why) {
    const before = this.level().lv;
    this.S.xp = (this.S.xp || 0) + n;
    const after = this.level();
    if (after.lv > before) {
      const bonus = after.lv * 5000;
      this.S.money += bonus; this.c.flashMoney(true);
      this.c.audio.play('goal');
      setTimeout(() => bigMsg(`⬆️ 레벨 ${after.lv}!`, `레벨업 보너스 ${won(bonus)}`, 2800), 300);
    }
  }
  // 오늘의 미션 (날짜마다 새로)
  ensureDaily() {
    const S = this.S, day = ST.day(S);
    if (S.daily && S.daily.day === day) return S.daily;
    const R = seeded(day * 7919 + 13);
    const pool = Object.keys(KINDS).filter(k => !(k === 'buy_stat' && day === 1));
    const pick = [];
    while (pick.length < 3) { const k = pool[Math.floor(R() * pool.length)]; if (!pick.includes(k)) pick.push(k); }
    S.daily = { day, bonus: false, list: pick.map((k, i) => ({ id: day + '-' + i, kind: k, prog: 0, done: false, claimed: false, ...KINDS[k].make(R, this) })) };
    return S.daily;
  }
  visitTargets(R) {
    const seen = new Set(), list = [];
    for (const e of this.c.city.entrances) { if (e.id === 'home' || seen.has(e.name)) continue; seen.add(e.name); list.push({ name: e.name, x: e.x, z: e.z, icon: e.icon }); }
    list.push(...LANDMARKS);
    return list[Math.floor(R() * list.length)];
  }
  event(kind, n = 1) {
    const d = this.ensureDaily();
    for (const m of d.list) {
      if (m.kind !== kind || m.done) continue;
      m.prog = Math.min(m.need, m.prog + n);
      if (m.prog >= m.need) this.complete(m);
    }
  }
  complete(m) {
    m.done = true;
    this.c.audio.play('success');
    toast(`🎯 미션 완료! ${m.text} · 📱 휴대폰 → 미션에서 보상 받기`, 'good', 4200);
    this.c.persist();
  }
  claim(id) {
    const m = this.ensureDaily().list.find(x => x.id === id);
    if (!m || !m.done || m.claimed) return false;    // 보상은 한 번만
    m.claimed = true;
    this.S.money += m.money; this.c.flashMoney(true); this.c.audio.coin();
    this.addXp(m.xp);
    toast(`🎁 보상 ${won(m.money)} · 경험치 +${m.xp}`, 'good');
    this.c.persist();
    return true;
  }
  claimBonus() {
    const d = this.ensureDaily();
    if (d.bonus || !d.list.every(m => m.claimed)) return false;
    d.bonus = true;
    this.S.money += 10000; this.c.flashMoney(true); this.addXp(50);
    this.c.audio.play('goal'); bigMsg('🎉 오늘의 미션 전부 완료!', `보너스 ${won(10000)} · 경험치 +50`, 2600);
    this.c.persist();
    return true;
  }
  // 매 프레임: 걸은 거리 · 방문 · 지역 발견
  update(dt, wp, onFoot) {
    const S = this.S;
    if (this.lastPos && onFoot) {
      const d = Math.hypot(wp.x - this.lastPos.x, wp.z - this.lastPos.z);
      if (d > 0.01 && d < 5) { this.walkAcc = (this.walkAcc || 0) + d; if (this.walkAcc >= 10) { this.event('walk', Math.floor(this.walkAcc)); this.walkAcc %= 1; } }
    }
    this.lastPos = { x: wp.x, z: wp.z };
    const daily = this.ensureDaily();
    for (const m of daily.list) if (m.kind === 'visit' && !m.done && Math.hypot(wp.x - m.target.x, wp.z - m.target.z) < 8) { m.prog = 1; this.complete(m); }
    this.areaT -= dt;
    if (this.areaT <= 0) {
      this.areaT = 0.7;
      const a = areaAt(wp.x, wp.z);
      if (a && a !== this.curArea) {
        this.curArea = a;
        if (!S.discovered.includes(a)) {
          S.discovered.push(a);
          if (S.discovered.length > 1) {
            this.addXp(15);
            toast(`🧭 새 지역 발견: <b>${a}</b> · 경험치 +15 (${S.discovered.length}/${ALL_AREAS.length})`, 'good', 3600);
            this.event('discover');
          }
        }
      }
    }
  }
  hudLine() {
    const d = this.ensureDaily();
    const m = d.list.find(x => !x.done);
    const done = d.list.filter(x => x.done).length;
    if (!m) return d.list.some(x => !x.claimed) || !d.bonus ? `🎯 오늘의 미션 ${done}/3 완료!<small>📱 휴대폰 → 미션에서 보상을 받으세요</small>` : '';
    return `🎯 ${m.text} <span class="dist">${m.prog}${m.unit || ''}/${m.need}${m.unit || ''}</span><small>오늘의 미션 ${done}/3 · 보상 ${won(m.money)}</small>`;
  }
  target() {
    const m = this.ensureDaily().list.find(x => x.kind === 'visit' && !x.done);
    return m ? m.target : null;
  }
  phoneHtml() {
    const d = this.ensureDaily(), L = this.level(), S = this.S;
    const bar = (p, col = '#46d1ff') => `<div style="height:7px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:5px"><i style="display:block;height:100%;width:${Math.round(p * 100)}%;background:${col}"></i></div>`;
    return `<div class="ph-title">🎯 미션</div>
      <div class="ph-widget"><b>레벨 ${L.lv}</b> · 경험치 ${L.xp}/${L.need}${bar(L.xp / L.need, '#ffd21a')}
        <div style="font-size:12px;opacity:.8;margin-top:6px">🧭 발견한 지역 ${S.discovered.length}/${ALL_AREAS.length} · 💬 대화한 사람 ${S.talkedTotal || 0}명</div></div>
      <div class="note" style="color:#ddd;margin:10px 0 4px">${ST.day(S)}일차 오늘의 미션 · 날짜가 바뀌면 새 미션이 나와요</div>
      ${d.list.map(m => `<div class="row"><div class="ic">${KINDS[m.kind].icon}</div><div class="info"><b>${m.text}</b><span>${m.prog}${m.unit || ''}/${m.need}${m.unit || ''} · ${won(m.money)} · 경험치 ${m.xp}</span>${bar(m.prog / m.need, m.done ? '#3ddc84' : '#46d1ff')}</div>
        ${m.claimed ? '<button class="btn gray" disabled>받음</button>' : m.done ? `<button class="btn green" data-claim="${m.id}">보상 받기</button>` : (m.kind === 'visit' ? `<button class="btn gray" data-way="${m.id}">길안내</button>` : '')}</div>`).join('')}
      <div class="row" style="${d.bonus ? 'opacity:.5' : ''}"><div class="ic">🎁</div><div class="info"><b>3개 모두 완료 보너스</b><span>${won(10000)} · 경험치 50</span></div>
        <button class="btn ${d.list.every(m => m.claimed) && !d.bonus ? 'green' : 'gray'}" data-bonus="1" ${d.list.every(m => m.claimed) && !d.bonus ? '' : 'disabled'}>${d.bonus ? '받음' : '받기'}</button></div>`;
  }

  // ───────── 길에서 만난 사람과 대화 ─────────
  talkSheet(o, hours) {
    const S = this.S;
    if (!o.name) o.name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const greet = hours < 11 ? '좋은 아침이에요!' : hours < 17 ? '안녕하세요~' : hours < 21 ? '좋은 저녁이에요.' : '이 시간에 산책하세요?';
    const area = areaAt(o.pos.x, o.pos.z) || '이 동네';
    const chats = [
      `"${area}는 살기 좋은 동네예요."`, '"문구랜드 뽑기에 황금 유니콘이 있대요. 아직 아무도 못 뽑았대요!"',
      '"24 마트 알바 구한대요. 계산대에서 물어보세요."', '"호수공원 전망대에서 보는 야경이 최고예요."',
      '"배달 일은 힘들어도 팁이 쏠쏠하대요."', '"한빛대학교 교육학과 나오면 선생님이 될 수 있어요."',
      '"드림모터스에 새 스포츠카 들어왔던데요?"', '"요즘 한끼식당 갈비가 그렇게 맛있대요."',
    ];
    const render = () => openSheet({
      icon: '💬', title: o.name, sub: `${area} · 지나가던 시민`,
      html: `<p class="note">${o.name}: "${greet}"</p>` +
        row({ icon: '👋', title: '인사하기', desc: o.greeted ? '이미 인사했어요' : '기분 +2', btn: '인사', action: 'hi', disabled: !!o.greeted }) +
        row({ icon: '🗨️', title: '이야기하기', desc: '동네 소문을 들어요', btn: '듣기', action: 'chat' }) +
        row({ icon: '🧭', title: '길 묻기', desc: '가까운 가게를 알려줘요', btn: '묻기', action: 'way' }) +
        (o.req && !o.reqDone ? row({ icon: '🙏', title: '부탁 들어주기', desc: S.errand ? '다른 부탁을 하고 있어요' : `"${o.reqItem}을(를) 좀 전해 줄 수 있어요?"`, btn: '들어주기', action: 'req', disabled: !!S.errand, btnClass: 'green' }) : '') +
        `<button class="btn wide gray" data-act="bye">잘 가요</button>`,
      bind: (b) => bindActs(b, {
        hi: () => {
          o.greeted = true; S.mood = ST.clamp(S.mood + 2); S.talkedTotal = (S.talkedTotal || 0) + 1;
          this.event('talk'); this.addXp(3);
          toast(`👋 ${o.name}: "반가워요!"`); render();
        },
        chat: () => { S.mood = ST.clamp(S.mood + 1); toast(`🗨️ ${o.name}: ${chats[Math.floor(Math.random() * chats.length)]}`, '', 4200); if (!o.greeted) { o.greeted = true; S.talkedTotal = (S.talkedTotal || 0) + 1; this.event('talk'); } },
        way: () => {
          const want = ['mart', 'stat', 'rest', 'gym', 'delivery'];
          let best = null, bd = 1e9;
          for (const e of this.c.city.entrances) if (want.includes(e.id)) { const d = Math.hypot(e.x - o.pos.x, e.z - o.pos.z); if (d < bd) { bd = d; best = e; } }
          if (best) { S.waypoint = { x: best.x, z: best.z, name: best.name }; toast(`🧭 ${o.name}: "${best.name}은(는) ${Math.round(bd)}m 쯤 저쪽이에요." · 길안내 시작`, '', 4000); }
          closeSheet();
        },
        req: () => {
          const t = this.errandTarget(o);
          S.errand = { from: o.name, item: o.reqItem, to: t, money: 4000 + Math.round(Math.hypot(t.x - o.pos.x, t.z - o.pos.z) * 12 / 100) * 100, xp: 40 };
          o.reqDone = true;
          toast(`🙏 ${o.name}의 부탁: ${o.reqItem}을(를) <b>${t.name}</b>에 전해 주기 · 빛기둥을 따라가세요`, 'good', 4500);
          closeSheet(); this.c.persist();
        },
        bye: () => closeSheet(),
      }),
    });
    render();
  }
  errandTarget(o) {
    const doors = this.c.city.doors;
    const near = doors.filter(d => { const k = Math.hypot(d.x - o.pos.x, d.z - o.pos.z); return k > 120 && k < 550; });
    const d = (near.length ? near : doors)[Math.floor(Math.random() * (near.length || doors.length))];
    return { x: d.x, z: d.z, name: d.name };
  }
  finishErrand() {
    const S = this.S, e = S.errand;
    if (!e) return;
    S.errand = null;
    S.money += e.money; this.c.flashMoney(true); this.c.audio.coin();
    this.addXp(e.xp);
    toast(`🙏 ${e.item} 전달 완료! ${e.from}이(가) 고맙대요 · ${won(e.money)} · 경험치 +${e.xp}`, 'good', 4200);
    this.event('errand');
    this.c.persist();
  }
}
export function pedName() { return NAMES[Math.floor(Math.random() * NAMES.length)]; }
export function pedItem() { return ITEMS[Math.floor(Math.random() * ITEMS.length)]; }

// ───────── 9단계: 직업별 성공 루트 · 업적 ─────────
import { toast, bigMsg } from './ui.js';
import { won } from './config.js';
import { CAREERS } from './career.js';
import * as ST from './state.js';

const best = (S, kind) => Math.max(S.bestRank?.[kind] ?? -1, S.career?.kind === kind ? S.career.rank : -1);
const rankRoute = (kind, icon, title, steps) => ({ id: kind, icon, title, steps: steps.map(([r, label]) => ({ label, done: (S) => best(S, kind) >= r })), kind });

// 루트: 단계별 목표
export const ROUTES = [
  rankRoute('office', '💼', '회사원 → 사장', [[0, '입사 (인턴)'], [3, '대리 승진'], [4, '과장'], [6, '부장'], [8, '사장 취임']]),
  rankRoute('police', '👮', '순경 → 경찰서장', [[0, '경찰 임용'], [2, '경사'], [4, '경감'], [6, '총경 (경찰서장)']]),
  rankRoute('fire', '🧑‍🚒', '소방사 → 소방서장', [[0, '소방관 임용'], [2, '소방장'], [4, '소방경'], [6, '소방정 (소방서장)']]),
  rankRoute('doctor', '🧑‍⚕️', '의대생 → 병원장', [[0, '인턴'], [2, '전문의'], [3, '과장'], [5, '병원장']]),
  rankRoute('nurse', '👩‍⚕️', '간호사 → 간호부장', [[0, '간호사'], [2, '수간호사'], [3, '간호부장']]),
  rankRoute('pharmacist', '💊', '약사 → 약국장', [[0, '근무약사'], [2, '약국장']]),
  rankRoute('stylist', '💇', '미용 인턴 → 원장', [[0, '인턴'], [1, '디자이너'], [3, '원장']]),
  rankRoute('chef', '👨‍🍳', '주방보조 → 오너셰프', [[0, '주방보조'], [2, '부주방장'], [4, '오너셰프']]),
  rankRoute('barista', '☕', '바리스타 → 점장', [[0, '바리스타'], [3, '점장']]),
  rankRoute('baker', '🥐', '제빵사 → 제과점 대표', [[0, '제빵사'], [3, '제과점 대표']]),
  { id: 'boss', icon: '🏪', title: '사장님 → 프랜차이즈', steps: [
    { label: '첫 가게 오픈', done: (S) => (S.shopsOpened || 0) >= 1 },
    { label: '가게 2곳 동시 운영', done: (S) => (S.contracts || []).filter(c => c.shop).length >= 2 },
    { label: '프랜차이즈 (가게 3곳)', done: (S) => (S.contracts || []).filter(c => c.shop).length >= 3 } ] },
  { id: 'landlord', icon: '🏢', title: '세입자 → 건물주', steps: [
    { label: '내 이름으로 계약', done: (S) => (S.contracts || []).some(c => c.kind === 'home') },
    { label: '내 집 마련 (매매)', done: (S) => (S.contracts || []).some(c => c.kind === 'home' && c.deal === 'buy') },
    { label: '건물주', done: (S) => (S.ownedBldgs || []).length >= 1 },
    { label: '빌딩 3채', done: (S) => (S.ownedBldgs || []).length >= 3 } ] },
  { id: 'investor', icon: '📈', title: '개미 → 슈퍼개미', steps: [
    { label: '첫 주식 매수', done: (S) => Object.keys(S.stocks?.hold || {}).length > 0 || (S.stockGain || 0) !== 0 },
    { label: '실현 수익 100만 원', done: (S) => (S.stockGain || 0) >= 1e6 },
    { label: '실현 수익 1,000만 원', done: (S) => (S.stockGain || 0) >= 1e7 },
    { label: '실현 수익 1억 원', done: (S) => (S.stockGain || 0) >= 1e8 } ] },
  { id: 'rich', icon: '💰', title: '자산 모으기', steps: [
    { label: '1,000만 원', done: (S, A) => A >= 1e7 }, { label: '1억 원', done: (S, A) => A >= 1e8 }, { label: '10억 원', done: (S, A) => A >= 1e9 }, { label: '100억 원', done: (S, A) => A >= 1e10 } ] },
  { id: 'pet', icon: '🐾', title: '반려동물 집사', steps: [
    { label: '반려동물 입양', done: (S) => !!S.pet },
    { label: '함께 7일', done: (S) => S.pet && ST.day(S) - S.pet.since >= 7 },
    { label: '함께 28일 (1년)', done: (S) => S.pet && ST.day(S) - S.pet.since >= 28 } ] },
  { id: 'photo', icon: '📸', title: '도시 사진가', steps: [
    { label: '첫 사진', done: (S) => (S.photoCount || 0) >= 1 },
    { label: '사진 20장', done: (S) => (S.photoCount || 0) >= 20 },
    { label: '사계절을 모두 찍기', done: (S) => (S.photoSeasons || []).length >= 4 },
    { label: '반려동물과 사진', done: (S) => (S.petPhotos || 0) >= 1 } ] },
  { id: 'citizen', icon: '🏛️', title: '모범 시민', steps: [
    { label: '전입신고', done: (S) => !!S.movedReg },
    { label: '선거 투표', done: (S) => !!S.vote },
    { label: '사고·화재 신고', done: (S) => (S.reports || 0) >= 1 },
    { label: '대중교통 20번', done: (S) => (S.rides || 0) >= 20 } ] },
];

export class Achieve {
  constructor(ctx) { this.c = ctx; this.t = 0; }   // { S, audio, missions, assets() }
  get S() { return this.c.S; }
  update(dt) {
    this.t -= dt; if (this.t > 0) return; this.t = 3;
    const S = this.S;
    if (S.career) { S.bestRank = S.bestRank || {}; S.bestRank[S.career.kind] = Math.max(S.bestRank[S.career.kind] ?? -1, S.career.rank); }
    S.routeDone = S.routeDone || {};
    const A = this.c.assets();
    for (const r of ROUTES) for (let i = 0; i < r.steps.length; i++) {
      const key = `${r.id}:${i}`;
      if (S.routeDone[key]) continue;
      if (!r.steps[i].done(S, A)) continue;
      S.routeDone[key] = ST.day(S);
      const last = i === r.steps.length - 1;
      this.c.missions?.addXp?.(last ? 200 : 40);
      this.c.audio?.chime?.();
      if (last) bigMsg(`👑 ${r.icon} ${r.title} 완성!`, `성공 루트 달성 · 경험치 +200`, 4200);
      else toast(`🏅 ${r.icon} ${r.steps[i].label} · 경험치 +40`, 'good', 3200);
    }
  }
  html() {
    const S = this.S, done = S.routeDone || {};
    const started = ROUTES.filter(r => r.steps.some((_, i) => done[`${r.id}:${i}`]) || !r.kind || S.career?.kind === r.kind);
    const rest = ROUTES.filter(r => !started.includes(r));
    const one = (r) => {
      const n = r.steps.filter((_, i) => done[`${r.id}:${i}`]).length;
      const next = r.steps.find((_, i) => !done[`${r.id}:${i}`]);
      return `<div class="row" style="${n === r.steps.length ? 'background:rgba(255,200,60,.12)' : ''}"><div class="ic">${r.icon}</div><div class="info"><b>${r.title} ${n === r.steps.length ? '👑' : ''}</b><span>${r.steps.map((s, i) => done[`${r.id}:${i}`] ? '●' : '○').join(' ')} · ${next ? `다음: ${next.label}` : '완성!'}</span></div></div>`;
    };
    const total = ROUTES.reduce((a, r) => a + r.steps.length, 0), got = Object.keys(done).length;
    return `<div class="ph-sub" style="margin:14px 0 6px;font-weight:700">🛤️ 성공 루트 (${got}/${total})</div>${started.map(one).join('')}
      ${rest.length ? `<details style="margin-top:6px"><summary style="color:#bbb;cursor:pointer">다른 직업 루트 보기 (${rest.length})</summary>${rest.map(one).join('')}</details>` : ''}`;
  }
}

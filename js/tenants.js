// ───────── 업종 카탈로그 · 간판 이름 · 층별 입점 규칙 ─────────
// 순수 데이터 (THREE 없음) — 건물 겉모습(간판)과 실내가 같은 규칙으로 정해져요.
import { seeded } from './geo.js';

// 업종: fam = 실내 모양 · loc = 들어가는 층 ('1'=1층, 'L'=2~3층, 'U'=4층 이상, 'B'=지하)
// hours: [여는 시각, 닫는 시각(24 넘으면 새벽)], br: 브레이크타임
export const TYPES = {
  bbq: { label: '고깃집', icon: '🥩', fam: 'bbq', loc: '1LB', minW: 8, hours: [11.5, 23], cat: 'food' },
  karaoke: { label: '노래방', icon: '🎤', fam: 'karaoke', loc: 'BLU', minW: 9, hours: [12, 26], cat: 'fun' },
  pcbang: { label: 'PC방', icon: '🖥️', fam: 'pcbang', loc: 'BLU', minW: 9, hours: [0, 24], cat: 'fun' },
  chicken: { label: '치킨', icon: '🍗', fam: 'chicken', loc: '1', minW: 5, hours: [15, 25], cat: 'food' },
  pizza: { label: '피자', icon: '🍕', fam: 'pizza', loc: '1', minW: 5, hours: [11, 23], cat: 'food' },
  burger: { label: '버거', icon: '🍔', fam: 'burger', loc: '1', minW: 6, hours: [9, 23], cat: 'food' },
  cafe: { label: '카페', icon: '☕', fam: 'cafe', loc: '1L', minW: 5, hours: [8, 22], cat: 'food' },
  bakery: { label: '빵집', icon: '🥐', fam: 'bakery', loc: '1', minW: 5, hours: [7.5, 22], cat: 'food' },
  bunsik: { label: '분식', icon: '🍢', fam: 'bunsik', loc: '1', minW: 5, hours: [9, 21.5], cat: 'food' },
  hansik: { label: '한식', icon: '🍲', fam: 'hansik', loc: '1L', minW: 6, hours: [10.5, 21.5], br: [15, 17], cat: 'food' },
  chinese: { label: '중식', icon: '🥟', fam: 'chinese', loc: '1L', minW: 6, hours: [11, 21.5], br: [15, 17], cat: 'food' },
  japanese: { label: '일식', icon: '🍣', fam: 'japanese', loc: '1L', minW: 6, hours: [11.5, 22], br: [15, 17], cat: 'food' },
  dessert: { label: '디저트', icon: '🍧', fam: 'dessert', loc: '1', minW: 5, hours: [11, 23], cat: 'food' },
  kidscafe: { label: '키즈카페', icon: '🧸', fam: 'kidscafe', loc: 'LU', minW: 12, hours: [10, 20], cat: 'fun' },
  petshop: { label: '펫숍', icon: '🐶', fam: 'petshop', loc: '1', minW: 5, hours: [10, 21], cat: 'pet' },
  vet: { label: '동물병원', icon: '🐾', fam: 'vet', loc: '1L', minW: 6, hours: [9.5, 20], cat: 'pet' },
  salon: { label: '미용실', icon: '💇', fam: 'salon', loc: '1L', minW: 5, hours: [10, 21], cat: 'beauty' },
  nail: { label: '네일샵', icon: '💅', fam: 'nail', loc: 'L', minW: 4, hours: [11, 21], cat: 'beauty' },
  clinic: { label: '병원', icon: '🏥', fam: 'clinic', loc: 'LU', minW: 7, hours: [9, 18.5], br: [13, 14], cat: 'med' },
  dental: { label: '치과', icon: '🦷', fam: 'dental', loc: 'LU', minW: 7, hours: [9.5, 19], br: [13, 14], cat: 'med' },
  pharmacy: { label: '약국', icon: '💊', fam: 'pharmacy', loc: '1', minW: 4, hours: [9, 21], cat: 'med' },
  bank: { label: '은행', icon: '🏦', fam: 'bank', loc: '1', minW: 9, hours: [9, 16], off: [5, 6], cat: 'svc' },
  realty: { label: '부동산', icon: '🏘️', fam: 'realty', loc: '1', minW: 4, hours: [9, 19], off: [6], cat: 'svc' },
  academy: { label: '학원', icon: '📚', fam: 'academy', loc: 'LU', minW: 8, hours: [13, 22], off: [6], cat: 'edu' },
  taekwondo: { label: '태권도장', icon: '🥋', fam: 'taekwondo', loc: 'LU', minW: 9, hours: [13, 20], off: [5, 6], cat: 'edu' },
  piano: { label: '피아노학원', icon: '🎹', fam: 'piano', loc: 'LU', minW: 6, hours: [13, 20], off: [6], cat: 'edu' },
  art: { label: '미술학원', icon: '🎨', fam: 'art', loc: 'LU', minW: 6, hours: [13, 20], off: [6], cat: 'edu' },
  reading: { label: '독서실', icon: '📖', fam: 'reading', loc: 'U', minW: 9, hours: [0, 24], cat: 'edu' },
  studycafe: { label: '스터디카페', icon: '✏️', fam: 'studycafe', loc: 'LU', minW: 8, hours: [0, 24], cat: 'edu' },
  bookstore: { label: '책방', icon: '📕', fam: 'bookstore', loc: '1L', minW: 5, hours: [10, 21], cat: 'shop' },
  mart: { label: '마트', icon: '🛒', fam: 'mart', loc: '1B', minW: 9, hours: [9, 23], cat: 'shop' },
  fruit: { label: '과일가게', icon: '🍎', fam: 'grocer', loc: '1', minW: 4, hours: [9, 22], cat: 'shop' },
  butcher: { label: '정육점', icon: '🥩', fam: 'butcher', loc: '1', minW: 4, hours: [10, 21], cat: 'shop' },
  banchan: { label: '반찬가게', icon: '🥗', fam: 'deli', loc: '1', minW: 4, hours: [9, 20], cat: 'shop' },
  tteok: { label: '떡집', icon: '🍡', fam: 'deli', loc: '1', minW: 4, hours: [7, 19], cat: 'shop' },
  flower: { label: '꽃집', icon: '💐', fam: 'flower', loc: '1', minW: 4, hours: [9, 20], cat: 'shop' },
  optician: { label: '안경점', icon: '👓', fam: 'optician', loc: '1L', minW: 4, hours: [10, 21], cat: 'shop' },
  phone: { label: '휴대폰 매장', icon: '📱', fam: 'phone', loc: '1', minW: 4, hours: [10, 21], cat: 'shop' },
  laundry: { label: '세탁소', icon: '👔', fam: 'laundry', loc: '1', minW: 4, hours: [8, 21], cat: 'svc' },
  coinwash: { label: '빨래방', icon: '🧺', fam: 'coinwash', loc: '1', minW: 4, hours: [0, 24], cat: 'svc' },
  photo: { label: '사진관', icon: '📷', fam: 'photo', loc: '1L', minW: 4, hours: [10, 20], cat: 'svc' },
  gym: { label: '헬스장', icon: '🏋️', fam: 'gym', loc: 'UB', minW: 12, hours: [6, 24], cat: 'fit' },
  yoga: { label: '요가·필라테스', icon: '🧘', fam: 'yoga', loc: 'LU', minW: 8, hours: [7, 22], off: [6], cat: 'fit' },
  office: { label: '사무실', icon: '🗂️', fam: 'office', loc: 'LU', minW: 5, hours: [9, 18], off: [5, 6], cat: 'work' },
};

// 간판 이름: [이름, 간판색, 업종, 프랜차이즈?]
// 앞쪽 48개는 예전부터 쓰던 간판 (순서 유지)
export const SHOP_NAMES = [
  ['정성김밥', '#c0392b', 'bunsik'], ['바삭치킨', '#e67e22', 'chicken'], ['장터국밥', '#6d4c2f', 'hansik'], ['엄마손분식', '#d35400', 'bunsik'], ['커피한잔', '#3e2723', 'cafe'], ['달콤베이커리', '#ad6f3b', 'bakery'],
  ['스마일치과', '#1e88e5', 'dental'], ['튼튼소아과', '#2e7d32', 'clinic'], ['푸른안과', '#00838f', 'clinic'], ['한빛세탁', '#3949ab', 'laundry'], ['반짝네일', '#d81b60', 'nail'], ['멍냥동물병원', '#6a1b9a', 'vet'],
  ['쑥쑥수학학원', '#1565c0', 'academy'], ['글로벌영어', '#283593', 'academy'], ['꿈틀미술', '#ef6c00', 'art'], ['라온피아노', '#5d4037', 'piano'], ['태극태권도', '#b71c1c', 'taekwondo'], ['한빛은행', '#0d47a1', 'bank', 1],
  ['우리동네마트', '#2e7d32', 'mart'], ['싱싱과일', '#558b2f', 'fruit'], ['도담꽃집', '#c2185b', 'flower'], ['다온안경', '#37474f', 'optician'], ['온새미약국', '#00897b', 'pharmacy'], ['빛고을헤어', '#4527a0', 'salon'],
  ['나래독서실', '#455a64', 'reading'], ['스터디카페 몰입', '#263238', 'studycafe'], ['코인노래방', '#8e24aa', 'karaoke'], ['PC존', '#212121', 'pcbang', 1], ['한빛한의원', '#795548', 'clinic'], ['미래이비인후과', '#0277bd', 'clinic'],
  ['고기굽는집', '#bf360c', 'bbq'], ['면사랑', '#f9a825', 'hansik'], ['초밥왕', '#1a237e', 'japanese'], ['마라공방', '#c62828', 'chinese'], ['피자마을', '#e53935', 'pizza'], ['동네책방', '#4e342e', 'bookstore'],
  ['한빛부동산', '#1d3b6e', 'realty'], ['새봄요가', '#00695c', 'yoga'], ['밝은내과', '#1976d2', 'clinic'], ['365 정형외과', '#0d47a1', 'clinic'], ['아이조아 키즈카페', '#f57f17', 'kidscafe'], ['한빛사진관', '#6a1b9a', 'photo'],
  ['한빛휴대폰', '#e53935', 'phone'], ['빨래방', '#0288d1', 'coinwash'], ['참치정육', '#ad1457', 'butcher'], ['한빛떡집', '#8d6e63', 'tteok'], ['반찬가게', '#689f38', 'banchan'], ['디저트39', '#ec407a', 'dessert'],
  // ─ 새로 추가 (프랜차이즈 = 1) ─
  ['돈마루 삼겹살', '#8e2416', 'bbq', 1], ['한우마을', '#5d1f12', 'bbq'], ['숯불연가', '#a1361a', 'bbq'], ['갈비명가', '#6b2410', 'bbq'],
  ['꼬꼬닭 치킨', '#f39c12', 'chicken', 1], ['치킨플러스', '#d84315', 'chicken', 1], ['옛날통닭', '#b5651d', 'chicken'],
  ['피자스퀘어', '#1565c0', 'pizza', 1], ['버거팩토리', '#e74c3c', 'burger', 1], ['빅버거', '#f1c40f', 'burger', 1],
  ['빈스커피', '#4e342e', 'cafe', 1], ['오늘커피', '#f9a825', 'cafe', 1], ['카페 온도', '#6d4c41', 'cafe'], ['카페 숲', '#33691e', 'cafe'],
  ['빵굽는마을', '#8d5524', 'bakery', 1], ['김밥천하', '#e53935', 'bunsik', 1], ['떡볶이공장', '#c62828', 'bunsik', 1],
  ['한빛백반', '#5d4037', 'hansik'], ['순두부명가', '#bf360c', 'hansik'], ['만리장성', '#b71c1c', 'chinese'], ['짬뽕대가', '#d32f2f', 'chinese', 1],
  ['돈카츠 요시', '#37474f', 'japanese'], ['라멘하우스', '#212121', 'japanese'], ['빙수왕국', '#26c6da', 'dessert', 1],
  ['멍멍펫샵', '#ff7043', 'petshop'], ['튼튼약국', '#00796b', 'pharmacy'], ['모두약국', '#00897b', 'pharmacy', 1], ['한빛저축은행', '#1a237e', 'bank', 1],
  ['행복공인중개사', '#283593', 'realty'], ['고운피부과', '#ad1457', 'clinic'], ['바른치과', '#0288d1', 'dental'], ['헤어살롱 준', '#311b92', 'salon'],
  ['헤어그루', '#4a148c', 'salon', 1], ['한빛국어논술', '#1b5e20', 'academy'], ['코딩스쿨', '#0d47a1', 'academy', 1], ['집중독서실', '#37474f', 'reading'],
  ['스타노래방', '#6a1b9a', 'karaoke', 1], ['게임존 PC방', '#1a1a2e', 'pcbang', 1], ['파워헬스', '#212121', 'gym', 1], ['필라테스 온', '#00838f', 'yoga'],
  ['한빛세무회계', '#263238', 'office'], ['바른법무사', '#3e2723', 'office'], ['미래보험', '#1565c0', 'office'], ['디자인 스튜디오', '#424242', 'office'],
  ['한빛마트 24', '#2e7d32', 'mart', 1], ['책읽는곰', '#5d4037', 'bookstore'], ['밝은안경', '#455a64', 'optician', 1], ['슈퍼키즈랜드', '#ff6f00', 'kidscafe', 1],
  ['한빛동물의료센터', '#4a148c', 'vet'], ['꽃담', '#ad1457', 'flower'], ['크린토피아 세탁', '#0277bd', 'laundry', 1], ['스튜디오 빛', '#212121', 'photo'],
];
export const VACANT_SLOT = SHOP_NAMES.length;   // '임대문의' 간판 칸
export const LOBBY_SLOT = SHOP_NAMES.length + 1; // 건물 출입구

// 업종별 이름 목록
export const NAMES_BY_TYPE = {};
SHOP_NAMES.forEach(([, , t], i) => (NAMES_BY_TYPE[t] = NAMES_BY_TYPE[t] || []).push(i));

// 층 기호
function locKey(n) { return n < 0 ? 'B' : n === 1 ? '1' : n <= 3 ? 'L' : 'U'; }
// 업종 가중치 (실제 신도시 상가처럼)
const W1 = { cafe: 9, bunsik: 6, chicken: 6, bakery: 4, pharmacy: 5, realty: 5, hansik: 5, bbq: 4, pizza: 3, burger: 3, dessert: 2, mart: 2, fruit: 2, butcher: 1.5, banchan: 1.5, tteok: 1, flower: 1.5, optician: 1.5, phone: 2, laundry: 2, coinwash: 1, photo: 1, bank: 1.5, petshop: 1.5, bookstore: 1, salon: 3, chinese: 2, japanese: 2, vet: 1 };
const WL = { clinic: 8, dental: 4, academy: 6, salon: 3, nail: 2, vet: 1.5, art: 2, piano: 2, taekwondo: 2, hansik: 2, chinese: 2, japanese: 1.5, cafe: 1.5, karaoke: 2, pcbang: 1.5, studycafe: 2, yoga: 1.5, office: 3, optician: 0.5, bbq: 1, kidscafe: 1, bookstore: 0.5, photo: 0.5 };
const WU = { academy: 6, reading: 4, studycafe: 3, gym: 3, yoga: 2, karaoke: 2, pcbang: 2, office: 5, kidscafe: 2, taekwondo: 2, clinic: 3, dental: 1, art: 1, piano: 1 };
const WB = { karaoke: 5, pcbang: 5, mart: 2, gym: 2, bbq: 1 };
const WEIGHTS = { 1: W1, L: WL, U: WU, B: WB };

// 가게 상태 덮어쓰기 (개업·폐업·내가 임대한 가게) — main이 저장 데이터로 채움
export const OVERRIDES = new Map();
export function unitKey(seed, n, k) { return `${seed}:${n}:${k}`; }

// 공실률 (건물 등급별)
const VAC = { A: 0.06, B: 0.11, C: 0.2 };

/**
 * 한 칸의 입점 가게: { slot, type, name, color, fr } 또는 { vacant: true }
 * seed: 건물 시드, n: 층, k: 칸 번호, w: 칸 너비(m), grade: 건물 등급, kind: 건물 종류
 */
export function tenantOf(seed, n, k, w = 8, grade = 'B', kind = 'shop', attempt = 0) {
  const o = OVERRIDES.get(unitKey(seed, n, k));
  if (o) return o.vacant ? { vacant: true, slot: VACANT_SLOT, override: true } : decorate(o.slot, { ...o, override: true });
  const R = seeded(seed * 131 + (n + 7) * 977 + k * 7919 + attempt * 104729);
  if (R() < VAC[grade] * (n === 1 ? 0.6 : 1)) return { vacant: true, slot: VACANT_SLOT };
  const lk = locKey(n);
  const table = WEIGHTS[lk];
  const entries = Object.entries(table).filter(([t]) => TYPES[t] && (TYPES[t].minW || 0) <= w + 0.5);
  if (!entries.length) return { vacant: true, slot: VACANT_SLOT };
  let tot = entries.reduce((a, [, v]) => a + v, 0), r = R() * tot, type = entries[0][0];
  for (const [t, v] of entries) { r -= v; if (r <= 0) { type = t; break; } }
  const list = NAMES_BY_TYPE[type] || [];
  if (!list.length) return { vacant: true, slot: VACANT_SLOT };
  const fr = list.filter(i => SHOP_NAMES[i][3]), indie = list.filter(i => !SHOP_NAMES[i][3]);
  const pool = fr.length && (R() < 0.5 || !indie.length) ? fr : indie.length ? indie : list;
  return decorate(pool[Math.floor(R() * pool.length)]);
}
function decorate(slot, extra = {}) {
  if (!SHOP_NAMES[slot]) return { slot, name: extra.name || '가게', color: extra.color || '#333333', type: extra.type || 'office', fr: false, ...extra };
  const [name, color, type, fr] = SHOP_NAMES[slot];
  return { slot, name, color, type, fr: !!fr, ...extra };
}
export const typeOf = (t) => TYPES[t] || TYPES.office;

// ───────── 한빛신도시 마스터플랜 ─────────
// 가로·세로 8개 블록, 도로 9줄. 블록 크기는 가운데로 갈수록 커짐 (단위 m)
export const N = 8;
export const ROAD = 20;          // 도로 폭: 중앙분리대 2 + 편도 2차로 7 + 갓길 1
export const MEDIAN = 1.0;       // 중앙분리대 반폭
export const SIDEWALK = 4;
export const LANE1 = 2.75;       // 1차로 중심 (도로 중심 기준)
export const LANE2 = 6.25;       // 2차로 중심
export const STOP = ROAD / 2 + 4.5; // 교차로 중심에서 정지선까지
export const BLOCK_W = [104, 112, 116, 124, 124, 116, 112, 104];
export const ROADS = [];
{
  const total = BLOCK_W.reduce((a, b) => a + b, 0) + N * ROAD;
  ROADS.push(-total / 2);
  for (let k = 0; k < N; k++) ROADS.push(ROADS[k] + ROAD + BLOCK_W[k]);
}
export const HALF = ROADS[N];
export const BLOCK = 120;        // (옛 코드 호환용 평균값)
export const P = 140;

// 호수공원 안쪽은 도로가 없음: v:k:s = x=ROADS[k] 세로도로의 s번째 구간, h:k:s = z=ROADS[k] 가로도로
export const REMOVED = new Set(['v:4:3', 'v:4:4', 'h:4:3', 'h:4:4']);
export function inNode(a, b) { return a >= 0 && a <= N && b >= 0 && b <= N; }
export function hasEdge(a, b, d) {
  const na = a + d[0], nb = b + d[1];
  if (!inNode(a, b) || !inNode(na, nb)) return false;
  if (d[0]) return !REMOVED.has(`h:${b}:${Math.min(a, na)}`);
  return !REMOVED.has(`v:${a}:${Math.min(b, nb)}`);
}
export function nodeExists(a, b) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(d => hasEdge(a, b, d));
}
export function segLen(a, b, d) { return d[0] ? Math.abs(ROADS[a + d[0]] - ROADS[a]) : Math.abs(ROADS[b + d[1]] - ROADS[b]); }
export function nearestRoad(v) {
  let best = 0, bd = 1e9;
  for (let k = 0; k <= N; k++) { const d = Math.abs(ROADS[k] - v); if (d < bd) { bd = d; best = k; } }
  return best;
}
// 좌표가 들어 있는 블록 번호 (도로 위면 가까운 쪽)
export function blockIndex(v) {
  for (let k = 0; k < N; k++) if (v < ROADS[k + 1]) return Math.max(0, k);
  return N - 1;
}

// 블록 (i,j)의 범위
export function blockRect(i, j) {
  const x0 = ROADS[i] + ROAD / 2, z0 = ROADS[j] + ROAD / 2;
  const x1 = ROADS[i + 1] - ROAD / 2, z1 = ROADS[j + 1] - ROAD / 2;
  return { x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
}

export const WORLD_LIMIT = HALF + 40;

// 게임 시간: 실제 1초 = 게임 1분
export const MIN_PER_SEC = 1;

export const WAGE_MART = 10320;
export const OFFICE_RANKS = [
  { name: '인턴', wage: 13000 },
  { name: '사원', wage: 16000 },
  { name: '대리', wage: 21000 },
  { name: '과장', wage: 28000 },
  { name: '차장', wage: 36000 },
  { name: '부장', wage: 47000 },
  { name: '상무', wage: 65000 },
];

export const CARS = [
  { id: 'mini', name: '중고 경차 · 모닝비', price: 800000, maxSpeed: 22, accel: 6, color: 0xf2f2ee, type: 'hatch', desc: '작고 귀여운 첫 차. 연비 최고' },
  { id: 'sedan', name: '중형 세단 · 소나무', price: 9000000, maxSpeed: 30, accel: 8, color: 0x1d2b3a, type: 'sedan', desc: '출퇴근 국민차. 승차감 좋음' },
  { id: 'suv', name: 'SUV · 투싼트', price: 18000000, maxSpeed: 31, accel: 8.5, color: 0x6b7b6a, type: 'suv', desc: '높은 시야, 넉넉한 트렁크' },
  { id: 'sport', name: '스포츠카 · 카이엔느 GT', price: 45000000, maxSpeed: 44, accel: 14, color: 0xc0201a, type: 'sport', desc: '도시의 주인공' },
];

export const HOMES = [
  { id: 'oneroom', name: '원룸', price: 0, w: 7, d: 8, desc: '작지만 내 공간' },
  { id: 'apt', name: '투룸 아파트', price: 30000000, w: 12, d: 10, desc: '거실과 침실이 분리된 아파트' },
  { id: 'pent', name: '펜트하우스', price: 200000000, w: 18, d: 14, desc: '통유리 창 너머 야경' },
];

export const FOODS = [
  { id: 'kimbap', name: '삼각김밥', price: 1400, hunger: 14, where: 'mart' },
  { id: 'ramen', name: '컵라면', price: 1700, hunger: 18, where: 'mart' },
  { id: 'sand', name: '샌드위치', price: 3800, hunger: 24, where: 'mart' },
  { id: 'dosirak', name: '편의점 도시락', price: 5500, hunger: 38, where: 'mart' },
  { id: 'coffee', name: '캔커피', price: 1500, hunger: 3, energy: 12, where: 'mart' },
  { id: 'energy', name: '에너지 드링크', price: 2500, hunger: 2, energy: 22, where: 'mart' },
  { id: 'kimchi', name: '김치찌개 정식', price: 9000, hunger: 60, where: 'rest' },
  { id: 'bulgogi', name: '불고기 백반', price: 12000, hunger: 75, where: 'rest' },
  { id: 'galbi', name: '숯불 갈비 세트', price: 32000, hunger: 100, energy: 10, where: 'rest' },
];

export const FURNITURE = [
  { id: 'bed', name: '싱글 침대', price: 0, w: 1.2, d: 2.1, sleep: 1.0 },
  { id: 'bed2', name: '퀸 침대', price: 650000, w: 1.7, d: 2.2, sleep: 1.35 },
  { id: 'fridge', name: '냉장고', price: 0, w: 0.8, d: 0.75 },
  { id: 'desk', name: '책상', price: 120000, w: 1.4, d: 0.7 },
  { id: 'chair', name: '의자', price: 45000, w: 0.55, d: 0.55 },
  { id: 'sofa', name: '3인 소파', price: 480000, w: 2.2, d: 0.95 },
  { id: 'table', name: '원목 테이블', price: 220000, w: 1.6, d: 0.9 },
  { id: 'tv', name: '65인치 TV', price: 1300000, w: 1.6, d: 0.45 },
  { id: 'shelf', name: '책장', price: 150000, w: 1.0, d: 0.4 },
  { id: 'plant', name: '몬스테라 화분', price: 38000, w: 0.6, d: 0.6 },
  { id: 'lamp', name: '스탠드 조명', price: 69000, w: 0.45, d: 0.45 },
  { id: 'rug', name: '러그', price: 89000, w: 2.4, d: 1.7 },
  { id: 'pc', name: '게이밍 PC 책상', price: 2400000, w: 1.6, d: 0.8 },
  { id: 'wardrobe', name: '옷장', price: 320000, w: 1.6, d: 0.6 },
  { id: 'piano', name: '업라이트 피아노', price: 3500000, w: 1.5, d: 0.65 },
];

export function won(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 100000000) {
    const eok = Math.floor(n / 100000000), man = Math.floor((n % 100000000) / 10000);
    return eok + '억' + (man ? ' ' + man.toLocaleString() + '만' : '') + '원';
  }
  return n.toLocaleString('ko-KR') + '원';
}

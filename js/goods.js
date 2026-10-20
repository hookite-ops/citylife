import * as THREE from 'three';

// ───────── 편의점 상품: 라벨 아틀라스 + 실제 모양 지오메트리 ─────────
// 모든 상품은 하나의 재질(라벨 아틀라스 × 꼭짓점 색)을 공유해서 드로우콜이 적어요.
let N = 10;           // 아틀라스 N×N 칸 (칸당 256px)
const CELL = 256;
const _c = new THREE.Color();
const hex = (h) => { _c.set(h); return [_c.r, _c.g, _c.b]; };

// 상품 종류 (이름·회사는 모두 가상)
// shape: pet 페트병 · can 캔 · jar 단지우유 · cup 컵라면 · tub 통 · bag 봉지 · box 상자 · tri 삼각김밥 · wedge 샌드위치 · tray 도시락 · bar 아이스바(누운 상자)
export const SKUS = {
  water: { shape: 'pet', r: 0.033, h: 0.21, body: 0xcfe9ff, cap: 0x2a7de0, bg: ['#ffffff', '#d8efff'], fg: '#1565c0', brand: '맑은샘', name: '먹는샘물 500mL', icon: '💧', price: 900 },
  water2: { shape: 'pet', r: 0.04, h: 0.27, body: 0xd8f0ff, cap: 0x1e9e5a, bg: ['#e9fff2', '#bfeeda'], fg: '#0e7a44', brand: '산골물', name: '2L 생수', icon: '⛰️', price: 1300 },
  cola: { shape: 'pet', r: 0.034, h: 0.22, body: 0x3a1a10, cap: 0xd81e1e, bg: ['#e8202a', '#b30f18'], fg: '#ffffff', brand: '콜라킹', name: 'ZERO 500mL', icon: '🥤', price: 2000 },
  cider: { shape: 'pet', r: 0.034, h: 0.22, body: 0xd8f5d0, cap: 0x2aa84a, bg: ['#2fbf57', '#127a32'], fg: '#ffffff', brand: '칠성바람', name: '사이다', icon: '🍋', price: 1900 },
  ion: { shape: 'pet', r: 0.034, h: 0.22, body: 0xe6f4ff, cap: 0x1a5fd8, bg: ['#ffffff', '#cfe4ff'], fg: '#1a5fd8', brand: '이온워터', name: '수분 충전', icon: '🌊', price: 2100 },
  tea: { shape: 'pet', r: 0.033, h: 0.21, body: 0xc8b060, cap: 0x2f7a3a, bg: ['#e8f3d8', '#b5d38a'], fg: '#2f5a1a', brand: '초록잎', name: '녹차 500mL', icon: '🍃', price: 1800 },
  juice: { shape: 'pet', r: 0.034, h: 0.2, body: 0xff9a1a, cap: 0xff7a00, bg: ['#ffb31a', '#ff7a00'], fg: '#ffffff', brand: '햇살과즙', name: '오렌지 100%', icon: '🍊', price: 2200 },
  coffee: { shape: 'can', r: 0.027, h: 0.11, body: 0xb8bcc2, bg: ['#6b3a1e', '#3a1e0e'], fg: '#ffe6c2', brand: '카페 라떼', name: '부드러운 우유커피', icon: '☕', price: 1500 },
  coffee2: { shape: 'can', r: 0.027, h: 0.11, body: 0xb8bcc2, bg: ['#1a1a1a', '#3a3a3a'], fg: '#e8c070', brand: '블랙 원두', name: '아메리카노', icon: '☕', price: 1600 },
  energy: { shape: 'can', r: 0.026, h: 0.155, body: 0xc0c4ca, bg: ['#1c1c1c', '#0a3a1a'], fg: '#4dff7a', brand: 'POWER UP', name: '에너지 드링크', icon: '⚡', price: 2500 },
  soda: { shape: 'can', r: 0.033, h: 0.122, body: 0xc0c4ca, bg: ['#ff4fa0', '#c21a6a'], fg: '#ffffff', brand: '복숭아 탄산', name: '355mL', icon: '🍑', price: 1700 },
  milk: { shape: 'jar', r: 0.036, h: 0.12, body: 0xffe27a, cap: 0xffd21a, bg: ['#ffe680', '#ffcc1a'], fg: '#7a4a00', brand: '바나나맛', name: '우유 240mL', icon: '🍌', price: 1700 },
  milk2: { shape: 'jar', r: 0.036, h: 0.12, body: 0xffd0e0, cap: 0xff8ab0, bg: ['#ffe0ea', '#ffb0c8'], fg: '#a0204a', brand: '딸기맛', name: '우유 240mL', icon: '🍓', price: 1700 },
  cupramen: { shape: 'cup', r: 0.058, rb: 0.044, h: 0.1, lid: 0xf4f4f4, bg: ['#e8231e', '#a8100c'], fg: '#ffffff', brand: '얼큰한 큰컵', name: '매운 소고기맛', icon: '🌶️', price: 1700 },
  cupramen2: { shape: 'cup', r: 0.058, rb: 0.044, h: 0.1, lid: 0x1a1a1a, bg: ['#2a2a2a', '#0a0a0a'], fg: '#ffcc33', brand: '짜장 큰컵', name: '춘장 듬뿍', icon: '🍜', price: 1900 },
  cupramen3: { shape: 'cup', r: 0.045, rb: 0.036, h: 0.075, lid: 0xf4f4f4, bg: ['#ffa01a', '#e86a00'], fg: '#ffffff', brand: '컵누들', name: '새우탕 소컵', icon: '🦐', price: 1300 },
  ramenpack: { shape: 'bag', w: 0.3, h: 0.19, d: 0.09, bg: ['#e8231e', '#b0100c'], fg: '#ffffff', brand: '얼큰라면', name: '5개입 멀티팩', icon: '🍜', price: 4500 },
  kimbap: { shape: 'tri', w: 0.105, h: 0.095, d: 0.035, bg: ['#ffffff', '#ffffff'], fg: '#d8231e', brand: '참치마요', name: '삼각김밥', icon: '🍙', price: 1400, tri: '#ff5a3a' },
  kimbap2: { shape: 'tri', w: 0.105, h: 0.095, d: 0.035, bg: ['#ffffff', '#ffffff'], fg: '#2a7a2a', brand: '전주비빔', name: '삼각김밥', icon: '🍙', price: 1500, tri: '#3aa04a' },
  kimbap3: { shape: 'tri', w: 0.105, h: 0.095, d: 0.035, bg: ['#ffffff', '#ffffff'], fg: '#a06010', brand: '불고기', name: '삼각김밥', icon: '🍙', price: 1500, tri: '#e0902a' },
  roll: { shape: 'box', w: 0.2, h: 0.05, d: 0.07, body: 0x1d2a1a, bg: ['#1d2a1a', '#2a3a24'], fg: '#ffffff', brand: '김밥 한 줄', name: '참치 · 야채', icon: '🍣', price: 3200, art: 'roll' },
  sand: { shape: 'wedge', w: 0.13, h: 0.11, d: 0.065, bg: ['#ffffff', '#ffffff'], fg: '#333', brand: '햄치즈', name: '샌드위치', icon: '🥪', price: 3800, art: 'sand' },
  dosirak: { shape: 'tray', w: 0.22, h: 0.05, d: 0.17, body: 0x1a1a1c, bg: ['#222', '#222'], fg: '#fff', brand: '제육 도시락', name: '', icon: '🍱', price: 5500, art: 'dosirak' },
  dosirak2: { shape: 'tray', w: 0.24, h: 0.055, d: 0.18, body: 0x1a1a1c, bg: ['#222', '#222'], fg: '#fff', brand: '혜자 정식', name: '', icon: '🍱', price: 6900, art: 'dosirak2' },
  eggs: { shape: 'box', w: 0.2, h: 0.07, d: 0.11, body: 0xf2e8d8, bg: ['#fff7ea', '#f2dfc0'], fg: '#8a5a1a', brand: '신선란', name: '6구 · 대란', icon: '🥚', price: 3900, art: 'eggs', top: true },
  rice: { shape: 'box', w: 0.13, h: 0.055, d: 0.13, body: 0xffffff, bg: ['#ffffff', '#eef4ff'], fg: '#c8102e', brand: '즉석밥', name: '210g 갓 지은 밥', icon: '🍚', price: 1500 },
  kimchi: { shape: 'tub', r: 0.06, h: 0.075, lid: 0xd8231e, bg: ['#ffffff', '#ffe8e0'], fg: '#c8102e', brand: '포기김치', name: '국산 배추 400g', icon: '🥬', price: 4200 },
  sausage: { shape: 'box', w: 0.16, h: 0.035, d: 0.1, body: 0xffd0c0, bg: ['#ff7a3a', '#e83a1a'], fg: '#ffffff', brand: '비엔나', name: '소시지 300g', icon: '🌭', price: 3300, top: true },
  tuna: { shape: 'can', r: 0.042, h: 0.042, body: 0xc0c4ca, bg: ['#1a4ab0', '#0a2a80'], fg: '#ffffff', brand: '바다참치', name: '살코기 150g', icon: '🐟', price: 2600 },
  mandu: { shape: 'bag', w: 0.22, h: 0.28, d: 0.07, bg: ['#ffffff', '#ffe0c0'], fg: '#c8401e', brand: '왕교자', name: '군만두 1kg', icon: '🥟', price: 5200 },
  chips: { shape: 'bag', w: 0.16, h: 0.23, d: 0.08, bg: ['#ffd21a', '#ffa800'], fg: '#c8102e', brand: '감자칩', name: '오리지널', icon: '🥔', price: 1800 },
  chips2: { shape: 'bag', w: 0.16, h: 0.23, d: 0.08, bg: ['#2a7ae8', '#1a4ab0'], fg: '#ffffff', brand: '새우칩', name: '고소한 맛', icon: '🦐', price: 1700 },
  chips3: { shape: 'bag', w: 0.15, h: 0.21, d: 0.075, bg: ['#7a2ad8', '#4a0ab0'], fg: '#ffe680', brand: '콘칩', name: '버터 갈릭', icon: '🌽', price: 1700 },
  choco: { shape: 'box', w: 0.14, h: 0.09, d: 0.035, body: 0x5a2a10, bg: ['#5a2a10', '#2a1005'], fg: '#ffd27a', brand: '초코파이', name: '정 담은 12개입', icon: '🍫', price: 4800 },
  choco2: { shape: 'box', w: 0.04, h: 0.13, d: 0.02, body: 0xc8102e, bg: ['#c8102e', '#800010'], fg: '#ffffff', brand: '초코바', name: '땅콩 듬뿍', icon: '🍫', price: 1300 },
  cookie: { shape: 'box', w: 0.17, h: 0.12, d: 0.05, body: 0x2a5ad8, bg: ['#2a5ad8', '#1a2a80'], fg: '#ffe680', brand: '버터쿠키', name: '바삭 고소', icon: '🍪', price: 2400 },
  jelly: { shape: 'bag', w: 0.12, h: 0.16, d: 0.05, bg: ['#ff6ac8', '#ff2a8a'], fg: '#ffffff', brand: '곰젤리', name: '새콤달콤', icon: '🐻', price: 1500 },
  bread: { shape: 'bag', w: 0.15, h: 0.15, d: 0.07, bg: ['#fff4dc', '#ffe0a0'], fg: '#b0601a', brand: '소보로빵', name: '갓 구운 빵', icon: '🍞', price: 2000 },
  bread2: { shape: 'bag', w: 0.15, h: 0.15, d: 0.07, bg: ['#ffffff', '#e0f0ff'], fg: '#2a5ab0', brand: '크림빵', name: '생크림 가득', icon: '🥐', price: 2200 },
  gum: { shape: 'box', w: 0.07, h: 0.1, d: 0.02, body: 0x2ac8a0, bg: ['#2ac8a0', '#0a8a6a'], fg: '#ffffff', brand: '민트껌', name: '쿨', icon: '🌿', price: 1000 },
  battery: { shape: 'box', w: 0.08, h: 0.12, d: 0.02, body: 0x1a1a1a, bg: ['#1a1a1a', '#e8a800'], fg: '#ffd21a', brand: '파워셀', name: 'AA 4입', icon: '🔋', price: 4500 },
  mask: { shape: 'box', w: 0.12, h: 0.16, d: 0.04, body: 0xffffff, bg: ['#ffffff', '#dceeff'], fg: '#1a5ab0', brand: 'KF94', name: '마스크 5매', icon: '😷', price: 4000 },
  candy: { shape: 'bag', w: 0.12, h: 0.16, d: 0.05, bg: ['#ffe680', '#ff9a1a'], fg: '#c8102e', brand: '과일사탕', name: '모둠', icon: '🍬', price: 1500 },
  icebar: { shape: 'bar', w: 0.065, h: 0.025, d: 0.19, body: 0x9adf6a, bg: ['#7ad84a', '#2a9a2a'], fg: '#ffffff', brand: '멜론바', name: '', icon: '🍈', price: 1200 },
  icebar2: { shape: 'bar', w: 0.065, h: 0.025, d: 0.19, body: 0xff4a4a, bg: ['#ff5a5a', '#c81a1a'], fg: '#ffffff', brand: '수박바', name: '', icon: '🍉', price: 1200 },
  icecone: { shape: 'bar', w: 0.075, h: 0.075, d: 0.2, body: 0xe8b060, bg: ['#3a1a8a', '#1a0a4a'], fg: '#ffd27a', brand: '초코콘', name: '', icon: '🍦', price: 1800 },
  icecup: { shape: 'tub', r: 0.05, h: 0.05, lid: 0xffffff, bg: ['#ffffff', '#ffe0ea'], fg: '#d81a5a', brand: '딸기컵', name: '', icon: '🍨', price: 1500 },
  // ───── 문구점 ─────
  note1: { shape: 'box', w: 0.19, h: 0.26, d: 0.008, body: 0xffffff, bg: ['#7ec8ff', '#3a8ae8'], fg: '#ffffff', brand: 'NOTE', name: '스프링 공책', icon: '🐳', price: 1500, art: 'note' },
  note2: { shape: 'box', w: 0.19, h: 0.26, d: 0.008, body: 0xffffff, bg: ['#ffb0d0', '#ff6aa0'], fg: '#ffffff', brand: 'MY NOTE', name: '스프링 공책', icon: '🐰', price: 1500, art: 'note' },
  note3: { shape: 'box', w: 0.19, h: 0.26, d: 0.008, body: 0xffffff, bg: ['#c8f0a0', '#6ac04a'], fg: '#ffffff', brand: 'STUDY', name: '스프링 공책', icon: '🦖', price: 1500, art: 'note' },
  notepack: { shape: 'box', w: 0.19, h: 0.26, d: 0.035, body: 0xf4f4f0, bg: ['#ffe680', '#ffb81a'], fg: '#5a3a00', brand: '줄공책', name: '5권 묶음', icon: '📒', price: 4000, art: 'note' },
  sketch: { shape: 'box', w: 0.27, h: 0.37, d: 0.012, body: 0xf8f4ea, bg: ['#ffffff', '#f2ece0'], fg: '#2a2a2a', brand: '스케치북', name: '8절 · 20매', icon: '🎨', price: 3000, art: 'sketch' },
  postit: { shape: 'box', w: 0.08, h: 0.08, d: 0.03, body: 0xfff06a, bg: ['#fff06a', '#ffd21a'], fg: '#7a5a00', brand: '붙임쪽지', name: '76×76', icon: '📝', price: 2000 },
  pencils: { shape: 'box', w: 0.075, h: 0.2, d: 0.016, body: 0x2a6a3a, bg: ['#2a7a3a', '#1a4a24'], fg: '#ffe680', brand: '연필 12자루', name: 'HB', icon: '✏️', price: 3000, art: 'pencils' },
  colorp: { shape: 'box', w: 0.21, h: 0.14, d: 0.018, body: 0xffffff, bg: ['#ffffff', '#e8f0ff'], fg: '#1a3a8a', brand: '색연필 24색', name: '부드럽게 칠해져요', icon: '🖍️', price: 6000, art: 'pencils' },
  crayon: { shape: 'box', w: 0.2, h: 0.12, d: 0.025, body: 0xffd21a, bg: ['#ffd21a', '#ff9a1a'], fg: '#c8102e', brand: '크레파스', name: '24색', icon: '🖍️', price: 5000 },
  paint: { shape: 'box', w: 0.22, h: 0.15, d: 0.03, body: 0x1a6ad8, bg: ['#ffffff', '#d8ecff'], fg: '#1a5ab0', brand: '수채물감', name: '18색 세트', icon: '🎨', price: 8000 },
  calc: { shape: 'box', w: 0.09, h: 0.15, d: 0.016, body: 0x3a3e44, bg: ['#4a4e56', '#2a2e34'], fg: '#ffffff', brand: '계산기', name: '12자리', icon: '🧮', price: 9000, art: 'calc' },
  folder: { shape: 'box', w: 0.23, h: 0.31, d: 0.006, body: 0x3ab0ff, bg: ['#7ad0ff', '#2a90e8'], fg: '#ffffff', brand: 'FILE', name: 'A4 클리어 파일', icon: '📂', price: 1500 },
  stapler: { shape: 'box', w: 0.14, h: 0.07, d: 0.04, body: 0xd8231e, bg: ['#ff4a3a', '#c8101e'], fg: '#ffffff', brand: '스테이플러', name: '10호 심 포함', icon: '📎', price: 4000 },
  glue: { shape: 'can', r: 0.014, h: 0.095, body: 0xffffff, bg: ['#ffe23a', '#ffb81a'], fg: '#1a4ab0', brand: '딱풀', name: '', icon: '🧴', price: 1000 },
  // 걸이 진열 (블리스터 카드)
  pen3: { shape: 'box', w: 0.075, h: 0.2, d: 0.018, body: 0xffffff, bg: ['#ffffff', '#e0ecff'], fg: '#1a3a8a', brand: '3색 볼펜', name: '0.7mm', icon: '🖊️', price: 2000, art: 'card' },
  mech: { shape: 'box', w: 0.075, h: 0.2, d: 0.018, body: 0xffffff, bg: ['#ffffff', '#eaeaea'], fg: '#2a2a2a', brand: '샤프', name: '0.5mm', icon: '✒️', price: 3000, art: 'card' },
  hili: { shape: 'box', w: 0.1, h: 0.18, d: 0.022, body: 0xffffff, bg: ['#ffffff', '#fff6b0'], fg: '#c87a00', brand: '형광펜', name: '5색 세트', icon: '🖍️', price: 3500, art: 'card' },
  eraser: { shape: 'box', w: 0.07, h: 0.12, d: 0.018, body: 0xffffff, bg: ['#ffffff', '#e8f4ff'], fg: '#1a5ab0', brand: '지우개', name: '잘 지워져요', icon: '⬜', price: 500, art: 'card' },
  scissors: { shape: 'box', w: 0.09, h: 0.2, d: 0.016, body: 0xffffff, bg: ['#ffffff', '#ffe0e0'], fg: '#c8101e', brand: '안전가위', name: '', icon: '✂️', price: 2500, art: 'card' },
  tape: { shape: 'box', w: 0.09, h: 0.14, d: 0.022, body: 0xffffff, bg: ['#ffffff', '#e8ffe8'], fg: '#2a7a2a', brand: '투명테이프', name: '', icon: '🎞️', price: 1500, art: 'card' },
  keyring: { shape: 'box', w: 0.08, h: 0.14, d: 0.02, body: 0xffffff, bg: ['#ffe0f0', '#ffb0d8'], fg: '#c81a6a', brand: '인형 키링', name: '랜덤', icon: '🧸', price: 5000, art: 'card' },
  // 장난감
  blocks: { shape: 'box', w: 0.3, h: 0.22, d: 0.08, body: 0xffd21a, bg: ['#ffd21a', '#ff8a00'], fg: '#c8101e', brand: '블록 놀이', name: '300피스', icon: '🧱', price: 15000 },
  slime: { shape: 'tub', r: 0.035, h: 0.05, lid: 0x7ad84a, bg: ['#c0ff8a', '#7ad84a'], fg: '#1a6a1a', brand: '슬라임', name: '', icon: '🫧', price: 3000 },
  spinner: { shape: 'box', w: 0.13, h: 0.17, d: 0.05, body: 0x2a6ad8, bg: ['#2a2a6a', '#0a0a3a'], fg: '#4dd8ff', brand: '배틀 팽이', name: '런처 포함', icon: '🌀', price: 8000 },
  car: { shape: 'box', w: 0.16, h: 0.1, d: 0.06, body: 0xd8231e, bg: ['#ffffff', '#ffe0e0'], fg: '#c8101e', brand: '미니카', name: '레이싱', icon: '🏎️', price: 4500 },
  // 추억의 간식
  jjon: { shape: 'bag', w: 0.1, h: 0.17, d: 0.025, bg: ['#ffcc5a', '#ff8a1a'], fg: '#7a2a00', brand: '쫀득이', name: '구워 먹는', icon: '🍬', price: 500 },
  starcandy: { shape: 'bag', w: 0.08, h: 0.12, d: 0.03, bg: ['#a0d8ff', '#6aa8ff'], fg: '#ffffff', brand: '별사탕', name: '', icon: '⭐', price: 500 },
  strawjelly: { shape: 'box', w: 0.09, h: 0.14, d: 0.02, body: 0xffffff, bg: ['#ff8ad8', '#b04aff'], fg: '#ffffff', brand: '빨대젤리', name: '10개입', icon: '🍭', price: 1000 },
  cornsnack: { shape: 'bag', w: 0.12, h: 0.17, d: 0.05, bg: ['#ffe23a', '#ffb81a'], fg: '#2a6a1a', brand: '콘과자', name: '추억의 맛', icon: '🌽', price: 1000 },
};
// 진열 코너별 상품 (가중치)
export const SECTION_SKUS = {
  drink: ['water', 'water', 'water2', 'cola', 'cola', 'cider', 'ion', 'tea', 'juice', 'coffee', 'coffee2', 'energy', 'soda', 'milk', 'milk', 'milk2'],
  ramen: ['cupramen', 'cupramen', 'cupramen2', 'cupramen3', 'ramenpack'],
  chill: ['kimbap', 'kimbap2', 'kimbap3', 'roll', 'sand', 'dosirak', 'dosirak2'],
  grocery: ['eggs', 'rice', 'rice', 'kimchi', 'sausage', 'tuna', 'mandu'],
  snack: ['chips', 'chips2', 'chips3', 'choco', 'choco2', 'cookie', 'jelly', 'candy'],
  bread: ['bread', 'bread', 'bread2', 'choco', 'cookie'],
  misc: ['gum', 'battery', 'mask', 'candy', 'choco2'],
  ice: ['icebar', 'icebar2', 'icecone', 'icecup'],
  st_note: ['note1', 'note2', 'note3', 'notepack', 'postit', 'folder'],
  st_art: ['sketch', 'colorp', 'crayon', 'paint', 'glue', 'pencils'],
  st_office: ['calc', 'stapler', 'postit', 'folder', 'pencils', 'glue'],
  st_peg: ['pen3', 'mech', 'hili', 'eraser', 'scissors', 'tape', 'keyring'],
  st_toy: ['blocks', 'slime', 'spinner', 'car', 'blocks', 'car'],
  st_snack: ['jjon', 'starcandy', 'strawjelly', 'cornsnack'],
};

// ───────── 아틀라스 ─────────
let atlas = null;
const cellOf = {};
const tagCell = {};
function makeAtlas() {
  const ids0 = Object.keys(SKUS);
  N = Math.ceil(Math.sqrt(1 + ids0.length + Math.ceil(ids0.length / 8)));
  SOLID_UV = [0.5 / N, 1 - 0.5 / N];
  const c = document.createElement('canvas'); c.width = c.height = N * CELL;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  let k = 1;   // 0번 칸은 흰색 (단색 부분용)
  const ids = Object.keys(SKUS);
  for (const id of ids) {
    const col = k % N, row = Math.floor(k / N);
    cellOf[id] = [col, row];
    x.save(); x.translate(col * CELL, row * CELL); x.beginPath(); x.rect(0, 0, CELL, CELL); x.clip();
    drawLabel(x, SKUS[id]);
    x.restore();
    k++;
  }
  // 가격표: 한 칸에 2×4개
  let t = 0;
  for (const id of ids) {
    const cell = k + Math.floor(t / 8), sub = t % 8;
    const col = cell % N, row = Math.floor(cell / N);
    const sx = (sub % 2) * 128, sy = Math.floor(sub / 2) * 64;
    tagCell[id] = [col, row, sx, sy];
    x.save(); x.translate(col * CELL + sx, row * CELL + sy);
    drawTag(x, SKUS[id]);
    x.restore();
    t++;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  atlas = tex;
}
function fitText(x, txt, maxW, size, weight = 900) {
  let s = size;
  do { x.font = `${weight} ${s}px "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`; s -= 2; } while (x.measureText(txt).width > maxW && s > 10);
}
function drawLabel(x, s) {
  const W = CELL, H = CELL;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, s.bg[0]); g.addColorStop(1, s.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const wrap = s.shape === 'pet' || s.shape === 'can' || s.shape === 'jar' || s.shape === 'cup' || s.shape === 'tub';
  const cw = wrap ? W * 0.5 : W;    // 둘러싸는 라벨은 앞쪽 절반에 그림
  const cx = W / 2;
  if (s.art === 'dosirak' || s.art === 'dosirak2') return drawDosirak(x, s);
  if (s.art === 'eggs') return drawEggs(x, s);
  if (s.art === 'roll') return drawRoll(x, s);
  if (s.art === 'sand') return drawSand(x, s);
  if (s.art === 'note') return drawNote(x, s);
  if (s.art === 'sketch') return drawSketch(x, s);
  if (s.art === 'pencils') return drawPencils(x, s);
  if (s.art === 'calc') return drawCalc(x, s);
  if (s.art === 'card') return drawCard(x, s);
  if (s.shape === 'tri') return drawTri(x, s);
  if (s.shape === 'bar') return drawBar(x, s);
  // 장식 띠
  x.fillStyle = 'rgba(255,255,255,0.18)';
  x.beginPath(); x.ellipse(cx, H * 0.95, cw * 0.9, H * 0.28, 0, 0, 7); x.fill();
  x.fillStyle = s.fg; x.globalAlpha = 0.9; x.fillRect(0, H * 0.06, W, 6); x.fillRect(0, H * 0.92, W, 6); x.globalAlpha = 1;
  // 그림
  x.font = `${Math.round(H * (wrap ? 0.3 : 0.34))}px sans-serif`;
  x.fillText(s.icon, cx, H * (s.shape === 'bag' ? 0.62 : 0.66));
  // 상표
  fitText(x, s.brand, cw * 0.92, Math.round(H * 0.17));
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.28)'; x.strokeText(s.brand, cx, H * 0.28);
  x.fillStyle = s.fg; x.fillText(s.brand, cx, H * 0.28);
  if (s.name) { fitText(x, s.name, cw * 0.92, Math.round(H * 0.075), 700); x.fillStyle = s.fg; x.globalAlpha = 0.92; x.fillText(s.name, cx, H * 0.43); x.globalAlpha = 1; }
  // 영양 표시 (뒷면처럼 보이는 작은 글씨)
  if (wrap) { x.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 6; i++) { x.fillRect(W * 0.78, H * 0.3 + i * 12, W * 0.18, 4); x.fillRect(W * 0.04, H * 0.3 + i * 12, W * 0.18, 4); } }
}
function drawTri(x, s) {
  const W = CELL, H = CELL;
  x.fillStyle = '#e9eef0'; x.fillRect(0, 0, W, H);
  // 김 + 밥 (삼각형)
  x.fillStyle = '#18241a'; x.beginPath(); x.moveTo(W * 0.04, H * 0.98); x.lineTo(W * 0.96, H * 0.98); x.lineTo(W * 0.5, H * 0.04); x.closePath(); x.fill();
  x.fillStyle = '#fbfaf4'; x.beginPath(); x.moveTo(W * 0.24, H * 0.56); x.lineTo(W * 0.76, H * 0.56); x.lineTo(W * 0.5, H * 0.08); x.closePath(); x.fill();
  for (let i = 0; i < 90; i++) { x.fillStyle = 'rgba(200,200,190,0.6)'; const px = W * (0.32 + Math.random() * 0.36), py = H * (0.2 + Math.random() * 0.34); x.fillRect(px, py, 3, 2); }
  // 포장 띠 + 스티커
  x.fillStyle = s.tri; x.fillRect(W * 0.47, 0, W * 0.06, H);
  x.fillStyle = '#ffffff'; x.fillRect(W * 0.18, H * 0.62, W * 0.64, H * 0.26);
  x.strokeStyle = s.tri; x.lineWidth = 6; x.strokeRect(W * 0.18, H * 0.62, W * 0.64, H * 0.26);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  fitText(x, s.brand, W * 0.58, 40); x.fillStyle = s.fg; x.fillText(s.brand, W * 0.5, H * 0.71);
  fitText(x, s.name, W * 0.5, 20, 700); x.fillStyle = '#444'; x.fillText(s.name, W * 0.5, H * 0.82);
}
function drawBar(x, s) {
  const W = CELL, H = CELL;
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, s.bg[1]); g.addColorStop(0.5, s.bg[0]); g.addColorStop(1, s.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(W * 0.1, 0, W * 0.08, H);
  x.save(); x.translate(W / 2, H / 2); x.rotate(-Math.PI / 2);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  fitText(x, s.brand, H * 0.7, 70); x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,0.3)'; x.strokeText(s.brand, 0, 0); x.fillStyle = s.fg; x.fillText(s.brand, 0, 0);
  x.font = '60px sans-serif'; x.fillText(s.icon, H * 0.38, 0);
  x.restore();
}
function drawDosirak(x, s) {
  const W = CELL, H = CELL;
  x.fillStyle = '#1a1a1c'; x.fillRect(0, 0, W, H);
  const comp = (x0, y0, w, h, col, dots, dcol) => {
    x.fillStyle = col; x.beginPath(); x.roundRect(x0, y0, w, h, 10); x.fill();
    for (let i = 0; i < dots; i++) { x.fillStyle = dcol[i % dcol.length]; const r = 4 + Math.random() * 7; x.beginPath(); x.arc(x0 + 8 + Math.random() * (w - 16), y0 + 8 + Math.random() * (h - 16), r, 0, 7); x.fill(); }
  };
  comp(10, 10, 130, 140, '#fbfaf2', 60, ['#efece0', '#ffffff']);                                  // 밥
  comp(148, 10, 98, 140, s.art === 'dosirak' ? '#b8401e' : '#8a4a20', 26, ['#d8602a', '#7a2a10', '#e8a040']); // 제육 / 불고기
  comp(10, 158, 76, 88, '#3a8a2a', 30, ['#5ab03a', '#2a6a1a']);                                   // 나물
  comp(92, 158, 74, 88, '#f6d23a', 14, ['#ffe680', '#e8b81a']);                                   // 계란말이
  comp(172, 158, 74, 88, '#d8301e', 30, ['#ff5a3a', '#a0180a']);                                  // 김치
  if (s.art === 'dosirak2') { x.fillStyle = '#c87a3a'; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(60 + i * 26, 110, 16, 10, 0.3, 0, 7); x.fill(); } }
  // 뚜껑 반사 + 스티커
  x.fillStyle = 'rgba(255,255,255,0.16)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(W * 0.5, 0); x.lineTo(0, H * 0.5); x.fill();
  x.fillStyle = '#ffffff'; x.fillRect(W * 0.08, H * 0.4, W * 0.5, H * 0.2);
  x.strokeStyle = '#d8231e'; x.lineWidth = 5; x.strokeRect(W * 0.08, H * 0.4, W * 0.5, H * 0.2);
  x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, s.brand, W * 0.46, 34); x.fillStyle = '#d8231e'; x.fillText(s.brand, W * 0.33, H * 0.5);
}
function drawEggs(x, s) {
  const W = CELL, H = CELL;
  x.fillStyle = '#e8dcc6'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const g = x.createRadialGradient(50 + i * 78, 70 + j * 92, 6, 56 + i * 78, 78 + j * 92, 40);
    g.addColorStop(0, '#fff3e0'); g.addColorStop(1, '#d8a878');
    x.fillStyle = g; x.beginPath(); x.ellipse(56 + i * 72, 76 + j * 88, 30, 36, 0, 0, 7); x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,0.92)'; x.fillRect(0, H * 0.78, W, H * 0.22);
  x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, s.brand + ' ' + s.name, W * 0.92, 34); x.fillStyle = s.fg; x.fillText(s.brand + ' ' + s.name, W / 2, H * 0.89);
}
function drawRoll(x, s) {
  const W = CELL, H = CELL;
  x.fillStyle = '#16221a'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const cx = 36 + i * 62, cy = H * 0.42;
    x.fillStyle = '#18241a'; x.beginPath(); x.arc(cx, cy, 30, 0, 7); x.fill();
    x.fillStyle = '#fbfaf2'; x.beginPath(); x.arc(cx, cy, 25, 0, 7); x.fill();
    for (const [c, dx, dy] of [['#f6c21a', -8, -6], ['#e8501e', 8, -4], ['#3a9a2a', 0, 8], ['#c86a3a', -6, 6], ['#ffffff', 6, 6]]) { x.fillStyle = c; x.fillRect(cx + dx - 4, cy + dy - 4, 8, 8); }
  }
  x.fillStyle = '#ffffff'; x.fillRect(W * 0.1, H * 0.7, W * 0.8, H * 0.22);
  x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, s.brand, W * 0.74, 38); x.fillStyle = '#1a6a2a'; x.fillText(s.brand, W / 2, H * 0.81);
}
function drawSand(x, s) {
  const W = CELL, H = CELL;
  x.fillStyle = '#eef3f6'; x.fillRect(0, 0, W, H);
  // 단면: 빵-양상추-햄-치즈-계란-빵
  const lay = [['#f2d9a6', 0.16], ['#5ab03a', 0.12], ['#f2a0a0', 0.16], ['#ffd21a', 0.1], ['#fff4c0', 0.14], ['#f2d9a6', 0.16]];
  let y = H * 0.08;
  for (const [c, h] of lay) { x.fillStyle = c; x.beginPath(); x.moveTo(W * 0.06, y); x.lineTo(W * 0.94, y); x.lineTo(W * 0.94, y + h * H * 0.82); x.lineTo(W * 0.06, y + h * H * 0.82); x.fill(); y += h * H * 0.82; }
  x.fillStyle = '#c89a5a'; x.fillRect(W * 0.06, H * 0.08, W * 0.88, 5);
  x.fillStyle = '#ffffff'; x.fillRect(W * 0.2, H * 0.78, W * 0.6, H * 0.17);
  x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, s.brand + ' ' + s.name, W * 0.56, 28); x.fillStyle = '#c8401e'; x.fillText(s.brand + ' ' + s.name, W / 2, H * 0.865);
}
function drawNote(x, s) {
  const W = CELL, H = CELL;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, s.bg[0]); g.addColorStop(1, s.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 물방울 무늬
  x.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.arc((i * 53) % W, (i * 97) % H, 10 + (i % 3) * 6, 0, 7); x.fill(); }
  // 스프링
  if (s.d < 0.02) { x.fillStyle = '#c8ccd2'; for (let y = 10; y < H - 6; y += 16) { x.beginPath(); x.ellipse(10, y, 7, 4, 0, 0, 7); x.fill(); } }
  x.fillStyle = 'rgba(255,255,255,0.92)'; x.beginPath(); x.roundRect(W * 0.2, H * 0.12, W * 0.66, H * 0.22, 12); x.fill();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  fitText(x, s.brand, W * 0.6, 44); x.fillStyle = s.bg[1]; x.fillText(s.brand, W * 0.53, H * 0.23);
  x.font = '96px sans-serif'; x.fillText(s.icon, W * 0.53, H * 0.6);
  fitText(x, s.name, W * 0.7, 22, 700); x.fillStyle = s.fg; x.fillText(s.name, W * 0.53, H * 0.88);
}
function drawSketch(x, s) {
  const W = CELL, H = CELL;
  x.fillStyle = '#f6f2e8'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#2a2a2a'; x.fillRect(0, 0, W, 14);
  x.fillStyle = '#c8ccd2'; for (let i = 8; i < W; i += 14) { x.beginPath(); x.arc(i, 14, 5, 0, 7); x.fill(); }
  // 수채화 얼룩
  for (const [c, cx, cy, r] of [['rgba(255,90,90,0.5)', 70, 120, 40], ['rgba(60,140,255,0.5)', 130, 140, 46], ['rgba(255,200,40,0.55)', 180, 110, 36], ['rgba(80,200,90,0.45)', 110, 180, 34]]) { x.fillStyle = c; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  fitText(x, s.brand, W * 0.8, 40); x.fillStyle = '#2a2a2a'; x.fillText(s.brand, W / 2, H * 0.3 - 10);
  fitText(x, s.name, W * 0.6, 20, 700); x.fillText(s.name, W / 2, H * 0.9);
}
function drawPencils(x, s) {
  const W = CELL, H = CELL;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, s.bg[0]); g.addColorStop(1, s.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const cols = s.brand.includes('색') ? ['#e8231e', '#ff8a00', '#ffd21a', '#3ac04a', '#1a8ae8', '#2a3ab0', '#8a2ad8', '#ff6ac8', '#7a4a1a', '#1a1a1a', '#9a9a9a', '#ffffff'] : ['#2a7a3a', '#2a7a3a', '#2a7a3a', '#2a7a3a', '#2a7a3a', '#2a7a3a'];
  const n = cols.length, pw = (W - 30) / n;
  for (let i = 0; i < n; i++) {
    const px = 15 + i * pw;
    x.fillStyle = cols[i]; x.fillRect(px + 2, H * 0.42, pw - 4, H * 0.5);
    x.fillStyle = '#f2d9a6'; x.beginPath(); x.moveTo(px + 2, H * 0.42); x.lineTo(px + pw - 2, H * 0.42); x.lineTo(px + pw / 2, H * 0.32); x.fill();
    x.fillStyle = cols[i] === '#2a7a3a' ? '#333' : cols[i]; x.beginPath(); x.moveTo(px + pw * 0.38, H * 0.355); x.lineTo(px + pw * 0.62, H * 0.355); x.lineTo(px + pw / 2, H * 0.32); x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(0, 0, W, H * 0.28);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  fitText(x, s.brand, W * 0.9, 40); x.fillStyle = s.fg === '#ffe680' ? '#1a4a24' : s.fg; x.fillText(s.brand, W / 2, H * 0.14);
}
function drawCalc(x, s) {
  const W = CELL, H = CELL;
  x.fillStyle = '#3a3e44'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#b8c8a0'; x.fillRect(W * 0.12, H * 0.08, W * 0.76, H * 0.2);
  x.fillStyle = '#2a3a1a'; x.font = '700 40px monospace'; x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillText('1234567.', W * 0.84, H * 0.18);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
    x.fillStyle = c === 3 ? '#ff8a1a' : r === 0 ? '#9aa0a8' : '#eef0f2';
    x.beginPath(); x.roundRect(W * 0.12 + c * W * 0.195, H * 0.34 + r * H * 0.125, W * 0.16, H * 0.1, 8); x.fill();
  }
}
function drawCard(x, s) {
  const W = CELL, H = CELL;
  // 걸이용 종이 + 투명 플라스틱 안에 물건
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, s.bg[1]); g.addColorStop(1, s.bg[0]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(W / 2, H * 0.07, 22, 9, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(40,40,40,0.55)'; x.beginPath(); x.ellipse(W / 2, H * 0.07, 16, 5, 0, 0, 7); x.fill();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  fitText(x, s.brand, W * 0.86, 40); x.fillStyle = s.fg; x.fillText(s.brand, W / 2, H * 0.22);
  x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.roundRect(W * 0.14, H * 0.32, W * 0.72, H * 0.56, 22); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 4; x.stroke();
  x.font = '110px sans-serif'; x.fillText(s.icon, W / 2, H * 0.62);
  if (s.name) { fitText(x, s.name, W * 0.8, 22, 700); x.fillStyle = s.fg; x.fillText(s.name, W / 2, H * 0.94); }
}
function drawTag(x, s) {
  x.fillStyle = '#ffe23a'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#d8231e'; x.fillRect(0, 0, 128, 16);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  fitText(x, s.brand, 120, 13, 700); x.fillStyle = '#ffffff'; x.fillText(s.brand, 64, 8);
  x.font = '900 30px sans-serif'; x.fillStyle = '#111'; x.fillText(s.price.toLocaleString(), 64, 42);
}

export function goodsMaterial() {
  if (!atlas) makeAtlas();
  return new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.38, metalness: 0.0 });
}

// ───────── 지오메트리 템플릿 ─────────
// 템플릿 = { p, n, uv, c, i } (원점 바닥 가운데, 앞면 +z)
class TB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, w, col) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.c.push(col[0], col[1], col[2]); return this.p.length / 3 - 1; }
}
const WHITE = [1, 1, 1];
function cellUV(id, u, v) {   // 칸 안의 0..1 좌표 → 아틀라스 UV
  const [col, row] = cellOf[id];
  u = 0.004 + u * 0.992; v = 0.004 + v * 0.992;
  return [(col + u) / N, 1 - (row + 1 - v) / N];
}
function colorBox(t, cx, cy, cz, w, h, d, col) {
  const tmp = new TB();
  boxT(tmp, null, w, h, d, col, { plain: true });
  const base = t.p.length / 3;
  for (let k = 0; k < tmp.p.length; k += 3) t.v(tmp.p[k] + cx, tmp.p[k + 1] + cy - h / 2, tmp.p[k + 2] + cz, tmp.n[k], tmp.n[k + 1], tmp.n[k + 2], tmp.uv[k / 3 * 2], tmp.uv[k / 3 * 2 + 1], [tmp.c[k], tmp.c[k + 1], tmp.c[k + 2]]);
  for (const i of tmp.i) t.i.push(base + i);
}
let SOLID_UV = [0.5 / N, 1 - 0.5 / N];   // 0번 칸 (흰색)

// 회전체: prof = [[r, y, 'L'|color], ...] 아래→위
function lathe(t, id, prof, seg, y0, y1) {
  for (let k = 0; k < prof.length - 1; k++) {
    const [r0, a0, m0] = prof[k], [r1, a1, m1] = prof[k + 1];
    const lab = m0 === 'L' && m1 === 'L';
    const col = lab ? WHITE : hex(typeof m1 === 'number' ? m1 : m0 === 'L' ? m1 : m0);
    const dr = r1 - r0, dy = a1 - a0, L = Math.hypot(dr, dy) || 1;
    const nr = dy / L, ny = -dr / L;
    const base = t.p.length / 3;
    for (let j = 0; j <= seg; j++) {
      const u = j / seg, ph = (u - 0.5) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
      for (const [r, y] of [[r0, a0], [r1, a1]]) {
        const uv = lab ? cellUV(id, u, (y - y0) / (y1 - y0)) : SOLID_UV;
        t.v(r * s, y, r * c, nr * s, ny, nr * c, uv[0], uv[1], col);
      }
    }
    for (let j = 0; j < seg; j++) { const a = base + j * 2, b = a + 2; t.i.push(a, b, b + 1, a, b + 1, a + 1); }
  }
}
// 상자 (앞면 라벨, top이면 윗면도 라벨)
function boxT(t, id, w, h, d, body, o = {}) {
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const face = (pts, n, lab, flip) => {
    if (o.plain) lab = false;
    const col = lab ? WHITE : hex(body);
    const uvs = lab ? [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => cellUV(id, flip ? 1 - u : u, v)) : [SOLID_UV, SOLID_UV, SOLID_UV, SOLID_UV];
    const b = t.p.length / 3;
    pts.forEach((p, k) => t.v(p[0], p[1], p[2], n[0], n[1], n[2], uvs[k][0], uvs[k][1], col));
    t.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  face([[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]], [0, 0, 1], true);
  face([[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]], [0, 0, -1], !!o.back);
  face([[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]], [-1, 0, 0], false);
  face([[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]], [1, 0, 0], false);
  face([[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0]], [0, 1, 0], !!o.top);
}
// 봉지 (빵빵한 베개 모양)
function bagT(t, id, w, h, d) {
  const nx = 6, ny = 7;
  const g = new THREE.BufferGeometry();
  const P = [], U = [], I = [];
  for (const side of [1, -1]) {
    const base = P.length / 3;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / ny;
      const bx = Math.pow(Math.sin(Math.PI * u), 0.5), by = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (v - 0.06) / 0.88))), 0.6);
      const z = side * d / 2 * bx * by;
      const x = (u - 0.5) * w * (1 - 0.06 * by), y = 0.004 + v * h;
      P.push(x * side, y, z); const uv = cellUV(id, u, v); U.push(uv[0], uv[1]);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = base + j * (nx + 1) + i, b = a + 1, c = a + nx + 2, e = a + nx + 1; I.push(a, b, c, a, c, e); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  g.computeVertexNormals();
  const base = t.p.length / 3;
  const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
  for (let k = 0; k < pa.count; k++) t.v(pa.getX(k), pa.getY(k), pa.getZ(k), na.getX(k), na.getY(k), na.getZ(k), ua.getX(k), ua.getY(k), WHITE);
  for (const k of I) t.i.push(base + k);
  // 위·아래 이음매
  const sc = SKUS[id].bg[1];
  colorBox(t, 0, 0.008, 0, w, 0.016, 0.01, sc);
  colorBox(t, 0, h - 0.004, 0, w, 0.016, 0.01, sc);
}
// 삼각 기둥 (삼각김밥 · 샌드위치)
function triT(t, id, w, h, d, sideCol) {
  const A = [-w / 2, 0], B = [w / 2, 0], C = [0, h];
  for (const side of [1, -1]) {
    const z = side * d / 2, b = t.p.length / 3;
    for (const [x, y] of side > 0 ? [A, B, C] : [B, A, C]) { const uv = cellUV(id, x / w + 0.5, y / h); t.v(x, y, z, 0, 0, side, uv[0], uv[1], WHITE); }
    t.i.push(b, b + 1, b + 2);
  }
  const col = hex(sideCol);
  for (const [p, q] of [[A, B], [B, C], [C, A]]) {
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), n = [dy / L, -dx / L];
    const b = t.p.length / 3;
    for (const [x, y, z] of [[p[0], p[1], d / 2], [q[0], q[1], d / 2], [q[0], q[1], -d / 2], [p[0], p[1], -d / 2]]) t.v(x, y, z, n[0], n[1], 0, SOLID_UV[0], SOLID_UV[1], col);
    t.i.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
}

const templates = {};
export function template(id, lo) {
  const key = id + (lo ? ':lo' : '');
  if (templates[key]) return templates[key];
  if (!atlas) makeAtlas();
  const s = SKUS[id], t = new TB();
  if (lo) {
    // 뒷줄용: 단순 상자 (앞면만 라벨)
    const w = s.r ? s.r * 2 : s.w, d = s.r ? s.r * 2 : s.d;
    boxT(t, id, w, s.h, d, s.body ?? s.lid ?? 0xdddddd);
  } else switch (s.shape) {
    case 'pet': {
      const r = s.r, h = s.h;
      lathe(t, id, [[0, 0, s.body], [r * 0.82, 0, s.body], [r, 0.014, s.body], [r, h * 0.28, 'L'], [r, h * 0.7, 'L'], [r * 0.97, h * 0.75, s.body], [r * 0.6, h * 0.86, s.body], [0.0145, h * 0.92, s.cap], [0.0145, h, s.cap], [0, h, s.cap]], 10, h * 0.28, h * 0.7);
      break;
    }
    case 'can': {
      const r = s.r, h = s.h;
      lathe(t, id, [[0, 0.004, s.body], [r * 0.82, 0, s.body], [r, 0.01, s.body], [r, 0.012, 'L'], [r, h - 0.012, 'L'], [r * 0.86, h, s.body], [r * 0.8, h + 0.002, s.body], [0, h + 0.002, s.body]], 10, 0.012, h - 0.012);
      break;
    }
    case 'jar': {
      const r = s.r, h = s.h;
      lathe(t, id, [[0, 0, s.body], [r * 0.85, 0, s.body], [r, h * 0.12, s.body], [r, h * 0.2, 'L'], [r * 1.02, h * 0.55, 'L'], [r * 0.8, h * 0.78, s.body], [r * 0.55, h * 0.88, s.body], [r * 0.58, h * 0.9, s.cap], [r * 0.58, h, s.cap], [0, h, s.cap]], 10, h * 0.2, h * 0.55);
      break;
    }
    case 'cup': {
      lathe(t, id, [[0, 0, 0xf0f0f0], [s.rb, 0, 0xf0f0f0], [s.rb, 0.001, 'L'], [s.r, s.h, 'L'], [s.r + 0.004, s.h, s.lid], [s.r + 0.004, s.h + 0.006, s.lid], [0, s.h + 0.006, s.lid]], 12, 0.001, s.h);
      break;
    }
    case 'tub': {
      lathe(t, id, [[0, 0, 0xf4f4f4], [s.r * 0.9, 0, 0xf4f4f4], [s.r * 0.92, 0.002, 'L'], [s.r, s.h * 0.85, 'L'], [s.r + 0.004, s.h * 0.85, s.lid], [s.r + 0.004, s.h, s.lid], [0, s.h, s.lid]], 12, 0.002, s.h * 0.85);
      break;
    }
    case 'bag': bagT(t, id, s.w, s.h, s.d); break;
    case 'tri': triT(t, id, s.w, s.h, s.d, 0x1a2a1a); break;
    case 'wedge': triT(t, id, s.w, s.h, s.d, 0xe8e0d0); break;
    case 'tray': boxT(t, id, s.w, s.h, s.d, s.body, { top: true }); break;
    case 'bar': boxT(t, id, s.w, s.h, s.d, s.body, { top: true }); break;
    default: boxT(t, id, s.w, s.h, s.d, s.body ?? 0xdddddd, { top: s.top, back: true });
  }
  return (templates[key] = t);
}
export function skuSize(id) {
  const s = SKUS[id];
  if (s.r) return { w: s.r * 2 + (s.shape === 'cup' || s.shape === 'tub' ? 0.008 : 0), h: s.h, d: s.r * 2 };
  return { w: s.w, h: s.h, d: s.d };
}

// 여러 개를 한 지오메트리로 모음
export class GoodsBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get count() { return this.i.length; }
  add(t, x, y, z, rotY = 0, tilt = 0) {
    const cs = Math.cos(rotY), sn = Math.sin(rotY), ct = Math.cos(tilt), st = Math.sin(tilt);
    const base = this.p.length / 3;
    for (let k = 0; k < t.p.length; k += 3) {
      // 앞뒤로 기울이기(경사 매대) → y축 회전 → 이동
      let px = t.p[k], py = t.p[k + 1], pz = t.p[k + 2];
      let qy = py * ct - pz * st, qz = py * st + pz * ct;
      this.p.push(x + px * cs + qz * sn, y + qy, z - px * sn + qz * cs);
      let nx = t.n[k], ny = t.n[k + 1], nz = t.n[k + 2];
      const my = ny * ct - nz * st, mz = ny * st + nz * ct;
      this.n.push(nx * cs + mz * sn, my, -nx * sn + mz * cs);
      this.c.push(t.c[k], t.c[k + 1], t.c[k + 2]);
    }
    for (const u of t.uv) this.uv.push(u);
    for (const i of t.i) this.i.push(base + i);
  }
  quad(x, y, z, rotY, w, h, uv4) {   // 가격표처럼 납작한 사각형
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    const base = this.p.length / 3;
    for (const [px, py] of [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]]) { this.p.push(x + px * cs, y + py, z - px * sn); this.n.push(sn, 0, cs); this.c.push(1, 1, 1); }
    for (const u of uv4) this.uv.push(u[0], u[1]);
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}
export function tagUV(id) {
  const [col, row, sx, sy] = tagCell[id];
  const u0 = (col * CELL + sx + 2) / (N * CELL), u1 = (col * CELL + sx + 126) / (N * CELL);
  const v1 = 1 - (row * CELL + sy + 2) / (N * CELL), v0 = 1 - (row * CELL + sy + 62) / (N * CELL);
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
}

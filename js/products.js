// 편의점 상품 · 요리 재료 · 레시피
// cat: 진열 위치  eat: 바로 먹을 수 있는지  ing: 요리 재료 (개수 단위)
export const PRODUCTS = [
  // 도시락·간편식 (오픈 냉장 매대)
  { id: 'kimbap', name: '삼각김밥 (참치마요)', icon: '🍙', price: 1400, cat: 'chill', hunger: 14, mood: 1 },
  { id: 'roll', name: '김밥 한 줄', icon: '🍣', price: 3200, cat: 'chill', hunger: 26, mood: 2 },
  { id: 'sand', name: '햄치즈 샌드위치', icon: '🥪', price: 3800, cat: 'chill', hunger: 24, mood: 2 },
  { id: 'dosirak', name: '제육 도시락', icon: '🍱', price: 5500, cat: 'chill', hunger: 40, mood: 3, heat: true },
  { id: 'dosirak2', name: '혜자 정식 도시락', icon: '🍱', price: 6900, cat: 'chill', hunger: 50, mood: 4, heat: true },
  // 라면
  { id: 'cupramen', name: '컵라면 (큰컵)', icon: '🍜', price: 1700, cat: 'ramen', hunger: 22, mood: 3, needWater: true },
  { id: 'cupramen2', name: '컵라면 (짜장)', icon: '🍜', price: 1900, cat: 'ramen', hunger: 22, mood: 3, needWater: true },
  { id: 'ramenpack', name: '봉지라면 (5입)', icon: '📦', price: 4500, cat: 'ramen', ing: { ramenpack: 5 } },
  // 식재료
  { id: 'eggs', name: '계란 6구', icon: '🥚', price: 3900, cat: 'grocery', ing: { egg: 6 } },
  { id: 'rice', name: '즉석밥 (210g)', icon: '🍚', price: 1500, cat: 'grocery', ing: { rice: 1 } },
  { id: 'kimchi', name: '포기김치 (400g)', icon: '🥬', price: 4200, cat: 'grocery', ing: { kimchi: 4 } },
  { id: 'sausage', name: '비엔나 소시지', icon: '🌭', price: 3300, cat: 'grocery', ing: { sausage: 3 } },
  { id: 'tuna', name: '참치캔', icon: '🥫', price: 2600, cat: 'grocery', ing: { tuna: 1 } },
  { id: 'mandu', name: '냉동 군만두', icon: '🥟', price: 5200, cat: 'grocery', ing: { mandu: 2 } },
  // 과자·빵
  { id: 'chips', name: '감자칩', icon: '🥔', price: 1800, cat: 'snack', hunger: 6, mood: 5 },
  { id: 'choco', name: '초코바', icon: '🍫', price: 1300, cat: 'snack', hunger: 5, mood: 4, energy: 3 },
  { id: 'bread', name: '소보로빵', icon: '🍞', price: 2000, cat: 'snack', hunger: 14, mood: 2 },
  { id: 'jelly', name: '젤리', icon: '🍬', price: 1500, cat: 'snack', hunger: 3, mood: 5 },
  { id: 'umbrella', name: '투명 비닐우산', icon: '☂️', price: 5000, cat: 'snack', item: true, desc: '비·눈 올 때 자동으로 써요' },
  // 음료 (뒤쪽 냉장고)
  { id: 'water', name: '생수 500ml', icon: '💧', price: 900, cat: 'drink', hunger: 1, mood: 1 },
  { id: 'cola', name: '콜라', icon: '🥤', price: 2000, cat: 'drink', hunger: 2, mood: 4, energy: 3 },
  { id: 'coffee', name: '캔커피', icon: '☕', price: 1500, cat: 'drink', hunger: 2, energy: 12 },
  { id: 'milk', name: '바나나우유', icon: '🍼', price: 1700, cat: 'drink', hunger: 6, mood: 4 },
  { id: 'energy', name: '에너지 드링크', icon: '🥫', price: 2500, cat: 'drink', hunger: 1, energy: 22, mood: -2 },
  { id: 'juice', name: '오렌지 주스', icon: '🧃', price: 2200, cat: 'drink', hunger: 4, mood: 3 },
  // 아이스크림 (냉동고)
  { id: 'icebar', name: '멜론바', icon: '🍈', price: 1200, cat: 'ice', hunger: 3, mood: 6 },
  { id: 'icecone', name: '초코콘', icon: '🍦', price: 1800, cat: 'ice', hunger: 5, mood: 7 },
  { id: 'icecup', name: '딸기컵 아이스크림', icon: '🍨', price: 1500, cat: 'ice', hunger: 4, mood: 6 },
];
// 문구랜드 상품 (cat: 진열 코너)  pages: 공책 쪽수 · pen: 필기구 · color: 채색 도구 · sketch: 스케치북 장수 · toy: 기분
export const STAT_PRODUCTS = [
  { id: 'st_note', name: '스프링 공책', icon: '📓', price: 1500, cat: 'snote', pages: 20, desc: '공책 20쪽 · 수업·공부 때 1쪽씩 써요' },
  { id: 'st_notepack', name: '줄공책 5권 묶음', icon: '📚', price: 4000, cat: 'snote', pages: 100, desc: '공책 100쪽 · 묶음이라 더 싸요' },
  { id: 'st_postit', name: '붙임쪽지', icon: '📝', price: 2000, cat: 'snote', postit: 1, desc: '중요한 것 메모 · 공부 효과 조금 더' },
  { id: 'st_folder', name: 'A4 클리어 파일', icon: '📂', price: 1500, cat: 'snote', desc: '서류 정리용' },
  { id: 'st_sketch', name: '스케치북 (20매)', icon: '🗒️', price: 3000, cat: 'sart', sketch: 20, desc: '집 책상에서 그림 그리기 20번' },
  { id: 'st_colorp', name: '색연필 24색', icon: '🖍️', price: 6000, cat: 'sart', color: true, desc: '그림 그리기에 필요해요' },
  { id: 'st_crayon', name: '크레파스 24색', icon: '🖍️', price: 5000, cat: 'sart', color: true, desc: '그림 그리기에 필요해요' },
  { id: 'st_paint', name: '수채물감 18색', icon: '🎨', price: 8000, cat: 'sart', color: true, paint: true, desc: '그림 그리기 · 기분이 더 좋아져요' },
  { id: 'st_glue', name: '딱풀', icon: '🧴', price: 1000, cat: 'sart', desc: '만들기 준비물' },
  { id: 'st_pencils', name: '연필 12자루', icon: '✏️', price: 3000, cat: 'soffice', pen: true, desc: '필기구 · 공책과 함께 있으면 수업 집중' },
  { id: 'st_calc', name: '계산기', icon: '🧮', price: 9000, cat: 'soffice', calc: true, desc: '회사 업무 미니게임 시간 +3초' },
  { id: 'st_stapler', name: '스테이플러', icon: '📎', price: 4000, cat: 'soffice', desc: '서류 묶기' },
  { id: 'st_pen3', name: '3색 볼펜', icon: '🖊️', price: 2000, cat: 'spen', pen: true, desc: '필기구 · 공책과 함께 있으면 수업 집중' },
  { id: 'st_mech', name: '샤프 0.5', icon: '✒️', price: 3000, cat: 'spen', pen: true, desc: '필기구' },
  { id: 'st_hili', name: '형광펜 5색', icon: '🖍️', price: 3500, cat: 'spen', hili: true, desc: '시험 점수 조금 더 (기말고사 +3점)' },
  { id: 'st_eraser', name: '지우개', icon: '⬜', price: 500, cat: 'spen', desc: '깔끔하게' },
  { id: 'st_scissors', name: '안전가위', icon: '✂️', price: 2500, cat: 'spen', desc: '만들기 준비물' },
  { id: 'st_tape', name: '투명테이프', icon: '🎞️', price: 1500, cat: 'spen', desc: '만들기 준비물' },
  { id: 'st_keyring', name: '인형 키링 (랜덤)', icon: '🧸', price: 5000, cat: 'spen', toy: 8, desc: '가방에 달면 기분 +8' },
  { id: 'st_blocks', name: '블록 놀이 300피스', icon: '🧱', price: 15000, cat: 'stoy', toy: 18, desc: '집에서 조립 · 기분 +18' },
  { id: 'st_slime', name: '슬라임', icon: '🫧', price: 3000, cat: 'stoy', toy: 6, desc: '말랑말랑 · 기분 +6' },
  { id: 'st_spinner', name: '배틀 팽이', icon: '🌀', price: 8000, cat: 'stoy', toy: 11, desc: '슝슝 · 기분 +11' },
  { id: 'st_car', name: '미니카', icon: '🏎️', price: 4500, cat: 'stoy', toy: 7, desc: '부릉부릉 · 기분 +7' },
  { id: 'st_jjon', name: '쫀득이', icon: '🍬', price: 500, cat: 'ssnack', hunger: 4, mood: 4, desc: '추억의 간식' },
  { id: 'st_star', name: '별사탕', icon: '⭐', price: 500, cat: 'ssnack', hunger: 2, mood: 4, desc: '추억의 간식' },
  { id: 'st_jelly', name: '빨대젤리 10개입', icon: '🍭', price: 1000, cat: 'ssnack', hunger: 3, mood: 5, desc: '추억의 간식' },
  { id: 'st_corn', name: '콘과자', icon: '🌽', price: 1000, cat: 'ssnack', hunger: 5, mood: 4, desc: '추억의 간식' },
];
export const STAT_CATS = {
  snote: { name: '공책·노트', icon: '📓' }, sart: { name: '미술용품', icon: '🎨' }, soffice: { name: '사무용품', icon: '📎' },
  spen: { name: '필기구·만들기', icon: '🖊️' }, stoy: { name: '장난감', icon: '🧸' }, ssnack: { name: '추억의 간식', icon: '🍬' },
};
// 뽑기 (캡슐 토이 · 스티커)
export const GACHA = {
  toy: { name: '캐릭터 뽑기', price: 1000, items: [
    { id: 'g_cat', name: '고양이 키링', icon: '🐱', r: 'C' }, { id: 'g_dog', name: '강아지 키링', icon: '🐶', r: 'C' }, { id: 'g_bear', name: '곰돌이 키링', icon: '🐻', r: 'C' },
    { id: 'g_rabbit', name: '토끼 키링', icon: '🐰', r: 'C' }, { id: 'g_frog', name: '개구리 키링', icon: '🐸', r: 'C' }, { id: 'g_duck', name: '오리 키링', icon: '🐥', r: 'C' }, { id: 'g_pig', name: '돼지 키링', icon: '🐷', r: 'C' },
    { id: 'g_panda', name: '판다 피규어', icon: '🐼', r: 'R' }, { id: 'g_fox', name: '여우 피규어', icon: '🦊', r: 'R' }, { id: 'g_penguin', name: '펭귄 피규어', icon: '🐧', r: 'R' }, { id: 'g_otter', name: '수달 피규어', icon: '🦦', r: 'R' },
    { id: 'g_unicorn', name: '황금 유니콘', icon: '🦄', r: 'L' },
  ] },
  sticker: { name: '스티커 뽑기', price: 500, items: [
    { id: 's_star', name: '반짝 별 스티커', icon: '🌟', r: 'C' }, { id: 's_heart', name: '하트 스티커', icon: '💖', r: 'C' }, { id: 's_rainbow', name: '무지개 스티커', icon: '🌈', r: 'C' },
    { id: 's_cloud', name: '구름 스티커', icon: '☁️', r: 'C' }, { id: 's_rocket', name: '로켓 스티커', icon: '🚀', r: 'R' }, { id: 's_crown', name: '왕관 스티커', icon: '👑', r: 'R' }, { id: 's_dragon', name: '홀로그램 용 스티커', icon: '🐉', r: 'L' },
  ] },
};
PRODUCTS.push(...STAT_PRODUCTS);
export const P = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

export const CATS = {
  chill: { name: '도시락·김밥', icon: '🍱' },
  ramen: { name: '라면', icon: '🍜' },
  grocery: { name: '식재료', icon: '🥚' },
  snack: { name: '과자·빵', icon: '🍫' },
  drink: { name: '음료', icon: '🥤' },
  ice: { name: '아이스크림', icon: '🍦' },
};

export const INGREDIENTS = {
  ramenpack: { name: '봉지라면', icon: '🍜' },
  egg: { name: '계란', icon: '🥚' },
  rice: { name: '즉석밥', icon: '🍚' },
  kimchi: { name: '김치', icon: '🥬' },
  sausage: { name: '소시지', icon: '🌭' },
  tuna: { name: '참치캔', icon: '🥫' },
  mandu: { name: '군만두', icon: '🥟' },
  pork: { name: '삼겹살', icon: '🥓' },
  beef: { name: '소고기', icon: '🥩' },
  chicken: { name: '생닭', icon: '🍗' },
};

// 직접 만든 음식 (먹으면 효과)
export const DISHES = {
  d_ramen: { name: '끓인 라면', icon: '🍜', hunger: 45, mood: 7 },
  d_ramen_egg: { name: '계란 라면', icon: '🍜', hunger: 55, mood: 9 },
  d_friedegg: { name: '계란후라이', icon: '🍳', hunger: 12, mood: 3 },
  d_eggrice: { name: '간장 계란밥', icon: '🍚', hunger: 40, mood: 6 },
  d_kimchirice: { name: '김치볶음밥', icon: '🍛', hunger: 58, mood: 11 },
  d_sausage: { name: '소시지 볶음', icon: '🌭', hunger: 22, mood: 6 },
  d_mandu: { name: '군만두', icon: '🥟', hunger: 32, mood: 7 },
  d_tunarice: { name: '참치마요 덮밥', icon: '🍚', hunger: 50, mood: 8 },
  d_rice: { name: '데운 밥 + 김치', icon: '🍚', hunger: 26, mood: 3 },
  d_hotdosirak: { name: '데운 도시락', icon: '🍱', hunger: 0, mood: 0 },
};

// 요리 단계: fill(물 붓기), fire(불 켜기/끄기), wait(기다리기), add(넣기), timing(타이밍 맞추기), mash(연타)
export const RECIPES = [
  {
    id: 'ramen', name: '라면 끓이기', dish: 'd_ramen', alt: { need: { egg: 1 }, dish: 'd_ramen_egg', label: '계란도 넣기' },
    need: { ramenpack: 1 }, tool: 'pot', minutes: 10,
    steps: [
      { t: 'fill', label: '냄비에 물 붓기', hint: '550ml 선에 맞춰서 손을 떼세요', target: 0.55, tol: 0.06 },
      { t: 'fire', label: '가스레인지 불 켜기', on: true },
      { t: 'wait', label: '물이 끓을 때까지', sec: 3, fx: 'boil' },
      { t: 'add', label: '면과 스프 넣기', items: ['🍜', '🧂'] },
      { t: 'add', label: '계란 넣기', items: ['🥚'], optional: 'alt' },
      { t: 'timing', label: '면이 꼬들할 때 불 끄기', hint: '초록 구간에서 멈추세요', speed: 0.45, zone: [0.55, 0.75] },
      { t: 'fire', label: '불 끄기', on: false },
    ],
  },
  {
    id: 'friedegg', name: '계란후라이', dish: 'd_friedegg', need: { egg: 1 }, tool: 'pan', minutes: 5,
    steps: [
      { t: 'fire', label: '프라이팬 달구기', on: true },
      { t: 'add', label: '기름 두르고 계란 깨기', items: ['🫗', '🥚'] },
      { t: 'timing', label: '반숙일 때 불 끄기', speed: 0.6, zone: [0.45, 0.65] },
      { t: 'fire', label: '불 끄기', on: false },
    ],
  },
  {
    id: 'eggrice', name: '간장 계란밥', dish: 'd_eggrice', need: { rice: 1, egg: 1 }, tool: 'pan', minutes: 8,
    steps: [
      { t: 'micro', label: '즉석밥 전자레인지 2분', sec: 2 },
      { t: 'fire', label: '프라이팬 불 켜기', on: true },
      { t: 'add', label: '계란 깨기', items: ['🥚'] },
      { t: 'timing', label: '노른자가 살아 있을 때 불 끄기', speed: 0.6, zone: [0.4, 0.6] },
      { t: 'fire', label: '불 끄기', on: false },
      { t: 'mash', label: '밥에 올리고 간장 넣고 비비기', n: 10 },
    ],
  },
  {
    id: 'kimchirice', name: '김치볶음밥', dish: 'd_kimchirice', need: { rice: 1, kimchi: 1 }, extra: { egg: 1, sausage: 1 }, tool: 'pan', minutes: 15,
    steps: [
      { t: 'micro', label: '즉석밥 데우기', sec: 2 },
      { t: 'fire', label: '팬에 불 켜고 기름 두르기', on: true },
      { t: 'add', label: '김치 넣기 (소시지 있으면 같이)', items: ['🥬', '🌭'] },
      { t: 'mash', label: '김치 볶기', n: 12 },
      { t: 'add', label: '밥 넣기', items: ['🍚'] },
      { t: 'mash', label: '골고루 볶기', n: 16 },
      { t: 'timing', label: '살짝 눌어붙을 때 불 끄기', speed: 0.5, zone: [0.6, 0.78] },
      { t: 'fire', label: '불 끄기', on: false },
    ],
  },
  {
    id: 'sausage', name: '소시지 볶음', dish: 'd_sausage', need: { sausage: 1 }, tool: 'pan', minutes: 8,
    steps: [
      { t: 'fire', label: '팬에 불 켜기', on: true },
      { t: 'add', label: '칼집 낸 소시지 넣기', items: ['🌭'] },
      { t: 'mash', label: '굴리면서 볶기', n: 12 },
      { t: 'timing', label: '노릇할 때 불 끄기', speed: 0.55, zone: [0.5, 0.72] },
      { t: 'fire', label: '불 끄기', on: false },
    ],
  },
  {
    id: 'mandu', name: '군만두', dish: 'd_mandu', need: { mandu: 1 }, tool: 'pan', minutes: 10,
    steps: [
      { t: 'fire', label: '팬에 불 켜기', on: true },
      { t: 'add', label: '만두 올리기', items: ['🥟'] },
      { t: 'timing', label: '바닥이 노릇할 때 뒤집기', speed: 0.5, zone: [0.5, 0.7] },
      { t: 'timing', label: '반대쪽도 노릇하게', speed: 0.6, zone: [0.5, 0.7] },
      { t: 'fire', label: '불 끄기', on: false },
    ],
  },
  {
    id: 'tunarice', name: '참치마요 덮밥', dish: 'd_tunarice', need: { rice: 1, tuna: 1 }, tool: 'bowl', minutes: 6,
    steps: [
      { t: 'micro', label: '즉석밥 데우기', sec: 2 },
      { t: 'add', label: '참치 기름 빼서 올리기', items: ['🥫'] },
      { t: 'mash', label: '마요네즈 뿌리고 비비기', n: 10 },
    ],
  },
  {
    id: 'rice', name: '밥 데워서 김치랑', dish: 'd_rice', need: { rice: 1 }, extra: { kimchi: 1 }, tool: 'bowl', minutes: 3,
    steps: [{ t: 'micro', label: '즉석밥 전자레인지 2분', sec: 2 }],
  },
];

// 알바 근무 시간대
export const SHIFTS = {
  morning: { name: '오전', start: 8, end: 12 },
  afternoon: { name: '오후', start: 13, end: 17 },
  evening: { name: '저녁', start: 18, end: 22 },
  night: { name: '야간', start: 23, end: 27, night: true },
};

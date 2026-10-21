// ───────── 업종별 메뉴 · 상품 · 서비스 (실제 2026년 한국 물가 기준) ─────────
// 음식: hunger(배고픔), mood(기분), energy, bites(한 입 수), side(반찬·곁들임), drink
export const MENUS = {
  bbq: [
    { id: 'samg', name: '삼겹살 (1인분 200g)', icon: '🥓', price: 16000, hunger: 30, mood: 10, grill: true, min: 2 },
    { id: 'moks', name: '목살 (1인분 200g)', icon: '🥩', price: 16000, hunger: 30, mood: 9, grill: true, min: 2 },
    { id: 'galbi', name: '양념 소갈비 (1인분)', icon: '🍖', price: 32000, hunger: 32, mood: 14, grill: true },
    { id: 'doenjang', name: '된장찌개', icon: '🍲', price: 3000, hunger: 12, mood: 4, side: true },
    { id: 'rice', name: '공기밥', icon: '🍚', price: 1000, hunger: 14, mood: 1, side: true },
    { id: 'naeng', name: '물냉면', icon: '🍜', price: 8000, hunger: 20, mood: 6 },
    { id: 'soju', name: '소주', icon: '🍶', price: 5500, hunger: 1, mood: 8, drink: true, adult: true },
    { id: 'beer', name: '맥주', icon: '🍺', price: 6000, hunger: 3, mood: 7, drink: true, adult: true },
    { id: 'coke', name: '콜라', icon: '🥤', price: 2500, hunger: 2, mood: 3, drink: true },
  ],
  chicken: [
    { id: 'fried', name: '후라이드 치킨', icon: '🍗', price: 21000, hunger: 45, mood: 14, share: true },
    { id: 'yang', name: '양념 치킨', icon: '🍗', price: 23000, hunger: 45, mood: 15, share: true },
    { id: 'half', name: '반반 치킨', icon: '🍗', price: 23000, hunger: 45, mood: 15, share: true },
    { id: 'cheeseball', name: '치즈볼 (5개)', icon: '🧀', price: 5000, hunger: 10, mood: 6 },
    { id: 'beer', name: '생맥주 500cc', icon: '🍺', price: 5000, hunger: 3, mood: 7, drink: true, adult: true },
    { id: 'coke', name: '콜라 1.25L', icon: '🥤', price: 2500, hunger: 2, mood: 3, drink: true },
  ],
  pizza: [
    { id: 'pep', name: '페퍼로니 피자 L', icon: '🍕', price: 24900, hunger: 45, mood: 13, share: true },
    { id: 'bulgo', name: '불고기 피자 L', icon: '🍕', price: 26900, hunger: 46, mood: 13, share: true },
    { id: 'potato', name: '포테이토 피자 L', icon: '🍕', price: 27900, hunger: 48, mood: 14, share: true },
    { id: 'spag', name: '치즈 오븐 스파게티', icon: '🍝', price: 8900, hunger: 22, mood: 7 },
    { id: 'coke', name: '콜라 1.25L', icon: '🥤', price: 2500, hunger: 2, mood: 3, drink: true },
  ],
  burger: [
    { id: 'classic', name: '클래식 버거 세트', icon: '🍔', price: 8900, hunger: 38, mood: 10, set: ['🍟', '🥤'] },
    { id: 'bulgo', name: '불고기 버거 세트', icon: '🍔', price: 7900, hunger: 36, mood: 9, set: ['🍟', '🥤'] },
    { id: 'chicken', name: '치킨 버거 세트', icon: '🍔', price: 8400, hunger: 37, mood: 9, set: ['🍟', '🥤'] },
    { id: 'cheese', name: '치즈버거 (단품)', icon: '🍔', price: 5900, hunger: 24, mood: 7 },
    { id: 'fries', name: '감자튀김', icon: '🍟', price: 2500, hunger: 10, mood: 5, side: true },
    { id: 'cone', name: '아이스크림콘', icon: '🍦', price: 1000, hunger: 4, mood: 6 },
    { id: 'coke', name: '콜라 (M)', icon: '🥤', price: 2300, hunger: 2, mood: 3, drink: true },
  ],
  cafe: [
    { id: 'ame', name: '아메리카노', icon: '☕', price: 4500, hunger: 1, energy: 18, mood: 4, drink: true, hot: true, recipe: ['샷', '물'] },
    { id: 'iceame', name: '아이스 아메리카노', icon: '🧊', price: 4500, hunger: 1, energy: 18, mood: 5, drink: true, recipe: ['얼음', '샷', '물'] },
    { id: 'latte', name: '카페라떼', icon: '☕', price: 5000, hunger: 4, energy: 15, mood: 5, drink: true, hot: true, recipe: ['샷', '우유'] },
    { id: 'vanilla', name: '바닐라 라떼', icon: '🥛', price: 5500, hunger: 5, energy: 14, mood: 7, drink: true, recipe: ['얼음', '시럽', '샷', '우유'] },
    { id: 'icetea', name: '복숭아 아이스티', icon: '🍑', price: 4500, hunger: 2, mood: 6, drink: true, recipe: ['얼음', '티', '물'] },
    { id: 'strawberry', name: '딸기 라떼', icon: '🍓', price: 6000, hunger: 6, mood: 8, drink: true, recipe: ['딸기청', '얼음', '우유'] },
    { id: 'cake', name: '치즈케이크', icon: '🍰', price: 6500, hunger: 12, mood: 9 },
    { id: 'croffle', name: '크로플', icon: '🧇', price: 5500, hunger: 12, mood: 8 },
    { id: 'macaron', name: '마카롱', icon: '🍬', price: 2800, hunger: 4, mood: 6 },
  ],
  bakery: [
    { id: 'salt', name: '소금빵', icon: '🥐', price: 3200, hunger: 12, mood: 6 },
    { id: 'crois', name: '크루아상', icon: '🥐', price: 3800, hunger: 12, mood: 6 },
    { id: 'redbean', name: '단팥빵', icon: '🍞', price: 2500, hunger: 14, mood: 5 },
    { id: 'cream', name: '슈크림빵', icon: '🍞', price: 2800, hunger: 13, mood: 6 },
    { id: 'loaf', name: '우유 식빵', icon: '🍞', price: 4500, hunger: 30, mood: 4, take: true },
    { id: 'sand', name: '햄에그 샌드위치', icon: '🥪', price: 6500, hunger: 24, mood: 6 },
    { id: 'cakeslice', name: '생크림 케이크 조각', icon: '🍰', price: 6000, hunger: 12, mood: 10 },
    { id: 'milk', name: '흰 우유', icon: '🥛', price: 1800, hunger: 5, mood: 2, drink: true },
  ],
  bunsik: [
    { id: 'tteok', name: '떡볶이', icon: '🌶️', price: 5000, hunger: 26, mood: 10 },
    { id: 'sundae', name: '순대', icon: '🌭', price: 5000, hunger: 22, mood: 6 },
    { id: 'twigim', name: '모둠 튀김 (3개)', icon: '🍤', price: 4000, hunger: 14, mood: 7, side: true },
    { id: 'kimbap', name: '김밥', icon: '🍙', price: 3500, hunger: 22, mood: 4 },
    { id: 'tunakim', name: '참치 김밥', icon: '🍙', price: 4500, hunger: 24, mood: 5 },
    { id: 'ramyeon', name: '라면', icon: '🍜', price: 4500, hunger: 24, mood: 6 },
    { id: 'odeng', name: '어묵 (2개)', icon: '🍢', price: 2000, hunger: 8, mood: 4, side: true },
    { id: 'jjolmyeon', name: '쫄면', icon: '🍜', price: 7000, hunger: 24, mood: 7 },
  ],
  hansik: [
    { id: 'kimchijj', name: '김치찌개', icon: '🍲', price: 9000, hunger: 34, mood: 8, banchan: true },
    { id: 'doenjangjj', name: '된장찌개', icon: '🍲', price: 9000, hunger: 34, mood: 7, banchan: true },
    { id: 'jeyuk', name: '제육볶음', icon: '🥘', price: 10000, hunger: 36, mood: 9, banchan: true },
    { id: 'sundubu', name: '순두부찌개', icon: '🍲', price: 9500, hunger: 33, mood: 8, banchan: true },
    { id: 'bibim', name: '돌솥 비빔밥', icon: '🍚', price: 9000, hunger: 34, mood: 8, banchan: true },
    { id: 'gukbap', name: '돼지국밥', icon: '🍲', price: 9500, hunger: 38, mood: 8, banchan: true },
    { id: 'bulgogi', name: '불고기 정식', icon: '🥘', price: 12000, hunger: 40, mood: 10, banchan: true },
    { id: 'naeng', name: '물냉면', icon: '🍜', price: 9000, hunger: 26, mood: 7 },
  ],
  chinese: [
    { id: 'jjajang', name: '짜장면', icon: '🍜', price: 7000, hunger: 32, mood: 8, danmuji: true },
    { id: 'jjamppong', name: '짬뽕', icon: '🍜', price: 8500, hunger: 33, mood: 9, danmuji: true },
    { id: 'jjamjja', name: '짬짜면', icon: '🍜', price: 9000, hunger: 34, mood: 10, danmuji: true },
    { id: 'tangsu', name: '탕수육 (소)', icon: '🍖', price: 18000, hunger: 30, mood: 12, share: true },
    { id: 'bokkum', name: '볶음밥', icon: '🍛', price: 8500, hunger: 33, mood: 7, danmuji: true },
    { id: 'mara', name: '마라탕 (1인)', icon: '🌶️', price: 12000, hunger: 34, mood: 10 },
    { id: 'mandu', name: '군만두', icon: '🥟', price: 6000, hunger: 14, mood: 6, side: true },
  ],
  japanese: [
    { id: 'sushiset', name: '모둠 초밥 (12p)', icon: '🍣', price: 16000, hunger: 32, mood: 12 },
    { id: 'salmon', name: '연어 초밥 (10p)', icon: '🍣', price: 15000, hunger: 28, mood: 12 },
    { id: 'tonkatsu', name: '등심 돈카츠', icon: '🍛', price: 11000, hunger: 36, mood: 10 },
    { id: 'udon', name: '우동', icon: '🍜', price: 8000, hunger: 26, mood: 7 },
    { id: 'ramen', name: '돈코츠 라멘', icon: '🍜', price: 10000, hunger: 34, mood: 10 },
    { id: 'hoedup', name: '회덮밥', icon: '🍱', price: 12000, hunger: 32, mood: 9 },
    { id: 'miso', name: '미소 된장국', icon: '🥣', price: 1500, hunger: 4, mood: 2, side: true },
  ],
  dessert: [
    { id: 'patbing', name: '우유 팥빙수', icon: '🍧', price: 9000, hunger: 14, mood: 12 },
    { id: 'mango', name: '망고 빙수', icon: '🥭', price: 13000, hunger: 16, mood: 14 },
    { id: 'waffle', name: '생크림 와플', icon: '🧇', price: 6500, hunger: 14, mood: 9 },
    { id: 'gelato', name: '젤라또 (2스쿱)', icon: '🍨', price: 3900, hunger: 6, mood: 8 },
    { id: 'juice', name: '생과일 주스', icon: '🧃', price: 5500, hunger: 5, mood: 6, drink: true },
  ],
};

// 가게 상품 (집으로 가져가는 것) · 서비스
export const GOODS = {
  pharmacy: [
    { id: 'coldmed', name: '종합 감기약', icon: '💊', price: 6000, cure: 'cold', desc: '감기 증상 완화 · 3일분' },
    { id: 'digest', name: '소화제', icon: '💊', price: 4000, desc: '과식했을 때 · 기분 +3' },
    { id: 'band', name: '밴드 (20매)', icon: '🩹', price: 3000, desc: '상비약' },
    { id: 'vita', name: '종합 비타민 (30일)', icon: '🍊', price: 15000, buff: 'vita', desc: '30일 동안 에너지 회복 +10%' },
    { id: 'mask', name: 'KF94 마스크 (5매)', icon: '😷', price: 4500, buff: 'mask', desc: '미세먼지·감기 예방' },
    { id: 'hangover', name: '숙취 해소 음료', icon: '🧪', price: 3500, desc: '에너지 +8' },
  ],
  flower: [
    { id: 'rose1', name: '장미 한 송이', icon: '🌹', price: 3000, gift: 6, desc: '선물하면 기분 UP' },
    { id: 'bouquet', name: '꽃다발', icon: '💐', price: 25000, gift: 20, desc: '특별한 날 선물' },
    { id: 'pot', name: '작은 화분 (몬스테라)', icon: '🪴', price: 15000, furniture: 'plant', desc: '집에 두면 분위기 UP' },
  ],
  fruit: [
    { id: 'apple', name: '사과 1봉 (5개)', icon: '🍎', price: 9000, food: { hunger: 8, mood: 3 }, n: 5 },
    { id: 'banana', name: '바나나 1송이', icon: '🍌', price: 4000, food: { hunger: 9, mood: 3 }, n: 5 },
    { id: 'tangerine', name: '귤 1봉 (10개)', icon: '🍊', price: 6000, food: { hunger: 4, mood: 3 }, n: 10 },
    { id: 'strawb', name: '딸기 1팩', icon: '🍓', price: 12000, food: { hunger: 8, mood: 8 }, n: 2 },
    { id: 'watermelon', name: '수박 반통', icon: '🍉', price: 15000, food: { hunger: 10, mood: 9 }, n: 4 },
  ],
  butcher: [
    { id: 'pork', name: '삼겹살 600g', icon: '🥓', price: 15000, ing: { pork: 3 } },
    { id: 'beefsoup', name: '한우 국거리 300g', icon: '🥩', price: 18000, ing: { beef: 2 } },
    { id: 'chickenw', name: '생닭 한 마리', icon: '🍗', price: 9000, ing: { chicken: 2 } },
    { id: 'egg30', name: '계란 한 판 (30구)', icon: '🥚', price: 8500, ing: { egg: 30 } },
  ],
  deli: [
    { id: 'kimchi', name: '포기김치 1kg', icon: '🥬', price: 9000, ing: { kimchi: 8 } },
    { id: 'myeolchi', name: '멸치볶음', icon: '🐟', price: 5000, food: { hunger: 6, mood: 3 }, n: 4, banchan: true },
    { id: 'japchae', name: '잡채', icon: '🍜', price: 7000, food: { hunger: 12, mood: 6 }, n: 3, banchan: true },
    { id: 'injeolmi', name: '인절미', icon: '🍡', price: 5000, food: { hunger: 10, mood: 6 }, n: 3 },
    { id: 'kkultteok', name: '꿀떡', icon: '🍡', price: 4000, food: { hunger: 8, mood: 7 }, n: 3 },
  ],
  bookstore: [
    { id: 'novel', name: '베스트셀러 소설', icon: '📕', price: 16800, read: 'novel', desc: '집에서 읽으면 기분 +15' },
    { id: 'comic', name: '만화책', icon: '📗', price: 6000, read: 'comic', desc: '기분 +10' },
    { id: 'workbook', name: '자격증 문제집', icon: '📘', price: 22000, read: 'study', desc: '자격증 시험 공부 효과 2배' },
    { id: 'cook', name: '요리책', icon: '📙', price: 18000, read: 'cook', desc: '요리 실력 UP' },
  ],
  optician: [
    { id: 'glasses', name: '뿔테 안경', icon: '👓', price: 89000, wear: 'glasses', desc: '쓰면 똑똑해 보여요' },
    { id: 'sunglass', name: '선글라스', icon: '🕶️', price: 59000, wear: 'sunglass', desc: '여름 필수' },
  ],
  phone: [
    { id: 'phone_pro', name: '최신 스마트폰 프로', icon: '📱', price: 1550000, upgrade: 'camera', desc: '카메라 화질 UP · 사진 저장 2배' },
    { id: 'case', name: '휴대폰 케이스', icon: '📱', price: 15000, desc: '기분 +3' },
    { id: 'charger', name: '고속 충전기', icon: '🔌', price: 25000, desc: '배터리 걱정 끝' },
  ],
  petshop: [
    { id: 'feed', name: '사료 2kg', icon: '🦴', price: 25000, pet: 'food', n: 10, desc: '반려동물 밥 10번' },
    { id: 'snack', name: '간식', icon: '🍖', price: 6000, pet: 'snack', n: 5, desc: '반려동물 기분 UP' },
    { id: 'toy', name: '장난감 공', icon: '🎾', price: 8000, pet: 'toy', desc: '놀아주기 효과 2배' },
  ],
};

// 서비스 (가격 · 걸리는 시간(분) · 효과)
export const SERVICES = {
  salon: [
    { id: 'cut', name: '커트', icon: '✂️', price: 18000, min: 40, hair: true },
    { id: 'perm', name: '펌', icon: '🌀', price: 70000, min: 120, hair: 'perm' },
    { id: 'dye', name: '염색', icon: '🎨', price: 60000, min: 90, hair: 'dye' },
    { id: 'wash', name: '샴푸 + 드라이', icon: '🧴', price: 12000, min: 20, mood: 8 },
  ],
  nail: [{ id: 'gel', name: '젤 네일', icon: '💅', price: 50000, min: 60, mood: 15 }, { id: 'care', name: '기본 케어', icon: '💅', price: 20000, min: 30, mood: 8 }],
  clinic: [{ id: 'visit', name: '진료 (진찰료)', icon: '🩺', price: 5500, min: 20, cure: 'cold', rx: true }, { id: 'shot', name: '독감 예방주사', icon: '💉', price: 40000, min: 15, buff: 'flu' }],
  dental: [{ id: 'scaling', name: '스케일링', icon: '🦷', price: 15000, min: 30, mood: 5 }, { id: 'check', name: '구강 검진', icon: '🦷', price: 5000, min: 15 }],
  vet: [{ id: 'checkup', name: '건강 검진', icon: '🩺', price: 30000, min: 30, pet: true }, { id: 'vaccine', name: '예방 접종', icon: '💉', price: 35000, min: 20, pet: true }],
  photo: [{ id: 'idphoto', name: '증명사진', icon: '🪪', price: 18000, min: 20, item: 'idphoto', desc: '이력서·자격증 서류에 필요해요' }, { id: 'profile', name: '프로필 사진', icon: '📸', price: 60000, min: 60, mood: 12 }],
  laundry: [{ id: 'dry', name: '드라이클리닝 (정장)', icon: '👔', price: 9000, min: 0, desc: '내일 찾아가요 · 면접 때 좋은 인상' }],
  coinwash: [{ id: 'wash', name: '세탁 + 건조', icon: '🧺', price: 9000, min: 70, clean: true }],
  gym: [{ id: 'day', name: '일일 이용권', icon: '🏋️', price: 12000, min: 60, fit: 1 }, { id: 'month', name: '1개월 회원권', icon: '🗓️', price: 70000, pass: 30 }],
  yoga: [{ id: 'class', name: '그룹 수업 1회', icon: '🧘', price: 25000, min: 50, mood: 14, fit: 1 }],
  karaoke: [{ id: 'coin', name: '코인 1곡', icon: '🪙', price: 500, songs: 1, cash: true }, { id: 'hour', name: '1시간 (방)', icon: '🎤', price: 15000, min: 60 }],
  pcbang: [{ id: 'h1', name: '1시간', icon: '🖥️', price: 1500, min: 60 }, { id: 'h3', name: '3시간', icon: '🖥️', price: 4000, min: 180 }],
  reading: [{ id: 'day', name: '1일권', icon: '📖', price: 8000, min: 240 }],
  studycafe: [{ id: 'h2', name: '2시간', icon: '✏️', price: 4000, min: 120 }, { id: 'h4', name: '4시간', icon: '✏️', price: 7000, min: 240 }],
  kidscafe: [{ id: 'enter', name: '입장 (2시간 · 보호자)', icon: '🧸', price: 8000, min: 120, mood: 16 }],
  taekwondo: [{ id: 'trial', name: '체험 수업', icon: '🥋', price: 10000, min: 50, fit: 1, mood: 8 }],
  piano: [{ id: 'trial', name: '레슨 1회', icon: '🎹', price: 25000, min: 50, mood: 12 }],
  art: [{ id: 'trial', name: '원데이 클래스', icon: '🎨', price: 35000, min: 120, mood: 18 }],
  academy: [
    { id: 'barista', name: '바리스타 자격증 과정', icon: '☕', price: 350000, cert: 'barista', days: 5 },
    { id: 'baker', name: '제과제빵 자격증 과정', icon: '🥐', price: 450000, cert: 'baker', days: 6 },
    { id: 'cook', name: '한식 조리사 자격증 과정', icon: '🍳', price: 400000, cert: 'cook', days: 6 },
    { id: 'hair', name: '미용사 자격증 과정', icon: '💇', price: 600000, cert: 'hair', days: 8 },
    { id: 'english', name: '토익 집중반 (면접 가산점)', icon: '🇬🇧', price: 280000, cert: 'toeic', days: 4 },
  ],
};

// 무료 반찬 · 곁들임 (식당에서 같이 나와요)
export const SIDES = {
  sangchu: { name: '상추쌈', icon: '🥬', hunger: 3, mood: 2, tag: 'veg' },
  ssamjang: { name: '쌈장 · 마늘', icon: '🧄', hunger: 1, mood: 1, tag: 'veg' },
  kimchi: { name: '김치', icon: '🥬', hunger: 2, mood: 1, tag: 'veg' },
  kongnamul: { name: '콩나물무침', icon: '🌱', hunger: 2, mood: 1, tag: 'veg' },
  gyeran: { name: '계란말이', icon: '🍳', hunger: 4, mood: 2, tag: 'veg' },
  danmuji: { name: '단무지 · 양파', icon: '🟨', hunger: 1, mood: 1, tag: 'veg' },
  kkakdugi: { name: '깍두기', icon: '🟥', hunger: 2, mood: 1, tag: 'veg' },
  pickle: { name: '피클', icon: '🥒', hunger: 1, mood: 1, tag: 'veg' },
  water: { name: '물', icon: '💧', hunger: 0, mood: 1, tag: 'drink', drink: true },
};
export const SIDE_SETS = { bbq: ['sangchu', 'ssamjang', 'kimchi', 'kongnamul'], hansik: ['kimchi', 'kongnamul', 'gyeran'], chinese: ['danmuji'], japanese: ['kkakdugi'], chicken: ['kkakdugi'], pizza: ['pickle'], bunsik: ['danmuji'] };
// 음식 분류 (조합 보너스)
export function menuTag(type, m) {
  if (m.tag) return m.tag;
  if (m.drink) return m.adult ? 'alcohol' : 'drink';
  if (m.grill) return 'meat';
  if (type === 'chicken') return 'chicken';
  if (type === 'pizza') return 'pizza';
  if (type === 'burger') return m.id === 'fries' ? 'fries' : 'burger';
  if (type === 'cafe') return 'dessert';
  if (type === 'bakery') return 'bread';
  if (type === 'dessert') return 'dessert';
  if (/면|라면|우동|라멘|짜장|짬뽕|냉면|쫄면/.test(m.name)) return 'noodle';
  if (/김밥/.test(m.name)) return 'rice';
  if (/떡볶이|튀김|어묵|순대/.test(m.name)) return 'bunsik';
  return 'meal';
}

export const ORDER_STYLE = {
  bbq: 'table', hansik: 'table', chinese: 'table', japanese: 'table',
  chicken: 'counter', pizza: 'counter', bunsik: 'counter', dessert: 'counter',
  burger: 'kiosk', cafe: 'kiosk', bakery: 'tray',
};
// 현금만 받는 곳 (작은 가게 일부)
export const CASH_ONLY = { bunsik: 0.25, tteok: 0.3, fruit: 0.2 };

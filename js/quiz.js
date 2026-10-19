// 문제 은행: 학교 단계별 (수학은 매번 새로 만들고, 나머지는 고정 문제)
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function mathQ(level) {
  let q, ans;
  if (level === 'elem') {
    const t = R(0, 2);
    if (t === 0) { const a = R(2, 9), b = R(2, 9); q = `${a} × ${b} = ?`; ans = a * b; }
    else if (t === 1) { const a = R(12, 89), b = R(11, 59); q = `${a} + ${b} = ?`; ans = a + b; }
    else { const b = R(2, 9), ansv = R(2, 9); q = `${b * ansv} ÷ ${b} = ?`; ans = ansv; }
  } else if (level === 'middle') {
    const t = R(0, 2);
    if (t === 0) { const x = R(-6, 9), a = R(2, 7), b = R(-10, 10); q = `${a}x ${b >= 0 ? '+' : '−'} ${Math.abs(b)} = ${a * x + b} 일 때 x는?`; ans = x; }
    else if (t === 1) { const a = R(-9, -1), b = R(2, 9); q = `(${a}) × ${b} = ?`; ans = a * b; }
    else { const a = R(3, 12); q = `한 변이 ${a}cm인 정사각형의 넓이는? (cm²)`; ans = a * a; }
  } else {
    const t = R(0, 2);
    if (t === 0) { const a = R(2, 6), n = R(2, 4); q = `f(x) = ${a}x^${n} 일 때 f'(1) = ?`; ans = a * n; }
    else if (t === 1) { const b = R(2, 3), n = R(3, 6); q = `log${'₂₃'[b - 2]} ${b ** n} = ?`; ans = n; }
    else { const a = R(1, 5), d = R(2, 6), n = R(5, 10); q = `첫째항 ${a}, 공차 ${d}인 등차수열의 제${n}항은?`; ans = a + (n - 1) * d; }
  }
  const opts = new Set([ans]);
  while (opts.size < 4) opts.add(ans + R(-6, 6) || ans + 7);
  const list = shuffle([...opts]);
  return { q, opts: list.map(String), a: list.indexOf(ans), subject: '수학' };
}

const BANK = {
  elem: [
    ['국어', '맞춤법이 바른 것은?', ['안 돼요', '안 되요', '않 돼요', '않 되요'], 0],
    ['국어', '"웃어른께 ○○를 드리다"에 알맞은 말은?', ['진지', '밥', '식사', '먹이'], 0],
    ['과학', '식물이 빛을 받아 양분을 만드는 것을 무엇이라 할까요?', ['광합성', '호흡', '증발', '발효'], 0],
    ['과학', '물이 끓는 온도는? (1기압)', ['100°C', '0°C', '50°C', '212°C'], 0],
    ['사회', '우리나라의 수도는?', ['서울', '부산', '인천', '대전'], 0],
    ['사회', '한글을 만든 왕은?', ['세종대왕', '태조', '정조', '광개토대왕'], 0],
    ['과학', '지구에서 가장 가까운 별은?', ['태양', '북극성', '시리우스', '달'], 0],
    ['국어', '"고맙습니다"의 반대 상황에서 쓰는 말은?', ['미안합니다', '반갑습니다', '안녕히 계세요', '축하합니다'], 0],
  ],
  middle: [
    ['과학', '물의 화학식은?', ['H₂O', 'CO₂', 'O₂', 'NaCl'], 0],
    ['과학', '빛의 3원색이 아닌 것은?', ['노랑', '빨강', '초록', '파랑'], 0],
    ['사회', '삼권분립에서 법을 만드는 곳은?', ['국회', '법원', '정부', '헌법재판소'], 0],
    ['역사', '임진왜란이 일어난 해는?', ['1592년', '1392년', '1636년', '1910년'], 0],
    ['영어', '"I ___ a student." 빈칸에 알맞은 것은?', ['am', 'is', 'are', 'be'], 0],
    ['과학', '세포에서 에너지를 만드는 기관은?', ['미토콘드리아', '핵', '엽록체', '세포막'], 0],
    ['국어', '"가는 말이 고와야 ○○ 말이 곱다"', ['오는', '하는', '듣는', '보는'], 0],
    ['역사', '훈민정음이 반포된 해는?', ['1446년', '1443년', '1592년', '1392년'], 0],
  ],
  high: [
    ['물리', '뉴턴 제2법칙은?', ['F = ma', 'E = mc²', 'V = IR', 'PV = nRT'], 0],
    ['화학', '주기율표 1번 원소는?', ['수소', '헬륨', '산소', '탄소'], 0],
    ['생명', 'DNA의 염기가 아닌 것은?', ['우라실(U)', '아데닌(A)', '구아닌(G)', '사이토신(C)'], 0],
    ['영어', '"despite"와 뜻이 가장 가까운 것은?', ['in spite of', 'because of', 'instead of', 'according to'], 0],
    ['한국사', '3·1 운동이 일어난 해는?', ['1919년', '1945년', '1910년', '1950년'], 0],
    ['국어', '"반어법"의 예로 알맞은 것은?', ['잘~한다 (실수했을 때)', '내 마음은 호수요', '구름처럼 흘러가네', '아아, 님은 갔습니다'], 0],
    ['지구과학', '판의 경계에서 자주 일어나는 것은?', ['지진', '일식', '조석', '오로라'], 0],
    ['경제', '물가가 계속 오르는 현상은?', ['인플레이션', '디플레이션', '리세션', '스태그'], 0],
  ],
  univ: [
    ['교양', '"생각하는 갈대"라고 말한 사람은?', ['파스칼', '데카르트', '칸트', '니체'], 0],
    ['교육학', '피아제의 인지발달 단계 중 마지막은?', ['형식적 조작기', '구체적 조작기', '전조작기', '감각운동기'], 0],
    ['교육학', '비고츠키가 말한 "도움을 받으면 할 수 있는 영역"은?', ['근접발달영역', '자아실현', '조작적 조건화', '스키마'], 0],
    ['경영학', 'SWOT에서 O는?', ['Opportunity', 'Operation', 'Option', 'Output'], 0],
    ['경영학', '수요가 늘고 공급이 그대로면 가격은?', ['오른다', '내린다', '그대로다', '0이 된다'], 0],
    ['교양', '민주주의의 기본 원리가 아닌 것은?', ['독재', '국민 주권', '권력 분립', '법치주의'], 0],
    ['교육학', '매슬로 욕구 위계에서 가장 높은 단계는?', ['자아실현', '안전', '소속', '생리'], 0],
    ['경영학', '"마케팅 4P"가 아닌 것은?', ['People', 'Product', 'Price', 'Place'], 0],
    ['교양', '인터넷 주소를 IP로 바꿔 주는 것은?', ['DNS', 'CPU', 'USB', 'HTML'], 0],
  ],
};

// level: elem | middle | high | univ
export function question(level, math = 0.4) {
  if (Math.random() < math) return mathQ(level === 'univ' ? 'high' : level);
  const b = BANK[level];
  const [subject, q, opts, a] = b[Math.floor(Math.random() * b.length)];
  const idx = shuffle([0, 1, 2, 3]);
  return { subject, q, opts: idx.map(i => opts[i]), a: idx.indexOf(a) };
}
export function questions(level, n, math) {
  const out = [], seen = new Set();
  let guard = 0;
  while (out.length < n && guard++ < 100) { const q = question(level, math); if (seen.has(q.q)) continue; seen.add(q.q); out.push(q); }
  return out;
}

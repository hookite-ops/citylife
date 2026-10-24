// ───────── 6단계: 회사 · 직업 (취업 · 출근 · 업무 · 승진) ─────────
import { $, toast, openSheet, closeSheet, sheetOpen, bindActs, row, bigMsg } from './ui.js';
import { won } from './config.js';
import { seeded } from './geo.js';
import { floorLabel, tenantMap } from './bplan.js';
import { OVERRIDES, unitKey, TYPES, SHOP_NAMES } from './tenants.js';
import * as ST from './state.js';
import { espressoGame, hoseGame } from './minigames.js';
import { gate } from './lifestage.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fh = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

// 회사 이름
const P1 = ['넥스트', '블루', '오로라', '퓨처', '스텔라', '코어', '루미', '새봄', '온누리', '하이', '그린', '씨엘'];
const P2 = [['소프트', 'IT'], ['파이낸셜', '금융'], ['디자인', '디자인'], ['게임즈', '게임'], ['건설', '건설'], ['물산', '무역'], ['바이오', '제약'], ['미디어', '광고'], ['컨설팅', '컨설팅'], ['테크', 'IT']];
export function companiesOf(B) {
  if (B._co) return B._co;
  const R = seeded(B.id * 29 + 5), out = [];
  let n = 2;
  while (n <= B.top) {
    const span = Math.min(B.top - n + 1, 2 + Math.floor(R() * 6));
    const [suf, ind] = P2[Math.floor(R() * P2.length)];
    out.push({ id: `${B.id}_${n}`, name: P1[Math.floor(R() * P1.length)] + suf, ind, bid: B.id, bname: B.name, from: n, to: n + span - 1, pay: 1 + R() * 0.5 + (B.grade === 'A' ? 0.2 : 0) });
    n += span;
  }
  return (B._co = out);
}
export function companyAt(B, n) { return companiesOf(B).find(c => n >= c.from && n <= c.to) || null; }

// 직업
export const CAREERS = {
  office: { name: '회사원', icon: '💼', ranks: [['인턴', 2200000], ['사원', 2900000], ['주임', 3300000], ['대리', 3900000], ['과장', 4800000], ['차장', 5800000], ['부장', 7200000], ['이사', 10000000], ['사장', 16000000]], hours: [9, 18] },
  police: { name: '경찰관', icon: '👮', ranks: [['순경', 2600000], ['경장', 3000000], ['경사', 3500000], ['경위', 4200000], ['경감', 5200000], ['경정', 6300000], ['총경 (경찰서장)', 8000000]], hours: [9, 18], place: 'police', req: { exam: 'police', fit: 3 } },
  fire: { name: '소방관', icon: '🧑‍🚒', ranks: [['소방사', 2600000], ['소방교', 3000000], ['소방장', 3500000], ['소방위', 4200000], ['소방경', 5200000], ['소방령', 6300000], ['소방정 (소방서장)', 8000000]], hours: [9, 18], place: 'fire', req: { exam: 'fire', fit: 4 } },
  doctor: { name: '의사', icon: '🧑‍⚕️', ranks: [['인턴', 3500000], ['레지던트', 4500000], ['전문의', 9000000], ['과장', 12000000], ['부원장', 15000000], ['병원장', 22000000]], hours: [9, 18], place: 'clinic', req: { degree: 'med' } },
  nurse: { name: '간호사', icon: '👩‍⚕️', ranks: [['간호사', 3200000], ['책임간호사', 3900000], ['수간호사', 4800000], ['간호부장', 6200000]], hours: [9, 18], place: 'clinic', req: { degree: 'nurse' } },
  pharmacist: { name: '약사', icon: '💊', ranks: [['근무약사', 4800000], ['관리약사', 6000000], ['약국장', 9000000]], hours: [9, 18], place: 'pharmacy', req: { degree: 'pharm' } },
  stylist: { name: '미용사', icon: '💇', ranks: [['인턴', 2300000], ['디자이너', 3200000], ['실장', 4500000], ['원장', 7000000]], hours: [10, 19], place: 'salon', req: { cert: 'hair' } },
  chef: { name: '요리사', icon: '👨‍🍳', ranks: [['주방보조', 2400000], ['요리사', 3000000], ['부주방장', 3800000], ['주방장', 5000000], ['오너셰프', 8000000]], hours: [10, 19], place: 'hansik', req: { cert: 'cook' } },
  barista: { name: '바리스타', icon: '☕', ranks: [['바리스타', 2400000], ['헤드 바리스타', 2900000], ['매니저', 3500000], ['점장', 4300000]], hours: [8, 17], place: 'cafe', req: { cert: 'barista' } },
  baker: { name: '제빵사', icon: '🥐', ranks: [['제빵사', 2500000], ['선임 제빵사', 3100000], ['베이커리 실장', 3900000], ['제과점 대표', 6000000]], hours: [7, 16], place: 'bakery', req: { cert: 'baker' } },
};
const CERT_NAME = { barista: '바리스타', baker: '제과제빵', cook: '한식 조리사', hair: '미용사', toeic: '토익' };
const DEG_NAME = { med: '의예과', nurse: '간호학과', pharm: '약학과', edu: '교육학과', biz: '경영학과', police: '경찰행정학과', fire: '소방안전학과' };

// 자격증 시험 문제
const CERT_Q = {
  barista: [['에스프레소 추출 시간으로 알맞은 것은?', ['25~30초', '2~3분', '5초'], 0], ['라떼에 들어가는 것은?', ['에스프레소 + 스팀 우유', '에스프레소 + 물', '우유만'], 0], ['원두를 볶는 과정은?', ['로스팅', '탬핑', '스티밍'], 0], ['탬핑이란?', ['커피 가루를 다지는 것', '우유를 데우는 것', '컵을 데우는 것'], 0], ['아메리카노는?', ['에스프레소 + 물', '에스프레소 + 우유', '홍차'], 0]],
  baker: [['빵 반죽을 부풀게 하는 것은?', ['이스트', '소금', '설탕'], 0], ['크루아상 반죽의 특징은?', ['버터를 접어 층을 만든다', '쌀가루를 쓴다', '튀긴다'], 0], ['발효 적정 온도는?', ['약 27~30도', '0도', '100도'], 0], ['오븐 예열을 하는 이유는?', ['일정한 온도로 굽기 위해', '전기 절약', '반죽을 식히려고'], 0], ['식빵을 구운 뒤 해야 할 것은?', ['틀에서 꺼내 식히기', '바로 냉동', '물에 담그기'], 0]],
  cook: [['김치찌개의 깊은 맛을 내는 방법은?', ['김치를 먼저 볶는다', '물만 오래 끓인다', '설탕을 많이'], 0], ['칼질할 때 손 모양은?', ['손끝을 구부린 고양이 손', '손가락을 편다', '한 손만 쓴다'], 0], ['생선을 손질할 때 먼저 하는 것은?', ['비늘 제거', '굽기', '양념'], 0], ['나물을 데칠 때 넣는 것은?', ['소금 약간', '식초 가득', '설탕 가득'], 0], ['식중독 예방 기본은?', ['손 씻기와 익혀 먹기', '오래 상온 보관', '맛보기'], 0]],
  hair: [['커트 전에 하는 것은?', ['상담과 샴푸', '염색', '드라이'], 0], ['펌을 고정시키는 약은?', ['중화제', '샴푸', '왁스'], 0], ['가위를 잡을 때 엄지는?', ['아래 날 고리에', '위 날 고리에', '안 씀'], 0], ['탈색 후 필요한 것은?', ['트리트먼트', '바로 펌', '드라이만'], 0], ['손님 두피가 예민하면?', ['패치 테스트 먼저', '그냥 진행', '약을 두 배로'], 0]],
  toeic: [['"I ___ to the office yesterday."', ['went', 'go', 'going'], 0], ['"meeting"의 뜻은?', ['회의', '식사', '퇴근'], 0], ['"deadline"의 뜻은?', ['마감 기한', '죽은 선', '출발선'], 0], ['"Could you ___ me the file?"', ['send', 'sent', 'sending'], 0], ['"invoice"의 뜻은?', ['청구서', '초대장', '목소리'], 0]],
  police: [['교통사고 현장에서 가장 먼저 할 일은?', ['부상자 확인과 2차 사고 예방', '사진 찍기', '자리 떠나기'], 0], ['범죄 신고 번호는?', ['112', '119', '114'], 0], ['미란다 원칙을 알려주는 때는?', ['체포할 때', '퇴근할 때', '식사할 때'], 0], ['음주운전 단속 기준 (면허 정지)은?', ['혈중알코올 0.03% 이상', '0.5% 이상', '없음'], 0], ['실종 신고는?', ['바로 받는다', '24시간 뒤에', '안 받는다'], 0]],
  fire: [['화재 신고 번호는?', ['119', '112', '120'], 0], ['소화기 사용 순서는?', ['안전핀 → 노즐 → 손잡이', '손잡이 → 안전핀', '흔들기만'], 0], ['연기가 많을 때 대피 자세는?', ['낮은 자세로 코와 입을 막고', '서서 뛰기', '엘리베이터 타기'], 0], ['기름 화재에 쓰면 안 되는 것은?', ['물', '소화기', '젖은 담요'], 0], ['심폐소생술 가슴 압박 속도는?', ['분당 100~120회', '분당 20회', '분당 300회'], 0]],
};

export class Career {
  constructor(ctx) { this.c = ctx; this.day = null; }   // { S, city, audio, earn, persist, passTime, setBusy, bldg(), toast }
  get S() { return this.c.S; }
  get job() { return this.S.career || null; }
  hour() { return ST.hour(this.S) % 24; }
  wd() { return (ST.day(this.S) - 1) % 7; }
  rankName(j = this.job) { return CAREERS[j.kind].ranks[j.rank][0]; }
  salary(j = this.job) { return Math.round(CAREERS[j.kind].ranks[j.rank][1] * (j.pay || 1) / 10000) * 10000; }

  // ─ 경찰서 · 소방서 자리 정하기 (가게 칸을 지구대·안전센터로) ─
  setupStations() {
    const city = this.c.city;
    const shops = city.bldgs.filter(s => s.bkind === 'shop' && s.type === 'shop' && !s.officePodium).sort((a, b) => Math.hypot((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2) - Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2));
    const pickUnit = (skip) => {
      for (const s of shops) {
        if (skip?.spec === s) continue;
        const B = city.bldgOf(s);
        for (const [key, t] of tenantMap(B)) { const [n, k] = key.split(':').map(Number); if (n === 1 && k < 90 && (t.type !== 'bank')) return { spec: s, n, k, B }; }
      }
      return null;
    };
    const p = pickUnit(), f = pickUnit(p);
    this.stations = {};
    if (p) { OVERRIDES.set(unitKey(p.B.id, 1, p.k), { slot: SHOP_NAMES.findIndex(q => q[2] === 'police'), type: 'police', name: '한빛지구대', color: '#1a3a7a' }); this.stations.police = { bid: p.B.id, n: 1, k: p.k, name: '한빛지구대' }; }
    if (f) { OVERRIDES.set(unitKey(f.B.id, 1, f.k), { slot: SHOP_NAMES.findIndex(q => q[2] === 'fire'), type: 'fire', name: '한빛119안전센터', color: '#b71c1c' }); this.stations.fire = { bid: f.B.id, n: 1, k: f.k, name: '한빛119안전센터' }; }
    return [p?.spec, f?.spec].filter(Boolean);
  }

  // ─ 구직 앱 ─
  postings() {
    const S = this.S, week = Math.floor(ST.day(S) / 7);
    if (this._post && this._pw === week) return this._post;
    const R = seeded(week * 131 + 7), out = [];
    const offices = this.c.city.bldgs.filter(s => s.bkind === 'office');
    for (let i = 0; i < 6; i++) {
      const s = offices[Math.floor(R() * offices.length)], B = this.c.city.bldgOf(s);
      const co = companiesOf(B); const c = co[Math.floor(R() * co.length)]; if (!c || out.some(o => o.co?.id === c.id)) continue;
      out.push({ id: 'p' + c.id, kind: 'office', co: c, title: `${c.name} ${['신입 사원', '경력 사원', '인턴'][Math.floor(R() * 3)]}`, ind: c.ind });
    }
    for (const k of ['police', 'fire', 'doctor', 'nurse', 'pharmacist', 'stylist', 'chef', 'barista', 'baker']) out.push({ id: 'p' + k, kind: k, title: `${CAREERS[k].name} ${k === 'police' ? '공채 (경찰 공무원)' : k === 'fire' ? '공채 (소방 공무원)' : '채용'}` });
    this._post = out; this._pw = week;
    return out;
  }
  reqText(kind) {
    const r = CAREERS[kind].req || {};
    const S = this.S, out = [];
    if (r.degree) out.push(`${S.uni?.degree === r.degree ? '✅' : '❌'} ${DEG_NAME[r.degree]} 졸업`);
    if (r.cert) out.push(`${S.certs?.[r.cert] ? '✅' : '❌'} ${CERT_NAME[r.cert]} 자격증`);
    if (r.exam) out.push(`${S.exams?.[r.exam] ? '✅' : '❌'} ${r.exam === 'police' ? '경찰' : '소방'} 공무원 시험 합격 (시청 민원실에서 응시)`);
    if (r.fit) out.push(`${(S.fitness || 0) >= r.fit ? '✅' : '❌'} 체력 ${r.fit} 이상 (지금 ${(S.fitness || 0).toFixed(1)})`);
    out.push(`${(S.items?.idphoto || 0) > 0 ? '✅' : '❌'} 증명사진 (사진관)`);
    return out;
  }
  meets(kind) {
    const r = CAREERS[kind].req || {}, S = this.S;
    if (!((S.items?.idphoto || 0) > 0)) return false;
    if (r.degree && S.uni?.degree !== r.degree) return false;
    if (r.cert && !S.certs?.[r.cert]) return false;
    if (r.exam && !S.exams?.[r.exam]) return false;
    if (r.fit && (S.fitness || 0) < r.fit) return false;
    return true;
  }
  appHtml() {
    const S = this.S, j = this.job;
    const apps = S.applications || [];
    const head = j ? `<div class="ph-widget">${CAREERS[j.kind].icon} <b>${j.place}</b><br>${this.rankName()} · 월급 ${won(this.salary())}<br>출근 ${fh(j.start)}~${fh(j.end)} · 근무 ${j.days}일 · 경고 ${j.warnings}/3</div><button class="btn wide gray" data-cq="1">회사 그만두기</button>` : '<p class="note" style="color:#ddd">💼 지원하려면 증명사진(사진관)이 필요해요. 학과·자격증이 필요한 직업도 있어요.</p>';
    const ap = apps.length ? '<div class="ph-title" style="font-size:15px">내 지원 현황</div>' + apps.map(a => `<div class="row"><div class="info"><b>${a.title}</b><span>${a.status}${a.at ? ` · 면접 ${a.atDay}일차 ${fh(a.atH)} ${a.where}` : ''}</span></div></div>`).join('') : '';
    const posts = this.postings().map(p => `<div class="row"><div class="ic">${CAREERS[p.kind].icon}</div><div class="info"><b>${p.title}</b><span>${p.kind === 'office' ? `${p.co.bname} ${p.co.from}~${p.co.to}층 · ${p.ind}` : this.reqText(p.kind).join(' ')}</span></div><button class="btn ${apps.some(a => a.pid === p.id) ? 'gray' : 'green'}" data-ap="${p.id}" ${apps.some(a => a.pid === p.id) || j ? 'disabled' : ''}>지원</button></div>`).join('');
    return `<div class="ph-title">💼 한빛잡</div>${head}${ap}<div class="ph-title" style="font-size:15px">이번 주 채용 공고</div>${posts}`;
  }
  bindApp(el, rerender) {
    el.querySelectorAll('[data-ap]').forEach(b => b.addEventListener('click', () => { this.apply(this.postings().find(p => p.id === b.dataset.ap)); rerender(); }));
    el.querySelector('[data-cq]')?.addEventListener('click', () => { this.quit(); rerender(); });
  }
  apply(p) {
    const S = this.S;
    if (!gate.can('career')) return;
    if (!(S.items?.idphoto > 0)) { toast('🪪 증명사진이 필요해요 · 사진관에서 찍어요', 'bad', 3000); return; }
    if (p.kind !== 'office' && !this.meets(p.kind)) { toast('📋 지원 자격이 안 돼요 · 조건을 확인하세요', 'bad', 3000); return; }
    S.items.idphoto--;
    S.applications = S.applications || [];
    S.applications.push({ id: 'A' + Date.now(), pid: p.id, kind: p.kind, title: p.title, co: p.co || null, status: '📨 서류 심사 중', day: ST.day(S) });
    toast('📨 이력서를 보냈어요 · 내일 결과가 와요', 'good');
    this.c.persist();
  }
  quit() { const j = this.job; if (!j) return; this.S.career = null; this.S.careerHist = [...(this.S.careerHist || []), { kind: j.kind, place: j.place, rank: j.rank }]; toast(`👋 ${j.place}을(를) 그만뒀어요`); this.c.persist(); }

  // ─ 매일: 서류 결과 · 면접 결과 · 결근 · 월급 ─
  dailyCheck() {
    const S = this.S, day = ST.day(S), h = this.hour();
    for (const a of S.applications || []) {
      if (a.status.includes('서류') && day > a.day && h >= 9) {
        const score = (a.kind === 'office' ? (S.uni?.graduated ? 0.75 : 0.45) + (S.certs?.toeic ? 0.15 : 0) : 0.85) + Math.random() * 0.2;
        if (score > 0.62) {
          const where = this.placeFor(a);
          if (!where) { a.status = '❌ 채용이 마감됐어요'; continue; }
          a.status = '📞 서류 합격! 면접 보러 오세요'; a.atDay = day + 1; a.atH = 10 + Math.floor(Math.random() * 6); a.where = where.label; a.place = where;
          S.appointments = S.appointments || [];
          S.appointments.push({ bid: where.bid, floor: where.n, at: a.atDay * 1440 + a.atH * 60 - 1440, label: `${a.title} 면접`, app: a.id });
          toast(`📱 [한빛잡] ${a.title} 서류 합격! ${a.atDay}일차 ${fh(a.atH)} 면접 · ${where.label}`, 'good', 5200);
        } else { a.status = '❌ 서류 불합격'; toast(`📱 [한빛잡] ${a.title} 서류 불합격… 다른 곳에 도전해요`, 'bad', 4000); }
      }
      if (a.status.includes('면접 보러') && day > a.atDay) { a.status = '❌ 면접에 안 갔어요'; }
      if (a.result && day > a.resultDay && !a.done) {
        a.done = true;
        if (a.result === 'pass') this.hire(a); else { a.status = '❌ 면접 불합격'; toast(`📱 ${a.title} 면접 결과: 아쉽게도 불합격이에요`, 'bad', 4000); }
      }
    }
    const j = this.job; if (!j) return;
    // 결근 체크 (평일)
    const wd = this.wd();
    if (wd < 5 && j.lastWork !== day && h > j.start + 1.5 && j.checked !== day && j.hiredDay !== day) {
      j.checked = day; j.warnings++;
      toast(`📞 ${j.place} 팀장님: "오늘 출근 안 해요?" (경고 ${j.warnings}/3)`, 'bad', 4500);
      if (j.warnings >= 3) { bigMsg('📄 해고', `${j.place}에서 무단결근으로 해고됐어요`, 4000); this.S.career = null; }
    }
    // 월급날 (30일마다)
    if (day >= j.nextPay) {
      j.nextPay += 30;
      const pay = Math.round(this.salary(j) * Math.min(1, j.monthDays / 22) / 10) * 10 + (j.overtime || 0);
      if (pay > 0) this.c.earn(pay, `${j.place} 월급 (${j.monthDays}일 근무${j.overtime ? ` · 야근수당 ${won(j.overtime)}` : ''})`);
      j.monthDays = 0; j.overtime = 0;
    }
  }
  placeFor(a) {
    const city = this.c.city;
    if (a.kind === 'office') { const B = city.bldgOf(city.bldgs.find(s => s.seed === a.co.bid)); return { bid: a.co.bid, n: a.co.from, label: `${B.name} ${a.co.from}층 ${a.co.name}`, name: a.co.name, co: a.co }; }
    if (a.kind === 'police' || a.kind === 'fire') { const st = this.stations?.[a.kind]; return st && { ...st, label: st.name }; }
    const type = CAREERS[a.kind].place;
    for (const s of city.bldgs) {
      if (s.bkind !== 'shop') continue;
      const B = city.bldgOf(s);
      for (const [key, t] of tenantMap(B)) if (t.type === type || (type === 'clinic' && t.type === 'clinic') || (type === 'hansik' && ['hansik', 'chinese', 'japanese'].includes(t.type))) { const [n, k] = key.split(':').map(Number); if (Math.random() < 0.3) return { bid: B.id, n, k, label: `${B.name} ${n}층 ${t.name}`, name: t.name }; }
    }
    return null;
  }
  hire(a) {
    const S = this.S, C = CAREERS[a.kind], p = a.place;
    const base = a.kind !== 'office' ? 0 : /인턴/.test(a.title || '') ? 0 : /경력/.test(a.title || '') ? Math.max(2, S.bestRank?.office ?? 0) : 1;
    const rank0 = a.kind === 'office' ? Math.min(4, base + (S.uni?.degree === 'biz' ? 1 : 0)) : 0;
    S.career = { kind: a.kind, place: p.name, bid: p.bid, n: p.n, k: p.k ?? null, co: p.co || null, rank: rank0, pay: a.co?.pay || 1, start: C.hours[0], end: C.hours[1], days: 0, monthDays: 0, overtime: 0, perf: 0, warnings: 0, lastWork: -1, hiredDay: ST.day(S), nextPay: ST.day(S) + 30 };
    a.status = '🎉 최종 합격!';
    S.applications = (S.applications || []).filter(q => q !== a);
    bigMsg(`🎉 ${C.icon} ${p.name} 합격!`, `${this.rankName()} · 월급 ${won(this.salary())} · 평일 ${fh(C.hours[0])} 출근`, 4200);
    this.c.missions?.event?.('hired');
    this.c.persist();
  }
  // 면접 (회사 층 회의실 · 직장 카운터)
  interviewHere(bldg) {
    const S = this.S, day = ST.day(S), h = this.hour();
    return (S.applications || []).find(a => a.status.includes('면접 보러') && a.atDay === day && a.place.bid === bldg.B.id && (a.place.n === bldg.n) && Math.abs(h - a.atH) < 2);
  }
  interview(a) {
    const S = this.S;
    if (!gate.can('career')) return;
    const QS = [
      ['간단하게 자기소개 해 주세요.', ['맡은 일은 끝까지 해내는 사람입니다', '그냥… 평범한 사람이에요', '돈이 필요해서 왔어요'], 0],
      ['우리 회사에 지원한 이유는?', ['회사의 성장 가능성과 제 강점이 맞아서요', '집이 가까워서요', '아무 데나 붙고 싶어서요'], 0],
      ['동료와 의견이 다르면 어떻게 하나요?', ['근거를 들어 대화하고 조율해요', '제 의견대로 밀어붙여요', '그냥 피해요'], 0],
      ['실수했을 때는?', ['바로 보고하고 해결책을 찾아요', '숨겨요', '남 탓을 해요'], 0],
      ['5년 뒤 목표는?', ['이 분야 전문가가 되는 것', '잘 모르겠어요', '빨리 그만두기'], 0],
    ];
    const qs = shuffle(QS).slice(0, 3);
    let i = 0, score = 0;
    const bonus = (S.items?.suitClean && S.items.suitClean <= ST.day(S) ? 0.5 : 0) + (S.items?.cleanClothes > ST.day(S) ? 0.3 : 0) + (S.certs?.toeic ? 0.5 : 0) + (S.mood > 60 ? 0.3 : 0);
    const ask = () => {
      const [q, opts, ok] = qs[i];
      const order = shuffle(opts.map((t, k) => [t, k]));
      openSheet({
        icon: '🧑‍💼', title: `면접 ${i + 1}/3`, sub: `면접관: "${q}"`,
        html: order.map(([t, k]) => `<button class="btn wide gray" data-act="a:${k}" style="margin-bottom:8px;text-align:left">${t}</button>`).join(''),
        bind: (b) => bindActs(b, { a: (k) => { if (+k === ok) score++; i++; if (i < qs.length) ask(); else done(); } }),
      });
    };
    const done = () => {
      closeSheet();
      this.c.passTime(40, 'idle');
      const pass = score + bonus + Math.random() * 0.6 >= 2.4;
      a.result = pass ? 'pass' : 'fail'; a.resultDay = ST.day(S); a.status = '⏳ 면접 결과 기다리는 중 (내일)';
      toast('🧑‍💼 "수고하셨습니다. 결과는 내일 연락드릴게요"', '', 3600);
      this.c.persist();
    };
    ask();
  }

  // ─ 출근 · 업무 ─
  atWork(bldg) {
    const j = this.job; if (!j || !bldg?.B) return false;
    if (j.bid !== bldg.B.id) return false;
    if (j.kind === 'office') return bldg.n >= j.co.from && bldg.n <= j.co.to;
    return bldg.n === j.n;
  }
  employedAt(B) { const j = this.job; return !!(j && j.bid === B.id); }
  floorAccess(B, n) {
    if (B.kind !== 'office' || n <= 1) return true;
    const j = this.job, S = this.S;
    if (j && j.bid === B.id && j.kind === 'office' && n >= j.co.from && n <= j.co.to) return true;
    if (S.visitPass && S.visitPass.bid === B.id && S.minutes < S.visitPass.until && (S.visitPass.floor === n)) return true;
    return false;
  }
  action(z, bldg) {
    const j = this.job, S = this.S;
    // 면접
    const iv = this.interviewHere(bldg);
    if (iv && (z.kind === 'meeting' || z.kind === 'odesk' || z.kind === 'reception' || z.kind === 'counter' || z.kind === 'inshop')) return { label: `🧑‍💼 ${iv.title} 면접 보기`, fn: () => this.interview(iv), green: true };
    if (!j || !this.atWork(bldg)) return null;
    if (j.kind !== 'office' && z.unit && (z.unit.k !== j.k)) return null;
    const d = this.day;
    if (!d) {
      const h = this.hour(), wd = this.wd();
      if (wd >= 5) return z.kind === 'odesk' || z.kind === 'counter' ? { label: '🗓️ 오늘은 쉬는 날이에요', fn: () => {} } : null;
      if (j.lastWork === ST.day(S)) return null;
      if (h >= j.start - 1.5 && h < j.end - 1 && (z.kind === 'odesk' || z.kind === 'meeting' || z.kind === 'counter' || z.kind === 'reception' || z.kind === 'exam' || z.kind === 'inshop')) return { label: `💼 출근하기 (${fh(j.start)})`, fn: () => this.clockIn(), green: true };
      return null;
    }
    // 근무 중
    const late = this.hour() >= j.end;
    if (d.q.length) return { label: `📋 ${d.q[0].icon} ${d.q[0].name} (할 일 ${d.q.length})`, fn: () => this.doTask(), green: true, alt: late ? { label: '🏠 퇴근하기', fn: () => this.clockOut() } : null };
    if (this.hour() >= j.end) return { label: `🏠 퇴근하기${this.hour() > j.end + 0.3 ? ' (야근 끝)' : ''}`, fn: () => this.clockOut(), green: true };
    return { label: `💼 근무 중 · 할 일 기다리는 중`, fn: () => toast('📧 곧 일이 들어와요') };
  }
  clockIn() {
    const j = this.job, S = this.S;
    const late = this.hour() > j.start + 0.17;
    this.day = { q: [], done: 0, good: 0, t: 0.3, meetings: new Set(), late, start: S.minutes };
    j.lastWork = ST.day(S);
    if (late) { j.perf -= 1; toast('⏰ 지각! 팀장님 눈치가 보여요', 'bad'); }
    else toast(`👋 ${j.place} 출근! ${this.rankName()} · 할 일이 생기면 알려 줘요`, 'good', 3000);
  }
  get working() { return !!this.day; }
  update(dt) {
    const d = this.day; if (!d) return;
    const j = this.job, h = this.hour();
    if (!j) { this.day = null; return; }
    d.t -= dt;
    if (d.t <= 0 && h < j.end + (d.ot ? 3 : 0)) {
      d.t = 14 + Math.random() * 10;
      if (d.q.length < 4) { d.q.push(this.makeTask(j.kind, h)); this.c.audio.play?.('ding'); if (d.q.length === 1) toast(`🔔 할 일: ${d.q[0].icon} ${d.q[0].name}`, '', 2400); }
    }
    // 경찰 · 소방: 도시에서 실제로 일어난 사고 · 화재에 출동
    if ((j.kind === 'police' || j.kind === 'fire') && this.c.life) {
      const life = this.c.life;
      d.dispT = (d.dispT ?? 20) - dt;
      if (d.dispT <= 0) { d.dispT = 40 + Math.random() * 40; if (!life.pendingFor(j.kind) && Math.random() < 0.35) life.dispatchSpawn(j.kind); }
      const ev = life.pendingFor(j.kind);
      if (ev && !d.q.some(t => t.ev === ev)) { ev.dispatched = true; d.q.unshift({ type: 'dispatch', ev, icon: '🚨', name: `긴급 출동 · ${ev.where}` }); this.c.audio.play?.('ding'); toast(`🚨 긴급 출동! ${ev.where} ${ev.kind === 'fire' ? '화재' : '교통사고'}`, 'bad', 3600); }
    }
    for (const mh of [11, 15]) if (j.kind === 'office' && h >= mh && h < mh + 0.2 && !d.meetings.has(mh)) { d.meetings.add(mh); d.q.unshift({ type: 'meeting', icon: '🗣️', name: `${mh}시 팀 회의` }); toast('🗣️ 회의 시간이에요!', '', 2400); }
    if (h >= 12 && h < 12.1 && !d.lunch) { d.lunch = true; toast('🍱 점심시간! (12~13시) 밖에서 밥 먹고 와요', '', 3200); }
    if (h >= j.end && !d.endMsg) { d.endMsg = true; toast('🕕 퇴근 시간이에요 · 더 일하면 야근수당이 나와요', '', 3600); d.ot = true; }
    if (h >= j.end + 3) this.clockOut();
  }
  makeTask(kind, h) {
    const T = {
      office: [{ type: 'approve', icon: '🗂', name: '결재 서류 처리' }, { type: 'email', icon: '📧', name: '거래처 이메일 회신' }, { type: 'sum', icon: '📊', name: '매출 엑셀 정리' }],
      police: [{ type: 'call', icon: '📞', name: '112 신고 출동' }, { type: 'patrol', icon: '🚓', name: '동네 순찰' }, { type: 'desk', icon: '🪪', name: '민원 처리' }],
      fire: [{ type: 'equip', icon: '🧯', name: '장비 점검' }, { type: 'drill', icon: '🚒', name: '출동 훈련' }, { type: 'call', icon: '📞', name: '119 구급 출동' }],
      doctor: [{ type: 'diag', icon: '🩺', name: '외래 환자 진료' }],
      nurse: [{ type: 'vital', icon: '🌡️', name: '환자 체온·혈압 재기' }, { type: 'inject', icon: '💉', name: '주사 놓기' }],
      pharmacist: [{ type: 'rx', icon: '💊', name: '처방전 조제' }],
      stylist: [{ type: 'steps', icon: '✂️', name: '손님 커트', steps: ['상담', '샴푸', '커트', '드라이', '스타일링'] }, { type: 'steps', icon: '🌀', name: '손님 펌', steps: ['상담', '롯드 말기', '펌 약', '중화제', '드라이'] }],
      chef: [{ type: 'steps', icon: '🍲', name: '김치찌개 조리', steps: ['김치 볶기', '고기', '물', '두부', '대파'] }, { type: 'steps', icon: '🥘', name: '제육볶음 조리', steps: ['고기 볶기', '양념', '양파', '대파', '담기'] }],
      barista: [{ type: 'brew', icon: '☕', name: '카페라떼 (라떼 아트)', latte: true }, { type: 'brew', icon: '🧊', name: '아이스 아메리카노', iced: true }, { type: 'brew', icon: '☕', name: '에스프레소 더블샷' }],
      baker: [{ type: 'steps', icon: '🥐', name: '크루아상', steps: ['반죽', '버터 접기', '성형', '발효', '굽기'] }, { type: 'steps', icon: '🍞', name: '식빵', steps: ['반죽', '1차 발효', '성형', '2차 발효', '굽기'] }],
    }[kind];
    return { ...pick(T) };
  }
  doTask() {
    const d = this.day, t = d.q[0]; if (!t) return;
    const finish = (good) => { d.q.shift(); d.done++; if (good) d.good++; this.job.perf += good ? 1 : -0.5; toast(good ? `✅ ${t.name} 완료! 잘했어요` : `😓 ${t.name} 끝냈지만 실수가 있었어요`, good ? 'good' : 'bad', 2000); this.c.passTime(20, 'work'); };
    if (t.type === 'brew') return espressoGame({ name: t.name, icon: t.icon, latte: t.latte, iced: t.iced, audio: this.c.audio }, (sc) => finish(sc >= 0.75));
    if (t.type === 'dispatch') {
      const fire = t.ev.kind === 'fire';
      // 현장 처리: 소방은 호스로 직접 불 끄기 · 경찰은 현장 정리 순서
      const onSite = (cb) => fire
        ? hoseGame({ title: `🚒 ${t.ev.where} 화재 진압`, fires: 4, audio: this.c.audio }, (sc) => cb(sc >= 0.7))
        : this.steps({ icon: '🚓', name: `${t.ev.where} 사고 현장`, steps: ['라바콘 설치', '부상자 확인', '구급차 요청', '견인차 요청', '도로 정리'] }, cb);
      const after = (good, drove) => { this.c.life.resolve(t.ev, good); this.job.perf += good ? (drove ? 2 : 1.5) : 0; finish(good); this.c.passTime(drove ? 10 : 40, 'work'); };
      if (!this.c.dispatchDrive) return onSite((g) => after(g, false));
      return openSheet({
        icon: '🚨', title: t.name, sub: `${fire ? '화재' : '교통사고'} 신고 · ${t.ev.where}`,
        html: row({ icon: fire ? '🚒' : '🚓', title: fire ? '소방차 타고 출동' : '순찰차 타고 출동', desc: '사이렌 켜고 직접 운전해서 현장으로 · 평가 더 좋아요', btn: '출동!', action: 'drive', btnClass: 'green' }) +
          row({ icon: '📻', title: '무전으로 지휘', desc: '다른 팀이 출동하고 여기서 지휘해요', btn: '지휘', action: 'radio' }),
        bind: (b) => bindActs(b, {
          drive: () => { closeSheet(); this.c.dispatchDrive(t.ev, fire ? 'fire' : 'police', (back) => onSite((g) => { after(g, true); back(g); })); },
          radio: () => { closeSheet(); onSite((g) => after(g, false)); },
        }),
      });
    }
    if (t.type === 'meeting') return this.quiz('🗣️ 팀 회의', [[`이번 분기 ${pick(['매출', '신제품', '마케팅'])} 회의 · 내 의견은?`, ['데이터를 근거로 개선안을 낸다', '조용히 졸기', '딴소리'], 0]], finish);
    if (t.type === 'approve') return this.approveGame(finish);
    if (t.type === 'email') return this.quiz('📧 이메일 회신', [[pick(['거래처: "납기가 늦어지는데 어떻게 되나요?"', '고객: "환불 요청드립니다"', '협력사: "미팅 일정 잡을 수 있을까요?"']), ['정중하게 사과하고 일정·방법을 안내한다', '읽고 무시한다', '반말로 답한다'], 0]], finish);
    if (t.type === 'sum') { const a = 100 + Math.floor(Math.random() * 900), b = 100 + Math.floor(Math.random() * 900), c = 100 + Math.floor(Math.random() * 900); const ans = a + b + c; return this.quiz('📊 엑셀 정리', [[`이번 주 매출 합계는? (${a}만 + ${b}만 + ${c}만)`, [`${ans}만`, `${ans + 100}만`, `${ans - 90}만`], 0]], finish); }
    if (t.type === 'diag') { const c = pick([['열 38.5도, 콧물, 기침', '감기 → 해열제·감기약'], ['배가 아프고 설사', '장염 → 수분 보충·지사제'], ['무릎을 삐었어요', '염좌 → 냉찜질·고정'], ['눈이 충혈되고 가려워요', '결막염 → 안약']]); return this.quiz('🩺 진료', [[`환자: "${c[0]}"`, shuffle([c[1], '그냥 집에 가세요', '수술해야 해요']).map(x => x), null, c[1]]], finish); }
    if (t.type === 'rx') { const m = pick(['타이레놀정 500mg', '아목시실린캡슐', '판토프라졸정', '세티리진정']); return this.quiz('💊 조제', [[`처방전: ${m} 3일분`, shuffle([m, '비타민C정', '소화제 시럽']), null, m]], finish); }
    if (t.type === 'vital' || t.type === 'inject') return this.timing(t.icon + ' ' + t.name, finish);
    if (t.type === 'steps') return this.steps(t, finish);
    if (t.type === 'call' && this.job.kind === 'police') return this.quiz('🚓 112 출동', [[pick(['"옆집에서 싸우는 소리가 나요"', '"지갑을 잃어버렸어요"', '"교통사고가 났어요!"']), ['현장 확인 → 안전 확보 → 상황 정리', '전화로만 대충 처리', '못 들은 척'], 0]], finish);
    if (t.type === 'call') return this.quiz('🚑 119 구급', [['"할머니가 쓰러지셨어요!"', ['의식·호흡 확인 → 심폐소생술 → 병원 이송', '깨울 때까지 기다리기', '물 먹이기'], 0]], finish);
    return this.timing(t.icon + ' ' + t.name, finish);
  }
  quiz(title, qs, done) {
    const [q, opts, ok, okText] = qs[0];
    const order = okText ? opts : shuffle(opts.map((t, k) => t + '\u0000' + k));
    openSheet({
      icon: '📋', title, sub: q,
      html: order.map((t, i) => `<button class="btn wide gray" data-act="a:${i}" style="margin-bottom:8px;text-align:left">${t.split('\u0000')[0]}</button>`).join(''),
      bind: (b) => bindActs(b, { a: (i) => { closeSheet(); const t = order[+i]; done(okText ? t === okText : +t.split('\u0000')[1] === ok); } }),
    });
  }
  approveGame(done) {
    const limit = pick([300000, 500000, 1000000]), amount = Math.round(limit * (0.5 + Math.random() * 0.9) / 1000) * 1000, signed = Math.random() < 0.8, ok = amount <= limit && signed;
    openSheet({ icon: '🗂', title: '결재 서류', sub: '규칙: 한도 이하 + 팀장 서명 → 승인', html: `<div class="doc">요청 금액 <b>${won(amount)}</b><br>결재 한도 ${won(limit)}<br>팀장 서명 ${signed ? '✔ 있음' : '<b style="color:#c22">✘ 없음</b>'}</div><div class="mg-btns" style="margin-top:10px"><button class="btn red" data-act="v:0">반려</button><button class="btn green" data-act="v:1">승인</button></div>`, bind: (b) => bindActs(b, { v: (v) => { closeSheet(); done((+v === 1) === ok); } }) });
  }
  timing(title, done) {
    const mg = $('mg'); mg.classList.remove('hidden', 'soft');
    let pos = 0, dir = 1, ended = false, last = performance.now();
    mg.innerHTML = `<div class="mg-box"><div class="mg-top"><span>${title}</span></div><div style="position:relative;height:40px;border-radius:20px;background:rgba(255,255,255,.08);overflow:hidden"><i style="position:absolute;left:42%;width:16%;top:0;bottom:0;background:rgba(80,255,160,.35)"></i><i id="tmDot" style="position:absolute;top:6px;width:28px;height:28px;border-radius:50%;background:#46d1ff"></i></div><p class="note" style="text-align:center">초록 칸에서 누르세요</p><button class="btn wide green" id="tmHit" style="padding:16px;font-size:18px">지금!</button></div>`;
    $('tmHit').onclick = () => { if (ended) return; ended = true; mg.classList.add('hidden'); mg.innerHTML = ''; done(pos > 0.42 && pos < 0.58); };
    const step = (now) => { if (ended || !$('tmDot')) return; pos += dir * (now - last) / 1000 * 0.8; last = now; if (pos > 1 || pos < 0) { dir *= -1; pos = Math.max(0, Math.min(1, pos)); } $('tmDot').style.left = `calc(${pos * 100}% - 14px)`; requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  steps(t, done) {
    const opts = shuffle([...t.steps, '휴대폰 보기', '멍 때리기']);
    let i = 0, miss = 0;
    const open = () => openSheet({
      icon: t.icon, title: t.name, sub: `순서대로 (${i + 1}/${t.steps.length})`,
      html: `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${opts.map((o, k) => `<button class="btn gray" data-act="s:${k}" style="padding:14px 6px">${o}</button>`).join('')}</div>`,
      bind: (b) => bindActs(b, { s: (k) => { if (opts[+k] === t.steps[i]) { i++; this.c.audio.play?.('pick'); if (i >= t.steps.length) { closeSheet(); done(miss === 0); return; } } else { miss++; this.c.audio.bad?.(); } open(); } }),
    });
    open();
  }
  clockOut() {
    const d = this.day, j = this.job; if (!d || !j) { this.day = null; return; }
    this.day = null;
    const S = this.S, h = this.hour();
    j.days++; j.monthDays++;
    if (h > j.end + 0.3) { const ot = Math.round((h - j.end) * this.salary(j) / 209 * 1.5 / 10) * 10; j.overtime = (j.overtime || 0) + ot; toast(`🌙 야근 ${(h - j.end).toFixed(1)}시간 · 야근수당 ${won(ot)} (월급날 지급)`, '', 3600); }
    const rate = d.done ? d.good / d.done : 0.5;
    bigMsg('🏠 퇴근!', `오늘 한 일 ${d.done}건 · 잘한 일 ${d.good}건`, 2600);
    this.tryPromote(rate);
    this.c.persist();
  }
  tryPromote(rate) {
    const j = this.job, C = CAREERS[j.kind];
    if (j.rank >= C.ranks.length - 1) return;
    const need = 8 + j.rank * 6;
    if (j.perf >= need && rate > 0.6) {
      j.rank++; j.perf = 0;
      bigMsg(`🎉 승진! ${this.rankName()}`, `월급 ${won(this.salary())}`, 3600);
      this.c.missions?.event?.('promote');
      this.c.audio.chime?.();
    }
  }
  hudText() {
    const d = this.day, j = this.job; if (!d || !j) return '';
    return `${CAREERS[j.kind].icon} ${j.place} 근무 중 · ${this.rankName()}<small>할 일 ${d.q.length} · 오늘 ${d.done}건 · 퇴근 ${fh(j.end)}${this.hour() > j.end + 0.3 ? ' (야근 중)' : ''}</small>`;
  }

  // ─ 자격증 학원 수업 · 시험 ─
  classAction(s) {
    const S = this.S, day = ST.day(S);
    const courses = Object.entries(S.courses || {});
    if (!courses.length) return null;
    const [cert, c] = courses[0];
    if (c.left > 0) {
      if (c.lastDay === day) return { label: `📚 ${c.name} · 오늘 수업은 들었어요 (${c.total - c.left}/${c.total})`, fn: () => {} };
      return { label: `📚 ${c.name} 수업 듣기 (${c.total - c.left + 1}/${c.total})`, green: true, fn: async () => { this.c.setBusy(true); await this.c.progress('📚 수업 듣는 중…', 2.6); this.c.passTime(120, 'work'); c.left--; c.lastDay = day; c.study = (c.study || 0) + 2; this.c.setBusy(false); toast(c.left ? `📚 수업 끝! 남은 수업 ${c.left}번` : '📝 수업을 다 들었어요 · 다음에 자격증 시험을 볼 수 있어요', 'good', 3000); this.c.persist(); } };
    }
    return { label: `📝 ${CERT_NAME[cert]} 자격증 시험 보기`, green: true, fn: () => this.exam(cert, (ok) => { if (ok) { S.certs = S.certs || {}; S.certs[cert] = true; delete S.courses[cert]; bigMsg('🎓 자격증 취득!', `${CERT_NAME[cert]} 자격증`, 3600); this.c.missions?.event?.('cert'); } else { c.study = Math.max(0, (c.study || 0) - 1); toast('😢 불합격… 공부를 더 하고 다시 봐요 (독서실·스터디카페)', 'bad', 3600); } this.c.persist(); }) };
  }
  exam(kind, done) {
    const S = this.S;
    const qs = shuffle(CERT_Q[kind]).slice(0, 5);
    const studyBonus = Math.min(2, Math.floor(((S.courses?.[kind]?.study) || (S.examStudy?.[kind]) || 0) / 3));
    let i = 0, score = 0;
    const ask = () => {
      const [q, opts, ok] = qs[i];
      const order = shuffle(opts.map((t, k) => [t, k]));
      openSheet({
        icon: '📝', title: `시험 ${i + 1}/${qs.length}`, sub: q,
        html: order.map(([t, k]) => `<button class="btn wide gray" data-act="a:${k}" style="margin-bottom:8px;text-align:left">${t}</button>`).join(''),
        bind: (b) => bindActs(b, { a: (k) => { if (+k === ok) score++; i++; if (i < qs.length) ask(); else { closeSheet(); const tot = score + studyBonus * 0.5; toast(`📝 ${score}/${qs.length} 정답${studyBonus ? ` (공부 보너스 +${studyBonus * 0.5})` : ''}`, '', 3000); done(tot >= 3.5); } } }),
      });
    };
    this.c.passTime(60, 'work');
    ask();
  }
  // 시청 민원실
  civic() {
    const S = this.S;
    openSheet({
      icon: '🏛️', title: '한빛시청 민원실', sub: '"번호표 순서대로 도와드릴게요"',
      html: (this.c.life?.voteRow() || '') + row({ icon: '👮', title: '경찰 공무원 시험 응시', desc: S.exams?.police ? '✅ 합격' : '필기 5문제 · 응시료 없음', btn: '응시', action: 'ex:police', disabled: !!S.exams?.police }) +
        row({ icon: '🧑‍🚒', title: '소방 공무원 시험 응시', desc: S.exams?.fire ? '✅ 합격' : '필기 5문제', btn: '응시', action: 'ex:fire', disabled: !!S.exams?.fire }) +
        row({ icon: '🏠', title: '전입신고', desc: S.homeUnit ? `${S.homeUnit.name}` : '이사하면 해요', btn: '신고', action: 'move', disabled: !S.homeUnit || S.movedReg === S.homeUnit?.bid }) +
        row({ icon: '📄', title: '주민등록등본 발급', desc: '500원', btn: '발급', action: 'doc' }),
      bind: (b) => bindActs(b, {
        ex: (k) => { closeSheet(); this.exam(k, (ok) => { if (ok) { S.exams = S.exams || {}; S.exams[k] = true; bigMsg('🎉 필기 합격!', `${k === 'police' ? '경찰' : '소방'} 공무원 · 한빛잡에서 지원할 수 있어요`, 3600); } else toast('😢 불합격… 독서실에서 공부하고 다시 도전해요', 'bad', 3200); this.c.persist(); }); },
        move: () => { S.movedReg = S.homeUnit.bid; S.mood = ST.clamp(S.mood + 3); closeSheet(); toast('🏠 전입신고 완료 · 이제 이 동네 주민이에요', 'good'); this.c.persist(); },
        doc: () => { closeSheet(); if (this.c.payCash(500)) toast('📄 주민등록등본을 받았어요', 'good'); },
        vote: () => { closeSheet(); this.c.life?.voteSheet(); },
      }),
    });
  }
}

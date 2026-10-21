// ───────── 옷 · 헤어 · 표정 (패션몰 앱) ─────────
export const LOOK_DEFAULT = { skin: 0xe9c6a2, hair: 0x1c1410, hairStyle: 'short', shirt: 0xf2f2f0, jacket: 0x2e3f57, pants: 0x2a2f38, shoes: 0xf4f4f4, hat: null, face: 'smile', tie: null };
export const OUTFIT_CATS = { hair: '💇 헤어', top: '👕 상의', pants: '👖 바지', shoes: '👟 신발', hat: '🧢 모자', face: '😀 표정' };
// set: 입으면 바뀌는 부분
export const OUTFITS = [
  { id: 'h_basic', cat: 'hair', name: '기본 숏컷 (검정)', price: 0, set: { hairStyle: 'short', hair: 0x1c1410 } },
  { id: 'h_brown', cat: 'hair', name: '숏컷 (밤색)', price: 8000, set: { hairStyle: 'short', hair: 0x6a3a1a } },
  { id: 'h_blond', cat: 'hair', name: '숏컷 (금발)', price: 12000, set: { hairStyle: 'short', hair: 0xe8c060 } },
  { id: 'h_long', cat: 'hair', name: '긴 생머리 (검정)', price: 10000, set: { hairStyle: 'long', hair: 0x1c1410 } },
  { id: 'h_longb', cat: 'hair', name: '긴 생머리 (갈색)', price: 12000, set: { hairStyle: 'long', hair: 0x8a5a2a } },
  { id: 'h_bun', cat: 'hair', name: '똥머리 (핑크)', price: 18000, set: { hairStyle: 'bun', hair: 0xff8ab8 } },
  { id: 'h_spikyr', cat: 'hair', name: '삐죽머리 (빨강)', price: 15000, set: { hairStyle: 'spiky', hair: 0xd8302a } },
  { id: 'h_spikyb', cat: 'hair', name: '삐죽머리 (파랑)', price: 20000, set: { hairStyle: 'spiky', hair: 0x2a7ae8 } },
  { id: 't_basic', cat: 'top', name: '흰 셔츠 + 남색 재킷', price: 0, set: { shirt: 0xf2f2f0, jacket: 0x2e3f57, tie: null } },
  { id: 't_white', cat: 'top', name: '흰 반팔티', price: 5000, set: { shirt: 0xf6f6f4, jacket: null, tie: null } },
  { id: 't_yellow', cat: 'top', name: '노랑 티셔츠', price: 6000, set: { shirt: 0xffd21a, jacket: null, tie: null } },
  { id: 't_sky', cat: 'top', name: '하늘색 셔츠', price: 9000, set: { shirt: 0x8ac8f0, jacket: null, tie: null } },
  { id: 't_green', cat: 'top', name: '초록 맨투맨', price: 12000, set: { shirt: 0x2a9a5a, jacket: null, tie: null } },
  { id: 't_hood', cat: 'top', name: '빨간 후드티', price: 15000, set: { shirt: 0xd8302a, jacket: null, tie: null } },
  { id: 't_purple', cat: 'top', name: '보라 바람막이', price: 22000, set: { shirt: 0x2a2a3a, jacket: 0x7a3ad8, tie: null } },
  { id: 't_leather', cat: 'top', name: '검정 가죽 재킷', price: 35000, set: { shirt: 0x9a9a9a, jacket: 0x161616, tie: null } },
  { id: 't_suit', cat: 'top', name: '정장 (넥타이)', price: 60000, set: { shirt: 0xf6f6f4, jacket: 0x1a1d24, tie: 0xb8202a } },
  { id: 'p_basic', cat: 'pants', name: '남색 바지', price: 0, set: { pants: 0x2a2f38 } },
  { id: 'p_jeans', cat: 'pants', name: '청바지', price: 15000, set: { pants: 0x3a5a8a } },
  { id: 'p_beige', cat: 'pants', name: '베이지 면바지', price: 12000, set: { pants: 0xc8b090 } },
  { id: 'p_grey', cat: 'pants', name: '회색 트레이닝', price: 9000, set: { pants: 0x8a8e94 } },
  { id: 'p_black', cat: 'pants', name: '검정 슬랙스', price: 20000, set: { pants: 0x18191c } },
  { id: 'p_red', cat: 'pants', name: '빨간 바지', price: 14000, set: { pants: 0xb8202a } },
  { id: 's_basic', cat: 'shoes', name: '흰 운동화', price: 0, set: { shoes: 0xf4f4f4 } },
  { id: 's_black', cat: 'shoes', name: '검정 구두', price: 25000, set: { shoes: 0x141414 } },
  { id: 's_red', cat: 'shoes', name: '빨간 운동화', price: 18000, set: { shoes: 0xd8302a } },
  { id: 's_blue', cat: 'shoes', name: '파란 운동화', price: 15000, set: { shoes: 0x2a7ae8 } },
  { id: 'c_none', cat: 'hat', name: '모자 안 쓰기', price: 0, set: { hat: null } },
  { id: 'c_black', cat: 'hat', name: '검정 야구모자', price: 8000, set: { hat: 0x1a1a1a } },
  { id: 'c_red', cat: 'hat', name: '빨간 야구모자', price: 8000, set: { hat: 0xd8302a } },
  { id: 'c_blue', cat: 'hat', name: '파란 야구모자', price: 8000, set: { hat: 0x2a6ad8 } },
  { id: 'c_white', cat: 'hat', name: '흰 야구모자', price: 9000, set: { hat: 0xf2f2f2 } },
  { id: 'f_smile', cat: 'face', name: '미소', price: 0, set: { face: 'smile' } },
  { id: 'f_grin', cat: 'face', name: '활짝 웃음', price: 3000, set: { face: 'grin' } },
  { id: 'f_calm', cat: 'face', name: '느긋한 표정', price: 3000, set: { face: 'calm' } },
  { id: 'f_wink', cat: 'face', name: '윙크', price: 5000, set: { face: 'wink' } },
];
export const SKIN_TONES = [0xf6d8c0, 0xe9c6a2, 0xd8a878, 0xb07a50, 0x7a4a2a];

export function ensureLook(S) {
  S.look = Object.assign({}, LOOK_DEFAULT, S.look || {});
  S.wardrobe = S.wardrobe || OUTFITS.filter(o => o.price === 0).map(o => o.id);
  S.wearing = S.wearing || { hair: 'h_basic', top: 't_basic', pants: 'p_basic', shoes: 's_basic', hat: 'c_none', face: 'f_smile' };
  return S.look;
}
export function wear(S, id) {
  const o = OUTFITS.find(x => x.id === id);
  if (!o || !S.wardrobe.includes(id)) return false;
  Object.assign(S.look, o.set);
  S.wearing[o.cat] = id;
  return true;
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
export function swatch(o) {
  const v = Object.values(o.set).filter(x => typeof x === 'number');
  if (o.cat === 'face') return { smile: '🙂', grin: '😁', calm: '😌', wink: '😉' }[o.set.face];
  if (o.cat === 'hat' && o.set.hat == null) return '🚫';
  return `<span style="display:inline-flex;gap:2px">${v.slice(0, 3).map(c => `<i style="display:inline-block;width:14px;height:22px;border-radius:5px;background:${hex(c)};border:1px solid rgba(255,255,255,.3)"></i>`).join('')}</span>`;
}

import { OFFICE_RANKS } from './config.js';

const KEY = 'citylife_save_v1';
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export function newState() {
  return {
    v: 1,
    name: '나',
    money: 80000,
    cash: 20000,                   // 지갑 현금
    minutes: 7 * 60 + 30,          // 1일차 07:30부터
    hunger: 75, energy: 85, mood: 70,
    fitness: 0,
    officeRank: 0, officeExp: 0, officeHired: false, lastWorkDay: -1, shiftsToday: 0,
    studyExp: 0,
    martShifts: 0, deliveries: 0,
    inventory: { food: {}, furniture: {}, ing: {} },
    homes: ['oneroom'], home: 'oneroom',
    placed: {
      oneroom: [
        { uid: 1, id: 'bed', x: -2.15, z: -2.1, rot: 0 },
        { uid: 2, id: 'fridge', x: -2.4, z: 2.55, rot: 1 },
      ],
      apt: [], pent: [],
    },
    nextUid: 10,
    cars: [], car: null, carPos: null,
    player: null,
    totalEarned: 0,
    settings: { quality: null, sound: true },
    stats: { daysLived: 0 },
    tutorial: true,
    mapVer: 3,
  };
}

// 저장: 본 저장 + 백업 저장 두 군데. 본 저장이 깨지면 백업에서 복구
const BAK = KEY + '_bak';
export let saveStatus = { ok: true, recovered: false, lastSave: 0 };
function parse(raw) {
  if (!raw) return null;
  const s = JSON.parse(raw);
  if (!s || typeof s !== 'object' || typeof s.minutes !== 'number' || typeof s.money !== 'number') throw new Error('bad save');
  return s;
}
export function load() {
  let s = null;
  try { s = parse(localStorage.getItem(KEY)); } catch (e) {
    try { s = parse(localStorage.getItem(BAK)); saveStatus.recovered = !!s; } catch (e2) { s = null; }
  }
  if (!s) return null;
  const base = newState();
  const out = Object.assign(base, s, {
    inventory: Object.assign(base.inventory, s.inventory || {}), placed: Object.assign(base.placed, s.placed || {}),
    settings: Object.assign(base.settings, s.settings || {}), stats: Object.assign(base.stats, s.stats || {}),
  });
  if (!Number.isFinite(out.money)) out.money = 0;
  for (const k of ['hunger', 'energy', 'mood']) if (!Number.isFinite(out[k])) out[k] = 60;
  return out;
}
let saveN = 0;
export function save(s) {
  try {
    const raw = JSON.stringify(s);
    localStorage.setItem(KEY, raw);
    if (++saveN % 3 === 1) localStorage.setItem(BAK, raw);   // 가끔 백업도 갱신
    saveStatus.ok = true; saveStatus.lastSave = Date.now();
    return true;
  } catch (e) { saveStatus.ok = false; return false; }
}
export function wipe() { try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch (e) {} }

export function day(s) { return Math.floor(s.minutes / 1440) + 1; }
export function hour(s) { return (s.minutes % 1440) / 60; }
export function weekday(s) { return DAYS[(day(s) - 1) % 7]; }
export function isWeekend(s) { return (day(s) - 1) % 7 >= 5; }
export function clock(s) {
  const m = Math.floor(s.minutes % 1440);
  const h = Math.floor(m / 60), mm = m % 60;
  const ap = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { text: `${ap} ${h12}:${String(mm).padStart(2, '0')}`, h, mm };
}
export function rank(s) { return OFFICE_RANKS[Math.min(s.officeRank, OFFICE_RANKS.length - 1)]; }

// 시간 경과에 따른 욕구 변화. rates: 시간당 변화량
export function passTime(s, minutes, mode = 'idle') {
  const hrs = minutes / 60;
  const r = {
    idle: { hunger: -4.2, energy: -3.2, mood: -0.8 },
    walk: { hunger: -4.6, energy: -3.8, mood: -0.5 },
    run: { hunger: -7, energy: -9, mood: 0 },
    drive: { hunger: -4, energy: -3.4, mood: 0.4 },
    work: { hunger: -6, energy: -7, mood: -3.5 },
    sleep: { hunger: -1.8, energy: 13, mood: 1 },
    rest: { hunger: -3.5, energy: 5, mood: 6 },
    fun: { hunger: -4, energy: -2, mood: 14 },
    gym: { hunger: -9, energy: -14, mood: 16 },
  }[mode];
  const before = Math.floor(s.minutes / 1440);
  s.minutes += minutes;
  s.hunger = clamp(s.hunger + r.hunger * hrs);
  s.energy = clamp(s.energy + r.energy * hrs * (s.hunger <= 0 ? 1.8 : 1));
  s.mood = clamp(s.mood + r.mood * hrs - (s.hunger < 15 ? 2 * hrs : 0) - (s.energy < 15 ? 2 * hrs : 0));
  if (s.sick) { s.energy = clamp(s.energy - (mode === 'sleep' ? 3 : 2.2) * hrs); s.mood = clamp(s.mood - 1.2 * hrs); }
  const after = Math.floor(s.minutes / 1440);
  if (after > before) { s.stats.daysLived += after - before; s.shiftsToday = 0; }
}
export function clamp(v, a = 0, b = 100) { return Math.max(a, Math.min(b, v)); }
export { DAYS };

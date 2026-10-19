import { OFFICE_RANKS } from './config.js';

const KEY = 'citylife_save_v1';
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export function newState() {
  return {
    v: 1,
    name: '나',
    money: 80000,
    minutes: 7 * 60 + 30,          // 1일차 07:30부터
    hunger: 75, energy: 85, mood: 70,
    fitness: 0,
    officeRank: 0, officeExp: 0, officeHired: false, lastWorkDay: -1, shiftsToday: 0,
    studyExp: 0,
    martShifts: 0, deliveries: 0,
    inventory: { food: {}, furniture: {} },
    homes: ['oneroom'], home: 'oneroom',
    placed: {
      oneroom: [
        { uid: 1, id: 'bed', x: -2.6, z: -2.75, rot: 0 },
        { uid: 2, id: 'fridge', x: -3.05, z: 3.5, rot: 1 },
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
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const base = newState();
    return Object.assign(base, s, { inventory: Object.assign(base.inventory, s.inventory || {}), placed: Object.assign(base.placed, s.placed || {}), settings: Object.assign(base.settings, s.settings || {}) });
  } catch (e) { return null; }
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} }

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
  const after = Math.floor(s.minutes / 1440);
  if (after > before) { s.stats.daysLived += after - before; s.shiftsToday = 0; }
}
export function clamp(v, a = 0, b = 100) { return Math.max(a, Math.min(b, v)); }
export { DAYS };

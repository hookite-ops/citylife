// ───────── 건물 실내 설계도 (순수 데이터) ─────────
// 건물 하나의 층·코어·엘리베이터·계단·호실을 시드로 만들어요.
// 로컬 좌표: 건물 가운데가 원점, +z = 정면(바깥쪽), +x = 정면을 바라볼 때 오른쪽(밖에서 볼 때 왼→오른쪽)
import { seeded } from './geo.js';
import { tenantOf, TYPES } from './tenants.js';

const Y_BASE = 0.18;
export const WALL_T = 0.16;

// 건물 나이·등급
export function bmeta(s) {
  const R = seeded(s.seed * 17 + 3);
  const range = { apt: [2, 30], office: [1, 25], shop: [1, 32], podium: [1, 20], villa: [3, 35], tower: [1, 10], civic: [5, 22] }[s.type] || [3, 25];
  const age = Math.round(range[0] + R() * (range[1] - range[0]));
  const grade = age < 8 ? 'A' : age < 20 ? 'B' : 'C';
  return { age, grade, built: 2026 - age };
}

// 정면 기준 회전값 · 길이
const FACE_ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
function frame(s, front) {
  const rot = FACE_ROT[front];
  const ew = s.x1 - s.x0, ns = s.z1 - s.z0;
  const L = front === 'S' || front === 'N' ? ew : ns, D = front === 'S' || front === 'N' ? ns : ew;
  return { rot, L, D, cx: (s.x0 + s.x1) / 2, cz: (s.z0 + s.z1) / 2 };
}
// 월드 방향 키 → 로컬 면 (F 정면 · B 뒤 · L 왼쪽(-x) · R 오른쪽(+x))
const WN = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
export function localSide(rot, key) {
  const [nx, nz] = WN[key]; const c = Math.cos(rot), sn = Math.sin(rot);
  const lx = nx * c - nz * sn, lz = nx * sn + nz * c;
  return lz > 0.5 ? 'F' : lz < -0.5 ? 'B' : lx > 0.5 ? 'R' : 'L';
}
export function toLocalPt(B, wx, wz) { const c = Math.cos(B.rot), sn = Math.sin(B.rot); const dx = wx - B.cx, dz = wz - B.cz; return [dx * c - dz * sn, dx * sn + dz * c]; }
export function toWorldPt(B, lx, lz) { const c = Math.cos(B.rot), sn = Math.sin(B.rot); return [B.cx + lx * c + lz * sn, B.cz - lx * sn + lz * c]; }

// 1층 상가 칸 나누기 (건물 겉모습 shopRow와 같은 규칙)
export function shopUnits(s) {
  const f = s.front || 'S';
  const L = f === 'S' || f === 'N' ? s.x1 - s.x0 : s.z1 - s.z0;
  const n = Math.max(1, Math.round(L / (s.unitW || 7)));
  return { n, uw: L / n, L };
}
// 출입구 칸 (1층에서 위층으로 가는 로비)
export function lobbyUnit(s) {
  const { n } = shopUnits(s);
  if (n < 2) return -1;
  return (s.seed % 2) ? n - 1 : 0;
}
// 위층 칸 수
export function upperUnits(L) { return Math.max(1, Math.min(4, Math.round(L / 9))); }
export function hasBasementShop(s) { return (s.type === 'shop' || s.type === 'podium') && !s.mall && !s.officePodium && (s.seed % 7) < 3; }

// 사각형 빼기 (겹치지 않는 조각들)
export function subRect(o, i) {
  const out = [];
  const ix0 = Math.max(o.x0, i.x0), ix1 = Math.min(o.x1, i.x1), iz0 = Math.max(o.z0, i.z0), iz1 = Math.min(o.z1, i.z1);
  if (ix1 <= ix0 || iz1 <= iz0) return [o];
  if (iz0 > o.z0) out.push({ ...o, z1: iz0 });
  if (iz1 < o.z1) out.push({ ...o, z0: iz1 });
  if (ix0 > o.x0) out.push({ ...o, x1: ix0, z0: iz0, z1: iz1 });
  if (ix1 < o.x1) out.push({ ...o, x0: ix1, z0: iz0, z1: iz1 });
  return out.filter(r => r.x1 - r.x0 > 0.05 && r.z1 - r.z0 > 0.05);
}

// ───────── 건물 정보 ─────────
// meta: { name, kind: 'shop'|'office'|'apt'|'villa'|'tower'|'mall'|'civic', podium?, tower?, hall? }
export function describe(s, meta = {}) {
  const kind = meta.kind || s.type;
  const front = meta.front || s.front || 'S';
  const fr = frame(s, front);
  const m = bmeta(s);
  const B = { id: s.seed, spec: s, kind, name: meta.name || '건물', front, ...fr, ...m, y0: s.y0, meta, banks: [], floors: [] };
  const fl = (n, y, h, extra = {}) => B.floors.push({ n, y, h, ...extra });
  switch (kind) {
    case 'shop': {
      const gh = s.groundH || 4.6;
      if (hasBasementShop(s)) fl(-1, s.y0 - 4.0, 4.0);
      fl(1, s.y0, gh);
      for (let k = 0; k < s.floors; k++) fl(2 + k, s.y0 + gh + k * s.fh, s.fh);
      const top = 1 + s.floors;
      fl(top + 1, s.y0 + gh + s.floors * s.fh, 3, { roof: true });
      if (top >= 4) {
        const all = B.floors.filter(f => !f.roof).map(f => f.n);
        B.banks.push({ id: 'A', cars: s.type === 'podium' && top > 6 ? 2 : 1, serves: all, speed: top > 8 ? 2.5 : 1.6, name: '엘리베이터' });
      }
      B.top = top; B.roofOpen = true;
      break;
    }
    case 'office': {
      const nb = s.floors > 24 ? 4 : s.floors > 12 ? 3 : 2;
      for (let k = nb; k >= 1; k--) fl(-k, s.y0 - 3.6 * k, 3.6, { parking: true });
      for (let k = 1; k <= s.floors; k++) fl(k, s.y0 + (k - 1) * s.fh, s.fh);
      fl(s.floors + 1, s.y0 + s.floors * s.fh, 3, { roof: true });
      const all = B.floors.filter(f => !f.roof).map(f => f.n);
      if (s.floors > 20) {
        const mid = Math.floor(s.floors / 2);
        B.banks.push({ id: 'A', cars: 4, serves: all.filter(n => n <= mid), speed: 2.5, name: `저층용 (B${nb}~${mid}층)` });
        B.banks.push({ id: 'B', cars: 4, serves: [1, ...all.filter(n => n > mid)], speed: 6, name: `고층용 (1층 · ${mid + 1}~${s.floors}층)`, express: true });
      } else B.banks.push({ id: 'A', cars: 4, serves: all, speed: 2.5, name: '엘리베이터' });
      B.top = s.floors; B.roofOpen = true;
      break;
    }
    case 'apt': {
      if (B.age < 22) for (let k = 2; k >= 1; k--) fl(-k, s.y0 - 3.4 * k, 3.4, { parking: true });
      for (let k = 1; k <= s.floors; k++) fl(k, s.y0 + (k - 1) * s.fh, s.fh);
      fl(s.floors + 1, s.y0 + s.floors * s.fh, 3, { roof: true });
      const all = B.floors.filter(f => !f.roof).map(f => f.n);
      B.banks.push({ id: 'A', cars: s.floors >= 25 ? 2 : 1, serves: all, speed: s.floors > 20 ? 2.5 : 1.75, name: '엘리베이터' });
      B.top = s.floors; B.roofOpen = false; B.residential = true;
      break;
    }
    case 'villa': {
      fl(1, s.y0, 2.8, { pilotis: true });
      for (let k = 0; k < s.floors; k++) fl(2 + k, s.y0 + 2.8 + k * s.fh, s.fh);
      fl(2 + s.floors, s.y0 + 2.8 + s.floors * s.fh, 3, { roof: true });
      B.top = 1 + s.floors; B.roofOpen = true; B.residential = true;
      break;
    }
    case 'tower': {
      // 1층 로비는 포디움 안 (지면), 2~3층은 상가라 엘리베이터가 서지 않아요
      const pod = meta.podium;
      for (let k = 3; k >= 1; k--) fl(-k, pod.y0 - 3.6 * k, 3.6, { parking: true });
      fl(1, pod.y0, 5, { lobby: true });
      for (let k = 0; k < s.floors; k++) fl(4 + k, s.y0 + k * s.fh, s.fh);
      const top = 3 + s.floors;
      fl(top + 1, s.y0 + s.floors * s.fh, 3, { roof: true });
      const mid = 4 + Math.floor(s.floors / 2);
      const low = B.floors.filter(f => !f.roof && f.n <= mid).map(f => f.n);
      const high = [1, ...B.floors.filter(f => !f.roof && f.n > mid).map(f => f.n)];
      B.banks.push({ id: 'A', cars: 3, serves: low, speed: 3, name: `저층용 (B3~${mid}층)` });
      B.banks.push({ id: 'B', cars: 2, serves: high, speed: 7.5, name: `고층 직행 (1층 · ${mid + 1}~${top}층)`, express: true });
      B.top = top; B.roofOpen = false; B.residential = true;
      // 로비는 타워 정면(포디움 가장자리 쪽)으로 길게
      B.lobbyLen = meta.lobbyLen || 22;
      break;
    }
    case 'mall': {
      const gh = s.groundH || 5;
      for (let k = 3; k >= 1; k--) fl(-k, s.y0 - 3.6 * k, 3.6, { parking: true });
      fl(1, s.y0, gh);
      for (let k = 0; k < s.floors; k++) fl(2 + k, s.y0 + gh + k * s.fh, s.fh);
      fl(2 + s.floors, s.y0 + gh + s.floors * s.fh + 0.3, 3, { roof: true, garden: true });
      const all = B.floors.filter(f => !f.roof).map(f => f.n);
      B.banks.push({ id: 'A', cars: 2, serves: [...all, 2 + s.floors], speed: 1.75, name: '엘리베이터' });
      B.top = 1 + s.floors; B.roofOpen = true;
      break;
    }
    case 'civic': {
      for (let k = 1; k <= s.floors; k++) fl(k, s.y0 + (k - 1) * s.fh, s.fh);
      fl(s.floors + 1, s.y0 + s.floors * s.fh, 3, { roof: true });
      B.banks.push({ id: 'A', cars: 3, serves: B.floors.filter(f => !f.roof).map(f => f.n), speed: 2, name: '엘리베이터' });
      B.top = s.floors; B.roofOpen = true;
      break;
    }
  }
  B.floors.sort((a, b) => a.n - b.n);
  B.floorOf = (n) => B.floors.find(f => f.n === n);
  return B;
}
export const floorLabel = (n, B) => (B && B.floorOf(n)?.roof) ? '옥상' : n < 0 ? `B${-n}` : `${n}층`;
export const floorShort = (n, B) => (B && B.floorOf(n)?.roof) ? 'R' : n < 0 ? `B${-n}` : `${n}`;

// ───────── 설계도 만들기 ─────────
class Plan {
  constructor(B, n) {
    const f = B.floorOf(n);
    this.B = B; this.n = n; this.y = f.y; this.h = f.h; this.f = f;
    this.ch = f.roof ? 3 : Math.min(f.h - 0.35, f.n === 1 ? 3.8 : 2.75 + Math.max(0, f.h - 3.3) * 0.6);
    this.W = B.L; this.D = B.D;
    this.rooms = []; this.doors = []; this.feats = []; this.elevs = []; this.ext = { F: 'none', B: 'none', L: 'none', R: 'none' };
    this.grade = B.grade; this.old = B.grade === 'C'; this.lux = B.grade === 'A';
    this.R = seeded(B.id * 13 + (n + 9) * 101);
  }
  room(o) { const r = { grp: 'r' + this.rooms.length, floor: this.old ? 'oldtile' : 'tile', wall: this.old ? [0.86, 0.84, 0.78] : [0.95, 0.95, 0.93], light: this.old ? 'tube' : 'panel', ...o }; this.rooms.push(r); return r; }
  door(o) { const d = { w: 1.0, h: 2.1, kind: 'wood', ...o }; this.doors.push(d); return d; }
  feat(o) { this.feats.push(o); return o; }
  // 엘리베이터 칸: (cx, 문 z 또는 x) 방향 face = 홀 쪽
  elev(bank, car, x, z, face, w = 1.9, d = 1.9) { const e = { bank, car, x, z, face, w, d }; this.elevs.push(e); this.door({ x, z, ax: face[0] ? 'z' : 'x', w: 1.0, h: 2.1, kind: 'elev', bank, car }); return e; }
}
const hallWall = (p) => p.old ? [0.84, 0.82, 0.76] : p.lux ? [0.9, 0.88, 0.84] : [0.93, 0.93, 0.91];
const hallFloor = (p) => p.old ? 'oldtile' : p.lux ? 'stone' : 'tile';

// 계단실 방 (계단 오르내리는 곳) — door: 홀 쪽 문 위치
function stairs(p, x0, z0, x1, z1, dx, dz, ax, face) {
  p.room({ x0, z0, x1, z1, kind: 'stairs', grp: 'stairs', floor: 'concrete', wall: [0.9, 0.9, 0.88], light: 'tube', face });
  p.door({ x: dx, z: dz, ax, w: 0.95, h: 2.1, kind: 'fire', label: '비상계단' });
}

// 건물 전체 입점 가게 (같은 업종이 겹치지 않게)
const MULTI = new Set(['clinic', 'academy', 'office', 'dental']);
const _tm = new Map();
export function clearTenants(id) { if (id === undefined) _tm.clear(); else _tm.delete(id); }
export function tenantMap(B) {
  let m = _tm.get(B.id);
  if (m) return m;
  m = new Map();
  const used = new Map(), slots = new Set();
  for (const f of B.floors) {
    if (f.roof || f.parking) continue;
    const p = planFloor(B, f.n, true);
    for (const r of p.rooms) {
      if (r.kind !== 'unit' || r.home || r.tenant) continue;
      let t;
      for (let a = 0; a < 6; a++) {
        t = tenantOf(B.id, f.n, r.k, r.x1 - r.x0, B.grade, B.kind, a);
        if (t.vacant || t.override || ((MULTI.has(t.type) || !used.has(t.type)) && !slots.has(t.slot))) break;
      }
      if (!t.vacant) { used.set(t.type, (used.get(t.type) || 0) + 1); slots.add(t.slot); }
      m.set(`${f.n}:${r.k}`, t);
    }
  }
  if (_tm.size > 400) _tm.clear();
  _tm.set(B.id, m);
  return m;
}

export function planFloor(B, n, raw = false) {
  const p = new Plan(B, n);
  const f = p.f;
  if (f.roof) roofPlan(p);
  else if (f.parking) parkingPlan(p);
  else switch (B.kind) {
    case 'shop': shopPlan(p); break;
    case 'office': officePlan(p); break;
    case 'apt': aptPlan(p); break;
    case 'villa': villaPlan(p); break;
    case 'tower': towerPlan(p); break;
    case 'mall': mallPlan(p); break;
    case 'civic': civicPlan(p); break;
  }
  // 호실마다 가게
  if (!raw) { const tm = tenantMap(B); for (const r of p.rooms) if (r.kind === 'unit' && !r.home && !r.tenant) r.tenant = tm.get(`${n}:${r.k}`) || tenantOf(B.id, n, r.k, r.x1 - r.x0, B.grade, B.kind); }
  return p;
}

// ── 코어 (가운데 뒤쪽): 엘리베이터 + 계단 ── (상가·주상복합 공용)
function shopCore(p, zc) {
  const B = p.B, D = p.D;
  const bank = B.banks[0];
  const zb = -D / 2;
  if (bank) {
    for (let c = 0; c < bank.cars; c++) { const cx = -2.5 + c * 2.0; p.elev('A', c, cx, zc, [0, 1], 1.8, 1.8); }
    p.room({ x0: -3.6, z0: zb, x1: 0.6, z1: zc, kind: 'shaft' });
  } else p.room({ x0: -3.6, z0: zb, x1: 0.6, z1: zc, kind: 'store', label: '창고', floor: 'concrete' });
  stairs(p, 0.6, zb, 3.6, zc, 2.1, zc, 'x', [0, 1]);
}

// ───────── 근린상가 ─────────
function shopPlan(p) {
  const B = p.B, s = B.spec, L = p.W, D = p.D, n = p.n;
  const hw = L / 2, hd = D / 2;
  const zc = -hd + 5, zf = zc + 2;   // 코어 앞선, 복도 앞선
  const streets = (s.streets || [B.front]).map(k => localSide(B.rot, k));
  const upperStyle = s.upper === 'curtain' ? 'curtain' : 'ribbon';
  for (const sd of streets) p.ext[sd] = n === 1 ? (sd === 'F' ? 'store' : 'ribbon') : n < 0 ? 'none' : upperStyle;
  p.ext.B = 'none';
  const hall = 'hall';
  shopCore(p, zc);
  // 복도
  p.room({ x0: -hw, z0: zc, x1: hw, z1: zf, kind: 'hall', grp: hall, floor: hallFloor(p), wall: hallWall(p) });
  // 뒤쪽 양옆: 화장실 · 작은 칸
  if (-3.6 - -hw > 2.4) { p.room({ x0: -hw, z0: -hd, x1: -3.6, z1: zc, kind: 'wc', label: '화장실', floor: 'tile', wall: [0.9, 0.93, 0.95] }); p.door({ x: (-hw - 3.6) / 2, z: zc, ax: 'x', w: 0.9, kind: 'wood', label: '화장실' }); }
  else p.room({ x0: -hw, z0: -hd, x1: -3.6, z1: zc, kind: 'shaft' });
  if (hw - 3.6 > 4) {
    const r = p.room({ x0: 3.6, z0: -hd, x1: hw, z1: zc, kind: 'unit', k: 90, back: true });
    p.door({ x: (3.6 + hw) / 2, z: zc, ax: 'x', w: 1.0, kind: 'glass', unit: r });
  } else p.room({ x0: 3.6, z0: -hd, x1: hw, z1: zc, kind: 'store', label: '창고', floor: 'concrete' });
  // 앞쪽 칸
  if (n === 1) {
    const { n: nu, uw } = shopUnits(s);
    const li = lobbyUnit(s);
    for (let i = 0; i < nu; i++) {
      const x0 = -hw + i * uw, x1 = x0 + uw, cx = x0 + uw / 2;
      if (i === li) {
        p.room({ x0, z0: zf, x1, z1: hd, kind: 'lobby', grp: hall, floor: hallFloor(p), wall: hallWall(p) });
        p.door({ x: cx, z: hd, ax: 'x', w: Math.min(1.8, uw * 0.3), h: 2.3, kind: 'glass2', exit: true, label: B.name });
        p.feat({ kind: 'directory', x: x1 - 0.1, z: (zf + hd) / 2, rot: -Math.PI / 2 });
        p.feat({ kind: 'mailbox', x: x0 + 0.1, z: (zf + hd) / 2, rot: Math.PI / 2, n: Math.min(12, (B.top - 1) * 3) });
        continue;
      }
      const r = p.room({ x0, z0: zf, x1, z1: hd, kind: 'unit', k: i, front: true });
      p.door({ x: cx, z: hd, ax: 'x', w: Math.min(1.7, uw * 0.3), h: 2.3, kind: 'glass', exit: true, unit: r });
    }
  } else if (n < 0) {
    const k = L > 20 ? 2 : 1, uw = L / k;
    for (let i = 0; i < k; i++) { const x0 = -hw + i * uw, r = p.room({ x0, z0: zf, x1: x0 + uw, z1: hd, kind: 'unit', k: i }); p.door({ x: x0 + uw / 2, z: zf, ax: 'x', w: 1.4, kind: 'glass', unit: r }); }
  } else {
    const k = upperUnits(L), uw = L / k;
    for (let i = 0; i < k; i++) {
      const x0 = -hw + i * uw, r = p.room({ x0, z0: zf, x1: x0 + uw, z1: hd, kind: 'unit', k: i });
      p.door({ x: Math.max(x0 + 1, Math.min(x0 + uw - 1, k === 1 ? 0.8 : x0 + uw / 2)), z: zf, ax: 'x', w: 1.2, kind: 'glass', unit: r });
    }
  }
  p.feat({ kind: 'extinguisher', x: -3.4, z: zc + 0.25 });
  p.feat({ kind: 'exit', x: 2.1, z: zc + 0.02, y: 2.35 });
}

// ───────── 오피스 ─────────
function officeCore(p) {
  const B = p.B, ch = p.ch;
  const A = B.banks[0], Bb = B.banks[1];
  const lobbyG = 'core';
  p.room({ x0: -4.6, z0: -1.7, x1: 4.6, z1: 1.7, kind: 'ehall', grp: lobbyG, floor: hallFloor(p) === 'tile' ? 'stone' : hallFloor(p), wall: [0.82, 0.8, 0.76], light: 'panel' });
  for (const sx of [-1, 1]) p.room({ x0: sx < 0 ? -8 : 4.6, z0: -1.7, x1: sx < 0 ? -4.6 : 8, z1: 1.7, kind: 'ehall', grp: lobbyG, floor: hallFloor(p) === 'tile' ? 'stone' : hallFloor(p), wall: [0.82, 0.8, 0.76] });
  const xs = [-3.3, -1.1, 1.1, 3.3];
  if (A && A.serves.includes(p.n)) for (let c = 0; c < A.cars; c++) p.elev('A', c, xs[c], -1.7, [0, 1], 1.9, 2.0);
  p.room({ x0: -4.6, z0: -5, x1: 4.6, z1: -1.7, kind: 'shaft' });
  if (Bb && Bb.serves.includes(p.n)) for (let c = 0; c < Bb.cars; c++) p.elev('B', c, xs[c], 1.7, [0, -1], 1.9, 2.0);
  p.room({ x0: -4.6, z0: 1.7, x1: 4.6, z1: 5, kind: 'shaft' });
  stairs(p, -8, -5, -4.6, -1.7, -6.3, -1.7, 'x', [0, 1]);
  p.room({ x0: -8, z0: 1.7, x1: -4.6, z1: 5, kind: 'wc', label: '남자 화장실', floor: 'tile', wall: [0.88, 0.92, 0.96] }); p.door({ x: -6.3, z: 1.7, ax: 'x', w: 0.9, label: '남자 화장실' });
  p.room({ x0: 4.6, z0: 1.7, x1: 8, z1: 5, kind: 'wc', label: '여자 화장실', floor: 'tile', wall: [0.96, 0.9, 0.92] }); p.door({ x: 6.3, z: 1.7, ax: 'x', w: 0.9, label: '여자 화장실' });
  p.room({ x0: 4.6, z0: -5, x1: 8, z1: -1.7, kind: 'pantry', label: '탕비실', floor: 'tile' }); p.door({ x: 6.3, z: -1.7, ax: 'x', w: 0.9, label: '탕비실' });
  // 코어 양 끝은 열린 통로
  p.door({ x: -8, z: 0, ax: 'z', w: 3.2, h: ch, kind: 'open' });
  p.door({ x: 8, z: 0, ax: 'z', w: 3.2, h: ch, kind: 'open' });
  p.feat({ kind: 'exit', x: -6.3, z: -1.68, y: 2.35 });
}
function officePlan(p) {
  const B = p.B, s = B.spec, hw = p.W / 2, hd = p.D / 2;
  for (const k of ['F', 'B', 'L', 'R']) p.ext[k] = 'curtain';
  officeCore(p);
  const g = p.n === 1 ? 'lobby' : 'office';
  const fl = p.n === 1 ? 'stone' : 'carpet';
  const wc = p.n === 1 ? [0.92, 0.9, 0.86] : [0.95, 0.95, 0.94];
  const kind = p.n === 1 ? 'olobby' : 'office';
  p.room({ x0: -hw, z0: -hd, x1: hw, z1: -5, kind, grp: g, floor: fl, wall: wc });
  p.room({ x0: -hw, z0: 5, x1: hw, z1: hd, kind, grp: g, floor: fl, wall: wc });
  p.room({ x0: -hw, z0: -5, x1: -8, z1: 5, kind, grp: g, floor: fl, wall: wc });
  p.room({ x0: 8, z0: -5, x1: hw, z1: 5, kind, grp: g, floor: fl, wall: wc });
  if (p.n === 1) {
    p.door({ x: 0, z: hd, ax: 'x', w: 3.2, h: 2.6, kind: 'auto', exit: true, label: B.name });
    p.feat({ kind: 'gates', x: -8, z: 0, ax: 'z', w: 3.2 });
    p.feat({ kind: 'gates', x: 8, z: 0, ax: 'z', w: 3.2 });
    p.feat({ kind: 'reception', x: 0, z: hd - 5, rot: 0, label: '안내 데스크' });
    p.feat({ kind: 'directory', x: -hw + 0.12, z: 7, rot: Math.PI / 2 });
    p.feat({ kind: 'sofas', x: -hw + 5, z: hd - 4 });
    p.feat({ kind: 'sofas', x: hw - 5, z: -hd + 4 });
    for (const [x, z] of [[-hw + 1.2, hd - 1.2], [hw - 1.2, hd - 1.2], [-hw + 1.2, -hd + 1.2], [hw - 1.2, -hd + 1.2]]) p.feat({ kind: 'plant', x, z, h: 1.8 });
    // 1층 카페 (로비 쪽은 유리)
    const r = p.room({ x0: hw - 9, z0: 5, x1: hw, z1: hd, kind: 'unit', k: 0, glassFront: 'L' });
    r.tenant = { ...tenantOf(B.id, 1, 0, 9, 'A', 'shop'), type: 'cafe', name: '라운지 카페', color: '#4e342e', slot: 58 };
    p.rooms.find(q => q.kind === 'olobby' && q.z0 === 5).x1 = hw - 9;
    p.door({ x: hw - 9, z: (5 + hd) / 2, ax: 'z', w: 1.6, kind: 'open', unit: r });
  } else {
    p.office = true;   // 회사 층 (6단계에서 회사 배정)
  }
}

// ───────── 아파트 (복도식 · 계단실 가운데) ─────────
function aptPlan(p) {
  const B = p.B, hw = p.W / 2, hd = p.D / 2, n = p.n;
  p.ext.F = 'balcony'; p.ext.B = p.old ? 'open' : 'punched'; p.ext.L = 'punched'; p.ext.R = 'punched';
  const zcor = -hd + 1.6;
  const hall = 'hall';
  // 가운데 홀 + 엘리베이터 + 계단
  p.room({ x0: -3.5, z0: -hd, x1: 3.5, z1: -1.0, kind: n === 1 ? 'alobby' : 'hall', grp: hall, floor: hallFloor(p), wall: hallWall(p) });
  const A = B.banks[0];
  for (let c = 0; c < A.cars; c++) p.elev('A', c, -2.2 + c * 2.2, -1.0, [0, -1], 1.8, 1.8);
  p.room({ x0: -3.5, z0: -1.0, x1: 1.2, z1: hd, kind: 'shaft' });
  stairs(p, 1.2, -1.0, 3.5, hd, 2.35, -1.0, 'x', [0, -1]);
  // 복도
  p.room({ x0: -hw, z0: -hd, x1: -3.5, z1: zcor, kind: 'hall', grp: hall, floor: hallFloor(p), wall: hallWall(p) });
  p.room({ x0: 3.5, z0: -hd, x1: hw, z1: zcor, kind: 'hall', grp: hall, floor: hallFloor(p), wall: hallWall(p) });
  // 세대
  let k = 0;
  const side = (x0, x1, dir) => {
    const w = x1 - x0, m = Math.max(1, Math.min(3, Math.round(w / 11))), uw = w / m;
    for (let i = 0; i < m; i++) {
      const a = x0 + i * uw;
      const r = p.room({ x0: a, z0: zcor, x1: a + uw, z1: hd, kind: 'unit', home: true, k: k++ });
      p.door({ x: dir < 0 ? a + uw - 1.2 : a + 1.2, z: zcor, ax: 'x', w: 1.0, kind: 'steel', unit: r });
    }
  };
  side(-hw, -3.5, -1); side(3.5, hw, 1);
  // 호수 번호: 서쪽부터 1, 2, 3...
  const units = p.rooms.filter(r => r.home).sort((a, b) => a.x0 - b.x0);
  units.forEach((r, i) => { r.num = `${n}${String(i + 1).padStart(2, '0')}호`; });
  if (n === 1) {
    p.door({ x: 0, z: -hd, ax: 'x', w: 1.8, h: 2.3, kind: 'auto', exit: true, label: '공동현관', secure: true });
    p.feat({ kind: 'mailbox', x: -3.4, z: -3.0, rot: Math.PI / 2, n: Math.min(40, B.top * units.length) });
    p.feat({ kind: 'parcel', x: 3.4, z: -3.0, rot: -Math.PI / 2 });
    p.feat({ kind: 'keypad', x: 1.3, z: -hd + 0.12, rot: 0 });
    p.feat({ kind: 'guardbooth', x: -2.4, z: -hd + 1.2, rot: 0 });
  }
  p.feat({ kind: 'extinguisher', x: 3.3, z: -1.25 });
  p.feat({ kind: 'floorsign', x: 0, z: -1.02, y: 2.3, rot: Math.PI, text: `${n}F` });
}

// ───────── 빌라 (필로티 + 계단실) ─────────
function villaPlan(p) {
  const B = p.B, s = B.spec, hw = p.W / 2, hd = p.D / 2, n = p.n;
  // 계단실: 월드 NE 모서리 (x1-4.2..x1-0.2, z0..z0+4) → 로컬
  const c1 = toLocalPt(B, s.x1 - 4.2, s.z0), c2 = toLocalPt(B, s.x1 - 0.2, s.z0 + 4);
  const sx0 = Math.max(-hw, Math.min(c1[0], c2[0])), sx1 = Math.min(hw, Math.max(c1[0], c2[0]));
  const sz0 = Math.max(-hd, Math.min(c1[1], c2[1])), sz1 = Math.min(hd, Math.max(c1[1], c2[1]));
  // 계단실 문은 건물 안쪽을 향함
  const inX = Math.abs(sx0 + hw) < 0.5 ? 1 : Math.abs(sx1 - hw) < 0.5 ? -1 : 0;
  const inZ = Math.abs(sz0 + hd) < 0.5 ? 1 : Math.abs(sz1 - hd) < 0.5 ? -1 : 0;
  const sdx = inX > 0 ? sx1 : sx0, sdz = inZ > 0 ? sz1 : sz0;
  const stR = { x0: sx0, z0: sz0, x1: sx1, z1: sz1 };
  if (n === 1) {
    // 필로티 주차장 (계단실 빼고)
    for (const r of subRect({ x0: -hw, z0: -hd, x1: hw, z1: hd }, stR)) p.room({ ...r, kind: 'pilotis', grp: 'out', floor: 'concrete', wall: [0.75, 0.75, 0.72], light: 'tube', open: true });
    p.room({ ...stR, kind: 'stairs', grp: 'stairs', floor: 'concrete', wall: [0.9, 0.9, 0.88], light: 'tube', villa: true });
    p.door({ x: inX ? sdx : (sx0 + sx1) / 2, z: inX ? (sz0 + sz1) / 2 : sdz, ax: inX ? 'z' : 'x', w: 1.0, kind: 'steel', label: '공동현관', secure: true });
    p.exitOpen = true; // 필로티는 사방이 열려 있어요 → 어디로든 나가기
    for (const [x, z] of [[-hw + 0.3, -hd + 0.3], [hw - 0.3, -hd + 0.3], [-hw + 0.3, hd - 0.3], [hw - 0.3, hd - 0.3]]) p.feat({ kind: 'pillar', x, z, s: 0.5, h: 2.8 });
    p.feat({ kind: 'car', x: inX > 0 ? hw - 3 : -hw + 3, z: 0, rot: 0 });
    return;
  }
  p.ext = { F: 'punched', B: 'punched', L: 'punched', R: 'punched' };
  p.room({ ...stR, kind: 'stairs', grp: 'stairs', floor: 'concrete', wall: [0.9, 0.9, 0.88], light: 'tube', villa: true });
  if (!inX) { p.room({ x0: -hw, z0: -hd, x1: hw, z1: inZ > 0 ? sz0 : hd, kind: 'unit', home: true, k: 0, num: `${n}01호` }); return; }
  // 큰 세대 (계단실 옆 전체) + 작은 세대 (계단실 앞)
  const ax0 = inX > 0 ? sx1 : -hw, ax1 = inX > 0 ? hw : sx0;
  const A = p.room({ x0: ax0, z0: -hd, x1: ax1, z1: hd, kind: 'unit', home: true, k: 0, num: `${n}01호` });
  p.door({ x: inX > 0 ? sx1 : sx0, z: (sz0 + sz1) / 2, ax: 'z', w: 0.95, kind: 'steel', unit: A });
  const bz0 = inZ > 0 ? sz1 : -hd, bz1 = inZ > 0 ? hd : sz0;
  if (bz1 - bz0 > 3) {
    const Bu = p.room({ x0: sx0, z0: bz0, x1: sx1, z1: bz1, kind: 'unit', home: true, k: 1, num: `${n}02호` });
    p.door({ x: (sx0 + sx1) / 2, z: inZ > 0 ? sz1 : sz0, ax: 'x', w: 0.95, kind: 'steel', unit: Bu });
  }
}

// ───────── 주상복합 타워 ─────────
function towerPlan(p) {
  const B = p.B, hw = p.W / 2, hd = p.D / 2, n = p.n;
  const A = B.banks[0], Bb = B.banks[1];
  const xsA = [-2.2, 0, 2.2], xsB = [0.6, 2.8];
  if (p.f.lobby) {
    // 1층: 포디움 가장자리 문에서 코어까지 긴 로비
    const L = B.lobbyLen;
    p.ext = { F: 'none', B: 'none', L: 'none', R: 'none' };
    p.room({ x0: -4.2, z0: -1.4, x1: 4.2, z1: 1.4, kind: 'ehall', grp: 'lobby', floor: 'stone', wall: [0.86, 0.82, 0.74], light: 'panel' });
    p.room({ x0: -4.2, z0: 1.4, x1: 4.2, z1: hd + L, kind: 'tlobby', grp: 'lobby', floor: 'stone', wall: [0.86, 0.82, 0.74], light: 'panel' });
    p.room({ x0: -4.2, z0: -hd, x1: 4.2, z1: -3.6, kind: 'shaft' });
    for (let c = 0; c < A.cars; c++) p.elev('A', c, xsA[c], -1.4, [0, 1], 1.9, 2.1);
    p.room({ x0: -4.2, z0: -3.6, x1: 4.2, z1: -1.4, kind: 'shaft' });
    p.door({ x: 0, z: hd + L, ax: 'x', w: 2.0, h: 2.4, kind: 'auto', exit: true, label: '공동현관', secure: true });
    // 고층 직행은 로비 옆 칸
    p.room({ x0: 4.2, z0: -1.4, x1: 8.6, z1: 1.4, kind: 'ehall', grp: 'lobby', floor: 'stone', wall: [0.82, 0.78, 0.7] });
    p.room({ x0: 4.2, z0: 1.4, x1: 8.6, z1: 3.6, kind: 'shaft' });
    p.room({ x0: 4.2, z0: -3.6, x1: 8.6, z1: -1.4, kind: 'shaft' });
    for (let c = 0; c < Bb.cars; c++) p.elev('B', c, 5.3 + c * 2.2, 1.4, [0, -1], 1.9, 2.1);
    stairs(p, -8.6, -1.4, -4.2, 1.4, -4.2, 0, 'z', [1, 0]);
    p.feat({ kind: 'concierge', x: -2.6, z: hd + L - 6, rot: Math.PI / 2 });
    p.feat({ kind: 'mailbox', x: 4.1, z: 8, rot: -Math.PI / 2, n: 40 });
    p.feat({ kind: 'parcel', x: 4.1, z: 14, rot: -Math.PI / 2 });
    p.feat({ kind: 'sofas', x: -1.5, z: 20 });
    p.feat({ kind: 'keypad', x: 1.6, z: hd + L - 0.12, rot: Math.PI });
    p.feat({ kind: 'plant', x: -3.5, z: hd + L - 1.2, h: 1.8 }); p.feat({ kind: 'plant', x: 3.5, z: hd + L - 1.2, h: 1.8 });
    p.feat({ kind: 'art', x: 0, z: 1.45, y: 2.6, rot: 0 });
    return;
  }
  p.ext = { F: 'balcony', B: 'balcony', L: 'balcony', R: 'balcony' };
  // 가운데 복도 (동서)
  p.room({ x0: -hw, z0: -1.4, x1: hw, z1: 1.4, kind: 'hall', grp: 'hall', floor: hallFloor(p), wall: hallWall(p) });
  // 북쪽 코어: 저층 엘리베이터 / 남쪽 코어: 고층 직행 + 계단
  p.room({ x0: -4.2, z0: -hd, x1: 4.2, z1: -1.4, kind: 'shaft' });
  if (A.serves.includes(n)) for (let c = 0; c < A.cars; c++) p.elev('A', c, xsA[c], -1.4, [0, 1], 1.9, 2.1);
  p.room({ x0: -4.2, z0: 1.4, x1: -0.4, z1: hd, kind: 'shaft' });
  stairs(p, -4.2, 1.4, -0.4, 6, -2.3, 1.4, 'x', [0, -1]);
  p.rooms.pop(); p.rooms.pop(); // 위 shaft·stairs 순서 정리
  p.room({ x0: -4.2, z0: 6, x1: -0.4, z1: hd, kind: 'shaft' });
  p.room({ x0: -4.2, z0: 1.4, x1: -0.4, z1: 6, kind: 'stairs', grp: 'stairs', floor: 'concrete', wall: [0.9, 0.9, 0.88], light: 'tube', face: [0, -1] });
  p.room({ x0: -0.4, z0: 1.4, x1: 4.2, z1: hd, kind: 'shaft' });
  if (Bb.serves.includes(n)) for (let c = 0; c < Bb.cars; c++) p.elev('B', c, xsB[c], 1.4, [0, -1], 1.9, 2.1);
  // 네 세대
  const units = [
    { x0: -hw, z0: -hd, x1: -4.2, z1: -1.4, d: [-hw + 2, -1.4] }, { x0: 4.2, z0: -hd, x1: hw, z1: -1.4, d: [hw - 2, -1.4] },
    { x0: -hw, z0: 1.4, x1: -4.2, z1: hd, d: [-hw + 2, 1.4] }, { x0: 4.2, z0: 1.4, x1: hw, z1: hd, d: [hw - 2, 1.4] },
  ];
  units.forEach((u, i) => {
    const r = p.room({ x0: u.x0, z0: u.z0, x1: u.x1, z1: u.z1, kind: 'unit', home: true, k: i, num: `${n}0${i + 1}호` });
    p.door({ x: u.d[0], z: u.d[1], ax: 'x', w: 1.0, kind: 'steel', unit: r });
  });
  p.feat({ kind: 'floorsign', x: -2.2, z: -1.38, y: 2.3, rot: 0, text: `${n}F` });
  p.feat({ kind: 'extinguisher', x: hw - 0.4, z: 1.2 });
}

// ───────── 대형 상가 (주상복합 포디움 · 몰) ─────────
function mallPlan(p) {
  const B = p.B, hw = p.W / 2, hd = p.D / 2, n = p.n;
  const dep = 12, cw = 6;
  p.ext = { F: n === 1 ? 'store' : 'curtain', B: 'curtain', L: 'curtain', R: 'curtain' };
  const ring = 'ring';
  const ix0 = -hw + dep, ix1 = hw - dep, iz0 = -hd + dep, iz1 = hd - dep;
  // 둘레 복도
  p.room({ x0: ix0, z0: iz0, x1: ix1, z1: iz0 + cw, kind: 'mallhall', grp: ring, floor: 'stone', wall: [0.94, 0.93, 0.9] });
  p.room({ x0: ix0, z0: iz1 - cw, x1: ix1, z1: iz1, kind: 'mallhall', grp: ring, floor: 'stone', wall: [0.94, 0.93, 0.9] });
  p.room({ x0: ix0, z0: iz0 + cw, x1: ix0 + cw, z1: iz1 - cw, kind: 'mallhall', grp: ring, floor: 'stone', wall: [0.94, 0.93, 0.9] });
  p.room({ x0: ix1 - cw, z0: iz0 + cw, x1: ix1, z1: iz1 - cw, kind: 'mallhall', grp: ring, floor: 'stone', wall: [0.94, 0.93, 0.9] });
  // 가운데: 광장 (엘리베이터 · 계단 · 푸드코트) + 타워 로비 자리
  const cx0 = ix0 + cw, cx1 = ix1 - cw, cz0 = iz0 + cw, cz1 = iz1 - cw;
  p.room({ x0: cx0, z0: cz0, x1: cx1, z1: cz1, kind: 'plaza', grp: ring, floor: 'stone', wall: [0.94, 0.93, 0.9], light: 'panel', atrium: true });
  // 엘리베이터 2대 + 계단 (광장 한가운데 코어)
  p.room({ x0: -3.6, z0: -2.4, x1: 3.6, z1: 0, kind: 'shaft' });
  p.elev('A', 0, -1.3, 0, [0, 1], 1.9, 2.0); p.elev('A', 1, 1.3, 0, [0, 1], 1.9, 2.0);
  stairs(p, -3.6, -6.4, 3.6, -2.4, 0, -6.4, 'x', [0, -1]);
  p.room({ x0: -3.6, z0: -6.4, x1: 3.6, z1: -2.4, kind: 'stairs', grp: 'stairs', floor: 'concrete', wall: [0.9, 0.9, 0.88], light: 'tube', face: [0, -1] });
  p.rooms.splice(p.rooms.length - 2, 1);
  // 타워 로비 (잠긴 주민 공간)
  for (const t of B.meta.towers || []) {
    const a = toLocalPt(B, t.x0 + 9, t.z0 + 9), b = toLocalPt(B, t.x1 - 9, t.z1 - 9);
    const r = { x0: Math.min(a[0], b[0]), z0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), z1: Math.max(a[1], b[1]) };
    if (r.x0 < cx0 + 1 || r.x1 > cx1 - 1 || r.z0 < cz0 + 1 || r.z1 > cz1 - 1) continue;
    p.room({ ...r, kind: 'private', label: '주민 전용 로비', wall: [0.62, 0.6, 0.56] });
  }
  // 푸드코트 테이블
  if (n === 1) for (let k = 0; k < 6; k++) p.feat({ kind: 'foodtable', x: cx0 + 6 + (k % 3) * 5, z: cz1 - 6 - Math.floor(k / 3) * 4 });
  // 둘레 매장
  let k = 100;
  const row = (x0, z0, x1, z1, side, fixed) => {
    const len = side === 'F' || side === 'B' ? x1 - x0 : z1 - z0;
    if (len < 3) return;
    const m = fixed ? 1 : Math.max(1, Math.round(len / 9)), uw = len / m;
    for (let i = 0; i < m; i++) {
      let r;
      const kk = fixed ? fixed.k : k++;
      if (side === 'F' || side === 'B') r = p.room({ x0: x0 + i * uw, z0, x1: x0 + (i + 1) * uw, z1, kind: 'unit', k: kk });
      else r = p.room({ x0, z0: z0 + i * uw, x1, z1: z0 + (i + 1) * uw, kind: 'unit', k: kk });
      const cxu = (r.x0 + r.x1) / 2, czu = (r.z0 + r.z1) / 2;
      if (side === 'F') p.door({ x: cxu, z: r.z0, ax: 'x', w: Math.min(2.4, len * 0.4), kind: 'glass', unit: r });
      if (side === 'B') p.door({ x: cxu, z: r.z1, ax: 'x', w: 2.4, kind: 'glass', unit: r });
      if (side === 'L') p.door({ x: r.x1, z: czu, ax: 'z', w: 2.4, kind: 'glass', unit: r });
      if (side === 'R') p.door({ x: r.x0, z: czu, ax: 'z', w: 2.4, kind: 'glass', unit: r });
      if (fixed && fixed.exit) p.door({ x: cxu, z: hd, ax: 'x', w: Math.min(1.7, len * 0.3), h: 2.3, kind: 'glass', exit: true, unit: r });
      r.glassFront = side === 'F' ? 'B' : side === 'B' ? 'F' : side === 'L' ? 'R' : 'L';
    }
  };
  // 모서리는 창고
  for (const [x0, z0, x1, z1] of [[-hw, -hd, ix0, iz0], [ix1, -hd, hw, iz0], [-hw, iz1, ix0, hd], [ix1, iz1, hw, hd]]) p.room({ x0, z0, x1, z1, kind: 'store', label: '창고', floor: 'concrete' });
  // 정면 출입구 = 바깥 상가 줄의 출입구 칸
  const { n: nu, uw: suw } = shopUnits(B.spec);
  const li = lobbyUnit(B.spec);
  const gx0 = li >= 0 ? -hw + li * suw : -3, gx1 = li >= 0 ? gx0 + suw : 3;
  if (n === 1) {
    for (let i = 0; i < nu; i++) {
      if (i === li) continue;
      let a = -hw + i * suw, b = a + suw;
      if (b <= ix0 + 0.5 || a >= ix1 - 0.5) continue;
      a = Math.max(a, ix0); b = Math.min(b, ix1);
      if (a < gx1 && b > gx0) continue;
      row(a, iz1, b, hd, 'F', { k: i, exit: true });
    }
  } else { row(ix0, iz1, gx0, hd, 'F'); row(gx1, iz1, ix1, hd, 'F'); }
  const gz = 3;
  row(ix0, -hd, -gz, iz0, 'B'); row(gz, -hd, ix1, iz0, 'B');
  row(-hw, iz0, ix0, -gz, 'L'); row(-hw, gz, ix0, iz1, 'L');
  row(ix1, iz0, hw, -gz, 'R'); row(ix1, gz, hw, iz1, 'R');
  for (const [x0, z0, x1, z1, ex] of [[gx0, iz1, gx1, hd, [(gx0 + gx1) / 2, hd, 'x']], [-gz, -hd, gz, iz0, [0, -hd, 'x']], [-hw, -gz, ix0, gz, [-hw, 0, 'z']], [ix1, -gz, hw, gz, [hw, 0, 'z']]]) {
    p.room({ x0, z0, x1, z1, kind: 'mallhall', grp: ring, floor: 'stone', wall: [0.94, 0.93, 0.9] });
    if (n === 1) p.door({ x: ex[0], z: ex[1], ax: ex[2], w: Math.min(3.6, (ex[2] === 'x' ? x1 - x0 : z1 - z0) - 0.6), h: 2.6, kind: 'auto', exit: true, label: B.name });
  }
}

// ───────── 시청 · 아트센터 ─────────
function civicPlan(p) {
  const B = p.B, hw = p.W / 2, hd = p.D / 2, n = p.n;
  for (const k of ['F', 'B', 'L', 'R']) p.ext[k] = 'curtain';
  // 코어: 가운데 뒤쪽
  p.room({ x0: -6, z0: -hd, x1: 6, z1: -hd + 6, kind: 'shaft' });
  for (let c = 0; c < 3; c++) p.elev('A', c, -2.4 + c * 2.4, -hd + 6, [0, 1], 2.0, 2.0);
  p.rooms.pop(); p.room({ x0: -6, z0: -hd, x1: 4, z1: -hd + 6, kind: 'shaft' });
  stairs(p, 4, -hd, 8, -hd + 6, 6, -hd + 6, 'x', [0, 1]);
  const hall = B.meta.hall;
  if (n === 1) {
    p.room({ x0: -hw, z0: -hd + 6, x1: hw, z1: hd, kind: hall ? 'minwon' : 'artlobby', grp: 'main', floor: 'stone', wall: [0.95, 0.94, 0.9] });
    p.room({ x0: -hw, z0: -hd, x1: -6, z1: -hd + 6, kind: 'wc', label: '화장실', floor: 'tile' }); p.door({ x: -10, z: -hd + 6, ax: 'x', w: 1.0, label: '화장실' });
    p.room({ x0: 8, z0: -hd, x1: hw, z1: -hd + 6, kind: 'store', label: '창고', floor: 'concrete' });
    p.door({ x: 0, z: hd, ax: 'x', w: 4, h: 2.8, kind: 'auto', exit: true, label: B.name });
    if (hall) {
      for (let c = 0; c < 8; c++) p.feat({ kind: 'civcounter', x: -hw + 8 + c * ((p.W - 16) / 7), z: -hd + 12, rot: 0, num: c + 1 });
      p.feat({ kind: 'ticket', x: 0, z: hd - 4, rot: 0 });
      for (let r2 = 0; r2 < 3; r2++) for (let c = 0; c < 6; c++) p.feat({ kind: 'benchrow', x: -hw + 12 + c * 12, z: 2 + r2 * 3.5 });
    } else {
      p.feat({ kind: 'reception', x: 0, z: hd - 6, rot: 0, label: '매표소' });
      p.feat({ kind: 'gallery', x: -hw + 10, z: 0 });
    }
  } else {
    p.room({ x0: -hw, z0: -hd + 6, x1: hw, z1: hd, kind: 'office', grp: 'main', floor: 'carpet', wall: [0.95, 0.95, 0.94] });
    p.room({ x0: -hw, z0: -hd, x1: -6, z1: -hd + 6, kind: 'wc', label: '화장실', floor: 'tile' }); p.door({ x: -10, z: -hd + 6, ax: 'x', w: 1.0, label: '화장실' });
    p.room({ x0: 8, z0: -hd, x1: hw, z1: -hd + 6, kind: 'pantry', label: '탕비실', floor: 'tile' }); p.door({ x: 11, z: -hd + 6, ax: 'x', w: 1.0, label: '탕비실' });
    p.civicOffice = true;
  }
}

// ───────── 지하 주차장 ─────────
function parkingPlan(p) {
  const B = p.B, hw = p.W / 2, hd = p.D / 2;
  p.ext = { F: 'none', B: 'none', L: 'none', R: 'none' };
  // 코어는 지상과 같은 자리
  const tmp = new Plan(B, B.floors.find(f => f.n === 1).n);
  switch (B.kind) {
    case 'office': officeCore(tmp); break;
    case 'apt': aptPlan(tmp); break;
    case 'tower': towerPlan(tmp); break;
    case 'mall': mallPlan(tmp); break;
    default: shopCore(tmp, -hd + 5);
  }
  // 엘리베이터 · 계단 · 승강장만 가져와요
  const keep = new Set(['shaft', 'stairs', 'ehall']);
  const core = tmp.rooms.filter(r => keep.has(r.kind) || (B.kind === 'apt' && r.kind === 'alobby'));
  let cx0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cz1 = -Infinity;
  for (const r of core) {
    const rr = { ...r, floor: 'epoxy', wall: [0.86, 0.88, 0.84], light: 'tube' };
    if (r.kind === 'alobby') { rr.kind = 'ehall'; rr.grp = 'vest'; rr.z0 = -3.6; }
    if (r.kind === 'ehall') rr.grp = 'vest';
    p.rooms.push(rr);
    cx0 = Math.min(cx0, rr.x0); cz0 = Math.min(cz0, rr.z0); cx1 = Math.max(cx1, rr.x1); cz1 = Math.max(cz1, rr.z1);
  }
  for (const e of tmp.elevs) if (B.banks.find(b => b.id === e.bank)?.serves.includes(p.n)) { p.elevs.push(e); p.door({ x: e.x, z: e.z, ax: e.face[0] ? 'z' : 'x', w: 1.0, h: 2.1, kind: 'elev', bank: e.bank, car: e.car }); }
  for (const d of tmp.doors) if (d.kind === 'fire') p.door({ ...d });
  // 승강장 유리문 (주차장 쪽)
  const vest = p.rooms.filter(r => r.grp === 'vest');
  for (const v of vest) {
    const opens = [];
    if (v.x0 <= cx0 + 0.01) opens.push({ x: v.x0, z: (v.z0 + v.z1) / 2, ax: 'z' });
    if (v.x1 >= cx1 - 0.01) opens.push({ x: v.x1, z: (v.z0 + v.z1) / 2, ax: 'z' });
    if (v.z1 >= cz1 - 0.01 && B.kind !== 'tower') opens.push({ x: (v.x0 + v.x1) / 2, z: v.z1, ax: 'x' });
    if (v.z0 <= cz0 + 0.01 && B.kind === 'apt') opens.push({ x: (v.x0 + v.x1) / 2, z: v.z0, ax: 'x' });
    for (const o of opens) p.door({ ...o, w: 1.6, h: 2.2, kind: 'glass2' });
  }
  if (B.kind === 'apt') { // 아파트 홀은 계단까지 앞쪽만
    const st = p.rooms.find(r => r.kind === 'stairs'); if (st) st.z1 = Math.min(st.z1, -1.0 + 4);
  }
  // 주차 공간: 코어 둘레를 넉넉한 사각형 4개로
  const g = 'park';
  const pr = (x0, z0, x1, z1) => { if (x1 - x0 > 0.5 && z1 - z0 > 0.5) p.room({ x0, z0, x1, z1, kind: 'parking', grp: g, floor: 'epoxy', wall: [0.82, 0.84, 0.8], light: 'tube' }); };
  pr(-hw, -hd, hw, cz0); pr(-hw, cz1, hw, hd); pr(-hw, cz0, cx0, cz1); pr(cx1, cz0, hw, cz1);
  // 기둥 · 주차 칸 · 차
  const R = p.R;
  for (let x = -hw + 8.4; x < hw - 2; x += 8.4) for (let z = -hd + 8.4; z < hd - 2; z += 8.4) {
    if (x > cx0 - 1.5 && x < cx1 + 1.5 && z > cz0 - 1.5 && z < cz1 + 1.5) continue;
    p.feat({ kind: 'pillar', x, z, s: 0.8, h: p.ch });
  }
  for (const [z, dir] of [[-hd + 2.6, 0], [hd - 2.6, Math.PI]]) {
    for (let x = -hw + 1.4; x < hw - 1.4; x += 2.5) {
      if (x > cx0 - 2 && x < cx1 + 2 && ((dir === 0 && cz0 < -hd + 6) || (dir !== 0 && cz1 > hd - 6))) continue;
      p.feat({ kind: 'stall', x, z, rot: dir });
      if (R() < 0.62) p.feat({ kind: 'car', x, z, rot: dir + Math.PI / 2, c: [[0.9, 0.9, 0.92], [0.12, 0.12, 0.14], [0.6, 0.62, 0.65], [0.15, 0.2, 0.4], [0.55, 0.1, 0.1], [0.92, 0.92, 0.88]][Math.floor(R() * 6)] });
    }
  }
  p.feat({ kind: 'ramp', x: hw - 4, z: 0, rot: -Math.PI / 2 });
  p.feat({ kind: 'parksign', x: 0, z: hd - 0.12, y: 2.2, rot: Math.PI, text: floorLabel(p.n) });
  p.parking = true;
}

// ───────── 옥상 ─────────
function roofPlan(p) {
  const B = p.B, hw = p.W / 2, hd = p.D / 2;
  p.ext = { F: 'parapet', B: 'parapet', L: 'parapet', R: 'parapet' };
  // 계단실 위치 = 아래층과 같은 곳 (계단탑)
  const below = planFloor(B, B.top);
  const st = below.rooms.find(r => r.kind === 'stairs');
  const deck = { x0: -hw, z0: -hd, x1: hw, z1: hd };
  for (const r of st ? subRect(deck, st) : [deck]) p.room({ ...r, kind: 'roofdeck', grp: 'roof', floor: p.f.garden ? 'roof' : 'concrete', wall: [0.8, 0.8, 0.78], light: 'none', open: true, noCeil: true });
  if (st) {
    p.room({ x0: st.x0, z0: st.z0, x1: st.x1, z1: st.z1, kind: 'stairs', grp: 'stairs', floor: 'concrete', wall: [0.9, 0.9, 0.88], light: 'tube', face: st.face, villa: st.villa, roofTop: true });
    const dr = below.doors.find(d => d.kind === 'fire') || { x: (st.x0 + st.x1) / 2, z: st.z1, ax: 'x' };
    p.door({ x: dr.x, z: dr.z, ax: dr.ax, w: 0.95, h: 2.1, kind: 'fire', label: '옥상 출입문' });
  }
  const R = p.R;
  p.feat({ kind: 'tank', x: hw - 3, z: -hd + 3 });
  for (let k = 0; k < Math.min(8, Math.round(p.W / 6)); k++) p.feat({ kind: 'ac', x: -hw + 2 + R() * (p.W - 4), z: hd - 1.5 - R() * 3 });
  if (p.f.garden) for (let k = 0; k < 10; k++) p.feat({ kind: 'plant', x: -hw + 4 + R() * (p.W - 8), z: -hd + 4 + R() * (p.D - 8), h: 1.6 });
  if (B.kind === 'office' && B.top >= 30) p.feat({ kind: 'heli', x: 0, z: 0 });
  else p.feat({ kind: 'benches', x: -hw / 2, z: 0 });
  p.roof = true;
}

// ───────── 문 앞 위치 (도시에서 들어가는 곳) ─────────
// 반환: [{ x, z (월드), nx, nz, kind, n(층), door, name }]
export function entrancesOf(B) {
  const out = [];
  const add = (p, d) => {
    const nx = d.ax === 'x' ? 0 : Math.sign(d.x), nz = d.ax === 'x' ? Math.sign(d.z) : 0;
    const [wx, wz] = toWorldPt(B, d.x + nx * 1.6, d.z + nz * 1.6);
    const c = Math.cos(B.rot), sn = Math.sin(B.rot);
    const wnx = nx * c + nz * sn, wnz = -nx * sn + nz * c;
    out.push({ x: wx, z: wz, nx: wnx, nz: wnz, n: p.n, door: d, unit: d.unit || null, B });
  };
  const p1 = planFloor(B, 1);
  for (const d of p1.doors) if (d.exit) add(p1, d);
  if (B.kind === 'villa') {
    // 필로티 바깥 가장자리에서 계단실 문 앞으로 바로 들어가요
    const d = p1.doors.find(q => q.secure);
    const st = p1.rooms.find(r => r.kind === 'stairs');
    if (d && st) {
      const hw = p1.W / 2, hd = p1.D / 2;
      // 계단실에서 가장 가까운 바깥 면
      const cands = [[(st.x0 + st.x1) / 2, hd + 1.6, 0, 1], [(st.x0 + st.x1) / 2, -hd - 1.6, 0, -1], [hw + 1.6, (st.z0 + st.z1) / 2, 1, 0], [-hw - 1.6, (st.z0 + st.z1) / 2, -1, 0]];
      cands.sort((a, b) => Math.hypot(a[0] - (st.x0 + st.x1) / 2, a[1] - (st.z0 + st.z1) / 2) - Math.hypot(b[0] - (st.x0 + st.x1) / 2, b[1] - (st.z0 + st.z1) / 2));
      const [lx, lz, nx, nz] = cands[0];
      const [wx, wz] = toWorldPt(B, lx, lz);
      const c = Math.cos(B.rot), sn = Math.sin(B.rot);
      out.push({ x: wx, z: wz, nx: nx * c + nz * sn, nz: -nx * sn + nz * c, n: 1, door: d, unit: null, B, villa: true });
    }
  }
  return out;
}
export { TYPES };

import * as THREE from 'three';
import { FUR, COL } from './bkit.js';
import { TYPES } from './tenants.js';
import { MENUS } from './shopdata.js';
import { seeded } from './geo.js';
import { JOB_TYPES } from './jobs.js';

// ───────── 업종별 실내 (칸 크기에 맞춰 자동 배치) ─────────
// 칸 좌표 u(문 벽을 따라, 들어갈 때 오른쪽 +) · v(문에서 안쪽 깊이)
export function unitFrame(r, door) {
  let ix = 0, iz = 0, edge;
  if (!door) door = { x: (r.x0 + r.x1) / 2, z: r.z1, ax: 'x' };
  if (door.ax === 'x') { const top = Math.abs(door.z - r.z0) < Math.abs(door.z - r.z1); iz = top ? 1 : -1; edge = top ? r.z0 : r.z1; }
  else { const left = Math.abs(door.x - r.x0) < Math.abs(door.x - r.x1); ix = left ? 1 : -1; edge = left ? r.x0 : r.x1; }
  const rx = -iz, rz = ix;
  const w = ix ? r.z1 - r.z0 : r.x1 - r.x0;
  const d = ix ? r.x1 - r.x0 : r.z1 - r.z0;
  const ox = ix ? edge : (r.x0 + r.x1) / 2, oz = ix ? (r.z0 + r.z1) / 2 : edge;
  const P = (u, v) => [ox + rx * u + ix * v, oz + rz * u + iz * v];
  const du = rx * (door.x - ox) + rz * (door.z - oz);
  const face = (fu, fv) => Math.atan2(rx * fu + ix * fv, rz * fu + iz * fv);
  const N = (fu, fv) => [rx * fu + ix * fv, rz * fu + iz * fv];
  return { P, w, d, du, face, N, ix, iz, rx, rz, r, door };
}

class U {
  constructor(k, r, door, tenant, ctx) {
    this.k = k; this.F = unitFrame(r, door); this.r = r; this.t = tenant; this.ctx = ctx;
    this.w = this.F.w; this.d = this.F.d; this.zones = []; this.spots = [];
    this.R = seeded((ctx?.B?.id || 1) * 3 + (r.k || 0) * 101 + (ctx?.n || 0) * 7);
    this.fam = TYPES[tenant?.type]?.fam || 'vacant';
  }
  p(u, v) { return this.F.P(u, v); }
  // 칸 좌표 상자
  box(u0, y0, v0, u1, y1, v1, c, gb) { const a = this.p(u0, v0), b = this.p(u1, v1); this.k.box(a[0], y0, a[1], b[0], y1, b[1], c, gb); }
  block(u0, v0, u1, v1) { const a = this.p(u0, v0), b = this.p(u1, v1); this.k.block(a[0], a[1], b[0], b[1]); }
  glow(u0, y0, v0, u1, y1, v1, c) { this.box(u0, y0, v0, u1, y1, v1, c, this.k.glow); }
  // 가구 놓기: f(kit, x, z, rot, opts) — rot은 앞쪽이 (fu, fv) 방향
  put(fn, u, v, fu, fv, opts) { const [x, z] = this.p(u, v); return fn(this.k, x, z, this.F.face(fu, fv), opts); }
  at(u, v, fu = 0, fv = -1) { const [x, z] = this.p(u, v); return this.k.at(x, z, this.F.face(fu, fv)); }
  // 벽에 붙은 판 (fu, fv: 바라보는 방향)
  sign(u, y, v, w, h, fu, fv, opts, px) { const [x, z] = this.p(u, v); this.k.sign(x, y, z, w, h, this.F.N(fu, fv), opts, px); }
  zone(kind, u0, v0, u1, v1, data = {}) { const a = this.p(u0, v0), b = this.p(u1, v1); const z = { kind, x0: Math.min(a[0], b[0]), z0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), z1: Math.max(a[1], b[1]), unit: this.r, tenant: this.t, fam: this.fam, ...data }; this.zones.push(z); return z; }
  spot(kind, u, v, fu, fv, data = {}) { const [x, z] = this.p(u, v); this.spots.push({ kind, x, z, rot: this.F.face(fu, fv), ...data }); }
  // 칸막이 벽 (u0,v0)→(u1,v1), 구멍
  wall(u0, v0, u1, v1, h, c, holes = []) { const a = this.p(u0, v0), b = this.p(u1, v1); this.k.wall(a[0], a[1], b[0], b[1], h, c, { t: 0.1, holes }); }
  menuBoard(u, y, v, fu, fv, w = 2.2, h = 0.9) {
    const menu = MENUS[this.t.type] || [];
    const name = this.t.name, color = this.t.color;
    this.sign(u, y, v, w, h, fu, fv, (x, W, H) => {
      x.fillStyle = '#16181c'; x.fillRect(0, 0, W, H);
      x.fillStyle = color; x.fillRect(0, 0, W, H * 0.2);
      x.fillStyle = '#fff'; x.font = `800 ${H * 0.13}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name + ' MENU', W / 2, H * 0.1);
      const rows = menu.slice(0, 8), cols = rows.length > 4 ? 2 : 1, per = Math.ceil(rows.length / cols);
      rows.forEach((m, i) => {
        const c = Math.floor(i / per), rI = i % per;
        const x0 = W * (0.04 + c * 0.5), y = H * 0.3 + rI * H * 0.17;
        x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = `700 ${H * 0.085}px sans-serif`;
        let s = m.icon + ' ' + m.name; while (x.measureText(s).width > W * (cols > 1 ? 0.33 : 0.66) && s.length > 4) s = s.slice(0, -1);
        x.fillText(s, x0, y);
        x.textAlign = 'right'; x.fillStyle = '#ffd25a'; x.fillText((m.price / 1000).toFixed(m.price % 1000 ? 1 : 0) + 'k', x0 + W * (cols > 1 ? 0.44 : 0.9), y);
      });
    }, 220);
  }
  poster(u, y, v, w, h, fu, fv, text, sub, bg = '#ffffff', fg = '#222') { this.sign(u, y, v, w, h, fu, fv, { text, sub, bg, fg, border: fg }, 96); }
  counterAt(u, v, fu, fv, opts = {}) {
    const f = this.at(u, v, fu, fv);
    FUR.counter(this.k, ...this.p(u, v), this.F.face(fu, fv), { w: opts.w || 2.2, d: opts.d || 0.6, h: opts.h || 1.0, c: opts.c || [0.95, 0.95, 0.94], top: opts.top || [0.25, 0.25, 0.27], front: this.t.color ? hexRGB(this.t.color) : null });
    FUR.register(this.k, ...pick3(this.p(u + (opts.regU || 0.5) * (opts.flip ? -1 : 1), v)), this.F.face(-fu, -fv));
    return f;
  }
}
const pick3 = ([x, z]) => [x, 1.0, z];
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
const shade = (c, f) => c.map(v => Math.min(1, v * f));

// 공통: 계산대 앞 존 · 직원 자리
function counterZone(u, cu, cv, fu, fv, kind = 'counter', w = 2.2) {
  // 손님은 계산대 앞쪽 (fu, fv 방향)
  const a0 = cu - w / 2 * (fv ? 1 : 0) - 0.45 * (fu ? 1 : 0), b0 = cv - w / 2 * (fu ? 1 : 0) - 0.45 * (fv ? 1 : 0);
  void a0; void b0;
  const pu = cu + fu * 0.85, pv = cv + fv * 0.85;
  u.zone(kind, pu - (fv ? w / 2 : 0.55), pv - (fu ? w / 2 : 0.55), pu + (fv ? w / 2 : 0.55), pv + (fu ? w / 2 : 0.55), { cu, cv });
  u.spot('staff', cu - fu * 0.75, cv - fv * 0.75, fu, fv, { counter: true });
}

// 테이블 + 의자 묶음 (식당)
function tableSet(u, cu, cv, { seats = 4, w = 1.2, d = 0.75, top = COL.WOOD, chair = [0.3, 0.25, 0.2], idx = 0, grill = false } = {}) {
  FUR.table(u.k, ...u.p(cu, cv), u.F.face(0, 1), { w, d, top, leg: COL.BLACK });
  if (grill) {
    const [x, z] = u.p(cu, cv);
    u.k.col(u.k.solid, [0.15, 0.15, 0.16]).addGeo(new THREE.CylinderGeometry(0.24, 0.2, 0.08, 16).translate(x, 0.78, z));
    u.k.col(u.k.metal, [0.55, 0.55, 0.58]).addGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.01, 16).translate(x, 0.825, z));
    u.k.col(u.k.metal, [0.75, 0.76, 0.78]).addGeo(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8).translate(x, 2.1, z));
    u.k.col(u.k.metal, [0.75, 0.76, 0.78]).addGeo(new THREE.CylinderGeometry(0.06, 0.34, 0.3, 16).translate(x, 1.42, z));
  }
  const pos = seats >= 4 ? [[-w / 4, -d / 2 - 0.35, 0, 1], [w / 4, -d / 2 - 0.35, 0, 1], [-w / 4, d / 2 + 0.35, 0, -1], [w / 4, d / 2 + 0.35, 0, -1]] : [[0, -d / 2 - 0.35, 0, 1], [0, d / 2 + 0.35, 0, -1]];
  for (const [a, b, fu, fv] of pos) { FUR.chair(u.k, ...u.p(cu + a, cv + b), u.F.face(-fu, -fv), { c: chair }); u.spot('seat', cu + a, cv + b, fu, fv, { table: idx }); }
  u.zone('seat', cu - w / 2 - 0.5, cv - d / 2 - 0.7, cu + w / 2 + 0.5, cv + d / 2 + 0.7, { table: idx, seats });
}

// 주방 (뒤쪽): 조리대 · 화구 · 냉장고 + 반쯤 열린 칸막이
function kitchen(u, depth, { hood = true, kind = 'general' } = {}) {
  const w = u.w, d = u.d, v0 = d - depth;
  u.wall(-w / 2 + 0.05, v0, -0.7, v0, 2.2, [0.94, 0.93, 0.9], [{ u0: Math.max(0, (w / 2 - 0.75) - 2.2), u1: Math.max(0.1, (w / 2 - 0.75) - 0.6), y0: 1.0, y1: 1.6 }]);
  u.wall(0.7, v0, w / 2 - 0.05, v0, 2.2, [0.94, 0.93, 0.9]);
  u.k.floor('tile', ...minmax(u.p(-w / 2, v0), u.p(w / 2, d)));
  const steel = [0.78, 0.8, 0.83];
  u.box(-w / 2 + 0.1, 0, d - 0.7, w / 2 - 0.1, 0.9, d - 0.05, steel, u.k.metal);
  for (let i = 0; i < Math.min(4, Math.floor((w - 1) / 1)); i++) {
    const cu = -w / 2 + 0.7 + i * 1.0;
    const [x, z] = u.p(cu, d - 0.4);
    u.k.col(u.k.solid, [0.12, 0.12, 0.12]).addGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12).translate(x, 0.92, z));
    if (kind !== 'fry' || i > 1) u.k.col(u.k.metal, [0.6, 0.6, 0.62]).addGeo(new THREE.CylinderGeometry(0.15, 0.13, 0.22, 12).translate(x, 1.04, z));
  }
  if (kind === 'fry') for (const s of [-1, 1]) u.box(s * 0.6 - 0.3, 0.9, d - 0.65, s * 0.6 + 0.3, 1.05, d - 0.1, [0.85, 0.65, 0.2]);
  if (hood) u.box(-w / 2 + 0.1, 1.9, d - 0.85, w / 2 - 0.1, 2.25, d - 0.05, steel, u.k.metal);
  FUR.fridge(u.k, ...u.p(w / 2 - 0.6, v0 + 0.5), u.F.face(-1, 0), { w: 0.8, drinks: false });
  u.block(-w / 2, v0, w / 2, d);
  u.spot('cook', 0, d - 1.1, 0, 1);
  return v0;
}
const minmax = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];

// ───────── 업종별 ─────────
const FAM = {
  vacant(u) {
    const w = u.w, d = u.d;
    u.k.floor('concrete', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
    u.poster(0, 1.4, d - 0.08, 1.6, 0.8, 0, -1, '임대 문의', '☎ 한빛부동산 · 보증금 / 월세 협의');
    for (let i = 0; i < 3; i++) u.box(-w / 2 + 0.8 + i * 0.7, 0, d - 1.2 + (i % 2) * 0.3, -w / 2 + 1.3 + i * 0.7, 0.35, d - 0.8 + (i % 2) * 0.3, [0.7, 0.55, 0.35]);
    u.zone('vacant', -w / 2 + 0.5, 0.6, w / 2 - 0.5, d - 0.5);
  },
  bbq(u) {
    const w = u.w, d = u.d;
    const kv = kitchen(u, 2.6, {});
    u.counterAt(w / 2 - 0.9, 1.6, -1, 0, { w: 1.6 });
    counterZone(u, w / 2 - 0.9, 1.6, -1, 0, 'counter', 1.6);
    u.menuBoard(0, 2.0, kv - 0.06, 0, -1, Math.min(3, w - 1), 1.0);
    let i = 0;
    for (let v = 2.6; v < kv - 1.2; v += 2.4) for (let a = -w / 2 + 1.3; a < w / 2 - 2.0; a += 2.2) tableSet(u, a, v, { idx: i++, top: [0.35, 0.3, 0.26], chair: [0.25, 0.2, 0.18], grill: true });
    FUR.fridge(u.k, ...u.p(-w / 2 + 0.5, 1.0), u.F.face(1, 0), { w: 0.9 });
    u.poster(-w / 2 + 0.06, 1.8, 2.6, 1.0, 0.6, 1, 0, '국내산 생삼겹', '200g · 16,000원', '#fff6e0', '#8e2416');
  },
  hansik(u) { FAM.dining(u, { top: COL.WOOD, chair: [0.4, 0.28, 0.2] }); },
  chinese(u) { FAM.dining(u, { top: [0.6, 0.12, 0.1], chair: [0.2, 0.15, 0.12], lantern: true }); },
  japanese(u) {
    const w = u.w, d = u.d;
    const kv = kitchen(u, 2.4, {});
    // 초밥 바 (주방 앞 긴 카운터 + 의자)
    u.box(-w / 2 + 0.6, 0, kv - 0.7, w / 2 - 0.6, 1.05, kv - 0.05, [0.55, 0.4, 0.26]);
    u.block(-w / 2 + 0.6, kv - 0.7, w / 2 - 0.6, kv - 0.05);
    for (let a = -w / 2 + 1.0, i = 0; a < w / 2 - 0.8; a += 0.8, i++) { FUR.stool(u.k, ...u.p(a, kv - 1.15), { c: [0.2, 0.2, 0.2], h: 0.7 }); u.spot('seat', a, kv - 1.15, 0, 1, { table: 100 }); }
    u.zone('seat', -w / 2 + 0.6, kv - 1.6, w / 2 - 0.6, kv - 0.75, { table: 100, seats: Math.floor((w - 1.4) / 0.8), bar: true });
    u.counterAt(w / 2 - 0.9, 1.5, -1, 0, { w: 1.4 }); counterZone(u, w / 2 - 0.9, 1.5, -1, 0, 'counter', 1.4);
    let i = 0;
    for (let v = 2.4; v < kv - 2.4; v += 2.3) for (let a = -w / 2 + 1.3; a < w / 2 - 2.0; a += 2.3) tableSet(u, a, v, { idx: i++, seats: 4, top: [0.25, 0.2, 0.16], chair: [0.2, 0.18, 0.15] });
    u.menuBoard(-w / 2 + 0.06, 2.0, Math.min(d - 3, 3), 1, 0, 2.2, 0.9);
    for (let a = -w / 2 + 1; a < w / 2; a += 1.6) { const [x, z] = u.p(a, kv - 0.4); u.k.col(u.k.glow, [1, 0.35, 0.25]).addGeo(new THREE.SphereGeometry(0.16, 10, 8).translate(x, 2.3, z)); }
  },
  dining(u, o = {}) {
    const w = u.w, d = u.d;
    const kv = kitchen(u, 2.4, {});
    u.counterAt(w / 2 - 0.9, 1.5, -1, 0, { w: 1.4 }); counterZone(u, w / 2 - 0.9, 1.5, -1, 0, 'counter', 1.4);
    u.menuBoard(0, 2.0, kv - 0.06, 0, -1, Math.min(3, w - 1), 1.0);
    let i = 0;
    for (let v = 2.5; v < kv - 1.1; v += 2.2) for (let a = -w / 2 + 1.2; a < w / 2 - 2.0; a += 2.1) tableSet(u, a, v, { idx: i++, seats: 4, top: o.top, chair: o.chair });
    if (o.lantern) for (let a = -w / 2 + 1; a < w / 2; a += 1.8) { const [x, z] = u.p(a, 2.5); u.k.col(u.k.glow, [1, 0.25, 0.15]).addGeo(new THREE.SphereGeometry(0.2, 10, 8).translate(x, 2.45, z)); }
    FUR.water(u.k, ...u.p(-w / 2 + 0.45, 1.0), u.F.face(1, 0));
    u.zone('water', ...[-w / 2 + 0.1, 0.5, -w / 2 + 1.2, 1.5]);
  },
  chicken(u) { FAM.takeout(u, { fry: true, tables: true }); u.poster(-u.w / 2 + 0.06, 1.8, 2.0, 0.9, 0.7, 1, 0, '🍗 바삭바삭', '오늘 튀긴 국내산 닭', '#fff3d8', '#c25a00'); },
  pizza(u) {
    FAM.takeout(u, { tables: true });
    const d = u.d, w = u.w;
    u.box(-0.9, 0, d - 1.5, 0.9, 1.5, d - 0.6, [0.55, 0.3, 0.2]); u.glow(-0.5, 0.5, d - 1.51, 0.5, 0.9, d - 1.505, [1, 0.5, 0.15]);
    void w;
  },
  takeout(u, o = {}) {
    const w = u.w, d = u.d;
    const kv = kitchen(u, 2.2, { kind: o.fry ? 'fry' : 'general' });
    // 앞 계산대 (주방 앞)
    u.box(-w / 2 + 0.4, 0, kv - 0.75, w / 2 - 1.6, 1.05, kv - 0.1, hexRGB(u.t.color || '#888888'));
    u.box(-w / 2 + 0.38, 1.05, kv - 0.77, w / 2 - 1.58, 1.09, kv - 0.08, [0.2, 0.2, 0.22]);
    u.block(-w / 2 + 0.4, kv - 0.75, w / 2 - 1.6, kv - 0.1);
    FUR.register(u.k, ...pick3(u.p(-0.5, kv - 0.4)), u.F.face(0, -1));
    counterZone(u, -0.5, kv - 0.45, 0, -1, 'counter', 2.0);
    u.menuBoard(-0.3, 2.15, kv - 0.04, 0, -1, Math.min(3.2, w - 1.5), 0.85);
    if (o.tables) { let i = 0; for (let v = 1.8; v < kv - 2.0; v += 2.0) for (let a = -w / 2 + 1.2; a < w / 2 - 1.6; a += 2.2) tableSet(u, a, v, { idx: i++, seats: 2, w: 0.9, d: 0.7, top: [0.9, 0.9, 0.88], chair: shade(hexRGB(u.t.color || '#888888'), 0.9) }); }
    u.zone('wait', w / 2 - 1.5, 0.6, w / 2 - 0.3, kv - 1.2);
  },
  bunsik(u) {
    const w = u.w, d = u.d;
    const kv = d - 2.2;
    u.wall(-w / 2 + 0.05, kv, w / 2 - 0.05, kv, 1.1, [0.95, 0.95, 0.94]);
    // 앞 판매대: 떡볶이 판 · 튀김 진열
    u.box(-w / 2 + 0.3, 0, kv - 0.9, w / 2 - 1.2, 0.95, kv - 0.1, [0.9, 0.9, 0.88]);
    u.block(-w / 2 + 0.3, kv - 0.9, w / 2 - 1.2, kv - 0.1);
    const [px, pz] = u.p(-w / 4, kv - 0.5);
    u.k.col(u.k.metal, [0.55, 0.55, 0.58]).addGeo(new THREE.BoxGeometry(1.1, 0.08, 0.6).translate(px, 1.0, pz));
    u.k.col(u.k.solid, [0.85, 0.15, 0.1]).addGeo(new THREE.BoxGeometry(1.0, 0.04, 0.5).translate(px, 1.05, pz));
    for (let i = 0; i < 8; i++) u.box(-w / 4 - 0.4 + i * 0.1, 1.07, kv - 0.6, -w / 4 - 0.35 + i * 0.1, 1.1, kv - 0.4, [0.95, 0.9, 0.85]);
    u.box(0.2, 0.95, kv - 0.85, 1.4, 1.15, kv - 0.15, [0.85, 0.6, 0.25]);
    FUR.register(u.k, ...pick3(u.p(w / 2 - 1.7, kv - 0.5)), u.F.face(0, -1));
    counterZone(u, -0.2, kv - 0.5, 0, -1, 'counter', 2.2);
    u.box(-w / 2 + 0.1, 0, d - 0.6, w / 2 - 0.1, 0.9, d - 0.05, [0.78, 0.8, 0.83], u.k.metal);
    u.block(-w / 2, kv, w / 2, d);
    u.spot('cook', 0, d - 1.1, 0, -1);
    u.menuBoard(0, 2.1, kv + 0.05, 0, -1, Math.min(3, w - 1), 0.85);
    let i = 0;
    for (let v = 1.6; v < kv - 2.0; v += 1.8) for (let a = -w / 2 + 1.0; a < w / 2 - 1.4; a += 1.9) tableSet(u, a, v, { idx: i++, seats: 2, w: 0.9, d: 0.65, top: [0.95, 0.85, 0.6], chair: [0.8, 0.2, 0.15] });
  },
  burger(u) {
    const w = u.w, d = u.d;
    const kv = kitchen(u, 2.4, { kind: 'fry' });
    u.box(-w / 2 + 0.4, 0, kv - 0.75, w / 2 - 0.4, 1.05, kv - 0.1, [0.9, 0.9, 0.9]); u.box(-w / 2 + 0.38, 1.05, kv - 0.77, w / 2 - 0.38, 1.09, kv - 0.08, [0.15, 0.15, 0.15]);
    u.block(-w / 2 + 0.4, kv - 0.75, w / 2 - 0.4, kv - 0.1);
    counterZone(u, 1.0, kv - 0.45, 0, -1, 'pickup', 1.8);
    u.sign(1.0, 2.2, kv - 0.06, 1.4, 0.5, 0, -1, { text: '주문번호 📢', sub: '번호가 뜨면 받아 가세요', bg: '#111', fg: '#ffd21a' }, 96);
    u.menuBoard(-1.2, 2.15, kv - 0.04, 0, -1, Math.min(3, w - 3), 0.85);
    // 키오스크 2대 (입구 옆)
    for (let i = 0; i < 2; i++) { const a = -w / 2 + 0.8 + i * 0.9; FUR.kiosk(u.k, ...u.p(a, 1.3), u.F.face(1, 0)); u.zone('kiosk', a + 0.2, 0.9, a + 0.8, 1.7); }
    let i = 0;
    for (let v = 2.4; v < kv - 1.8; v += 1.9) for (let a = -w / 2 + 1.0; a < w / 2 - 1.0; a += 2.0) tableSet(u, a, v, { idx: i++, seats: 2, w: 0.8, d: 0.6, top: [0.95, 0.85, 0.2], chair: [0.85, 0.15, 0.12] });
  },
  cafe(u) {
    const w = u.w, d = u.d;
    const bv = d - 2.0;
    // 바 (뒤쪽): 에스프레소 머신 · 진열장
    u.box(-w / 2 + 0.4, 0, bv, w / 2 - 0.4, 1.0, bv + 0.6, [0.35, 0.25, 0.18]); u.box(-w / 2 + 0.38, 1.0, bv - 0.02, w / 2 - 0.38, 1.04, bv + 0.62, [0.92, 0.92, 0.9]);
    u.block(-w / 2 + 0.4, bv, w / 2 - 0.4, bv + 0.6);
    u.box(-0.6, 1.04, bv + 0.15, 0.1, 1.5, bv + 0.55, [0.75, 0.76, 0.78], u.k.metal);
    u.box(0.5, 1.04, bv + 0.2, 0.75, 1.45, bv + 0.5, [0.15, 0.15, 0.15]);
    FUR.displayCase(u.k, ...u.p(-w / 2 + 1.3, bv - 0.45), u.F.face(0, -1), { w: Math.min(1.6, w / 2 - 1), d: 0.55, items: [[0.95, 0.85, 0.7], [0.6, 0.35, 0.2], [0.95, 0.6, 0.7], [0.98, 0.95, 0.85]] });
    u.box(-w / 2 + 0.1, 0, d - 0.55, w / 2 - 0.1, 0.9, d - 0.05, [0.8, 0.8, 0.82], u.k.metal); u.box(-w / 2 + 0.1, 1.6, d - 0.45, w / 2 - 0.1, 1.64, d - 0.05, [0.4, 0.3, 0.2]);
    u.block(-w / 2, bv, w / 2, d);
    counterZone(u, w / 2 - 1.4, bv + 0.3, 0, -1, 'counter', 1.6);
    u.zone('pickup', -1.2, bv - 0.9, 0.4, bv - 0.1);
    u.spot('barista', -0.3, bv + 1.1, 0, -1);
    u.menuBoard(0, 2.25, d - 0.06, 0, -1, Math.min(3.2, w - 1.2), 0.85);
    FUR.kiosk(u.k, ...u.p(w / 2 - 0.5, 1.2), u.F.face(-1, 0)); u.zone('kiosk', w / 2 - 1.1, 0.8, w / 2 - 0.3, 1.6);
    let i = 0;
    for (let v = 1.4; v < bv - 1.5; v += 1.8) for (let a = -w / 2 + 1.0; a < w / 2 - 1.5; a += 1.8) {
      FUR.roundTable(u.k, ...u.p(a, v), { r: 0.36, top: [0.95, 0.93, 0.88] });
      for (const s of [-1, 1]) { FUR.chair(u.k, ...u.p(a + s * 0.55, v), u.F.face(-s, 0), { c: [0.55, 0.4, 0.28] }); u.spot('seat', a + s * 0.55, v, -s, 0, { table: i }); }
      u.zone('seat', a - 0.9, v - 0.6, a + 0.9, v + 0.6, { table: i++, seats: 2 });
    }
    FUR.plant(u.k, ...u.p(-w / 2 + 0.4, 0.5), { h: 1.4 });
    for (let a = -w / 2 + 1; a < w / 2; a += 1.5) { const [x, z] = u.p(a, bv - 0.8); u.k.col(u.k.glow, [1, 0.85, 0.6]).addGeo(new THREE.SphereGeometry(0.1, 8, 6).translate(x, 2.2, z)); }
  },
  bakery(u) {
    const w = u.w, d = u.d;
    const cv = d - 1.6;
    u.box(-w / 2 + 0.1, 0, d - 0.6, w / 2 - 0.1, 2.0, d - 0.05, [0.7, 0.5, 0.32]);
    for (let y = 0.5; y < 2; y += 0.45) for (let a = -w / 2 + 0.3; a < w / 2 - 0.3; a += 0.3) u.box(a, y, d - 0.5, a + 0.22, y + 0.12, d - 0.3, [0.85 + u.R() * 0.1, 0.6 + u.R() * 0.15, 0.3]);
    u.block(-w / 2, d - 0.6, w / 2, d);
    // 계산대 + 트레이·집게
    u.box(w / 2 - 2.4, 0, cv - 0.6, w / 2 - 0.3, 1.0, cv, [0.95, 0.92, 0.85]); u.block(w / 2 - 2.4, cv - 0.6, w / 2 - 0.3, cv);
    FUR.register(u.k, ...pick3(u.p(w / 2 - 1.0, cv - 0.3)), u.F.face(0, -1));
    counterZone(u, w / 2 - 1.35, cv - 0.3, 0, -1, 'counter', 1.8);
    u.box(-w / 2 + 0.2, 0, 0.6, -w / 2 + 0.8, 0.9, 1.4, [0.7, 0.5, 0.32]);
    for (let i = 0; i < 4; i++) u.box(-w / 2 + 0.25, 0.9 + i * 0.03, 0.7, -w / 2 + 0.75, 0.92 + i * 0.03, 1.3, [0.75, 0.6, 0.4]);
    u.block(-w / 2 + 0.2, 0.6, -w / 2 + 0.8, 1.4);
    u.zone('tray', -w / 2 + 0.8, 0.5, -w / 2 + 1.6, 1.5);
    // 빵 진열 테이블
    for (let v = 2.0; v < cv - 1.4; v += 1.6) for (let a = -w / 2 + 1.6; a < w / 2 - 1.0; a += 1.9) {
      FUR.table(u.k, ...u.p(a, v), u.F.face(0, 1), { w: 1.3, d: 0.8, h: 0.85, top: [0.75, 0.55, 0.35] });
      for (let i = 0; i < 6; i++) { const [x, z] = u.p(a - 0.45 + (i % 3) * 0.45, v - 0.18 + Math.floor(i / 3) * 0.36); u.k.col(u.k.solid, [0.82 + u.R() * 0.12, 0.55 + u.R() * 0.2, 0.25]).addGeo(new THREE.SphereGeometry(0.1, 8, 6).scale(1.3, 0.6, 1).translate(x, 0.9, z)); }
      u.zone('shelf', a - 0.9, v - 0.75, a + 0.9, v + 0.75, { bread: true });
    }
    u.menuBoard(-w / 2 + 0.06, 2.0, d - 2.5, 1, 0, 2.0, 0.85);
  },
  dessert(u) { FAM.cafe(u); },
  karaoke(u) {
    const w = u.w, d = u.d;
    u.k.floor('carpet', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
    // 카운터 (입구 옆)
    u.counterAt(-w / 2 + 1.2, 1.4, 1, 0, { w: 1.6, c: [0.25, 0.1, 0.35] }); counterZone(u, -w / 2 + 1.2, 1.4, 1, 0, 'counter', 1.6);
    u.sign(-w / 2 + 0.07, 2.2, 1.4, 1.8, 0.5, 1, 0, { text: '🎤 ' + u.t.name, sub: '1시간 15,000원 · 코인 1곡 500원', bg: '#2a0a3a', fg: '#ff7ae0' }, 96);
    // 복도 + 방들 (양쪽)
    const cw = 1.6, rd = Math.min(3.2, (w - cw) / 2);
    const cu = 0.6, rv0 = 3.0;
    let i = 0;
    for (let v = rv0; v + 2.6 <= d - 0.1; v += 2.7) {
      for (const s of [-1, 1]) {
        const a0 = s < 0 ? cu - cw / 2 - rd : cu + cw / 2, a1 = a0 + rd;
        if (a0 < -w / 2 - 0.01 || a1 > w / 2 + 0.01) continue;
        const ri = i++;
        const doorU = s < 0 ? a1 : a0;
        u.wall(doorU, v, doorU, v + 2.6, 2.6, [0.2, 0.1, 0.25], [{ u0: 0.3, u1: 1.15, y0: 0, y1: 2.1 }, { u0: 1.3, u1: 1.9, y0: 1.2, y1: 1.8, glass: true }]);
        u.wall(a0, v + 2.6, a1, v + 2.6, 2.6, [0.25, 0.12, 0.3]);
        // 소파 (ㄷ자) · 테이블 · 화면
        const far = s < 0 ? a0 + 0.35 : a1 - 0.35;
        u.box(Math.min(far, far - s * 0.0) - 0.3, 0, v + 0.3, Math.max(far, far) + 0.3, 0.45, v + 2.3, [0.55, 0.1, 0.4]);
        u.box(far - 0.32, 0.45, v + 0.3, far + 0.32, 0.9, v + 0.5, [0.55, 0.1, 0.4]);
        FUR.table(u.k, ...u.p((a0 + a1) / 2 + s * 0.2, v + 1.3), u.F.face(0, 1), { w: 0.6, d: 1.0, h: 0.45, top: [0.15, 0.15, 0.18], collide: true });
        const scrU = s < 0 ? a1 - 0.06 : a0 + 0.06;
        u.box(scrU - 0.03, 1.0, v + 0.8, scrU + 0.03, 1.85, v + 1.9, [0.05, 0.05, 0.06]);
        u.glow(scrU - 0.035 * s - 0.005, 1.04, v + 0.84, scrU - 0.035 * s + 0.005, 1.81, v + 1.86, [0.25, 0.3, 0.75]);
        u.glow((a0 + a1) / 2 - 0.1, 2.5, v + 1.2, (a0 + a1) / 2 + 0.1, 2.55, v + 1.4, [1, 0.3, 0.9]);
        u.block(Math.min(far - 0.32, far + 0.32), v + 0.3, Math.max(far - 0.32, far + 0.32), v + 2.3);
        u.zone('krroom', Math.min(a0, a1) + 0.4, v + 0.3, Math.max(a0, a1) - 0.4, v + 2.3, { room: ri, label: `${ri + 1}번 방` });
        u.sign(s < 0 ? a1 + 0.06 : a0 - 0.06, 2.3, v + 0.75, 0.5, 0.25, -s, 0, { text: `${ri + 1}`, bg: '#ff2a8a', fg: '#fff' }, 48);
      }
    }
  },
  pcbang(u) {
    const w = u.w, d = u.d;
    u.k.floor('carpet', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
    u.counterAt(w / 2 - 1.3, 1.3, -1, 0, { w: 1.8, c: [0.1, 0.1, 0.12] }); counterZone(u, w / 2 - 1.3, 1.3, -1, 0, 'counter', 1.8);
    u.box(w / 2 - 0.6, 0, 2.4, w / 2 - 0.05, 1.8, 4.2, [0.15, 0.15, 0.17]); u.glow(w / 2 - 0.61, 0.9, 2.5, w / 2 - 0.6, 1.7, 4.1, [0.95, 0.75, 0.3]);
    u.block(w / 2 - 0.6, 2.4, w / 2, 4.2);
    u.sign(w / 2 - 0.07, 2.2, 1.3, 1.6, 0.45, -1, 0, { text: '🖥️ ' + u.t.name, sub: '1시간 1,500원 · 라면 4,500원', bg: '#0a0a14', fg: '#46d1ff' }, 96);
    let i = 0;
    for (let v = 2.6; v < d - 0.8; v += 1.8) {
      for (let a = -w / 2 + 0.6; a < w / 2 - 1.4; a += 0.85) {
        const back = (Math.round((v - 2.6) / 1.8) % 2);
        u.box(a - 0.4, 0.72, v - 0.35, a + 0.4, 0.75, v + 0.35, [0.12, 0.12, 0.14]);
        u.block(a - 0.4, v - 0.35, a + 0.4, v + 0.35);
        const mv = back ? v - 0.22 : v + 0.22;
        u.box(a - 0.3, 0.8, mv - 0.02, a + 0.3, 1.18, mv + 0.02, [0.05, 0.05, 0.05]);
        u.glow(a - 0.28, 0.82, mv + (back ? 0.021 : -0.021) - 0.002, a + 0.28, 1.16, mv + (back ? 0.021 : -0.021) + 0.002, [0.2 + u.R() * 0.3, 0.3 + u.R() * 0.4, 0.8]);
        const sv = back ? v + 0.75 : v - 0.75;
        u.box(a - 0.26, 0.3, sv - 0.25, a + 0.26, 0.5, sv + 0.25, [0.6, 0.08, 0.1]); u.box(a - 0.26, 0.5, back ? sv + 0.2 : sv - 0.25, a + 0.26, 1.25, back ? sv + 0.25 : sv - 0.2, [0.6, 0.08, 0.1]);
        u.zone('pcseat', a - 0.4, Math.min(sv, v) - 0.35, a + 0.4, Math.max(sv, v) + 0.35, { seat: i++ });
      }
    }
  },
  kidscafe(u) {
    const w = u.w, d = u.d;
    u.k.floor('kids', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
    u.counterAt(w / 2 - 1.2, 1.2, -1, 0, { w: 1.6, c: [1, 0.85, 0.3] }); counterZone(u, w / 2 - 1.2, 1.2, -1, 0, 'counter', 1.6);
    // 정글짐 · 미끄럼틀 · 볼풀
    const cols = [[1, 0.3, 0.3], [0.3, 0.6, 1], [1, 0.85, 0.2], [0.4, 0.85, 0.4]];
    const jx = -w / 4, jv = d / 2;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) u.box(jx - 1.5 + i, 0, jv - 1 + j, jx - 1.45 + i, 2.2, jv - 0.95 + j, cols[(i + j) % 4]);
    for (const y of [1.0, 2.0]) u.box(jx - 1.5, y, jv - 1, jx + 1.55, y + 0.08, jv + 1.05, [0.95, 0.95, 0.95]);
    u.block(jx - 1.5, jv - 1, jx + 1.55, jv + 1.05);
    u.box(w / 4 - 1, 0, d - 3, w / 4 + 1, 0.4, d - 1, [0.3, 0.6, 1]);
    for (let i = 0; i < 70; i++) { const [x, z] = u.p(w / 4 - 0.9 + u.R() * 1.8, d - 2.9 + u.R() * 1.8); u.k.col(u.k.solid, cols[i % 4]).addGeo(new THREE.SphereGeometry(0.08, 6, 5).translate(x, 0.42 + u.R() * 0.06, z)); }
    u.zone('play', -w / 2 + 0.5, 2.5, w / 2 - 0.5, d - 0.5, { play: true });
    FUR.sofa(u.k, ...u.p(-w / 2 + 1.5, 1.4), u.F.face(1, 0), { w: 1.6, c: [0.95, 0.75, 0.35] });
  },
  petshop(u) {
    const w = u.w, d = u.d;
    for (let i = 0; i < Math.floor((w - 1) / 1.0); i++) for (let j = 0; j < 2; j++) {
      const a = -w / 2 + 0.6 + i * 1.0;
      u.box(a - 0.45, 0.3 + j * 0.75, d - 0.9, a + 0.45, 0.33 + j * 0.75, d - 0.1, [0.95, 0.95, 0.95]);
      u.box(a - 0.45, 0.33 + j * 0.75, d - 0.15, a + 0.45, 1.02 + j * 0.75, d - 0.1, [0.95, 0.95, 0.95]);
      const [gx, gz] = u.p(a, d - 0.9); void gx; void gz;
      u.k.glass.quad(...glassQuad(u, a - 0.45, a + 0.45, d - 0.9, 0.33 + j * 0.75, 1.02 + j * 0.75));
    }
    u.block(-w / 2, d - 0.9, w / 2, d);
    u.zone('pets', -w / 2 + 0.5, d - 1.6, w / 2 - 0.5, d - 0.9);
    u.spots.push({ kind: 'pets', cages: Math.floor((w - 1) / 1.0) * 2, ...(() => { const [x, z] = u.p(-w / 2 + 0.6, d - 0.5); return { x, z }; })(), F: u.F });
    FUR.shelf(u.k, ...u.p(-w / 2 + 0.3, d / 2 - 0.5), u.F.face(1, 0), { w: 2.4, palette: [[0.9, 0.5, 0.2], [0.3, 0.6, 0.9], [0.95, 0.85, 0.3]] });
    u.zone('shelf', -w / 2 + 0.5, d / 2 - 1.8, -w / 2 + 1.4, d / 2 + 0.8, { goods: 'petshop' });
    u.counterAt(w / 2 - 1.2, 1.4, -1, 0, { w: 1.6 }); counterZone(u, w / 2 - 1.2, 1.4, -1, 0, 'counter', 1.6);
  },
  vet(u) { FAM.clinic(u, { pet: true }); },
  clinic(u, o = {}) {
    const w = u.w, d = u.d;
    const rv = d - 3.2;
    // 진료실 (뒤쪽 칸막이)
    const n = Math.max(1, Math.min(3, Math.floor(w / 3)));
    const rw = w / n;
    for (let i = 0; i < n; i++) {
      const a0 = -w / 2 + i * rw;
      u.wall(a0, rv, a0 + rw, rv, 2.5, [0.96, 0.97, 0.98], [{ u0: rw / 2 - 0.5, u1: rw / 2 + 0.5, y0: 0, y1: 2.1 }]);
      if (i > 0) u.wall(a0, rv, a0, d, 2.5, [0.96, 0.97, 0.98]);
      const cx = a0 + rw / 2;
      if (u.fam === 'dental') { u.box(cx - 0.35, 0, d - 2.2, cx + 0.35, 0.55, d - 0.6, [0.2, 0.6, 0.75]); u.box(cx - 0.35, 0.55, d - 0.85, cx + 0.35, 1.2, d - 0.6, [0.2, 0.6, 0.75]); u.glow(cx - 0.15, 2.0, d - 1.6, cx + 0.15, 2.05, d - 1.3, [1, 1, 0.95]); u.block(cx - 0.4, d - 2.2, cx + 0.4, d - 0.6); }
      else if (o.pet) { u.box(cx - 0.5, 0, d - 1.8, cx + 0.5, 0.9, d - 1.0, [0.8, 0.82, 0.85], u.k.metal); u.block(cx - 0.5, d - 1.8, cx + 0.5, d - 1.0); }
      else { FUR.bed(u.k, ...u.p(cx + rw / 2 - 0.7, d - 1.3), u.F.face(-1, 0), { w: 0.8, l: 1.9 }); }
      FUR.desk(u.k, ...u.p(a0 + 0.8, d - 0.9), u.F.face(0, -1), { w: 1.1, d: 0.6, chair: false });
      FUR.chair(u.k, ...u.p(a0 + 0.8, d - 1.55), u.F.face(0, 1), { c: [0.2, 0.2, 0.25] });
      u.zone('exam', a0 + 0.3, rv + 0.2, a0 + rw - 0.3, d - 0.3, { room: i, label: `진료실 ${i + 1}` });
      u.spot('doctor', a0 + 0.8, d - 0.35, 0, -1, { room: i });
    }
    // 접수 · 대기
    u.counterAt(w / 2 - 1.3, 1.5, -1, 0, { w: 1.8, c: [0.97, 0.97, 0.98], top: [0.85, 0.88, 0.9] });
    counterZone(u, w / 2 - 1.3, 1.5, -1, 0, 'reception', 1.8);
    u.sign(w / 2 - 0.07, 2.2, 1.5, 1.4, 0.4, -1, 0, { text: '접수 · 수납', bg: o.pet ? '#6a1b9a' : '#1565c0', fg: '#fff' }, 64);
    for (let i = 0; i < Math.max(1, Math.floor((w - 3) / 2.2)); i++) FUR.sofa(u.k, ...u.p(-w / 2 + 1.4 + i * 2.2, rv - 0.6), u.F.face(0, -1), { w: 1.8, c: o.pet ? [0.6, 0.4, 0.7] : [0.55, 0.7, 0.8] });
    u.zone('wait', -w / 2 + 0.4, rv - 1.3, w / 2 - 2.4, rv - 0.1);
    FUR.tv(u.k, ...(() => { const [x, z] = u.p(-w / 2 + 0.06, 2.6); return [x, 1.6, z]; })(), u.F.face(1, 0), { w: 1.1 });
    u.sign(-w / 2 + 0.07, 2.4, 1.2, 0.6, 0.3, 1, 0, { text: '대기 03', bg: '#0a1020', fg: '#46d1ff' }, 48);
    FUR.water(u.k, ...u.p(-w / 2 + 0.4, rv - 2.4), u.F.face(1, 0));
  },
  dental(u) { FAM.clinic(u); },
  pharmacy(u) {
    const w = u.w, d = u.d;
    for (let a = -w / 2 + 1.2; a < w / 2 - 0.8; a += 2.0) FUR.shelf(u.k, ...u.p(a, d - 0.3), u.F.face(0, -1), { w: 1.8, d: 0.4, h: 2.0, levels: 5, palette: [[0.95, 0.95, 0.95], [0.9, 0.3, 0.3], [0.3, 0.6, 0.9], [0.95, 0.8, 0.3], [0.4, 0.75, 0.5]] });
    u.box(-w / 2 + 0.5, 0, d - 1.9, w / 2 - 0.5, 1.0, d - 1.3, [0.95, 0.97, 0.97]); u.box(-w / 2 + 0.48, 1.0, d - 1.92, w / 2 - 0.48, 1.04, d - 1.28, [0.2, 0.55, 0.5]);
    u.block(-w / 2 + 0.5, d - 1.9, w / 2 - 0.5, d - 1.3);
    FUR.register(u.k, ...pick3(u.p(0.6, d - 1.6)), u.F.face(0, -1));
    counterZone(u, 0, d - 1.6, 0, -1, 'counter', 2.4);
    u.spot('staff', 0, d - 0.9, 0, -1, { counter: true });
    FUR.shelf(u.k, ...u.p(-w / 2 + 0.3, d / 2 - 1), u.F.face(1, 0), { w: 1.8, h: 1.5, levels: 4 });
    u.zone('shelf', -w / 2 + 0.5, d / 2 - 2.2, -w / 2 + 1.5, d / 2 + 0.2, { goods: 'pharmacy' });
    u.sign(0, 2.3, d - 0.08, 1.4, 0.4, 0, -1, { text: '💊 처방전 접수', bg: '#00796b', fg: '#fff' }, 64);
  },
  bank(u) {
    const w = u.w, d = u.d;
    const cv = d - 2.2;
    const n = Math.max(2, Math.min(5, Math.floor((w - 1) / 1.8)));
    const cw = (w - 1) / n;
    u.box(-w / 2 + 0.5, 0, cv, w / 2 - 0.5, 1.0, cv + 0.7, [0.9, 0.9, 0.88]); u.block(-w / 2 + 0.5, cv, w / 2 - 0.5, cv + 0.7);
    for (let i = 0; i < n; i++) {
      const a = -w / 2 + 0.5 + (i + 0.5) * cw;
      u.k.glass.quad(...glassQuad(u, a - cw / 2 + 0.05, a + cw / 2 - 0.05, cv, 1.0, 1.8));
      u.box(a - 0.15, 1.95, cv + 0.05, a + 0.15, 2.15, cv + 0.1, [0.1, 0.1, 0.12]);
      u.sign(a, 2.05, cv - 0.01, 0.3, 0.18, 0, -1, { text: `${i + 1}`, bg: '#101418', fg: '#ff7a1a' }, 40);
      FUR.chair(u.k, ...u.p(a, cv - 0.6), u.F.face(0, 1), { c: [0.2, 0.3, 0.55] });
      u.zone('teller', a - cw / 2 + 0.1, cv - 1.0, a + cw / 2 - 0.1, cv - 0.15, { num: i + 1 });
      u.spot('staff', a, cv + 1.1, 0, -1, { counter: true });
    }
    u.box(-w / 2 + 0.1, 0, d - 0.6, w / 2 - 0.1, 0.8, d - 0.1, [0.85, 0.85, 0.85]);
    // 번호표 · ATM
    u.box(w / 2 - 0.8, 0, 1.0, w / 2 - 0.4, 1.3, 1.4, [0.95, 0.95, 0.95]); u.glow(w / 2 - 0.81, 1.0, 1.05, w / 2 - 0.8, 1.2, 1.35, [0.3, 0.6, 0.9]);
    u.block(w / 2 - 0.8, 1.0, w / 2 - 0.4, 1.4); u.zone('ticket', w / 2 - 1.6, 0.8, w / 2 - 0.8, 1.6);
    for (let i = 0; i < 2; i++) { u.box(-w / 2 + 0.1, 0, 0.8 + i * 1.0, -w / 2 + 0.7, 1.7, 1.6 + i * 1.0, [0.25, 0.3, 0.45]); u.glow(-w / 2 + 0.701, 1.05, 0.95 + i * 1.0, -w / 2 + 0.705, 1.4, 1.45 + i * 1.0, [0.5, 0.75, 1]); u.block(-w / 2 + 0.1, 0.8 + i, -w / 2 + 0.7, 1.6 + i); }
    u.zone('atm', -w / 2 + 0.7, 0.8, -w / 2 + 1.6, 2.6);
    for (let i = 0; i < Math.max(1, Math.floor((w - 3) / 2.0)); i++) for (let r = 0; r < 2; r++) FUR.bench(u.k, ...u.p(-w / 2 + 2.2 + i * 2.0, cv - 2.0 - r * 1.2), u.F.face(0, 1), { w: 1.6, c: [0.25, 0.35, 0.6] });
    u.zone('wait', -w / 2 + 1.5, cv - 3.8, w / 2 - 1.5, cv - 1.2);
  },
  realty(u) {
    const w = u.w, d = u.d;
    for (let i = 0; i < Math.min(3, Math.floor(w / 2.4)); i++) FUR.desk(u.k, ...u.p(-w / 2 + 1.4 + i * 2.4, d - 1.4), u.F.face(0, -1), { w: 1.4 });
    for (let i = 0; i < Math.min(3, Math.floor(w / 2.4)); i++) u.spot('staff', -w / 2 + 1.4 + i * 2.4, d - 0.75, 0, -1);
    FUR.sofa(u.k, ...u.p(-w / 2 + 1.3, 1.6), u.F.face(1, 0), { w: 1.8, c: [0.45, 0.35, 0.3] });
    FUR.table(u.k, ...u.p(-w / 2 + 2.3, 1.6), u.F.face(0, 1), { w: 0.6, d: 1.0, h: 0.45 });
    u.zone('counter', -w / 2 + 0.8, d - 2.6, w / 2 - 0.8, d - 1.9, { realty: true });
    for (let i = 0; i < Math.floor(w / 1.1); i++) u.sign(-w / 2 + 0.6 + i * 1.1, 1.6 + (i % 2) * 0.55, d - 0.06, 0.9, 0.5, 0, -1, { text: ['급매', '전세', '월세', '매매', '신축'][i % 5], sub: ['32평 · 5.2억', '24평 · 3.1억', '원룸 500/45', '상가 1층', '투룸 1000/60'][i % 5], bg: '#ffffff', fg: '#1d3b6e', border: '#1d3b6e' }, 64);
  },
  academy(u) {
    const w = u.w, d = u.d;
    const n = Math.max(1, Math.min(3, Math.floor(w / 3.5)));
    const rw = w / n, rv = 3.2;
    u.counterAt(w / 2 - 1.2, 1.4, -1, 0, { w: 1.4 }); counterZone(u, w / 2 - 1.2, 1.4, -1, 0, 'reception', 1.4);
    for (let i = 0; i < n; i++) {
      const a0 = -w / 2 + i * rw;
      u.wall(a0, rv, a0 + rw, rv, 2.6, [0.95, 0.95, 0.92], [{ u0: 0.4, u1: 1.3, y0: 0, y1: 2.1 }, { u0: 1.6, u1: rw - 0.4, y0: 1.0, y1: 1.9, glass: true }]);
      if (i > 0) u.wall(a0, rv, a0, d, 2.6, [0.95, 0.95, 0.92]);
      FUR.whiteboard(u.k, ...(() => { const [x, z] = u.p(a0 + rw / 2, d - 0.06); return [x, 0.9, z]; })(), u.F.face(0, -1), { w: Math.min(2.6, rw - 0.8) });
      for (let r = 0; r < 3; r++) for (let c = 0; c < Math.floor((rw - 0.6) / 1.1); c++) {
        const a = a0 + 0.8 + c * 1.1, v = d - 2.0 - r * 1.2;
        if (v < rv + 0.8) continue;
        FUR.table(u.k, ...u.p(a, v), u.F.face(0, -1), { w: 0.9, d: 0.5, h: 0.72, top: [0.85, 0.8, 0.7] });
        FUR.chair(u.k, ...u.p(a, v - 0.5), u.F.face(0, 1), { c: [0.3, 0.45, 0.65] });
      }
      u.zone('class', a0 + 0.3, rv + 0.3, a0 + rw - 0.3, d - 0.3, { room: i });
      u.spot('teacher', a0 + rw / 2, d - 0.5, 0, -1, { room: i });
    }
    for (let a = -w / 2 + 0.5; a < w / 2 - 2.5; a += 1.1) u.sign(a + 0.5, 1.7, 0.08, 0.9, 0.6, 0, 1, { text: ['합격!', '수강생 모집', '1:1 상담', '자격증반'][Math.floor(a + 10) % 4], bg: '#fff8e0', fg: hexToCss(u.t.color) }, 64);
  },
  taekwondo(u) {
    const w = u.w, d = u.d;
    u.k.floor('mat', ...minmax(u.p(-w / 2 + 0.5, 2.4), u.p(w / 2 - 0.5, d - 0.5)));
    FUR.mirror(u.k, ...(() => { const [x, z] = u.p(0, d - 0.06); return [x, 0.3, z]; })(), u.F.face(0, -1), { w: Math.min(6, w - 1), h: 1.9 });
    for (let i = 0; i < 2; i++) { const [x, z] = u.p(-w / 2 + 1 + i * 1.4, 3); u.k.col(u.k.solid, [0.8, 0.15, 0.12]).addGeo(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 12).translate(x, 1.2, z)); u.k.col(u.k.metal, [0.5, 0.5, 0.5]).addGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4).translate(x, 2.05, z)); }
    u.counterAt(w / 2 - 1.0, 1.2, -1, 0, { w: 1.2 }); counterZone(u, w / 2 - 1.0, 1.2, -1, 0, 'reception', 1.2);
    u.zone('class', -w / 2 + 1, 3.0, w / 2 - 1, d - 1, { gym: true });
    u.sign(0, 2.35, d - 0.07, 2.0, 0.4, 0, -1, { text: '태 권 도', bg: '#b71c1c', fg: '#fff' }, 64);
    u.spot('teacher', 0, d - 1.5, 0, -1);
  },
  piano(u) {
    const w = u.w, d = u.d;
    const n = Math.max(1, Math.floor(w / 2.2));
    for (let i = 0; i < n; i++) {
      const a0 = -w / 2 + i * (w / n), a1 = a0 + w / n;
      u.wall(a0, d - 2.6, a1, d - 2.6, 2.5, [0.97, 0.94, 0.9], [{ u0: 0.3, u1: 1.1, y0: 0, y1: 2.1 }]);
      if (i > 0) u.wall(a0, d - 2.6, a0, d, 2.5, [0.97, 0.94, 0.9]);
      const cx = (a0 + a1) / 2;
      u.box(cx - 0.7, 0, d - 0.65, cx + 0.7, 1.25, d - 0.1, [0.08, 0.06, 0.05]); u.box(cx - 0.65, 0.72, d - 0.8, cx + 0.65, 0.78, d - 0.65, [0.95, 0.95, 0.95]);
      u.block(cx - 0.7, d - 0.8, cx + 0.7, d - 0.1); FUR.stool(u.k, ...u.p(cx, d - 1.2), { c: [0.1, 0.1, 0.1] });
      u.zone('class', a0 + 0.2, d - 2.4, a1 - 0.2, d - 0.85, { room: i, piano: true });
    }
    u.counterAt(w / 2 - 1.0, 1.2, -1, 0, { w: 1.2 }); counterZone(u, w / 2 - 1.0, 1.2, -1, 0, 'reception', 1.2);
    FUR.sofa(u.k, ...u.p(-w / 2 + 1.2, 1.4), u.F.face(1, 0), { w: 1.6 });
  },
  art(u) {
    const w = u.w, d = u.d;
    for (let v = 2.2; v < d - 1.2; v += 2.0) FUR.table(u.k, ...u.p(0, v), u.F.face(0, 1), { w: Math.min(3.2, w - 2.5), d: 1.0, top: [0.95, 0.95, 0.95] });
    for (let i = 0; i < Math.floor(w / 1.3); i++) { const a = -w / 2 + 0.7 + i * 1.3; u.box(a - 0.03, 0, d - 0.6, a + 0.03, 1.6, d - 0.55, COL.WOOD); u.box(a - 0.35, 1.0, d - 0.62, a + 0.35, 1.5, d - 0.6, [0.95, 0.9 - (i % 3) * 0.2, 0.7 + (i % 2) * 0.2]); }
    u.counterAt(w / 2 - 1.0, 1.2, -1, 0, { w: 1.2 }); counterZone(u, w / 2 - 1.0, 1.2, -1, 0, 'reception', 1.2);
    u.zone('class', -w / 2 + 0.6, 1.8, w / 2 - 2.0, d - 0.8, { art: true });
  },
  reading(u) {
    const w = u.w, d = u.d;
    u.k.floor('carpet', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
    u.counterAt(w / 2 - 1.0, 1.2, -1, 0, { w: 1.2, c: [0.3, 0.32, 0.35] }); counterZone(u, w / 2 - 1.0, 1.2, -1, 0, 'counter', 1.2);
    u.wall(-w / 2, 2.4, w / 2 - 2.0, 2.4, 2.6, [0.4, 0.42, 0.45], [{ u0: w - 3.2, u1: w - 2.2, y0: 0, y1: 2.1 }]);
    let i = 0;
    for (let v = 3.0; v < d - 0.6; v += 1.3) for (let a = -w / 2 + 0.6; a < w / 2 - 0.5; a += 0.95) {
      u.box(a - 0.45, 0.72, v, a + 0.45, 0.75, v + 0.55, [0.85, 0.8, 0.7]);
      u.box(a - 0.47, 0, v + 0.55, a + 0.47, 1.35, v + 0.58, [0.35, 0.37, 0.4]);
      u.box(a + 0.45, 0, v, a + 0.48, 1.35, v + 0.58, [0.35, 0.37, 0.4]);
      u.glow(a - 0.2, 1.2, v + 0.45, a + 0.2, 1.22, v + 0.52, [1, 0.95, 0.8]);
      u.block(a - 0.47, v, a + 0.48, v + 0.58);
      FUR.chair(u.k, ...u.p(a, v - 0.25), u.F.face(0, 1), { c: [0.15, 0.15, 0.18] });
      u.zone('desk', a - 0.4, v - 0.6, a + 0.4, v - 0.02, { seat: i++ });
    }
  },
  studycafe(u) {
    const w = u.w, d = u.d;
    u.k.floor('wood', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
    FUR.kiosk(u.k, ...u.p(w / 2 - 0.5, 1.0), u.F.face(-1, 0)); u.zone('kiosk', w / 2 - 1.2, 0.5, w / 2 - 0.3, 1.5);
    u.box(-w / 2 + 0.1, 0, 0.5, -w / 2 + 0.7, 1.0, 2.2, [0.9, 0.9, 0.9]); u.box(-w / 2 + 0.2, 1.0, 0.7, -w / 2 + 0.6, 1.5, 1.2, [0.2, 0.2, 0.2]);
    u.block(-w / 2 + 0.1, 0.5, -w / 2 + 0.7, 2.2); u.zone('snack', -w / 2 + 0.7, 0.5, -w / 2 + 1.5, 2.2);
    let i = 0;
    for (let v = 2.8; v < d - 0.6; v += 1.4) {
      FUR.table(u.k, ...u.p(0, v), u.F.face(0, 1), { w: w - 1.6, d: 0.7, top: [0.95, 0.93, 0.88] });
      for (let a = -w / 2 + 1.1; a < w / 2 - 0.9; a += 0.9) { FUR.chair(u.k, ...u.p(a, v - 0.6), u.F.face(0, 1), { c: [0.5, 0.45, 0.4] }); u.glow(a - 0.15, 1.2, v - 0.05, a + 0.15, 1.22, v + 0.05, [1, 0.95, 0.85]); u.zone('desk', a - 0.4, v - 0.95, a + 0.4, v - 0.35, { seat: i++ }); }
    }
  },
  bookstore(u) {
    const w = u.w, d = u.d;
    for (let a = -w / 2 + 1; a < w / 2 - 0.8; a += 1.9) FUR.shelf(u.k, ...u.p(a, d - 0.3), u.F.face(0, -1), { w: 1.8, d: 0.35, h: 2.1, levels: 6, c: COL.WOOD, palette: [[0.75, 0.2, 0.2], [0.2, 0.35, 0.6], [0.9, 0.85, 0.7], [0.25, 0.5, 0.3], [0.85, 0.6, 0.2], [0.4, 0.3, 0.5]] });
    for (let v = 2.0; v < d - 1.8; v += 1.8) { FUR.table(u.k, ...u.p(-0.5, v), u.F.face(0, 1), { w: 1.8, d: 0.9, h: 0.8, top: COL.WOOD }); for (let i = 0; i < 8; i++) u.box(-1.3 + (i % 4) * 0.4, 0.8, v - 0.3 + Math.floor(i / 4) * 0.35, -1.0 + (i % 4) * 0.4, 0.86 + u.R() * 0.06, v - 0.05 + Math.floor(i / 4) * 0.35, [0.3 + u.R() * 0.6, 0.3 + u.R() * 0.5, 0.3 + u.R() * 0.5]); u.zone('shelf', -1.5, v - 0.8, 0.5, v + 0.8, { goods: 'bookstore' }); }
    u.counterAt(w / 2 - 1.0, 1.4, -1, 0, { w: 1.4, c: COL.WOOD }); counterZone(u, w / 2 - 1.0, 1.4, -1, 0, 'counter', 1.4);
  },
  mart(u) {
    const w = u.w, d = u.d;
    for (let a = -w / 2 + 1.5; a < w / 2 - 1.5; a += 2.0) FUR.shelf(u.k, ...u.p(a, d - 0.3), u.F.face(0, -1), { w: 1.9, d: 0.5, h: 1.9 });
    // 진열대마다 파는 물건이 달라요 (라면·식료품 / 과자 / 생활·문구), 냉장고는 음료·아이스크림·간편식
    const AISLES = [{ cats: ['ramen', 'grocery'], aisle: '🍜 라면·식료품' }, { cats: ['snack', 'ssnack'], aisle: '🍪 과자·간식' }, { cats: ['snote', 'spen', 'soffice', 'sart', 'stoy'], aisle: '✏️ 생활·문구' }];
    const vs = []; for (let v = 3.0; v < d - 2.5; v += 2.4) vs.push(v);
    vs.forEach((v, j) => {
      FUR.shelf(u.k, ...u.p(-0.6, v), u.F.face(0, -1), { w: Math.min(4, w - 4), d: 0.45, h: 1.5 }); FUR.shelf(u.k, ...u.p(-0.6, v + 0.46), u.F.face(0, 1), { w: Math.min(4, w - 4), d: 0.45, h: 1.5 });
      let g = AISLES[j % AISLES.length];
      if (j === vs.length - 1 && vs.length < AISLES.length) { const rest = AISLES.slice(j); g = { cats: rest.flatMap(a => a.cats), aisle: rest.map(a => a.aisle).join(' · ') }; }
      u.zone('shelf', -0.6 - Math.min(2, w / 2 - 2), v - 0.9, -0.6 + Math.min(2, w / 2 - 2), v + 1.4, { goods: 'mart', cats: g.cats, aisle: g.aisle });
    });
    for (let i = 0; i < 2; i++) FUR.fridge(u.k, ...u.p(-w / 2 + 0.4, 2.0 + i * 1.3), u.F.face(1, 0), { w: 1.2 });
    u.zone('shelf', -w / 2 + 0.4, 1.3, -w / 2 + 1.5, 4.0, { goods: 'mart', cats: ['drink', 'ice', 'chill'], aisle: '🧊 냉장고 · 음료·아이스크림·도시락' });
    u.counterAt(w / 2 - 1.2, 1.4, -1, 0, { w: 1.8 }); counterZone(u, w / 2 - 1.2, 1.4, -1, 0, 'counter', 1.8);
  },
  grocer(u) {
    const w = u.w, d = u.d;
    const cols = { fruit: [[0.9, 0.15, 0.15], [1, 0.6, 0.1], [0.95, 0.85, 0.2], [0.4, 0.75, 0.3], [0.6, 0.2, 0.5]], flower: [[0.95, 0.3, 0.45], [1, 0.85, 0.3], [0.9, 0.9, 0.95], [0.75, 0.4, 0.85], [1, 0.55, 0.6]] }[u.fam === 'flower' ? 'flower' : 'fruit'];
    for (let v = 1.2; v < d - 1.0; v += 1.4) for (let a = -w / 2 + 0.9; a < w / 2 - 1.8; a += 1.3) {
      u.box(a - 0.5, 0, v - 0.4, a + 0.5, 0.5, v + 0.4, [0.7, 0.52, 0.32]); u.block(a - 0.5, v - 0.4, a + 0.5, v + 0.4);
      const c = cols[Math.floor(u.R() * cols.length)];
      for (let i = 0; i < 9; i++) { const [x, z] = u.p(a - 0.3 + (i % 3) * 0.3, v - 0.25 + Math.floor(i / 3) * 0.25); u.k.col(u.k.solid, c).addGeo(new THREE.SphereGeometry(u.fam === 'flower' ? 0.1 : 0.12, 8, 6).translate(x, u.fam === 'flower' ? 0.75 + u.R() * 0.2 : 0.58, z)); if (u.fam === 'flower') u.k.col(u.k.solid, [0.2, 0.55, 0.25]).addGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3).translate(x, 0.55, z)); }
    }
    u.zone('shelf', -w / 2 + 0.4, 0.6, w / 2 - 1.8, d - 0.6, { goods: u.fam === 'flower' ? 'flower' : 'fruit' });
    u.counterAt(w / 2 - 0.8, d - 1.5, -1, 0, { w: 1.4 }); counterZone(u, w / 2 - 0.8, d - 1.5, -1, 0, 'counter', 1.4);
  },
  flower(u) { FAM.grocer(u); },
  butcher(u) {
    const w = u.w, d = u.d;
    FUR.displayCase(u.k, ...u.p(0, d - 1.6), u.F.face(0, -1), { w: w - 1.4, d: 0.8, h: 1.2, items: [[0.85, 0.3, 0.3], [0.95, 0.75, 0.7], [0.7, 0.2, 0.25]] });
    u.box(-w / 2 + 0.2, 0, d - 0.6, w / 2 - 0.2, 0.9, d - 0.1, [0.8, 0.82, 0.85], u.k.metal); u.block(-w / 2, d - 0.6, w / 2, d);
    counterZone(u, 0, d - 1.6, 0, -1, 'counter', w - 2);
    u.zone('shelf', -w / 2 + 0.6, d - 3.0, w / 2 - 0.6, d - 2.1, { goods: u.t.type === 'butcher' ? 'butcher' : 'deli' });
    u.spot('staff', 0, d - 0.95, 0, -1, { counter: true });
  },
  deli(u) { FAM.butcher(u); },
  optician(u) { FAM.retailWall(u, 'optician', [[0.15, 0.15, 0.15], [0.6, 0.4, 0.2], [0.75, 0.75, 0.8]]); },
  phone(u) { FAM.retailWall(u, 'phone', [[0.12, 0.12, 0.14], [0.85, 0.85, 0.88], [0.3, 0.5, 0.85]]); },
  retailWall(u, goods, pal) {
    const w = u.w, d = u.d;
    for (let a = -w / 2 + 1; a < w / 2 - 0.8; a += 1.9) FUR.shelf(u.k, ...u.p(a, d - 0.25), u.F.face(0, -1), { w: 1.8, d: 0.3, h: 2.0, levels: 5, c: [0.95, 0.95, 0.95], palette: pal });
    for (let v = 2.0; v < d - 2.0; v += 2.0) { FUR.table(u.k, ...u.p(-0.6, v), u.F.face(0, 1), { w: 1.6, d: 0.8, h: 0.9, top: [0.95, 0.95, 0.95] }); u.zone('shelf', -1.6, v - 0.8, 0.4, v + 0.8, { goods }); }
    u.counterAt(w / 2 - 1.0, 1.4, -1, 0, { w: 1.4 }); counterZone(u, w / 2 - 1.0, 1.4, -1, 0, 'counter', 1.4);
  },
  laundry(u) {
    const w = u.w, d = u.d;
    u.box(-w / 2 + 0.4, 1.9, d - 1.6, w / 2 - 0.4, 1.95, d - 1.5, [0.7, 0.7, 0.72], u.k.metal);
    for (let a = -w / 2 + 0.6; a < w / 2 - 0.6; a += 0.22) u.box(a - 0.08, 0.9, d - 1.62, a + 0.08, 1.85, d - 1.48, [0.3 + u.R() * 0.6, 0.3 + u.R() * 0.5, 0.35 + u.R() * 0.5]);
    u.block(-w / 2, d - 1.8, w / 2, d);
    u.counterAt(0, d - 2.6, 0, -1, { w: 2.0 }); counterZone(u, 0, d - 2.6, 0, -1, 'counter', 2.0);
  },
  coinwash(u) {
    const w = u.w, d = u.d;
    for (let a = -w / 2 + 0.5; a < w / 2 - 0.4; a += 0.75) for (let r = 0; r < 2; r++) {
      u.box(a - 0.35, r * 0.85, d - 0.75, a + 0.35, r * 0.85 + 0.82, d - 0.05, [0.95, 0.95, 0.96]);
      const [x, z] = u.p(a, d - 0.76); u.k.col(u.k.metal, [0.35, 0.4, 0.45]).addGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16).rotateX(Math.PI / 2).rotateY(u.F.face(0, -1)).translate(x, r * 0.85 + 0.42, z));
    }
    u.block(-w / 2, d - 0.75, w / 2, d);
    u.zone('counter', -w / 2 + 0.5, d - 1.6, w / 2 - 0.5, d - 0.8, { self: true });
    FUR.table(u.k, ...u.p(0, d / 2 - 0.5), u.F.face(0, 1), { w: 1.6, d: 0.7, h: 0.9 });
    FUR.kiosk(u.k, ...u.p(-w / 2 + 0.5, 1.2), u.F.face(1, 0));
  },
  photo(u) {
    const w = u.w, d = u.d;
    u.box(-w / 2 + 0.6, 0, d - 0.2, w / 2 - 0.6, 2.6, d - 0.1, [0.92, 0.94, 0.96]);
    u.box(-w / 2 + 0.6, 0, d - 1.4, w / 2 - 0.6, 0.02, d - 0.1, [0.92, 0.94, 0.96]);
    FUR.stool(u.k, ...u.p(0, d - 1.0), { c: [0.2, 0.2, 0.2] });
    for (const s of [-1, 1]) { const [x, z] = u.p(s * 1.4, d - 2.6); u.k.col(u.k.metal, [0.2, 0.2, 0.2]).addGeo(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 4).translate(x, 0.9, z)); u.k.col(u.k.glow, [1, 1, 0.97]).addGeo(new THREE.BoxGeometry(0.5, 0.5, 0.05).translate(x, 1.9, z)); }
    u.zone('service', -1, d - 1.6, 1, d - 0.4, { studio: true });
    u.counterAt(w / 2 - 1.0, 1.4, -1, 0, { w: 1.2 }); counterZone(u, w / 2 - 1.0, 1.4, -1, 0, 'counter', 1.2);
    for (let i = 0; i < 4; i++) u.sign(-w / 2 + 0.07, 1.4 + (i % 2) * 0.7, 1.0 + Math.floor(i / 2) * 0.9, 0.5, 0.6, 1, 0, { text: ['👨‍👩‍👧', '🎓', '💍', '👶'][i], bg: '#f2ece0', fg: '#333', border: '#8a6a4a' }, 64);
  },
  salon(u, o = {}) {
    const w = u.w, d = u.d;
    const n = Math.max(1, Math.min(5, Math.floor((w - 1.2) / 1.4)));
    for (let i = 0; i < n; i++) {
      const a = -w / 2 + 1.0 + i * 1.4;
      FUR.mirror(u.k, ...(() => { const [x, z] = u.p(a, d - 0.06); return [x, 0.9, z]; })(), u.F.face(0, -1), { w: 0.9, h: 1.2 });
      u.box(a - 0.5, 0.75, d - 0.35, a + 0.5, 0.8, d - 0.08, [0.95, 0.95, 0.95]);
      u.box(a - 0.3, 0, d - 1.15, a + 0.3, 0.55, d - 0.65, [0.1, 0.1, 0.1]); u.box(a - 0.3, 0.55, d - 0.75, a + 0.3, 1.2, d - 0.65, [0.1, 0.1, 0.1]);
      u.block(a - 0.3, d - 1.15, a + 0.3, d - 0.08);
      u.zone(o.nail ? 'service' : 'chair', a - 0.6, d - 1.9, a + 0.6, d - 1.15, { chair: i });
      u.spot('stylist', a + 0.5, d - 1.3, -1, 0, { chair: i });
    }
    u.counterAt(w / 2 - 1.0, 1.4, -1, 0, { w: 1.2 }); counterZone(u, w / 2 - 1.0, 1.4, -1, 0, 'reception', 1.2);
    FUR.sofa(u.k, ...u.p(-w / 2 + 1.2, 1.4), u.F.face(1, 0), { w: 1.6, c: [0.85, 0.85, 0.82] });
    u.zone('wait', -w / 2 + 0.4, 0.5, -w / 2 + 2.4, 2.4);
  },
  nail(u) { FAM.salon(u, { nail: true }); },
  gym(u) {
    const w = u.w, d = u.d;
    u.k.floor('rubber', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
    for (let a = -w / 2 + 0.8; a < w / 2 - 0.6; a += 1.0) { u.box(a - 0.35, 0, d - 2.0, a + 0.35, 0.25, d - 0.4, [0.15, 0.15, 0.16]); u.box(a - 0.3, 0.25, d - 0.6, a + 0.3, 1.4, d - 0.45, [0.2, 0.2, 0.22]); u.glow(a - 0.15, 1.2, d - 0.61, a + 0.15, 1.35, d - 0.6, [0.3, 0.8, 0.5]); u.block(a - 0.35, d - 2.0, a + 0.35, d - 0.4); u.zone('equip', a - 0.45, d - 2.6, a + 0.45, d - 2.0, { eq: 'treadmill' }); }
    FUR.mirror(u.k, ...(() => { const [x, z] = u.p(-w / 2 + 0.06, d / 2); return [x, 0.3, z]; })(), u.F.face(1, 0), { w: Math.min(5, d - 4), h: 1.9 });
    for (let v = 3.0; v < d - 3.2; v += 2.2) { u.box(-0.5, 0, v - 0.2, 0.5, 0.45, v + 0.2, [0.15, 0.15, 0.16]); u.box(-0.9, 1.05, v - 0.03, 0.9, 1.1, v + 0.03, [0.6, 0.6, 0.62], u.k.metal); for (const s of [-1, 1]) { const [x, z] = u.p(s * 0.8, v); u.k.col(u.k.solid, [0.1, 0.1, 0.1]).addGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14).rotateZ(Math.PI / 2).rotateY(u.F.face(0, 1)).translate(x, 1.07, z)); } u.block(-0.9, v - 0.25, 0.9, v + 0.25); u.zone('equip', -1.2, v + 0.3, 1.2, v + 1.0, { eq: 'bench' }); }
    u.counterAt(w / 2 - 1.0, 1.2, -1, 0, { w: 1.4, c: [0.15, 0.15, 0.16] }); counterZone(u, w / 2 - 1.0, 1.2, -1, 0, 'counter', 1.4);
  },
  yoga(u) {
    const w = u.w, d = u.d;
    u.k.floor('wood', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
    FUR.mirror(u.k, ...(() => { const [x, z] = u.p(0, d - 0.06); return [x, 0.2, z]; })(), u.F.face(0, -1), { w: Math.min(6, w - 1), h: 2.0 });
    for (let v = 2.6; v < d - 1.2; v += 1.2) for (let a = -w / 2 + 1; a < w / 2 - 1; a += 1.0) u.box(a - 0.3, 0.005, v - 0.9, a + 0.3, 0.015, v + 0.0, [0.4 + u.R() * 0.4, 0.5, 0.7]);
    u.zone('class', -w / 2 + 0.8, 2.2, w / 2 - 0.8, d - 0.8, { yoga: true });
    u.counterAt(w / 2 - 1.0, 1.2, -1, 0, { w: 1.2 }); counterZone(u, w / 2 - 1.0, 1.2, -1, 0, 'reception', 1.2);
  },
  police(u) {
    const w = u.w, d = u.d;
    u.counterAt(0, 2.0, 0, -1, { w: Math.min(3, w - 1.5), c: [0.85, 0.87, 0.92], top: [0.15, 0.2, 0.35] }); counterZone(u, 0, 2.0, 0, -1, 'counter', 2.4);
    for (let a = -w / 2 + 1.2; a < w / 2 - 1; a += 1.8) { FUR.desk(u.k, ...u.p(a, 3.8), u.F.face(0, -1), { w: 1.4 }); u.spot('staff', a, 4.45, 0, -1); }
    const cw = Math.min(3, w / 2 - 0.5);
    for (let a = w / 2 - cw; a <= w / 2 - 0.1; a += 0.18) u.box(a - 0.02, 0, d - 2.2, a + 0.02, 2.2, d - 2.16, [0.3, 0.32, 0.35], u.k.metal);
    u.block(w / 2 - cw, d - 2.25, w / 2, d);
    u.sign(0, 2.3, d - 0.07, 1.8, 0.45, 0, -1, { text: '👮 한빛지구대', sub: '112 · 365일 24시간', bg: '#1a3a7a', fg: '#fff' }, 96);
    FUR.shelf(u.k, ...u.p(-w / 2 + 0.3, d - 1.5), u.F.face(1, 0), { w: 2, palette: [[0.2, 0.25, 0.4], [0.9, 0.9, 0.9]] });
  },
  fire(u) {
    const w = u.w, d = u.d;
    u.k.floor('concrete', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
    FUR.car(u.k, ...u.p(-w / 4, d / 2 + 0.5), u.F.face(0, -1), { c: [0.8, 0.08, 0.06] });
    u.box(-w / 4 - 0.9, 1.35, d / 2 - 1.5, -w / 4 + 0.9, 1.55, d / 2 + 2.5, [0.85, 0.85, 0.85], u.k.metal);
    for (let i = 0; i < 4; i++) { const a = w / 2 - 0.5; u.box(a - 0.35, 0, 1.5 + i * 0.9, a + 0.3, 2.0, 2.2 + i * 0.9, [0.85, 0.75, 0.2]); }
    u.block(w / 2 - 0.9, 1.4, w / 2, 5.0);
    u.counterAt(w / 4, 1.6, 0, -1, { w: 1.6, c: [0.85, 0.85, 0.85], top: [0.6, 0.1, 0.1] }); counterZone(u, w / 4, 1.6, 0, -1, 'counter', 1.6);
    u.sign(0, 2.3, d - 0.07, 2.0, 0.45, 0, -1, { text: '🚒 한빛119안전센터', sub: '화재 · 구급 · 구조', bg: '#b71c1c', fg: '#fff' }, 96);
    u.spot('staff', w / 4, 0.9, 0, 1);
  },
  office(u) {
    const w = u.w, d = u.d;
    for (let v = 2.0; v < d - 1.0; v += 2.0) for (let a = -w / 2 + 1.2; a < w / 2 - 1.0; a += 1.6) { FUR.desk(u.k, ...u.p(a, v), u.F.face(0, -1), { w: 1.4 }); u.spot('worker', a, v + 0.65, 0, -1); }
    FUR.shelf(u.k, ...u.p(-w / 2 + 0.3, 1.2), u.F.face(1, 0), { w: 1.6, palette: [[0.9, 0.9, 0.85], [0.3, 0.4, 0.6]] });
    u.zone('counter', -w / 2 + 0.5, 0.4, w / 2 - 0.5, 1.6, { office: true });
  },
};
function glassQuad(u, a0, a1, v, y0, y1) {
  const p0 = u.p(a0, v), p1 = u.p(a1, v);
  return [[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]];
}
const hexToCss = (h) => h || '#333';

// 공용: 칸 하나 만들기
export function buildUnit(k, r, tenant, door, ctx) {
  const u = new U(k, r, door, tenant || { vacant: true }, ctx);
  if (!tenant || tenant.vacant) { u.fam = 'vacant'; FAM.vacant(u); return u; }
  const fam = TYPES[tenant.type]?.fam || 'office';
  // 매장 바닥 · 분위기
  const floors = { bbq: 'darkwood', hansik: 'wood', chinese: 'darkwood', japanese: 'wood', cafe: 'wood', bakery: 'wood', dessert: 'wood', bookstore: 'wood', realty: 'wood', salon: 'stone', nail: 'stone', clinic: 'tile', dental: 'tile', vet: 'tile', pharmacy: 'tile', bank: 'stone', office: 'carpet', academy: 'tile', piano: 'wood', art: 'tile' };
  if (floors[fam]) k.floor(floors[fam], ...minmax(u.p(-u.w / 2 + 0.01, 0.01), u.p(u.w / 2 - 0.01, u.d - 0.01)));
  try { (FAM[fam] || FAM.office)(u); }
  catch (e) { console.warn('unit build failed', fam, e); }
  // 알바 모집 공고 (문 옆 벽)
  if (JOB_TYPES.includes(tenant.type)) {
    const pu = u.F.du > 0 ? u.F.du - 1.3 : u.F.du + 1.3;
    if (Math.abs(pu) < u.w / 2 - 0.4) { u.sign(pu, 1.5, 0.08, 0.5, 0.65, 0, 1, (x, W, H) => { x.fillStyle = '#fffbe8'; x.fillRect(0, 0, W, H); x.fillStyle = '#d32f2f'; x.font = `800 ${H * 0.16}px sans-serif`; x.textAlign = 'center'; x.fillText('알바 모집', W / 2, H * 0.2); x.fillStyle = '#333'; x.font = `600 ${H * 0.09}px sans-serif`; ['시급 10,320원~', '주 2일 이상', '초보 환영', '문의: 카운터'].forEach((t, i) => x.fillText(t, W / 2, H * (0.38 + i * 0.14))); }, 120); u.zone('jobpost', pu - 0.5, 0.15, pu + 0.5, 1.0); }
  }
  // 칸 전체 존 (가게 안에 있음)
  u.zone('inshop', -u.w / 2, 0, u.w / 2, u.d, { big: true });
  return u;
}

// ───────── 빈 집 (집 구경) ─────────
export function buildHome(k, r, door, ctx) {
  const u = new U(k, r, door, { vacant: true }, ctx);
  const w = u.w, d = u.d;
  const wc = [0.96, 0.95, 0.92];
  // 현관 (신발장) → 앞쪽 뒷줄: 욕실 · 방들 / 안쪽: 거실 + 주방
  const rearD = Math.min(4.0, d * 0.42);
  const entW = 1.5;
  const doorU = Math.max(-w / 2 + entW / 2, Math.min(w / 2 - entW / 2, u.F.du));
  const e0 = doorU - entW / 2, e1 = doorU + entW / 2;
  k.floor('wood', ...minmax(u.p(-w / 2, 0), u.p(w / 2, d)));
  // 현관 바닥 타일 + 신발장
  k.floor('oldtile', ...minmax(u.p(e0, 0.02), u.p(e1, 1.0)));
  u.box(e1 - 0.4, 0, 0.1, e1 - 0.02, 2.0, 1.2, [0.85, 0.82, 0.76]); u.block(e1 - 0.4, 0.1, e1 - 0.02, 1.2);
  // 뒷줄 칸: 왼쪽 / 오른쪽 나눔
  const cells = [];
  if (e0 + w / 2 > 1.8) cells.push([-w / 2, e0]);
  if (w / 2 - e1 > 1.8) cells.push([e1, w / 2]);
  let bath = false;
  for (const [a0, a1] of cells) {
    // 칸 안을 방 1~2개로
    const cw = a1 - a0;
    const parts = cw > 6 ? [[a0, a0 + cw * 0.45], [a0 + cw * 0.45, a1]] : [[a0, a1]];
    for (const [b0, b1] of parts) {
      const isBath = !bath && b1 - b0 < 3.6; if (isBath) bath = true;
      // 방 앞벽 (거실 쪽) + 문
      u.wall(b0, rearD, b1, rearD, 2.4, wc, [{ u0: 0.2, u1: 1.0, y0: 0, y1: 2.05 }]);
      if (b0 > -w / 2 + 0.01) u.wall(b0, 0, b0, rearD, 2.4, wc);
      if (b1 < w / 2 - 0.01 && Math.abs(b1 - e0) > 0.01) u.wall(b1, 0, b1, rearD, 2.4, wc);
      if (isBath) {
        k.floor('tile', ...minmax(u.p(b0 + 0.05, 0.05), u.p(b1 - 0.05, rearD - 0.05)));
        FUR.toilet(k, ...u.p(b0 + 0.45, 0.5), u.F.face(0, 1)); FUR.sink(k, ...u.p(b1 - 0.5, 0.35), u.F.face(0, 1), { w: 0.55 });
        u.box(b0 + 0.1, 0, rearD - 1.0, b0 + 1.6, 0.55, rearD - 0.15, [0.97, 0.97, 0.98]); u.block(b0 + 0.1, rearD - 1.0, b0 + 1.6, rearD - 0.15);
      } else {
        u.box(b0 + 0.05, 0, 0.05, b1 - 0.05, 2.3, 0.65, [0.92, 0.9, 0.85]); u.block(b0 + 0.05, 0.05, b1 - 0.05, 0.65);
      }
    }
  }
  if (e0 > -w / 2 + 0.01) u.wall(e0, 0, e0, rearD, 2.4, wc, [{ u0: rearD - 1.0, u1: rearD - 0.1, y0: 0, y1: 2.05 }]);
  if (e1 < w / 2 - 0.01) u.wall(e1, 0, e1, rearD, 2.4, wc, [{ u0: rearD - 1.0, u1: rearD - 0.1, y0: 0, y1: 2.05 }]);
  // 주방 (거실 한쪽)
  const kw = Math.min(3.2, w * 0.4);
  u.box(-w / 2 + 0.05, 0, rearD + 0.2, -w / 2 + 0.65, 0.9, rearD + 0.2 + kw, [0.95, 0.95, 0.93]); u.box(-w / 2 + 0.05, 0.9, rearD + 0.2, -w / 2 + 0.67, 0.94, rearD + 0.2 + kw, [0.3, 0.3, 0.32]);
  u.box(-w / 2 + 0.05, 1.5, rearD + 0.2, -w / 2 + 0.4, 2.3, rearD + 0.2 + kw, [0.95, 0.95, 0.93]);
  u.block(-w / 2, rearD + 0.2, -w / 2 + 0.67, rearD + 0.2 + kw);
  u.box(-w / 2 + 0.1, 0.94, rearD + 0.6, -w / 2 + 0.55, 0.96, rearD + 1.1, [0.15, 0.15, 0.15]);
  u.zone('homeview', -w / 2 + 1, rearD + 0.5, w / 2 - 1, d - 0.5, { home: r });
  return u.zones;
}

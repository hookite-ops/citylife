import * as THREE from 'three';
import { Kit, FUR, COL, drawSign, sharedMats } from './bkit.js';
import { planFloor, tenantMap, floorLabel, floorShort, WALL_T } from './bplan.js';
import { buildUnit, buildHome } from './shoptypes.js';
import { TYPES } from './tenants.js';
import { seeded } from './geo.js';

// ───────── 한 층을 실제 공간으로 ─────────
// 지금 있는 층만 그려요. 벽은 방 사각형에서 자동으로 (같은 공간끼리는 벽 없음).
const T = WALL_T;
export const HOME_VACANCY = { A: 0.08, B: 0.12, C: 0.18 };
export function homeVacant(B, n, k) { const R = seeded(B.id * 7 + n * 131 + k * 17); return R() < HOME_VACANCY[B.grade]; }

export class FloorView {
  constructor(B, n, lifts, opts = {}) {
    this.B = B; this.n = n; this.lifts = lifts; this.opts = opts;
    this.plan = planFloor(B, n);
    this.W = B.L; this.D = B.D;
    this.root = new THREE.Group();
    this.zones = []; this.colliders = []; this.elevVis = []; this.doorsLocked = [];
    this.npcSpots = [];
    this.build();
  }
  zone(kind, x0, z0, x1, z1, data = {}) { const z = { kind, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), ...data }; this.zones.push(z); return z; }

  build() {
    const p = this.plan, k = new Kit();
    this.kit = k;
    const ch = p.ch;
    // ─ 바닥 · 천장 · 조명 ─
    for (const r of p.rooms) {
      if (r.kind === 'shaft' || r.kind === 'private') { if (r.kind === 'private') { k.floor('stone', r.x0, r.z0, r.x1, r.z1); } continue; }
      if (r.kind !== 'stairs') k.floor(r.floor || 'tile', r.x0, r.z0, r.x1, r.z1);
      if (!r.noCeil && r.kind !== 'stairs' && !p.roof) k.ceiling(r.x0, r.z0, r.x1, r.z1, ch, r.old ? [0.9, 0.89, 0.85] : [0.96, 0.96, 0.95]);
      if (r.light !== 'none' && !p.roof) this.lights(k, r, ch);
    }
    this.walls(k);
    this.doorsGeom(k);
    for (const r of p.rooms) if (r.kind === 'stairs') this.stairs(k, r);
    for (const f of p.feats) this.feature(k, f);
    if (p.office || p.civicOffice) this.officeFloor(k);
    // ─ 호실 ─
    for (const r of p.rooms) {
      if (r.kind !== 'unit') continue;
      const d = p.doors.find(q => q.unit === r);
      if (r.home) {
        const vacant = homeVacant(this.B, this.n, r.k) && !this.isMine(r);
        r.vacant = vacant;
        if (vacant) { const zs = buildHome(k, r, d, { plan: p, B: this.B }); for (const z of zs || []) this.zones.push(z); }
      } else {
        const out = buildUnit(k, r, r.tenant, d, { plan: p, B: this.B, n: this.n });
        for (const z of out?.zones || []) this.zones.push(z);
        if (out?.spots) this.npcSpots.push(...out.spots.map(s => ({ ...s, room: r })));
        r.view = out;
      }
    }
    this.elevators(k);
    for (const m of k.meshes()) this.root.add(m);
    this.colliders = k.colliders;
    for (const e of this.elevVis) this.root.add(e.group);
  }

  lights(k, r, ch) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const sp = r.kind === 'parking' ? 8.4 : r.light === 'tube' ? 3.2 : 3.4;
    const nx = Math.max(1, Math.round(w / sp)), nz = Math.max(1, Math.round(d / sp));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = r.x0 + (i + 0.5) * w / nx, z = r.z0 + (j + 0.5) * d / nz;
      if (r.light === 'tube') k.lightPanel(x, z, ch, 1.2, 0.12, this.plan.old ? [1, 0.97, 0.88] : [0.97, 0.99, 1]);
      else if (r.light === 'warm') k.lightPanel(x, z, ch, 0.35, 0.35, [1, 0.88, 0.7]);
      else k.lightPanel(x, z, ch, 0.6, 0.6, this.plan.lux ? [1, 0.98, 0.94] : [0.98, 0.99, 1]);
    }
  }

  // ─ 벽: 방 모서리 선을 모아서, 같은 공간이 아니면 벽 ─
  walls(k) {
    const p = this.plan, ch = p.ch;
    const hw = p.W / 2, hd = p.D / 2;
    const lines = new Map();
    const add = (ax, c, a, b, room, side) => {
      const key = ax + ':' + Math.round(c * 40);
      let L = lines.get(key); if (!L) lines.set(key, L = { ax, c, e: [] });
      L.e.push({ a, b, room, side });
    };
    for (const r of p.rooms) {
      add('x', r.z0, r.x0, r.x1, r, 1); add('x', r.z1, r.x0, r.x1, r, -1);
      add('z', r.x0, r.z0, r.z1, r, 1); add('z', r.x1, r.z0, r.z1, r, -1);
    }
    for (const L of lines.values()) {
      const pts = [...new Set(L.e.flatMap(e => [e.a, e.b]).map(v => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
      const segs = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1]; if (b - a < 0.01) continue;
        const m = (a + b) / 2;
        const P = L.e.find(e => e.side > 0 && e.a <= m && e.b >= m)?.room || null;
        const M = L.e.find(e => e.side < 0 && e.a <= m && e.b >= m)?.room || null;
        const last = segs[segs.length - 1];
        if (last && last.P === P && last.M === M && Math.abs(last.b - a) < 0.01) last.b = b; else segs.push({ a, b, P, M });
      }
      for (const s of segs) this.wallSeg(k, L, s, hw, hd, ch);
    }
  }
  wallSeg(k, L, s, hw, hd, ch) {
    const p = this.plan;
    const { P, M } = s;
    if (P && M && P.grp === M.grp) return;
    const shaftP = !P || P.kind === 'shaft', shaftM = !M || M.kind === 'shaft';
    if (shaftP && shaftM) return;
    // 바깥 면?
    let ext = null;
    if (!P || !M) {
      if (L.ax === 'x' && Math.abs(L.c - hd) < 0.05) ext = 'F';
      else if (L.ax === 'x' && Math.abs(L.c + hd) < 0.05) ext = 'B';
      else if (L.ax === 'z' && Math.abs(L.c - hw) < 0.05) ext = 'R';
      else if (L.ax === 'z' && Math.abs(L.c + hw) < 0.05) ext = 'L';
    }
    const room = P || M;
    let h = ch;
    if (room.open && ext) {
      if (room.kind === 'pilotis') return;            // 필로티: 바깥과 이어짐
      if (room.kind === 'roofdeck') h = 1.15;         // 옥상 난간
    }
    if (p.roof && (P?.kind === 'stairs' || M?.kind === 'stairs')) h = 2.6;
    // 구멍: 문 + 창
    const holes = [];
    for (const d of p.doors) {
      if (d.ax !== L.ax) continue;
      const lc = L.ax === 'x' ? d.z : d.x, u = L.ax === 'x' ? d.x : d.z;
      if (Math.abs(lc - L.c) > 0.3) continue;
      if (u + d.w / 2 < s.a + 0.05 || u - d.w / 2 > s.b - 0.05) continue;
      holes.push({ u0: Math.max(s.a, u - d.w / 2) - s.a, u1: Math.min(s.b, u + d.w / 2) - s.a, y0: 0, y1: Math.min(h - 0.05, d.kind === 'open' ? h : d.h), door: d });
    }
    let railing = null;
    if (ext && room.kind !== 'shaft') {
      const st = room.glassFront ? 'none' : (p.ext[ext] || 'none');
      const len = s.b - s.a;
      const win = [];
      if (st === 'store' && room.kind !== 'stairs') win.push({ u0: 0.12, u1: len - 0.12, y0: 0.06, y1: Math.min(h - 0.45, 3.2), glass: true, mull: 2.1 });
      else if (st === 'ribbon') win.push({ u0: 0.4, u1: len - 0.4, y0: 0.9, y1: Math.min(h - 0.25, 2.45), glass: true, mull: 1.7 });
      else if (st === 'curtain') win.push({ u0: 0.06, u1: len - 0.06, y0: 0.08, y1: h - 0.08, glass: true, mull: 1.6 });
      else if (st === 'balcony') win.push({ u0: 0.3, u1: len - 0.3, y0: 0.06, y1: Math.min(h - 0.3, 2.35), glass: true, mull: 1.75 });
      else if (st === 'open') { win.push({ u0: 0.2, u1: len - 0.2, y0: 1.05, y1: h - 0.1, glass: false }); railing = true; }
      else if (st === 'punched') {
        const nW = Math.floor((len - 0.6) / 3.0);
        for (let i = 0; i < nW; i++) { const c = (i + 0.5) * len / nW; win.push({ u0: c - 0.7, u1: c + 0.7, y0: 0.9, y1: Math.min(h - 0.4, 2.2), glass: true, mull: 0.7 }); }
      }
      // 창과 문이 겹치면 창을 잘라요
      for (const w of win) {
        let parts = [w];
        for (const dh of holes) {
          const next = [];
          for (const q of parts) {
            if (dh.u1 + 0.1 <= q.u0 || dh.u0 - 0.1 >= q.u1) { next.push(q); continue; }
            if (dh.u0 - 0.1 - q.u0 > 0.3) next.push({ ...q, u1: dh.u0 - 0.1 });
            if (q.u1 - dh.u1 - 0.1 > 0.3) next.push({ ...q, u0: dh.u1 + 0.1 });
          }
          parts = next;
        }
        holes.push(...parts);
      }
    }
    // 반쪽 벽 두 장 (방마다 색)
    const x0 = L.ax === 'x' ? s.a : L.c, z0 = L.ax === 'x' ? L.c : s.a;
    const x1 = L.ax === 'x' ? s.b : L.c, z1 = L.ax === 'x' ? L.c : s.b;
    const off = (sg) => L.ax === 'x' ? [0, sg * T / 4] : [sg * T / 4, 0];
    let glassDone = false;
    for (const [room2, sg] of [[P, 1], [M, -1]]) {
      if (!room2 || room2.kind === 'shaft') continue;
      const [ox, oz] = off(sg);
      const hs = holes.map(o => ({ ...o, glass: o.glass && !glassDone }));
      k.wall(x0 + ox, z0 + oz, x1 + ox, z1 + oz, h, room2.wall || [0.94, 0.94, 0.92], { t: T / 2, holes: hs, collide: false });
      glassDone = true;
      // 걸레받이
      if (room2.kind !== 'roofdeck' && room2.kind !== 'parking' && room2.kind !== 'pilotis') {
        const bb = this.plan.old ? [0.45, 0.38, 0.3] : [0.85, 0.85, 0.83];
        const solid = [];
        let u = 0; for (const o of [...holes].sort((a, b) => a.u0 - b.u0)) { if (o.y0 < 0.12) { if (o.u0 > u) solid.push([u, o.u0]); u = Math.max(u, o.u1); } }
        if (s.b - s.a > u) solid.push([u, s.b - s.a]);
        for (const [a, b] of solid) {
          if (L.ax === 'x') k.box(s.a + a, 0, L.c + sg * T / 2, s.a + b, 0.09, L.c + sg * (T / 2 + 0.015), bb);
          else k.box(L.c + sg * T / 2, 0, s.a + a, L.c + sg * (T / 2 + 0.015), 0.09, s.a + b, bb);
        }
      }
    }
    if (railing) { if (L.ax === 'x') k.box(s.a, 1.0, L.c - 0.04, s.b, 1.06, L.c + 0.04, [0.3, 0.32, 0.35], k.metal); else k.box(L.c - 0.04, 1.0, s.a, L.c + 0.04, 1.06, s.b, [0.3, 0.32, 0.35], k.metal); }
    // 콜라이더 (문 구멍 빼고, 두께 전체)
    let u = 0;
    const solidC = (a, b) => { if (b - a < 0.02) return; if (L.ax === 'x') k.block(s.a + a, L.c - T / 2 - 0.02, s.a + b, L.c + T / 2 + 0.02); else k.block(L.c - T / 2 - 0.02, s.a + a, L.c + T / 2 + 0.02, s.a + b); };
    for (const o of [...holes].sort((a, b) => a.u0 - b.u0)) {
      if (o.y0 > 0.3) continue;
      if (o.door && o.door.kind !== 'elev' && this.isLocked(o.door)) continue;
      solidC(u, o.u0); u = Math.max(u, o.u1);
      if (o.door?.kind === 'elev') {
        // 엘리베이터 문: 열렸을 때만 지나갈 수 있는 콜라이더
        const c = L.ax === 'x' ? { x0: s.a + o.u0, z0: L.c - T / 2 - 0.02, x1: s.a + o.u1, z1: L.c + T / 2 + 0.02 } : { x0: L.c - T / 2 - 0.02, z0: s.a + o.u0, x1: L.c + T / 2 + 0.02, z1: s.a + o.u1 };
        c.elev = o.door; k.colliders.push(c);
      }
    }
    solidC(u, s.b - s.a);
  }
  isMine(u) { const h = this.opts.myHome; return !!(h && u && h.bid === this.B.id && h.n === this.n && h.k === u.k); }
  isLocked(d) {
    if (d.kind === 'elev') return true;
    if (d.unit?.home) return this.isMine(d.unit) || !homeVacant(this.B, this.n, d.unit.k);
    if (d.unit?.kind === 'private') return true;
    return false;
  }

  // ─ 문짝 · 문틀 · 간판 ─
  doorsGeom(k) {
    const p = this.plan;
    for (const d of p.doors) {
      if (d.kind === 'elev' || d.kind === 'open') continue;
      const ax = d.ax, w = d.w, h = d.h;
      const P = (u, side) => ax === 'x' ? [d.x + u, d.z + side] : [d.x + side, d.z + u];
      const box = (u0, y0, s0, u1, y1, s1, c, gb) => { const a = P(u0, s0), b = P(u1, s1); k.box(a[0], y0, a[1], b[0], y1, b[1], c, gb); };
      // 어느 쪽이 호실(안쪽)인지
      const unit = d.unit;
      let inSide = 1;
      if (unit) { const c = ax === 'x' ? (unit.z0 + unit.z1) / 2 - d.z : (unit.x0 + unit.x1) / 2 - d.x; inSide = c >= 0 ? 1 : -1; }
      else if (d.exit) { inSide = -(ax === 'x' ? Math.sign(d.z) : Math.sign(d.x)) || -1; }
      const frameC = d.kind === 'steel' ? [0.35, 0.33, 0.32] : d.kind === 'wood' ? [0.55, 0.42, 0.3] : [0.72, 0.74, 0.77];
      // 문틀
      box(-w / 2 - 0.06, 0, -T / 2 - 0.02, -w / 2, h + 0.06, T / 2 + 0.02, frameC, k.metal);
      box(w / 2, 0, -T / 2 - 0.02, w / 2 + 0.06, h + 0.06, T / 2 + 0.02, frameC, k.metal);
      box(-w / 2 - 0.06, h, -T / 2 - 0.02, w / 2 + 0.06, h + 0.06, T / 2 + 0.02, frameC, k.metal);
      const locked = this.isLocked(d);
      if (d.kind === 'auto' || d.kind === 'glass2') {
        // 미닫이 유리문 (양쪽으로 열림)
        const lw = w / 2;
        for (const sg of [-1, 1]) {
          const u0 = sg * (w / 2 + 0.02), u1 = sg * (w / 2 + lw - 0.02);
          box(Math.min(u0, u1), 0, -0.07, Math.max(u0, u1), 0.05, -0.03, [0.6, 0.62, 0.65], k.metal);
          box(Math.min(u0, u1), h - 0.05, -0.07, Math.max(u0, u1), h, -0.03, [0.6, 0.62, 0.65], k.metal);
          const a = P(Math.min(u0, u1), -0.05), b = P(Math.max(u0, u1), -0.05);
          k.glass.quad([a[0], 0.05, a[1]], [b[0], 0.05, b[1]], [b[0], h - 0.05, b[1]], [a[0], h - 0.05, a[1]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        }
      } else if (locked) {
        // 닫힌 현관문
        const c = d.kind === 'steel' ? (p.old ? [0.42, 0.3, 0.22] : [0.36, 0.37, 0.4]) : [0.5, 0.5, 0.52];
        box(-w / 2, 0, -0.03, w / 2, h, 0.03, c, k.solid);
        box(w / 2 - 0.16, 0.95, 0.03 * -inSide - 0.03, w / 2 - 0.1, 1.15, 0.03 * -inSide + 0.03, [0.8, 0.8, 0.82], k.metal);
        if (!p.old) box(w / 2 - 0.2, 1.2, -0.06 * inSide, w / 2 - 0.08, 1.45, -0.035 * inSide, [0.12, 0.12, 0.14]); // 도어락
      } else {
        // 열려 있는 여닫이문 (안쪽으로 젖혀짐)
        const c = d.kind === 'glass' ? null : d.kind === 'fire' ? [0.55, 0.56, 0.58] : d.kind === 'steel' ? [0.36, 0.37, 0.4] : [0.62, 0.48, 0.34];
        const hu = -w / 2;
        if (c) box(hu - 0.02, 0, inSide * 0.05, hu + 0.03, h - 0.02, inSide * (w - 0.05), c, k.solid);
        else {
          const a = P(hu, inSide * 0.05), b = P(hu, inSide * (w - 0.05));
          k.glass.quad([a[0], 0.02, a[1]], [b[0], 0.02, b[1]], [b[0], h - 0.04, b[1]], [a[0], h - 0.04, a[1]], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
          box(hu - 0.025, 0, inSide * 0.05, hu + 0.025, h - 0.02, inSide * 0.09, [0.7, 0.72, 0.75], k.metal);
          box(hu - 0.025, 0.95, inSide * (w - 0.3), hu + 0.025, 1.15, inSide * (w - 0.27), [0.8, 0.8, 0.82], k.metal);
        }
      }
      // 간판 · 번호판 (복도 쪽)
      const out = -inSide;
      const nrm = ax === 'x' ? [0, out] : [out, 0];
      const sp = P(0, out * (T / 2 + 0.03));
      if (unit && !unit.home && unit.tenant) {
        const t = unit.tenant;
        const label = t.vacant ? '임대 문의' : t.name;
        k.sign(sp[0], h + 0.38, sp[1], Math.min(3.2, Math.max(1.6, w * 1.8)), 0.5, nrm, t.vacant ? { text: '임대 문의', sub: '☎ 한빛부동산 1588-0000', bg: '#ffffff', fg: '#c62828', border: '#c62828' } : { text: label, sub: TYPES[t.type]?.label || '', bg: t.color, fg: '#ffffff' });
      } else if (unit?.home) {
        const pl = P(w / 2 + 0.3, out * (T / 2 + 0.02));
        k.sign(pl[0], 1.62, pl[1], 0.3, 0.14, nrm, { text: unit.num || '', bg: p.old ? '#d8c8a0' : '#2a2d33', fg: p.old ? '#3a2a10' : '#ffffff' }, 64);
        const bl = P(w / 2 + 0.3, out * (T / 2 + 0.02));
        k.box(bl[0] - 0.04, 1.25, bl[1] - 0.04, bl[0] + 0.04, 1.38, bl[1] + 0.04, [0.85, 0.85, 0.85]);
      } else if (d.label && d.kind !== 'auto') {
        k.sign(sp[0], h + 0.25, sp[1], 1.1, 0.26, nrm, d.kind === 'fire' ? { text: '🏃 비상계단', bg: '#18a84a', fg: '#fff' } : { text: d.label, bg: '#33373d', fg: '#fff' }, 64);
      }
      if (d.exit && d.label) {
        const ip = P(0, inSide * (T / 2 + 0.03));
        k.sign(ip[0], h + 0.3, ip[1], 1.4, 0.3, ax === 'x' ? [0, inSide] : [inSide, 0], { text: '🚪 나가는 곳', bg: '#1d6f3c', fg: '#fff' }, 64);
      }
      // 존: 문 (잠긴 집 → 초인종, 나가는 문 → 나가기)
      const zp = P(0, out * 0.7);
      if (d.exit) { const ip = P(0, inSide * 0.55); this.zone('exit', ip[0] - 0.9, ip[1] - 0.6, ip[0] + 0.9, ip[1] + 0.6, { door: d }); }
      if (locked && unit?.home) this.zone('homedoor', zp[0] - 0.7, zp[1] - 0.6, zp[0] + 0.7, zp[1] + 0.6, { door: d, unit });
      if (locked && unit?.kind === 'private') this.zone('private', zp[0] - 0.7, zp[1] - 0.6, zp[0] + 0.7, zp[1] + 0.6, { door: d });
      if (unit && !unit.home && unit.tenant && !d.exit) { const ip = P(0, inSide * 0.9); this.zone('shopdoor', ip[0] - 0.8, ip[1] - 0.6, ip[0] + 0.8, ip[1] + 0.6, { unit, door: d, enter: true }); }
    }
  }

  // ─ 계단실: 실제 계단 (위로 · 아래로) ─
  stairs(k, r) {
    const p = this.plan, h = p.f.h || 3.4, ch = p.ch;
    const d = p.doors.find(q => q.kind === 'fire' && q.x >= r.x0 - 0.3 && q.x <= r.x1 + 0.3 && q.z >= r.z0 - 0.3 && q.z <= r.z1 + 0.3);
    // 문 쪽 방향 (방 안 → 홀)
    let fx = 0, fz = 0;
    if (d) { if (d.ax === 'x') fz = Math.abs(d.z - r.z1) < Math.abs(d.z - r.z0) ? 1 : -1; else fx = Math.abs(d.x - r.x1) < Math.abs(d.x - r.x0) ? 1 : -1; }
    else if (r.face) { fx = r.face[0]; fz = r.face[1]; } else fz = 1;
    // 로컬: 문쪽 가장자리 = 앞(f), 깊이 방향은 반대
    const along = fz ? 'z' : 'x';
    const near = fz > 0 ? r.z1 : fz < 0 ? r.z0 : fx > 0 ? r.x1 : r.x0;
    const far = fz > 0 ? r.z0 : fz < 0 ? r.z1 : fx > 0 ? r.x0 : r.x1;
    const w0 = along === 'z' ? r.x0 : r.z0, w1 = along === 'z' ? r.x1 : r.z1;
    const dir = Math.sign(far - near);       // 안쪽으로 들어가는 방향
    const depth = Math.abs(far - near);
    const land = Math.min(1.5, depth * 0.35), mid = Math.min(1.1, depth * 0.25);
    const run = depth - land - mid;
    // 문 위치에 가까운 쪽 = 오르는 줄(A)
    const dc = d ? (along === 'z' ? d.x : d.z) : (w0 + w1) / 2;
    const half = (w0 + w1) / 2;
    const laneA = dc <= half ? [w0, half - 0.05] : [half + 0.05, w1];
    const laneB = dc <= half ? [half + 0.05, w1] : [w0, half - 0.05];
    const R = (a0, a1, b0, b1) => along === 'z' ? [Math.min(b0, b1), Math.min(a0, a1), Math.max(b0, b1), Math.max(a0, a1)] : [Math.min(a0, a1), Math.min(b0, b1), Math.max(a0, a1), Math.max(b0, b1)];
    const bx = (a0, a1, b0, b1, y0, y1, c, gb) => { const [x0, z0, x1, z1] = R(a0, a1, b0, b1); k.box(x0, y0, z0, x1, y1, z1, c, gb); };
    const conc = [0.72, 0.72, 0.7], tread = [0.62, 0.62, 0.6], nosing = [0.95, 0.75, 0.1];
    // 층참 바닥
    const l0 = near, l1 = near + dir * land;
    { const [x0, z0, x1, z1] = R(l0, l1, w0, w1); k.floor('concrete', x0, z0, x1, z1); }
    const top = p.roof ? 0 : 1;   // 옥상 계단탑: 위로 가는 계단 없음
    const bottom = !this.B.floors.some(f => f.n < this.n && !f.roof) ? 0 : 1;
    const N = 10;
    const flight = (lane, y0, y1, a0, a1) => {
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        const ya = y0 + (y1 - y0) * (i + 1) / N;
        const aa = a0 + (a1 - a0) * t0, ab = a0 + (a1 - a0) * t1;
        bx(aa, ab, lane[0], lane[1], ya - 0.22, ya, tread);
        bx(aa, aa + Math.sign(a1 - a0) * 0.04, lane[0], lane[1], ya - 0.005, ya + 0.005, nosing);
      }
    };
    const m0 = near + dir * (land + run), m1 = far;
    if (top) {
      flight(laneA, 0, h / 2, l1, m0);                       // 오르는 계단
      bx(m0, m1, w0, w1, h / 2 - 0.22, h / 2, conc);          // 중간 층참 (위)
      flight(laneB, h / 2, h, m0, l1);                        // 꺾여서 위층으로
      bx(l1, l0, laneB[0], laneB[1], h - 0.22, h, conc);
    }
    if (bottom) {
      flight(laneB, 0, -h / 2, l1, m0);                       // 내려가는 계단
      bx(m0, m1, w0, w1, -h / 2 - 0.22, -h / 2, conc);
      flight(laneA, -h / 2, -h, m0, l1);
    } else {
      const [x0, z0, x1, z1] = R(l1, far, laneB[0], laneB[1]); k.floor('concrete', x0, z0, x1, z1);
    }
    if (!top) { const [x0, z0, x1, z1] = R(l1, far, laneA[0], laneA[1]); k.floor('concrete', x0, z0, x1, z1); }
    // 난간
    const rc = [0.25, 0.27, 0.3];
    bx(l1, m0, half - 0.05, half + 0.05, 0.9, 0.95, rc, k.metal);
    if (bottom) bx(l1, m0, half - 0.05, half + 0.05, -h / 2 + 0.9, -h / 2 + 0.95, rc, k.metal);
    // 계단실 벽 위아래로 (뚫린 곳 너머)
    const wc = r.wall || [0.9, 0.9, 0.88];
    const ext = (y0, y1) => {
      k.box(r.x0 - T / 2, y0, r.z0 - T / 2, r.x1 + T / 2, y1, r.z0, wc); k.box(r.x0 - T / 2, y0, r.z1, r.x1 + T / 2, y1, r.z1 + T / 2, wc);
      k.box(r.x0 - T / 2, y0, r.z0, r.x0, y1, r.z1, wc); k.box(r.x1, y0, r.z0, r.x1 + T / 2, y1, r.z1, wc);
    };
    if (bottom) ext(-h - 0.3, 0);
    if (top && !p.roof) ext(ch, h + 2.4);
    if (p.roof) k.box(r.x0 - T / 2, 2.6, r.z0 - T / 2, r.x1 + T / 2, 2.8, r.z1 + T / 2, [0.78, 0.78, 0.76]);
    // 비상등 · 층 표시
    const lp = R(l0 + dir * 0.02, l0 + dir * 0.03, (w0 + w1) / 2 - 0.4, (w0 + w1) / 2 + 0.4);
    k.lightPanel((lp[0] + lp[2]) / 2, (lp[1] + lp[3]) / 2, Math.min(ch, 2.6), 0.8, 0.1, [0.97, 1, 0.96]);
    { // 큰 층 숫자 (오르는 계단 맞은편 벽)
      const a = far - dir * 0.02, wc2 = (w0 + w1) / 2;
      const [cx, cz] = along === 'z' ? [wc2, a] : [a, wc2];
      const nrm = along === 'z' ? [0, -dir] : [-dir, 0];
      k.sign(cx, 1.7, cz, 1.0, 0.7, nrm, { text: floorShort(this.n, this.B), sub: this.n < 0 ? '지하' : p.roof ? '옥상' : '층', bg: '#e8e8e4', fg: '#2a6a3a' }, 96);
    }
    // 못 들어가는 곳 (계단 위/아래는 존으로만 이동)
    const [ax0, az0, ax1, az1] = R(l1 + dir * 0.05, far, w0, w1);
    k.block(ax0, az0, ax1, az1);
    // 존
    const za = R(l0, l1, laneA[0], laneA[1]), zb = R(l0, l1, laneB[0], laneB[1]);
    const upTo = this.nextFloor(1), downTo = this.nextFloor(-1);
    if (top && upTo != null) this.zone('stairsUp', za[0], za[1], za[2], za[3], { to: upTo });
    else if (top && this.B.floorOf(this.n + 1)?.roof) this.zone('stairsUp', za[0], za[1], za[2], za[3], { to: this.n + 1, roofLocked: true });
    if (bottom && downTo != null) this.zone('stairsDown', zb[0], zb[1], zb[2], zb[3], { to: downTo });
    this.stairsSpot = { x: (za[0] + za[2] + zb[0] + zb[2]) / 4, z: (za[1] + za[3]) / 2, face: [fx, fz] };
  }
  nextFloor(dir) {
    const fl = this.B.floors.filter(f => !(f.lobbySkip)).map(f => f.n).sort((a, b) => a - b);
    const i = fl.indexOf(this.n);
    let j = i + dir;
    // 주상복합: 2·3층(상가)은 계단도 따로 — 1층 ↔ 4층 바로
    const next = fl[j];
    if (next == null) return null;
    const f = this.B.floorOf(next);
    if (f.roof && !this.B.roofOpen) return null;
    return next;
  }

  // ─ 엘리베이터: 홀 문 + 카 실내 ─
  elevators(k) {
    const p = this.plan;
    const M = sharedMats();
    const banksDone = new Set();
    for (const e of p.elevs) {
      const [fx, fz] = e.face;            // 카 → 홀 방향
      const along = fx ? 'z' : 'x';
      const g = new THREE.Group();
      // 카 실내 (문 뒤)
      const car = new THREE.Group();
      const ck = new Kit();
      const cw = e.w, cd = e.d;
      const cx = e.x - fx * cd / 2, cz = e.z - fz * cd / 2;
      const hwid = along === 'x' ? cw / 2 : cd / 2, hdep = along === 'x' ? cd / 2 : cw / 2;
      const ix0 = cx - hwid, ix1 = cx + hwid, iz0 = cz - hdep, iz1 = cz + hdep;
      const lux = p.lux || this.B.kind === 'tower' || this.B.kind === 'office';
      const panelC = lux ? [0.78, 0.8, 0.82] : p.old ? [0.62, 0.5, 0.36] : [0.82, 0.83, 0.85];
      ck.floor(lux ? 'stone' : 'rubber', ix0, iz0, ix1, iz1);
      ck.ceiling(ix0, iz0, ix1, iz1, 2.35, [0.85, 0.86, 0.88]);
      ck.lightPanel(cx, cz, 2.35, cw * 0.6, cd * 0.6, [1, 0.98, 0.94]);
      // 벽 (문 쪽 빼고)
      const back = along === 'x' ? (fz > 0 ? 'z0' : 'z1') : (fx > 0 ? 'x0' : 'x1');
      const wallBox = (side) => {
        if (side === 'z0') ck.box(ix0, 0, iz0 - 0.04, ix1, 2.35, iz0, panelC, lux ? ck.metal : ck.solid);
        if (side === 'z1') ck.box(ix0, 0, iz1, ix1, 2.35, iz1 + 0.04, panelC, lux ? ck.metal : ck.solid);
        if (side === 'x0') ck.box(ix0 - 0.04, 0, iz0, ix0, 2.35, iz1, panelC, lux ? ck.metal : ck.solid);
        if (side === 'x1') ck.box(ix1, 0, iz0, ix1 + 0.04, 2.35, iz1, panelC, lux ? ck.metal : ck.solid);
      };
      const front = along === 'x' ? (fz > 0 ? 'z1' : 'z0') : (fx > 0 ? 'x1' : 'x0');
      for (const sd of ['z0', 'z1', 'x0', 'x1']) if (sd !== front) wallBox(sd);
      // 뒷벽 거울 (새 건물) · 손잡이
      if (!p.old) {
        const mw = cw * 0.8;
        const bp = back === 'z0' ? [cx, iz0 + 0.005] : back === 'z1' ? [cx, iz1 - 0.005] : back === 'x0' ? [ix0 + 0.005, cz] : [ix1 - 0.005, cz];
        const m = new THREE.Mesh(new THREE.PlaneGeometry(mw, 1.3), M.mirror); m.position.set(bp[0], 1.4, bp[1]);
        m.rotation.y = back === 'z0' ? 0 : back === 'z1' ? Math.PI : back === 'x0' ? Math.PI / 2 : -Math.PI / 2; car.add(m);
      }
      const rail = [0.75, 0.77, 0.8];
      if (back === 'z0') ck.box(ix0 + 0.1, 0.88, iz0 + 0.04, ix1 - 0.1, 0.92, iz0 + 0.08, rail, ck.metal);
      if (back === 'z1') ck.box(ix0 + 0.1, 0.88, iz1 - 0.08, ix1 - 0.1, 0.92, iz1 - 0.04, rail, ck.metal);
      if (back === 'x0') ck.box(ix0 + 0.04, 0.88, iz0 + 0.1, ix0 + 0.08, 0.92, iz1 - 0.1, rail, ck.metal);
      if (back === 'x1') ck.box(ix1 - 0.08, 0.88, iz0 + 0.1, ix1 - 0.04, 0.92, iz1 - 0.1, rail, ck.metal);
      // 버튼 패널 (문 옆 안쪽 벽)
      const pu = along === 'x' ? [e.x + 0.62, e.z - fz * 0.06] : [e.x - fx * 0.06, e.z + 0.62];
      ck.box(pu[0] - 0.12, 0.95, pu[1] - 0.12, pu[0] + 0.12, 1.5, pu[1] + 0.12, [0.2, 0.2, 0.22]);
      for (let i = 0; i < 8; i++) ck.lightPanel(pu[0] + ((i % 2) - 0.5) * 0.08 * (along === 'x' ? 1 : 0), pu[1] + ((i % 2) - 0.5) * 0.08 * (along === 'z' ? 1 : 0), 0.0, 0.01, 0.01);
      for (const m of ck.meshes()) car.add(m);
      // 카 안 층 표시창
      const disp = this.dispTex();
      const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.14), new THREE.MeshBasicMaterial({ map: disp.tex }));
      dm.position.set(e.x - fx * 0.05, 2.18, e.z - fz * 0.05); dm.rotation.y = Math.atan2(-fx, -fz); car.add(dm);
      car.visible = false;
      g.add(car);
      // 홀 쪽 문 두 짝 (가운데서 양쪽으로)
      const dw = 1.0, dh = 2.1;
      const leafMat = new THREE.MeshStandardMaterial({ color: p.old ? 0x8a8a86 : lux ? 0xc8ccd2 : 0xb8bcc2, metalness: 0.8, roughness: 0.28 });
      const leaves = [];
      for (const sg of [-1, 1]) {
        const lf = new THREE.Mesh(new THREE.BoxGeometry(along === 'x' ? dw / 2 : 0.04, dh, along === 'x' ? 0.04 : dw / 2), leafMat);
        lf.userData.sg = sg; lf.userData.base = along === 'x' ? [e.x + sg * dw / 4, e.z - fz * 0.02] : [e.x - fx * 0.02, e.z + sg * dw / 4];
        lf.position.set(lf.userData.base[0], dh / 2, lf.userData.base[1]);
        g.add(lf); leaves.push(lf);
      }
      // 문틀 + 홀 위 층 표시
      const fr = new Kit();
      const P = (u, s, y0, y1, u2, s2) => along === 'x' ? fr.box(e.x + u, y0, e.z + fz * s, e.x + u2, y1, e.z + fz * s2, [0.7, 0.72, 0.75], fr.metal) : fr.box(e.x + fx * s, y0, e.z + u, e.x + fx * s2, y1, e.z + u2, [0.7, 0.72, 0.75], fr.metal);
      P(-dw / 2 - 0.12, 0, 0, dh + 0.12, -dw / 2, T / 2 + 0.03); P(dw / 2, 0, 0, dh + 0.12, dw / 2 + 0.12, T / 2 + 0.03); P(-dw / 2 - 0.12, T / 2 + 0.03, dh, dh + 0.12, dw / 2 + 0.12, 0);
      for (const m of fr.meshes()) g.add(m);
      const hd2 = this.dispTex();
      const hm = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.18), new THREE.MeshBasicMaterial({ map: hd2.tex }));
      hm.position.set(e.x + fx * (T / 2 + 0.035), dh + 0.32, e.z + fz * (T / 2 + 0.035)); hm.rotation.y = Math.atan2(fx, fz); g.add(hm);
      const col = k.colliders.find(c => c.elev && c.elev.bank === e.bank && c.elev.car === e.car);
      this.elevVis.push({ e, group: g, car, leaves, disp, hd: hd2, along, col, inside: { x0: ix0 + 0.1, z0: iz0 + 0.1, x1: ix1 - 0.1, z1: iz1 - 0.1 } });
      // 카 벽 콜라이더 (문 쪽 빼고)
      const tk = 0.06;
      if (front !== 'z0') k.colliders.push({ x0: ix0, z0: iz0 - tk, x1: ix1, z1: iz0 });
      if (front !== 'z1') k.colliders.push({ x0: ix0, z0: iz1, x1: ix1, z1: iz1 + tk });
      if (front !== 'x0') k.colliders.push({ x0: ix0 - tk, z0: iz0, x1: ix0, z1: iz1 });
      if (front !== 'x1') k.colliders.push({ x0: ix1, z0: iz0, x1: ix1 + tk, z1: iz1 });
      // 존: 카 안
      this.zone('car', ix0 + 0.15, iz0 + 0.15, ix1 - 0.15, iz1 - 0.15, { e });
      // 호출 버튼 (뱅크마다 하나 · 첫 카 옆)
      const bk = this.B.banks.find(b => b.id === e.bank);
      if (!banksDone.has(e.bank)) {
        banksDone.add(e.bank);
        const cars = p.elevs.filter(q => q.bank === e.bank);
        const xs = cars.map(q => along === 'x' ? q.x : q.z);
        const a0 = Math.min(...xs) - 0.9, a1 = Math.max(...xs) + 0.9;
        const z0 = fx || fz;
        const bandA = along === 'x' ? [a0, e.z + fz * 0.2, a1, e.z + fz * 2.2] : [e.x + fx * 0.2, a0, e.x + fx * 2.2, a1];
        this.zone('elevcall', bandA[0], bandA[1], bandA[2], bandA[3], { bank: e.bank, name: bk?.name, face: e.face });
        void z0;
        // 버튼 판
        const bp2 = along === 'x' ? [Math.max(...xs) + 0.75, e.z + fz * (T / 2 + 0.01)] : [e.x + fx * (T / 2 + 0.01), Math.max(...xs) + 0.75];
        k.box(bp2[0] - 0.06, 1.05, bp2[1] - 0.06, bp2[0] + 0.06, 1.3, bp2[1] + 0.06, [0.75, 0.77, 0.8], k.metal);
        k.lightPanel(bp2[0] + fx * 0.07, bp2[1] + fz * 0.07, 0, 0.001, 0.001);
        if (bk?.express) k.sign(bp2[0] + fx * 0.07, 1.6, bp2[1] + fz * 0.07, 0.9, 0.28, [fx, fz], { text: '⚡ 고층 직행', sub: bk.name, bg: '#1a237e', fg: '#fff' }, 80);
      }
    }
  }
  dispTex() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 56;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return { c, tex, last: '' };
  }
  drawDisp(d, text) {
    if (d.last === text) return;
    d.last = text;
    const x = d.c.getContext('2d');
    x.fillStyle = '#0a0c10'; x.fillRect(0, 0, 128, 56);
    x.fillStyle = '#ff7a1a'; x.font = '800 38px "Pretendard",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 64, 30);
    d.tex.needsUpdate = true;
  }
  // 매 프레임: 문 · 표시창 · 카 보이기
  updateLifts(dt, ridingCar) {
    if (!this.lifts) return;
    const fy = this.B.floorOf(this.n).y;
    for (const v of this.elevVis) {
      const c = this.lifts.car(v.e.bank, v.e.car);
      if (!c) continue;
      const here = Math.abs(c.y - fy) < 0.05;
      const open = here ? c.door : 0;
      for (const lf of v.leaves) {
        const sg = lf.userData.sg, [bx, bz] = lf.userData.base;
        const off = sg * open * 0.49;
        if (v.along === 'x') lf.position.x = bx + off; else lf.position.z = bz + off;
      }
      v.car.visible = (here && c.door > 0.02) || c === ridingCar;
      const txt = this.lifts.label(c.n) + (c.state === 'moving' ? (c.dir > 0 ? '▲' : '▼') : '');
      this.drawDisp(v.hd, txt); this.drawDisp(v.disp, txt);
    }
  }

  // ─ 공용 시설 ─
  feature(k, f) {
    const p = this.plan;
    switch (f.kind) {
      case 'directory': {
        const tm = tenantMap(this.B);
        const rows = [];
        for (const fl of [...this.B.floors].reverse()) {
          if (fl.roof || fl.parking) continue;
          const names = [];
          for (const [key, t] of tm) { const [n] = key.split(':'); if (+n === fl.n && !t.vacant) names.push(t.name); }
          rows.push([floorShort(fl.n, this.B), names.slice(0, 3).join(' · ') || (fl.n === 1 ? '로비' : '임대 문의')]);
        }
        const fr = k.at(f.x, f.z, f.rot);
        fr.box(-0.55, 0.9, -0.03, 0.55, 2.3, 0, [0.2, 0.22, 0.25]);
        fr.sign(0, 1.6, 0.005, 1.02, 1.32, (x, w, h) => {
          x.fillStyle = '#1c2026'; x.fillRect(0, 0, w, h);
          x.fillStyle = '#ffd25a'; x.font = `800 ${h * 0.06}px sans-serif`; x.textAlign = 'center'; x.fillText(this.B.name, w / 2, h * 0.07);
          const lh = Math.min(h * 0.085, (h * 0.88) / Math.max(1, rows.length));
          x.textAlign = 'left';
          rows.slice(0, 12).forEach(([a, b], i) => {
            const y = h * 0.14 + i * lh + lh * 0.6;
            x.fillStyle = '#46d1ff'; x.font = `800 ${lh * 0.6}px sans-serif`; x.fillText(a, w * 0.05, y);
            x.fillStyle = '#fff'; x.font = `600 ${lh * 0.5}px sans-serif`;
            let s = b; while (x.measureText(s).width > w * 0.72 && s.length > 4) s = s.slice(0, -2);
            x.fillText(s, w * 0.24, y);
          });
        }, 0, 1, 400);
        this.zone('directory', ...rect(f.x, f.z, f.rot, 1.2, 1.1), { rows });
        break;
      }
      case 'mailbox': {
        const fr = k.at(f.x, f.z, f.rot), n = Math.max(4, f.n || 12), cols = Math.min(8, n), rws = Math.ceil(n / cols);
        const cw = 0.28, chh = 0.2, W = cols * cw;
        fr.box(-W / 2 - 0.03, 0.75, -0.3, W / 2 + 0.03, 0.8 + rws * chh + 0.05, 0, [0.6, 0.62, 0.65], k.metal);
        for (let i = 0; i < cols; i++) for (let j = 0; j < rws; j++) {
          fr.box(-W / 2 + i * cw + 0.015, 0.8 + j * chh + 0.015, 0.0, -W / 2 + (i + 1) * cw - 0.015, 0.8 + (j + 1) * chh - 0.015, 0.012, p.old ? [0.75, 0.62, 0.3] : [0.85, 0.86, 0.88], k.metal);
          fr.box(-W / 2 + i * cw + 0.05, 0.8 + (j + 1) * chh - 0.06, 0.012, -W / 2 + i * cw + 0.13, 0.8 + (j + 1) * chh - 0.045, 0.016, [0.15, 0.15, 0.15]);
        }
        fr.block(-W / 2, -0.3, W / 2, 0);
        this.zone('mailbox', ...rect(f.x, f.z, f.rot, W + 0.4, 1.4, 0.7));
        break;
      }
      case 'parcel': {
        const fr = k.at(f.x, f.z, f.rot);
        fr.box(-1.0, 0, -0.5, 1.0, 1.9, 0, [0.2, 0.45, 0.75]);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) if (!(i === 1 && j >= 2 && j <= 3)) fr.box(-0.98 + i * 0.49 + 0.02, 0.05 + j * 0.37 + 0.02, 0, -0.98 + (i + 1) * 0.49 - 0.02, 0.05 + (j + 1) * 0.37 - 0.02, 0.012, [0.92, 0.93, 0.95]);
        fr.glow(-0.45, 0.85, 0.012, -0.05, 1.25, 0.016, [0.35, 0.7, 1]);
        fr.sign(0, 2.05, 0.01, 1.2, 0.22, { text: '📦 무인 택배함', bg: '#1d4f8a', fg: '#fff' }, 0, 1, 64);
        fr.block(-1.0, -0.5, 1.0, 0);
        this.zone('parcel', ...rect(f.x, f.z, f.rot, 2.2, 1.5, 0.8));
        break;
      }
      case 'keypad': {
        const fr = k.at(f.x, f.z, f.rot);
        fr.box(-0.11, 1.15, -0.05, 0.11, 1.5, 0.02, [0.15, 0.15, 0.17]); fr.glow(-0.08, 1.38, 0.021, 0.08, 1.47, 0.024, [0.3, 0.8, 0.5]);
        break;
      }
      case 'guardbooth': {
        const fr = k.at(f.x, f.z, f.rot);
        fr.box(-1.0, 0, -0.8, 1.0, 0.9, 0.8, [0.75, 0.72, 0.65]);
        fr.glassQ(-1.0, 0.8, 1.0, 0.8, 0.9, 2.2); fr.glassQ(1.0, -0.8, 1.0, 0.8, 0.9, 2.2);
        fr.box(-1.0, 2.2, -0.8, 1.0, 2.3, 0.8, [0.75, 0.72, 0.65]);
        fr.sign(0, 2.45, 0.81, 0.9, 0.22, { text: '경비실', bg: '#2a3a52', fg: '#fff' }, 0, 1, 64);
        fr.block(-1.0, -0.8, 1.0, 0.8);
        this.zone('guard', ...rect(f.x, f.z + 1.3, f.rot, 2.0, 1.0)); this.npcSpots.push({ kind: 'guard', x: f.x, z: f.z, rot: f.rot });
        break;
      }
      case 'concierge': case 'reception': {
        const fr = k.at(f.x, f.z, f.rot);
        FUR.counter(k, f.x, f.z, f.rot, { w: 2.8, d: 0.8, h: 1.05, c: [0.85, 0.82, 0.76], top: [0.25, 0.22, 0.2] });
        fr.sign(0, 0.6, 0.42, 1.6, 0.28, { text: f.label || '컨시어지', bg: '#2a2622', fg: '#f2e2c0' }, 0, 1, 64);
        this.zone(f.kind, ...rect(f.x, f.z, f.rot, 3, 1.2, 1.0));
        this.npcSpots.push({ kind: 'staff', x: f.x, z: f.z, rot: f.rot, behind: true });
        break;
      }
      case 'gates': {
        // 스피드 게이트 (코어 입구)
        const n = 3, w = f.w;
        for (let i = 0; i <= n; i++) {
          const u = -w / 2 + i * w / n;
          const [x, z] = f.ax === 'z' ? [f.x, f.z + u] : [f.x + u, f.z];
          if (f.ax === 'z') k.box(x - 0.6, 0, z - 0.09, x + 0.6, 1.0, z + 0.09, [0.85, 0.86, 0.88], k.metal);
          else k.box(x - 0.09, 0, z - 0.6, x + 0.09, 1.0, z + 0.6, [0.85, 0.86, 0.88], k.metal);
          k.lightPanel(x, z, 0, 0.001, 0.001);
        }
        // 닫힌 게이트 = 콜라이더 (출입증 찍으면 잠깐 열림)
        const g = f.ax === 'z' ? { x0: f.x - 0.1, z0: f.z - w / 2, x1: f.x + 0.1, z1: f.z + w / 2 } : { x0: f.x - w / 2, z0: f.z - 0.1, x1: f.x + w / 2, z1: f.z + 0.1 };
        g.gate = true; k.colliders.push(g);
        const side = Math.sign(f.x) || 1;
        this.zone('gates', f.ax === 'z' ? f.x + side * 0.3 : f.x - w / 2, f.ax === 'z' ? f.z - w / 2 : f.z + 0.3, f.ax === 'z' ? f.x + side * 1.6 : f.x + w / 2, f.ax === 'z' ? f.z + w / 2 : f.z + 1.6, { gate: g });
        this.zone('gates', f.ax === 'z' ? f.x - side * 0.3 : f.x - w / 2, f.ax === 'z' ? f.z - w / 2 : f.z - 0.3, f.ax === 'z' ? f.x - side * 1.6 : f.x + w / 2, f.ax === 'z' ? f.z + w / 2 : f.z - 1.6, { gate: g, inside: true });
        break;
      }
      case 'sofas': FUR.sofa(k, f.x, f.z, 0, { w: 2.2, c: [0.35, 0.33, 0.3] }); FUR.sofa(k, f.x, f.z + 2.4, Math.PI, { w: 2.2, c: [0.35, 0.33, 0.3] }); FUR.table(k, f.x, f.z + 1.2, 0, { w: 1.0, d: 0.6, h: 0.42, top: [0.2, 0.2, 0.2] }); break;
      case 'plant': FUR.plant(k, f.x, f.z, { h: f.h || 1.3 }); break;
      case 'extinguisher': FUR.extinguisher(k, f.x, f.z); break;
      case 'exit': FUR.exitSign(k, f.x, f.y || 2.3, f.z, f.rot || 0); break;
      case 'floorsign': k.at(f.x, f.z, f.rot || 0).sign(0, f.y || 2.3, 0.01, 0.9, 0.42, { text: f.text, bg: '#2a6a3a', fg: '#fff' }, 0, 1, 80); break;
      case 'parksign': k.at(f.x, f.z, f.rot || 0).sign(0, f.y || 2.2, 0.01, 1.6, 0.6, { text: f.text, sub: 'PARKING', bg: '#f2c230', fg: '#1a1a1a' }, 0, 1, 96); break;
      case 'pillar': FUR.pillar(k, f.x, f.z, { s: f.s || 0.7, h: f.h || p.ch, c: p.parking ? [0.78, 0.8, 0.76] : [0.85, 0.85, 0.83] });
        if (p.parking) { k.box(f.x - (f.s || 0.7) / 2 - 0.01, 0, f.z - (f.s || 0.7) / 2 - 0.01, f.x + (f.s || 0.7) / 2 + 0.01, 1.0, f.z + (f.s || 0.7) / 2 + 0.01, [0.95, 0.75, 0.15]); }
        break;
      case 'car': FUR.car(k, f.x, f.z, f.rot || 0, { c: f.c || [0.85, 0.85, 0.87] }); break;
      case 'stall': { const fr = k.at(f.x, f.z, f.rot); fr.box(-1.2, 0.005, -2.6, -1.14, 0.012, 2.6, [0.95, 0.95, 0.92]); fr.box(-1.2, 0.005, -2.6, 1.2, 0.012, -2.54, [0.95, 0.95, 0.92]); fr.box(-0.5, 0, -2.3, 0.5, 0.12, -2.15, [0.95, 0.85, 0.2]); break; }
      case 'ramp': { const fr = k.at(f.x, f.z, f.rot); fr.box(-3, 0, -2.5, 3, 0.02, 2.5, [0.45, 0.47, 0.45]); fr.sign(0, 2.3, -2.4, 2.4, 0.5, { text: '↑ 출구 EXIT', bg: '#18a84a', fg: '#fff' }, 0, 1, 80); break; }
      case 'tank': { const fr = k.at(f.x, f.z, 0); fr.box(-1.6, 0, -1.2, 1.6, 2.4, 1.2, [0.35, 0.55, 0.78]); fr.box(-1.7, 0, -1.3, 1.7, 0.2, 1.3, [0.5, 0.5, 0.5]); fr.block(-1.7, -1.3, 1.7, 1.3); break; }
      case 'ac': { const fr = k.at(f.x, f.z, 0); fr.box(-0.45, 0, -0.3, 0.45, 0.8, 0.3, [0.88, 0.88, 0.86]); fr.cyl(0, 0.2, 0.31, 0.25, 0.02, [0.3, 0.3, 0.32]); fr.block(-0.45, -0.3, 0.45, 0.3); break; }
      case 'heli': { k.box(f.x - 6, 0.01, f.z - 6, f.x + 6, 0.03, f.z + 6, [0.3, 0.32, 0.35]); k.sign(f.x, 0.04, f.z, 4, 4, [0, 1], { text: 'H', bg: '#30353a', fg: '#ffd21a', border: '#ffd21a' }, 128); break; }
      case 'benches': for (let i = 0; i < 3; i++) FUR.bench(k, f.x + i * 2.2, f.z, 0); break;
      case 'art': { const fr = k.at(f.x, f.z, f.rot || 0); fr.sign(0, f.y || 2.4, 0.02, 3.2, 1.0, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#d8b48a'); g.addColorStop(0.5, '#f2ead8'); g.addColorStop(1, '#a88a6a'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(80,60,40,.5)'; x.lineWidth = 6; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, h * (0.2 + i * 0.12)); x.bezierCurveTo(w * 0.3, h * (0.1 + i * 0.1), w * 0.6, h * (0.4 + i * 0.08), w, h * (0.2 + i * 0.12)); x.stroke(); } }, 0, 1, 160); break; }
      case 'foodtable': FUR.table(k, f.x, f.z, 0, { w: 1.4, d: 0.8, top: [0.92, 0.92, 0.9] }); for (const [a, b] of [[-0.4, -0.65], [0.4, -0.65], [-0.4, 0.65], [0.4, 0.65]]) FUR.chair(k, f.x + a, f.z + b, b > 0 ? Math.PI : 0, { c: [0.85, 0.55, 0.25] }); this.zone('seat', f.x - 0.9, f.z - 0.9, f.x + 0.9, f.z + 0.9, { food: true }); break;
      case 'civcounter': {
        const fr = k.at(f.x, f.z, f.rot);
        FUR.counter(k, f.x, f.z, f.rot, { w: 2.2, d: 0.7, h: 1.0, c: [0.9, 0.9, 0.88] });
        fr.glassQ(-1.1, 0.0, 1.1, 0.0, 1.0, 1.6);
        fr.box(-0.3, 1.9, 0.3, 0.3, 2.2, 0.34, [0.1, 0.1, 0.12]); fr.sign(0, 2.05, 0.35, 0.56, 0.26, { text: `${f.num}번`, bg: '#101418', fg: '#ff7a1a' }, 0, 1, 64);
        FUR.chair(k, ...fr.p(0, 0.75), f.rot + Math.PI, {});
        this.zone('civcounter', ...rect(f.x, f.z + 0.9, f.rot, 2.0, 0.9), { num: f.num });
        this.npcSpots.push({ kind: 'staff', x: f.x, z: f.z - 0.75, rot: f.rot });
        break;
      }
      case 'ticket': { const fr = k.at(f.x, f.z, f.rot); fr.box(-0.25, 0, -0.2, 0.25, 1.3, 0.2, [0.95, 0.95, 0.95]); fr.glow(-0.18, 1.0, 0.201, 0.18, 1.2, 0.205, [0.3, 0.6, 0.9]); fr.block(-0.25, -0.2, 0.25, 0.2); this.zone('ticket', ...rect(f.x, f.z + 0.6, f.rot, 1.2, 0.8)); break; }
      case 'benchrow': for (let i = 0; i < 3; i++) FUR.chair(k, f.x - 0.55 + i * 0.55, f.z, Math.PI, { c: [0.3, 0.5, 0.75] }); this.zone('wait', f.x - 1, f.z - 0.5, f.x + 1, f.z + 0.5); break;
      case 'gallery': for (let i = 0; i < 6; i++) { FUR.plant(k, f.x + i * 6, f.z - 6, { h: 1.0 }); } break;
    }
  }

  // ─ 회사 층: 책상 줄 · 회의 테이블 · 회사 이름 ─
  officeFloor(k) {
    const p = this.plan;
    const rooms = p.rooms.filter(r => r.kind === 'office');
    const co = this.opts.company?.(this.B, this.n);
    let meetRoom = null;
    for (const r of rooms) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const alongX = w >= d;
      const len = alongX ? w : d, dep = alongX ? d : w;
      if (dep < 3.5) continue;
      if (!meetRoom && len > 10) {
        meetRoom = r;
        const mx = alongX ? r.x0 + 3 : (r.x0 + r.x1) / 2, mz = alongX ? (r.z0 + r.z1) / 2 : r.z0 + 3;
        FUR.table(k, mx, mz, alongX ? Math.PI / 2 : 0, { w: 2.6, d: 1.1, top: [0.3, 0.3, 0.32] });
        for (let i = -1; i <= 1; i++) for (const sd of [-1, 1]) { const [cx, cz] = alongX ? [mx + sd * 0.8, mz + i * 0.8] : [mx + i * 0.8, mz + sd * 0.8]; FUR.chair(k, cx, cz, alongX ? (sd > 0 ? -Math.PI / 2 : Math.PI / 2) : (sd > 0 ? Math.PI : 0), { c: [0.15, 0.15, 0.18] }); }
        this.zone('meeting', mx - 2.2, mz - 2.2, mx + 2.2, mz + 2.2, {});
      }
      const start = (alongX ? r.x0 : r.z0) + (meetRoom === r ? 6 : 1.5);
      for (let a = start; a < (alongX ? r.x1 : r.z1) - 1.2; a += 1.6) {
        for (let b = (alongX ? r.z0 : r.x0) + 1.6; b < (alongX ? r.z1 : r.x1) - 1.4; b += 3.2) {
          const [x, z] = alongX ? [a, b] : [b, a];
          FUR.desk(k, x, z, alongX ? 0 : Math.PI / 2, { w: 1.4 });
          this.zone('odesk', x - 0.8, z - 0.5, x + 0.8, z + 1.2, {});
          this.npcSpots.push({ kind: 'worker', x: alongX ? x : x + 0.65, z: alongX ? z + 0.65 : z, rot: alongX ? Math.PI : -Math.PI / 2 });
        }
      }
    }
    if (co) for (const sx of [-8, 8]) k.sign(sx + Math.sign(sx) * 0.2, 2.2, -1.75, 2.6, 0.5, [0, 1], { text: co.name, sub: co.ind, bg: '#1d2a3a', fg: '#ffffff' }, 96);
  }
  // ─ 충돌: 벽 · 가구 · (닫힌) 게이트 ─
  collide(pos, r) {
    for (let it = 0; it < 2; it++) for (const c of this.colliders) {
      if (c.open) continue;
      if (pos.x < c.x0 - r || pos.x > c.x1 + r || pos.z < c.z0 - r || pos.z > c.z1 + r) continue;
      const dx0 = pos.x - (c.x0 - r), dx1 = c.x1 + r - pos.x, dz0 = pos.z - (c.z0 - r), dz1 = c.z1 + r - pos.z;
      const m = Math.min(dx0, dx1, dz0, dz1);
      if (m === dx0) pos.x = c.x0 - r; else if (m === dx1) pos.x = c.x1 + r; else if (m === dz0) pos.z = c.z0 - r; else pos.z = c.z1 + r;
    }
    // 건물 밖으로는 못 나감 (나가는 문 존 제외)
    const hw = this.W / 2 + 2, hd = this.D / 2 + 2;
    if (this.plan.f.lobby) { pos.x = Math.max(-hw, Math.min(hw, pos.x)); pos.z = Math.max(-hd, Math.min(this.D / 2 + this.B.lobbyLen + 1, pos.z)); }
    else if (!this.plan.exitOpen) { pos.x = Math.max(-hw, Math.min(hw, pos.x)); pos.z = Math.max(-hd, Math.min(hd, pos.z)); }
  }
  zoneAt(pos) {
    let best = null, ba = 1e9;
    for (const z of this.zones) {
      if (pos.x < z.x0 || pos.x > z.x1 || pos.z < z.z0 || pos.z > z.z1) continue;
      const a = (z.x1 - z.x0) * (z.z1 - z.z0);
      if (a < ba) { ba = a; best = z; }
    }
    return best;
  }
  roomAt(x, z) { return this.plan.rooms.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && r.kind !== 'shaft'); }
  dispose() {
    this.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const m = o.material; if (m && !m.userData?.shared && m.map && m.map !== sharedMats().vc?.map) { if (o.userData.own !== false && m.map?.isCanvasTexture) m.map.dispose(); } } });
    this.root.parent?.remove(this.root);
  }
  updateWalls() {}
}
// 회전한 사각 존 (앞쪽 offset)
function rect(x, z, rot, w, d, off = 0.6) {
  const r = Math.round(rot / (Math.PI / 2)) & 3;
  const fx = [0, 1, 0, -1][r], fz = [1, 0, -1, 0][r];
  const cx = x + fx * off, cz = z + fz * off;
  const hw = (r % 2 ? d : w) / 2, hd = (r % 2 ? w : d) / 2;
  return [cx - hw, cz - hd, cx + hw, cz + hd];
}
export { rect };

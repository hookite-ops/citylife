import * as THREE from 'three';
import { GB } from './geo.js';

// ───────── 실내 부품 키트: 재질 · 벽(문·창 구멍) · 가구 ─────────
// 좌표: 층 기준 로컬 (x, z), 바닥 y = 0. 가구 앞쪽은 회전 0일 때 +z.

const _mats = {};
function cv(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
// 바닥 무늬
const FLOOR_DRAW = {
  tile: (x, w, h) => { x.fillStyle = '#e8e6e0'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 228 + Math.random() * 12; x.fillStyle = `rgb(${v},${v - 2},${v - 6})`; x.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); } x.strokeStyle = 'rgba(150,150,150,.5)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); } },
  oldtile: (x, w, h) => { x.fillStyle = '#c9c2b2'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const v = 185 + Math.random() * 25; x.fillStyle = (i + j) % 2 ? `rgb(${v},${v - 6},${v - 18})` : `rgb(${v - 30},${v - 34},${v - 40})`; x.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); } for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(80,70,50,${Math.random() * 0.12})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, Math.random() * 14, 0, 7); x.fill(); } },
  stone: (x, w, h) => { x.fillStyle = '#efece6'; x.fillRect(0, 0, w, h); for (let k = 0; k < 220; k++) { x.strokeStyle = `rgba(150,140,130,${Math.random() * 0.12})`; x.lineWidth = Math.random() * 2; x.beginPath(); const sx = Math.random() * w, sy = Math.random() * h; x.moveTo(sx, sy); x.bezierCurveTo(sx + rnd(-60, 60), sy + rnd(-60, 60), sx + rnd(-60, 60), sy + rnd(-60, 60), sx + rnd(-90, 90), sy + rnd(-90, 90)); x.stroke(); } x.strokeStyle = 'rgba(120,120,120,.35)'; x.lineWidth = 1.5; x.strokeRect(0, 0, w, h); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); },
  wood: (x, w, h) => { for (let i = 0; i < 8; i++) { const v = 150 + Math.random() * 40; x.fillStyle = `rgb(${v + 40},${v + 8},${v - 40})`; x.fillRect(0, i * 32, w, 32); x.strokeStyle = 'rgba(70,40,20,.35)'; x.strokeRect(((i * 97) % w), i * 32, w, 32); for (let k = 0; k < 18; k++) { x.strokeStyle = `rgba(90,50,20,${Math.random() * 0.15})`; x.beginPath(); const y = i * 32 + Math.random() * 32; x.moveTo(0, y); x.lineTo(w, y + rnd(-3, 3)); x.stroke(); } } },
  darkwood: (x, w, h) => { for (let i = 0; i < 8; i++) { const v = 70 + Math.random() * 25; x.fillStyle = `rgb(${v + 30},${v + 10},${v - 10})`; x.fillRect(0, i * 32, w, 32); x.strokeStyle = 'rgba(20,10,5,.5)'; x.strokeRect(((i * 61) % w), i * 32, w, 32); } },
  carpet: (x, w, h) => { x.fillStyle = '#4a4f5a'; x.fillRect(0, 0, w, h); for (let k = 0; k < 9000; k++) { const v = 60 + Math.random() * 40; x.fillStyle = `rgba(${v},${v + 4},${v + 14},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } },
  redcarpet: (x, w, h) => { x.fillStyle = '#6a2a3a'; x.fillRect(0, 0, w, h); for (let k = 0; k < 9000; k++) { const v = Math.random() * 40; x.fillStyle = `rgba(${110 + v},${40 + v / 2},${60 + v / 2},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } },
  concrete: (x, w, h) => { x.fillStyle = '#9a9a96'; x.fillRect(0, 0, w, h); for (let k = 0; k < 4000; k++) { const v = 130 + Math.random() * 50; x.fillStyle = `rgba(${v},${v},${v - 4},.4)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } for (let k = 0; k < 20; k++) { x.fillStyle = `rgba(60,60,60,${Math.random() * 0.08})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, Math.random() * 40, 0, 7); x.fill(); } },
  epoxy: (x, w, h) => { x.fillStyle = '#5f8a6a'; x.fillRect(0, 0, w, h); for (let k = 0; k < 3000; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } },
  mat: (x, w, h) => { const cols = ['#2f6fd6', '#d63a3a']; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = cols[(i + j) % 2]; x.fillRect(i * 128, j * 128, 128, 128); } x.strokeStyle = 'rgba(0,0,0,.2)'; x.strokeRect(0, 0, w, h); },
  rubber: (x, w, h) => { x.fillStyle = '#2a2b2e'; x.fillRect(0, 0, w, h); for (let k = 0; k < 6000; k++) { x.fillStyle = `rgba(${Math.random() < 0.1 ? '200,80,60' : '120,120,120'},.25)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } },
  kids: (x, w, h) => { const cols = ['#ffd21a', '#5ab0ff', '#7ad84a', '#ff7ab0']; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = cols[(i + j * 2) % 4]; x.fillRect(i * 64, j * 64, 64, 64); } },
  roof: (x, w, h) => { x.fillStyle = '#6a8a7a'; x.fillRect(0, 0, w, h); for (let k = 0; k < 3000; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } },
};
const FLOOR_SCALE = { tile: 2.4, oldtile: 2.4, stone: 2.4, wood: 2.2, darkwood: 2.2, carpet: 3, redcarpet: 3, concrete: 4, epoxy: 6, mat: 2, rubber: 3, kids: 2.4, roof: 5 };
export function floorMat(kind) {
  const k = 'f_' + kind;
  if (!_mats[k]) {
    const t = cv(256, 256, FLOOR_DRAW[kind] || FLOOR_DRAW.tile);
    _mats[k] = new THREE.MeshStandardMaterial({ map: t, roughness: kind === 'stone' ? 0.25 : kind === 'epoxy' ? 0.3 : 0.75, metalness: kind === 'stone' ? 0.05 : 0 });
    _mats[k].userData.scale = FLOOR_SCALE[kind] || 2.4;
  }
  return _mats[k];
}
export function sharedMats() {
  if (_mats.vc) return _mats;
  _mats.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.02 });
  _mats.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.75 });
  _mats.glass = new THREE.MeshStandardMaterial({ color: 0xc6e2ee, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.5, side: THREE.DoubleSide, depthWrite: false });
  _mats.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  _mats.mirror = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.02, metalness: 1 });
  return _mats;
}

// ───────── 글자·그림 아틀라스 (층마다 1장) ─────────
export class LabelAtlas {
  constructor(size = 2048) {
    this.size = size;
    this.c = document.createElement('canvas'); this.c.width = this.c.height = size;
    this.x = this.c.getContext('2d');
    this.x.fillStyle = '#fff'; this.x.fillRect(0, 0, size, size);
    this.cx = 0; this.cy = 0; this.rowH = 0;
  }
  // 영역 확보 → draw(ctx, w, h) → UV 반환
  add(w, h, draw) {
    w = Math.min(w, this.size); h = Math.min(h, this.size);
    if (this.cx + w > this.size) { this.cx = 0; this.cy += this.rowH + 2; this.rowH = 0; }
    if (this.cy + h > this.size) { this.cx = 0; this.cy = 0; this.rowH = 0; } // 넘치면 덮어씀
    const x0 = this.cx, y0 = this.cy;
    this.x.save(); this.x.translate(x0, y0); this.x.beginPath(); this.x.rect(0, 0, w, h); this.x.clip();
    draw(this.x, w, h);
    this.x.restore();
    this.cx += w + 2; this.rowH = Math.max(this.rowH, h);
    const S = this.size;
    return [x0 / S, 1 - (y0 + h) / S, (x0 + w) / S, 1 - y0 / S];
  }
  texture() {
    if (!this.tex) { this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4; }
    return this.tex;
  }
}
// 글자 판 그리기 도우미
export function drawSign(x, w, h, { text = '', sub = '', bg = '#222', fg = '#fff', font = 800, border = null, align = 'center' }) {
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (border) { x.strokeStyle = border; x.lineWidth = Math.max(3, h * 0.05); x.strokeRect(2, 2, w - 4, h - 4); }
  x.fillStyle = fg; x.textAlign = align; x.textBaseline = 'middle';
  let fs = Math.floor(h * (sub ? 0.46 : 0.62));
  const ff = (s) => `${font} ${s}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  x.font = ff(fs);
  while (x.measureText(text).width > w * 0.9 && fs > 8) { fs -= 2; x.font = ff(fs); }
  const ax = align === 'center' ? w / 2 : w * 0.06;
  x.fillText(text, ax, sub ? h * 0.38 : h / 2 + 1);
  if (sub) {
    let ss = Math.floor(h * 0.22); x.font = ff(ss).replace(String(font), '600');
    while (x.measureText(sub).width > w * 0.9 && ss > 7) { ss -= 1; x.font = ff(ss).replace(String(font), '600'); }
    x.globalAlpha = 0.85; x.fillText(sub, ax, h * 0.76); x.globalAlpha = 1;
  }
}

// ───────── 키트 ─────────
const _c = new THREE.Color();
export class Kit {
  constructor() {
    this.solid = new GB(); this.metal = new GB(); this.glass = new GB(); this.glow = new GB(); this.label = new GB();
    this.floors = {};    // kind → GB (텍스처 바닥)
    this.colliders = []; // {x0,z0,x1,z1}
    this.atlas = new LabelAtlas();
    this.extra = [];     // 따로 만든 메시
  }
  col(gb, c) { if (Array.isArray(c)) gb.setRGB(c[0], c[1], c[2]); else gb.setColor(c); return gb; }
  // 축 정렬 상자 (로컬)
  box(x0, y0, z0, x1, y1, z1, c, gb = this.solid) { this.col(gb, c).box(Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1)); }
  // 콜라이더
  block(x0, z0, x1, z1) { this.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); }
  // 바닥 (텍스처)
  floor(kind, x0, z0, x1, z1, y = 0) {
    const g = this.floors[kind] || (this.floors[kind] = new GB());
    const s = floorMat(kind).userData.scale;
    g.top(x0, z0, x1, z1, y, s, s);
  }
  ceiling(x0, z0, x1, z1, y, c = [0.96, 0.96, 0.95]) { this.col(this.solid, c).bottom(x0, z0, x1, z1, y); }
  // 천장 조명 (빛나는 판)
  lightPanel(x, z, y, w = 0.6, d = 0.6, c = [1, 1, 0.97]) { this.col(this.glow, c); this.glow.bottom(x - w / 2, z - d / 2, x + w / 2, z + d / 2, y - 0.01); }
  // 글자판: 평면 (위치·법선 방향 [nx, nz])
  plane(cx, cy, cz, w, h, n, uv, gb = this.label) {
    const [u0, v0, u1, v1] = uv;
    const tx = n[1], tz = -n[0];   // 바라볼 때 오른쪽
    const hw = w / 2, hh = h / 2;
    gb.quad([cx - tx * hw, cy - hh, cz - tz * hw], [cx + tx * hw, cy - hh, cz + tz * hw], [cx + tx * hw, cy + hh, cz + tz * hw], [cx - tx * hw, cy + hh, cz - tz * hw], [n[0], 0, n[1]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  }
  sign(cx, cy, cz, w, h, n, opts, px = 120) {
    const uv = this.atlas.add(Math.round(px * w / h), px, (x, W, H) => (typeof opts === 'function' ? opts(x, W, H) : drawSign(x, W, H, opts)));
    this.plane(cx, cy, cz, w, h, n, uv);
  }
  // 회전 프레임 (0/90/180/270도)
  at(x, z, rot = 0) { return new Frame(this, x, z, rot); }

  // 벽: (x0,z0)→(x1,z1), 두께 t, 높이 h, 구멍 [{u0,u1,y0,y1,glass}]. 방 안쪽에서 보이는 색.
  wall(x0, z0, x1, z1, h, c, { t = 0.15, holes = [], collide = true, base = null } = {}) {
    const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.01) return;
    const dx = (x1 - x0) / L, dz = (z1 - z0) / L;
    const seg = (u0, u1, y0, y1) => {
      if (u1 - u0 < 0.005 || y1 - y0 < 0.005) return;
      const ax = x0 + dx * u0, az = z0 + dz * u0, bx = x0 + dx * u1, bz = z0 + dz * u1;
      const px = -dz * t / 2, pz = dx * t / 2;
      this.box(Math.min(ax, bx) - Math.abs(px), y0, Math.min(az, bz) - Math.abs(pz), Math.max(ax, bx) + Math.abs(px), y1, Math.max(az, bz) + Math.abs(pz), c);
    };
    const hs = holes.slice().sort((a, b) => a.u0 - b.u0);
    let u = 0;
    for (const o of hs) {
      seg(u, o.u0, 0, h);
      seg(o.u0, o.u1, 0, o.y0 || 0);
      seg(o.u0, o.u1, o.y1, h);
      if (o.glass) {
        const ax = x0 + dx * o.u0, az = z0 + dz * o.u0, bx = x0 + dx * o.u1, bz = z0 + dz * o.u1;
        this.glass.quad([ax, o.y0, az], [bx, o.y0, bz], [bx, o.y1, bz], [ax, o.y1, az], [-dz, 0, dx], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        // 창틀
        this.box(Math.min(ax, bx) - 0.02, o.y0 - 0.04, Math.min(az, bz) - 0.02, Math.max(ax, bx) + 0.02, o.y0, Math.max(az, bz) + 0.02, [0.85, 0.86, 0.87], this.metal);
        this.box(Math.min(ax, bx) - 0.02, o.y1, Math.min(az, bz) - 0.02, Math.max(ax, bx) + 0.02, o.y1 + 0.04, Math.max(az, bz) + 0.02, [0.85, 0.86, 0.87], this.metal);
        if (o.mull) for (let m = o.u0 + o.mull; m < o.u1 - 0.1; m += o.mull) { const mx = x0 + dx * m, mz = z0 + dz * m; this.box(mx - 0.025, o.y0, mz - 0.025, mx + 0.025, o.y1, mz + 0.025, [0.3, 0.32, 0.35], this.metal); }
      }
      u = Math.max(u, o.u1);
    }
    seg(u, L, 0, h);
    if (base) { // 걸레받이
      let uu = 0;
      for (const o of [...hs, { u0: L, u1: L, y0: 0 }]) { if (o.y0 > 0.1 || o.u0 > uu) { const a = uu, b = o.y0 > 0.1 ? o.u1 : o.u0; if (b > a) { const ax = x0 + dx * a, az = z0 + dz * a, bx = x0 + dx * b, bz = z0 + dz * b; const px = Math.abs(-dz * (t / 2 + 0.012)), pz = Math.abs(dx * (t / 2 + 0.012)); this.box(Math.min(ax, bx) - px, 0, Math.min(az, bz) - pz, Math.max(ax, bx) + px, 0.09, Math.max(az, bz) + pz, base); } } uu = o.u1; }
    }
    if (collide) {
      let uu = 0;
      const solid = (a, b) => { if (b - a < 0.02) return; const ax = x0 + dx * a, az = z0 + dz * a, bx = x0 + dx * b, bz = z0 + dz * b; const px = Math.abs(dz) * t / 2 + 0.02, pz = Math.abs(dx) * t / 2 + 0.02; this.block(Math.min(ax, bx) - px, Math.min(az, bz) - pz, Math.max(ax, bx) + px, Math.max(az, bz) + pz); };
      for (const o of hs) { if ((o.y0 || 0) > 0.3) continue; solid(uu, o.u0); uu = Math.max(uu, o.u1); }
      solid(uu, L);
    }
  }
  // 메시로 만들기
  meshes() {
    const M = sharedMats(), out = [];
    const add = (gb, mat, o = {}) => { if (gb.empty) return; const m = new THREE.Mesh(gb.build(), mat); Object.assign(m, o); out.push(m); return m; };
    for (const [k, g] of Object.entries(this.floors)) add(g, floorMat(k), { receiveShadow: true });
    add(this.solid, M.vc, { receiveShadow: true });
    add(this.metal, M.metal);
    add(this.glow, M.glow);
    if (!this.label.empty) add(this.label, new THREE.MeshStandardMaterial({ map: this.atlas.texture(), roughness: 0.55, emissive: 0xffffff, emissiveMap: this.atlas.texture(), emissiveIntensity: 0.18 }));
    const gm = add(this.glass, M.glass); if (gm) gm.renderOrder = 3;
    out.push(...this.extra);
    return out;
  }
}

// 회전 프레임: 가구 로컬 좌표(fx, fz) → 층 좌표
export class Frame {
  constructor(kit, x, z, rot) {
    this.k = kit; this.x = x; this.z = z;
    this.r = Math.round(rot / (Math.PI / 2)) & 3;
  }
  p(fx, fz) {
    switch (this.r) {
      case 0: return [this.x + fx, this.z + fz];
      case 1: return [this.x + fz, this.z - fx];
      case 2: return [this.x - fx, this.z - fz];
      default: return [this.x - fz, this.z + fx];
    }
  }
  n(nx, nz) { const a = this.p(nx, nz); return [a[0] - this.x, a[1] - this.z]; }
  box(fx0, y0, fz0, fx1, y1, fz1, c, gb) { const a = this.p(fx0, fz0), b = this.p(fx1, fz1); this.k.box(a[0], y0, a[1], b[0], y1, b[1], c, gb); return this; }
  cbox(fx, y, fz, w, h, d, c, gb) { return this.box(fx - w / 2, y - h / 2, fz - d / 2, fx + w / 2, y + h / 2, fz + d / 2, c, gb); }
  block(fx0, fz0, fx1, fz1) { const a = this.p(fx0, fz0), b = this.p(fx1, fz1); this.k.block(a[0], a[1], b[0], b[1]); return this; }
  cyl(fx, y0, fz, r, h, c, seg = 10, gb = this.k.solid) { const [x, z] = this.p(fx, fz); this.k.col(gb, c).addGeo(new THREE.CylinderGeometry(r, r, h, seg).translate(x, y0 + h / 2, z)); return this; }
  cone(fx, y0, fz, r0, r1, h, c, seg = 10, gb = this.k.solid) { const [x, z] = this.p(fx, fz); this.k.col(gb, c).addGeo(new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y0 + h / 2, z)); return this; }
  sphere(fx, y, fz, r, c, gb = this.k.solid) { const [x, z] = this.p(fx, fz); this.k.col(gb, c).addGeo(new THREE.SphereGeometry(r, 10, 8).translate(x, y, z)); return this; }
  glow(fx0, y0, fz0, fx1, y1, fz1, c) { return this.box(fx0, y0, fz0, fx1, y1, fz1, c, this.k.glow); }
  // 글자판 (로컬 앞쪽 법선 기준)
  sign(fx, y, fz, w, h, opts, nfx = 0, nfz = 1, px) { const [x, z] = this.p(fx, fz); this.k.sign(x, y, z, w, h, this.n(nfx, nfz), opts, px); return this; }
  planeUV(fx, y, fz, w, h, uv, nfx = 0, nfz = 1) { const [x, z] = this.p(fx, fz); this.k.plane(x, y, z, w, h, this.n(nfx, nfz), uv); return this; }
  glassQ(fx0, fz0, fx1, fz1, y0, y1) { const a = this.p(fx0, fz0), b = this.p(fx1, fz1); const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; this.k.glass.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [-dz / L, 0, dx / L], [[0, 0], [1, 0], [1, 1], [0, 1]]); return this; }
}

// ───────── 가구 라이브러리 ─────────
// 모두 (kit, x, z, rot, opts) 형태. 콜라이더도 같이 넣음.
const WOOD = [0.62, 0.44, 0.28], DARKW = [0.3, 0.2, 0.14], WHITE = [0.95, 0.95, 0.94], BLACK = [0.12, 0.12, 0.13], STEEL = [0.72, 0.74, 0.77], GREY = [0.55, 0.56, 0.58];
export const COL = { WOOD, DARKW, WHITE, BLACK, STEEL, GREY };

export const FUR = {
  table(k, x, z, rot = 0, { w = 1.2, d = 0.75, h = 0.74, top = WOOD, leg = BLACK, collide = true } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, h - 0.04, -d / 2, w / 2, h, d / 2, top);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) f.cbox(a * (w / 2 - 0.06), h / 2 - 0.02, b * (d / 2 - 0.06), 0.05, h - 0.04, 0.05, leg);
    if (collide) f.block(-w / 2, -d / 2, w / 2, d / 2);
    return f;
  },
  roundTable(k, x, z, { r = 0.45, h = 0.74, top = WHITE, leg = STEEL } = {}) {
    const f = k.at(x, z, 0);
    f.cyl(0, h - 0.035, 0, r, 0.035, top, 18); f.cyl(0, 0, 0, 0.04, h - 0.03, leg); f.cyl(0, 0, 0, 0.25, 0.03, leg, 12);
    f.block(-r * 0.75, -r * 0.75, r * 0.75, r * 0.75);
  },
  chair(k, x, z, rot = 0, { c = [0.25, 0.27, 0.3], seatH = 0.45, back = true } = {}) {
    const f = k.at(x, z, rot);
    f.box(-0.21, seatH - 0.04, -0.21, 0.21, seatH, 0.21, c);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) f.cbox(a * 0.18, (seatH - 0.04) / 2, b * 0.18, 0.03, seatH - 0.04, 0.03, BLACK);
    if (back) f.box(-0.21, seatH, -0.22, 0.21, seatH + 0.42, -0.18, c);
  },
  stool(k, x, z, { c = [0.85, 0.3, 0.25], h = 0.45 } = {}) {
    const f = k.at(x, z, 0); f.cyl(0, h - 0.05, 0, 0.17, 0.05, c, 12); f.cyl(0, 0, 0, 0.025, h - 0.05, STEEL, 6);
  },
  sofa(k, x, z, rot = 0, { w = 1.8, c = [0.35, 0.38, 0.45], d = 0.8 } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, 0.05, -d / 2, w / 2, 0.42, d / 2, c);
    f.box(-w / 2, 0.42, -d / 2, w / 2, 0.85, -d / 2 + 0.2, c);
    f.box(-w / 2, 0.42, -d / 2, -w / 2 + 0.16, 0.62, d / 2, c); f.box(w / 2 - 0.16, 0.42, -d / 2, w / 2, 0.62, d / 2, c);
    f.block(-w / 2, -d / 2, w / 2, d / 2);
  },
  bench(k, x, z, rot = 0, { w = 1.6, c = WOOD } = {}) {
    const f = k.at(x, z, rot); f.box(-w / 2, 0.42, -0.2, w / 2, 0.46, 0.2, c); f.box(-w / 2 + 0.1, 0, -0.15, -w / 2 + 0.16, 0.42, 0.15, BLACK); f.box(w / 2 - 0.16, 0, -0.15, w / 2 - 0.1, 0.42, 0.15, BLACK); f.block(-w / 2, -0.2, w / 2, 0.2);
  },
  counter(k, x, z, rot = 0, { w = 2.4, d = 0.65, h = 1.0, c = WHITE, top = [0.3, 0.3, 0.32], front = null } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, 0, -d / 2, w / 2, h - 0.04, d / 2, c);
    f.box(-w / 2 - 0.02, h - 0.04, -d / 2 - 0.02, w / 2 + 0.02, h, d / 2 + 0.03, top);
    if (front) f.box(-w / 2, 0.15, d / 2, w / 2, h - 0.12, d / 2 + 0.01, front);
    f.block(-w / 2, -d / 2, w / 2, d / 2);
    return f;
  },
  register(k, x, y, z, rot = 0) {
    const f = k.at(x, z, rot);
    f.box(-0.18, y, -0.15, 0.18, y + 0.1, 0.15, [0.2, 0.2, 0.22]);
    f.box(-0.16, y + 0.1, -0.12, 0.16, y + 0.36, -0.1, BLACK); f.glow(-0.14, y + 0.12, -0.099, 0.14, y + 0.34, -0.098, [0.35, 0.6, 0.9]);
    f.box(0.2, y, -0.05, 0.3, y + 0.04, 0.08, [0.25, 0.25, 0.28]);
  },
  kiosk(k, x, z, rot = 0, { c = [0.95, 0.95, 0.95], screen = [0.2, 0.55, 0.95] } = {}) {
    const f = k.at(x, z, rot);
    f.box(-0.3, 0, -0.18, 0.3, 0.05, 0.18, GREY);
    f.box(-0.08, 0.05, -0.08, 0.08, 1.0, 0.08, c);
    f.box(-0.32, 1.0, -0.12, 0.32, 1.85, 0.0, c);
    f.glow(-0.28, 1.05, 0.001, 0.28, 1.8, 0.005, screen);
    f.block(-0.3, -0.18, 0.3, 0.18);
  },
  shelf(k, x, z, rot = 0, { w = 1.8, d = 0.45, h = 1.8, levels = 4, c = WHITE, goods = true, palette = null } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, 0, -d / 2, -w / 2 + 0.04, h, d / 2, c); f.box(w / 2 - 0.04, 0, -d / 2, w / 2, h, d / 2, c);
    f.box(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.03, c);
    const pal = palette || [[0.9, 0.3, 0.25], [0.95, 0.75, 0.2], [0.25, 0.55, 0.9], [0.3, 0.7, 0.4], [0.9, 0.9, 0.85], [0.7, 0.4, 0.8], [0.95, 0.55, 0.25]];
    for (let i = 0; i <= levels; i++) {
      const y = 0.08 + i * (h - 0.12) / levels;
      f.box(-w / 2, y - 0.025, -d / 2, w / 2, y, d / 2, c);
      if (goods && i < levels) {
        let u = -w / 2 + 0.08;
        const gh = (h - 0.12) / levels * (0.55 + Math.random() * 0.3);
        while (u < w / 2 - 0.12) {
          const pw = 0.08 + Math.random() * 0.14;
          f.box(u, y, -d / 2 + 0.06, Math.min(u + pw, w / 2 - 0.06), y + gh * (0.6 + Math.random() * 0.4), d / 2 - 0.04, pal[Math.floor(Math.random() * pal.length)]);
          u += pw + 0.015;
        }
      }
    }
    f.block(-w / 2, -d / 2, w / 2, d / 2);
  },
  fridge(k, x, z, rot = 0, { w = 1.2, h = 2.0, d = 0.7, drinks = true } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.05, [0.85, 0.86, 0.88]);
    f.box(-w / 2, 0, -d / 2, -w / 2 + 0.05, h, d / 2, [0.85, 0.86, 0.88]); f.box(w / 2 - 0.05, 0, -d / 2, w / 2, h, d / 2, [0.85, 0.86, 0.88]);
    f.box(-w / 2, h - 0.2, -d / 2, w / 2, h, d / 2, [0.85, 0.86, 0.88]); f.box(-w / 2, 0, -d / 2, w / 2, 0.15, d / 2, [0.85, 0.86, 0.88]);
    f.glow(-w / 2 + 0.06, h - 0.22, -d / 2 + 0.1, w / 2 - 0.06, h - 0.2, d / 2 - 0.1, [0.9, 0.95, 1]);
    const pal = [[0.9, 0.15, 0.15], [0.2, 0.6, 0.25], [0.95, 0.8, 0.2], [0.2, 0.4, 0.9], [0.95, 0.95, 0.95], [0.6, 0.35, 0.2]];
    for (let i = 0; i < 4; i++) {
      const y = 0.15 + i * (h - 0.4) / 4;
      f.box(-w / 2 + 0.05, y, -d / 2 + 0.05, w / 2 - 0.05, y + 0.02, d / 2 - 0.05, [0.8, 0.82, 0.85]);
      if (drinks) for (let u = -w / 2 + 0.1; u < w / 2 - 0.1; u += 0.1) f.cyl(u + 0.04, y + 0.02, 0.1, 0.035, 0.24, pal[Math.floor(Math.random() * pal.length)], 6);
    }
    f.glassQ(-w / 2, d / 2, w / 2, d / 2, 0.15, h - 0.2);
    f.box(-0.02, 0.15, d / 2, 0.02, h - 0.2, d / 2 + 0.02, STEEL, k.metal);
    f.block(-w / 2, -d / 2, w / 2, d / 2);
  },
  displayCase(k, x, z, rot = 0, { w = 1.6, d = 0.7, h = 1.1, items = null, c = WHITE } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, 0, -d / 2, w / 2, 0.6, d / 2, c);
    f.box(-w / 2, 0.6, -d / 2, w / 2, 0.63, d / 2, [0.85, 0.85, 0.85]);
    f.glow(-w / 2 + 0.05, h - 0.02, -d / 2 + 0.05, w / 2 - 0.05, h, d / 2 - 0.05, [1, 0.96, 0.88]);
    if (items) for (let u = -w / 2 + 0.15; u < w / 2 - 0.1; u += 0.22) for (const zz of [-0.15, 0.12]) f.cbox(u, 0.67, zz, 0.15, 0.08, 0.15, items[Math.floor(Math.random() * items.length)]);
    f.glassQ(-w / 2, d / 2, w / 2, d / 2, 0.63, h); f.glassQ(-w / 2, -d / 2, -w / 2, d / 2, 0.63, h); f.glassQ(w / 2, d / 2, w / 2, -d / 2, 0.63, h);
    f.box(-w / 2, h - 0.03, -d / 2, w / 2, h, d / 2, [0.9, 0.9, 0.9]);
    f.block(-w / 2, -d / 2, w / 2, d / 2);
  },
  plant(k, x, z, { h = 1.2, pot = [0.85, 0.85, 0.82] } = {}) {
    const f = k.at(x, z, 0);
    f.cone(0, 0, 0, 0.18, 0.22, 0.4, pot, 10);
    f.sphere(0, 0.4 + h * 0.4, 0, h * 0.32, [0.25, 0.55, 0.3]); f.sphere(0.12, 0.4 + h * 0.6, 0.05, h * 0.22, [0.3, 0.62, 0.32]);
    f.block(-0.2, -0.2, 0.2, 0.2);
  },
  tv(k, x, y, z, rot = 0, { w = 1.2, on = true, c = [0.15, 0.35, 0.6] } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, y, -0.04, w / 2, y + w * 0.58, 0, BLACK);
    if (on) f.glow(-w / 2 + 0.03, y + 0.03, 0.001, w / 2 - 0.03, y + w * 0.58 - 0.03, 0.004, c);
  },
  monitor(k, x, y, z, rot = 0, { w = 0.55, on = true, c = [0.25, 0.5, 0.85] } = {}) {
    const f = k.at(x, z, rot);
    f.box(-0.06, y, -0.08, 0.06, y + 0.12, 0, BLACK); f.box(-0.15, y, -0.12, 0.15, y + 0.015, 0.02, BLACK);
    f.box(-w / 2, y + 0.1, -0.03, w / 2, y + 0.1 + w * 0.6, 0, BLACK);
    if (on) f.glow(-w / 2 + 0.015, y + 0.115, 0.001, w / 2 - 0.015, y + 0.085 + w * 0.6, 0.003, c);
  },
  desk(k, x, z, rot = 0, { w = 1.4, d = 0.7, c = [0.9, 0.9, 0.88], pc = true, chair = true } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, 0.72, -d / 2, w / 2, 0.75, d / 2, c);
    f.box(-w / 2, 0, -d / 2, -w / 2 + 0.04, 0.72, d / 2, GREY); f.box(w / 2 - 0.04, 0, -d / 2, w / 2, 0.72, d / 2, GREY);
    f.box(w / 2 - 0.45, 0.1, -d / 2 + 0.05, w / 2 - 0.05, 0.7, d / 2 - 0.05, GREY);
    if (pc) { const mp = f.p(0, -d / 2 + 0.2); FUR.monitor(k, mp[0], 0.75, mp[1], rot, {}); }
    if (pc) f.box(-0.25, 0.75, 0.0, 0.2, 0.77, 0.15, BLACK);
    if (chair) FUR.chair(k, ...f.p(0, d / 2 + 0.35), rot + Math.PI, { c: [0.15, 0.15, 0.18] });
    f.block(-w / 2, -d / 2, w / 2, d / 2);
  },
  whiteboard(k, x, y, z, rot = 0, { w = 2.4, h = 1.1 } = {}) {
    const f = k.at(x, z, rot); f.box(-w / 2, y, -0.03, w / 2, y + h, 0, [0.97, 0.97, 0.97]); f.box(-w / 2 - 0.03, y - 0.03, -0.04, w / 2 + 0.03, y, 0.06, STEEL);
  },
  mirror(k, x, y, z, rot = 0, { w = 0.8, h = 1.1 } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2 - 0.03, y - 0.03, -0.03, w / 2 + 0.03, y + h + 0.03, 0, BLACK);
    const [cx, cz] = f.p(0, 0.002); const n = f.n(0, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sharedMats().mirror); m.position.set(cx, y + h / 2, cz); m.rotation.y = Math.atan2(n[0], n[1]); k.extra.push(m);
  },
  bed(k, x, z, rot = 0, { w = 1.0, l = 2.0, c = [0.9, 0.92, 0.95], frame = STEEL } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, 0.3, -l / 2, w / 2, 0.55, l / 2, c);
    f.box(-w / 2, 0.05, -l / 2, w / 2, 0.3, l / 2, frame);
    f.box(-w / 2 + 0.1, 0.55, -l / 2 + 0.05, w / 2 - 0.1, 0.65, -l / 2 + 0.4, WHITE);
    f.box(-w / 2, 0.3, -l / 2 - 0.05, w / 2, 0.9, -l / 2, frame);
    f.block(-w / 2, -l / 2, w / 2, l / 2);
  },
  curtain(k, x0, z0, x1, z1, { h = 2.0, c = [0.55, 0.75, 0.85] } = {}) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), n = Math.max(2, Math.round(L / 0.25));
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, off = (i % 2) * 0.03; k.box(x0 + dx * t0 - Math.abs(dz / L) * off, 0.15, z0 + dz * t0 - Math.abs(dx / L) * off, x0 + dx * t1 + Math.abs(dz / L) * 0.02, h, z0 + dz * t1 + Math.abs(dx / L) * 0.02, c); }
  },
  sink(k, x, z, rot = 0, { w = 0.6 } = {}) {
    const f = k.at(x, z, rot);
    f.box(-w / 2, 0, -0.25, w / 2, 0.85, 0.25, WHITE);
    f.box(-w / 2 + 0.06, 0.78, -0.18, w / 2 - 0.06, 0.86, 0.18, [0.8, 0.82, 0.85], k.metal);
    f.cyl(0, 0.86, -0.18, 0.02, 0.25, STEEL, 6, k.metal);
    f.block(-w / 2, -0.25, w / 2, 0.25);
  },
  toilet(k, x, z, rot = 0) {
    const f = k.at(x, z, rot);
    f.box(-0.2, 0, -0.35, 0.2, 0.4, 0.2, WHITE); f.box(-0.22, 0.4, -0.37, 0.22, 0.45, 0.22, WHITE); f.box(-0.2, 0.4, -0.38, 0.2, 0.85, -0.25, WHITE);
    f.block(-0.22, -0.38, 0.22, 0.22);
  },
  water(k, x, z, rot = 0) {
    const f = k.at(x, z, rot);
    f.box(-0.18, 0, -0.18, 0.18, 1.0, 0.18, WHITE); f.cyl(0, 1.0, 0, 0.14, 0.4, [0.6, 0.8, 0.95], 10);
    f.block(-0.18, -0.18, 0.18, 0.18);
  },
  trash(k, x, z) { const f = k.at(x, z, 0); f.cyl(0, 0, 0, 0.17, 0.6, [0.3, 0.32, 0.35], 10); },
  extinguisher(k, x, z, rot = 0) { const f = k.at(x, z, rot); f.cyl(0, 0, 0, 0.08, 0.5, [0.85, 0.12, 0.1], 8); f.box(-0.12, 0, -0.12, 0.12, 0.05, 0.12, [0.2, 0.2, 0.2]); },
  exitSign(k, x, y, z, rot = 0) {
    const f = k.at(x, z, rot);
    f.sign(0, y, 0.01, 0.42, 0.16, (c, w, h) => { c.fillStyle = '#18a84a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `800 ${h * 0.55}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🏃 비상구', w / 2, h / 2 + 2); }, 0, 1, 64);
  },
  pillar(k, x, z, { s = 0.7, h = 3, c = [0.85, 0.85, 0.83] } = {}) { k.box(x - s / 2, 0, z - s / 2, x + s / 2, h, z + s / 2, c); k.block(x - s / 2, z - s / 2, x + s / 2, z + s / 2); },
  // 주차된 차 (단순 모형)
  car(k, x, z, rot = 0, { c = [0.85, 0.85, 0.87] } = {}) {
    const f = k.at(x, z, rot);
    f.box(-0.9, 0.25, -2.2, 0.9, 0.85, 2.2, c);
    f.box(-0.8, 0.85, -1.1, 0.8, 1.35, 1.0, c);
    f.box(-0.78, 0.9, 1.0, 0.78, 1.3, 1.02, [0.15, 0.18, 0.22]); f.box(-0.78, 0.9, -1.12, 0.78, 1.3, -1.1, [0.15, 0.18, 0.22]);
    f.box(-0.81, 0.9, -1.0, -0.8, 1.3, 0.9, [0.15, 0.18, 0.22]); f.box(0.8, 0.9, -1.0, 0.81, 1.3, 0.9, [0.15, 0.18, 0.22]);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [wx, wz] = f.p(a * 0.82, b * 1.35); k.col(k.solid, BLACK).addGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12).rotateZ(Math.PI / 2).rotateY(f.r % 2 ? Math.PI / 2 : 0).translate(wx, 0.32, wz)); }
    f.glow(-0.75, 0.6, 2.2, -0.45, 0.72, 2.21, [1, 0.95, 0.8]); f.glow(0.45, 0.6, 2.2, 0.75, 0.72, 2.21, [1, 0.95, 0.8]);
    f.box(-0.8, 0.6, -2.21, -0.5, 0.72, -2.2, [0.8, 0.1, 0.1]); f.box(0.5, 0.6, -2.21, 0.8, 0.72, -2.2, [0.8, 0.1, 0.1]);
    f.block(-0.95, -2.25, 0.95, 2.25);
  },
};

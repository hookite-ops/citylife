import * as THREE from 'three';
import { GB, seeded } from './geo.js';
import { SHOP_NAMES, VACANT_SLOT, LOBBY_SLOT } from './tenants.js';
import { describe, tenantMap, lobbyUnit, upperUnits } from './bplan.js';

// ───────── 건물을 실제 도형으로 만드는 생성기 ─────────
// 텍스처 없이: 벽·슬래브·창틀은 꼭짓점 색 상자, 유리는 반투명 면, 유리 뒤에는 방(실내 벽) 면.
// 방 면 중 일부는 "켜진 방"(밤에 빛남)으로 따로 모음.

const LIT_HOME = [[1, 0.84, 0.6], [1, 0.9, 0.74], [1, 0.78, 0.52], [0.98, 0.95, 0.88], [0.9, 0.94, 1]];
const LIT_OFFICE = [[0.92, 0.96, 1], [0.98, 0.99, 1], [0.88, 0.93, 1]];
const LIT_SHOP = [[1, 0.97, 0.92], [1, 0.92, 0.8], [0.95, 0.98, 1], [1, 0.88, 0.7]];
const DARK = [[0.13, 0.14, 0.16], [0.18, 0.17, 0.16], [0.1, 0.11, 0.13], [0.52, 0.47, 0.4], [0.62, 0.6, 0.56], [0.24, 0.26, 0.3]];

export { SHOP_NAMES };

// 간판 아틀라스 (글자만 텍스처로)
let atlasTex = null;
const SLOT_W = 256, SLOT_H = 64, COLS = 8, ROWS = 16;
function signAtlas() {
  if (atlasTex) return atlasTex;
  const c = document.createElement('canvas'); c.width = SLOT_W * COLS; c.height = SLOT_H * ROWS;
  const x = c.getContext('2d');
  const all = [...SHOP_NAMES, ['임대 문의', '#ffffff', '', 0, '#c62828'], ['ENTRANCE · 출입구', '#2a2d33']];
  all.forEach(([name, bg, , , fgc], i) => {
    const sx = (i % COLS) * SLOT_W, sy = Math.floor(i / COLS) * SLOT_H;
    x.fillStyle = bg; x.fillRect(sx, sy, SLOT_W, SLOT_H);
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(sx, sy + SLOT_H - 6, SLOT_W, 3);
    x.fillStyle = fgc || '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (fgc) { x.strokeStyle = fgc; x.lineWidth = 4; x.strokeRect(sx + 3, sy + 3, SLOT_W - 6, SLOT_H - 6); }
    let fs = 38; x.font = `800 ${fs}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
    while (x.measureText(name).width > SLOT_W - 24 && fs > 18) { fs -= 2; x.font = `800 ${fs}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`; }
    x.fillText(name, sx + SLOT_W / 2, sy + SLOT_H / 2 + 2);
  });
  atlasTex = new THREE.CanvasTexture(c);
  atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 4;
  return atlasTex;
}
// 직접 지은 가게 이름을 간판 칸에 그리기
export function setCustomSlot(i, name, bg) {
  const t = signAtlas(), c = t.image, x = c.getContext('2d');
  const sx = (i % COLS) * SLOT_W, sy = Math.floor(i / COLS) * SLOT_H;
  x.fillStyle = bg; x.fillRect(sx, sy, SLOT_W, SLOT_H);
  x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(sx, sy + SLOT_H - 6, SLOT_W, 3);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = 38; const ff = (n) => `800 ${n}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  x.font = ff(fs); while (x.measureText(name).width > SLOT_W - 24 && fs > 16) { fs -= 2; x.font = ff(fs); }
  x.fillText(name, sx + SLOT_W / 2, sy + SLOT_H / 2 + 2);
  t.needsUpdate = true;
}
export function slotUV(i) {
  const cx = i % COLS, cy = Math.floor(i / COLS);
  const u0 = cx / COLS, u1 = (cx + 1) / COLS, v1 = 1 - cy / ROWS, v0 = 1 - (cy + 1) / ROWS;
  return [u0, v0, u1, v1];
}

// ───────── 걸어 들어가는 건물: 1층 안쪽을 잘라내는 상자 (셰이더에서 버림) ─────────
// A: 1층 바깥 껍데기(유리·창틀·가짜 매장) 높이까지 · B: 안쪽(LOD 상자 · 가짜 실내)을 1층 천장까지
export const CUT_MAX = 6;
export const CUT = {
  n: { value: 0 },
  a0: { value: Array.from({ length: CUT_MAX }, () => new THREE.Vector3()) }, a1: { value: Array.from({ length: CUT_MAX }, () => new THREE.Vector3()) },
  b0: { value: Array.from({ length: CUT_MAX }, () => new THREE.Vector3()) }, b1: { value: Array.from({ length: CUT_MAX }, () => new THREE.Vector3()) },
};
export function setCuts(list) {
  const n = Math.min(CUT_MAX, list.length);
  for (let i = 0; i < n; i++) { const c = list[i]; CUT.a0.value[i].copy(c.a0); CUT.a1.value[i].copy(c.a1); CUT.b0.value[i].copy(c.b0); CUT.b1.value[i].copy(c.b1); }
  CUT.n.value = n;
}
function addCut(m, key, extra) {
  m.onBeforeCompile = (sh) => {
    extra?.(sh);
    sh.uniforms.uCutN = CUT.n; sh.uniforms.uCutA0 = CUT.a0; sh.uniforms.uCutA1 = CUT.a1; sh.uniforms.uCutB0 = CUT.b0; sh.uniforms.uCutB1 = CUT.b1;
    sh.vertexShader = 'varying vec3 vCutWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvCutWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vCutWP;\nuniform int uCutN;\nuniform vec3 uCutA0[${CUT_MAX}];\nuniform vec3 uCutA1[${CUT_MAX}];\nuniform vec3 uCutB0[${CUT_MAX}];\nuniform vec3 uCutB1[${CUT_MAX}];\n` +
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', `for (int ci = 0; ci < ${CUT_MAX}; ci++) { if (ci >= uCutN) break;
        if (all(greaterThan(vCutWP, uCutA0[ci])) && all(lessThan(vCutWP, uCutA1[ci]))) discard;
        if (all(greaterThan(vCutWP, uCutB0[ci])) && all(lessThan(vCutWP, uCutB1[ci]))) discard; }
      #include <clipping_planes_fragment>`);
  };
  m.customProgramCacheKey = () => 'cut_' + key;
}

export function makeMaterials() {
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.02 });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xa8d4ee, transparent: true, opacity: 0.32, roughness: 0.03, metalness: 0.8, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide });
  const room = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0, color: 0x5a5a5a });
  lit.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'); };
  lit.customProgramCacheKey = () => 'litRooms';
  const shopLit = lit.clone();
  shopLit.onBeforeCompile = lit.onBeforeCompile; shopLit.customProgramCacheKey = () => 'litShops';
  shopLit.color.set(0xd8d8d8); shopLit.emissiveIntensity = 0.35;
  const t = signAtlas();
  const sign = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.5 });
  const litFix = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'); };
  addCut(solid, 'solid'); addCut(metal, 'metal'); addCut(glass, 'glass'); addCut(room, 'room'); addCut(sign, 'sign');
  addCut(lit, 'lit', litFix); addCut(shopLit, 'shopLit', litFix);
  return { solid, metal, glass, room, lit, shopLit, sign };
}

// 한 블록(또는 묶음)의 지오메트리를 모으는 그릇
export class Bld {
  constructor() { this.solid = new GB(); this.metal = new GB(); this.glass = new GB(); this.room = new GB(); this.lit = new GB(); this.shopLit = new GB(); this.sign = new GB(); }
  meshes(M) {
    const out = [];
    for (const k of ['solid', 'metal', 'room', 'lit', 'shopLit', 'sign', 'glass']) {
      if (this[k].empty) continue;
      const m = new THREE.Mesh(this[k].build(), M[k]);
      m.castShadow = k === 'solid' || k === 'metal';
      m.receiveShadow = k !== 'glass';
      if (k === 'glass') m.renderOrder = 3;
      m.userData.kind = k;
      out.push(m);
    }
    return out;
  }
}

// ───────── 면(파사드) 도우미 ─────────
// 면: 바깥에서 볼 때 왼→오른쪽으로 p에서 t 방향, n은 바깥쪽 법선. d: 안쪽으로 들어간 깊이 (음수 = 바깥으로 튀어나옴)
export function faces(s) {
  const { x0, z0, x1, z1 } = s;
  return {
    S: { p: [x0, z1], t: [1, 0], n: [0, 1], L: x1 - x0 },
    N: { p: [x1, z0], t: [-1, 0], n: [0, -1], L: x1 - x0 },
    E: { p: [x1, z1], t: [0, -1], n: [1, 0], L: z1 - z0 },
    W: { p: [x0, z0], t: [0, 1], n: [-1, 0], L: z1 - z0 },
  };
}
function fpt(f, u, d) { return [f.p[0] + f.t[0] * u - f.n[0] * d, f.p[1] + f.t[1] * u - f.n[1] * d]; }
export function fquad(gb, f, u0, u1, y0, y1, d) { const a = fpt(f, u0, d), b = fpt(f, u1, d); gb.wall(a[0], a[1], b[0], b[1], y0, y1); }
export function fbox(gb, f, u0, u1, y0, y1, dIn, dOut, bottom = false) {
  const a = fpt(f, u0, dIn), b = fpt(f, u1, dOut);
  gb.box(Math.min(a[0], b[0]), y0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), y1, Math.max(a[1], b[1]), { bottom });
}
function fsign(gb, f, u0, u1, y0, y1, d, slot) {
  const a = fpt(f, u0, d), b = fpt(f, u1, d);
  const [su0, sv0, su1, sv1] = slotUV(slot);
  gb.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [f.n[0], 0, f.n[1]], [[su0, sv0], [su1, sv0], [su1, sv1], [su0, sv1]]);
}
const rgb = (gb, c) => Array.isArray(c) ? gb.setRGB(c[0], c[1], c[2]) : gb.setColor(c);
const pick = (R, a) => a[Math.floor(R() * a.length)];

// 방(유리 뒤 실내 면)
function rooms(B, f, R, u0, u1, nb, y0, y1, depth, litFrac, kind = 'home') {
  const w = (u1 - u0) / nb;
  const litSet = kind === 'office' ? LIT_OFFICE : kind === 'shop' ? LIT_SHOP : LIT_HOME;
  // 사무실은 층 전체가 같이 켜지는 경우가 많음
  const floorLit = kind === 'office' ? R() < litFrac : null;
  for (let k = 0; k < nb; k++) {
    const on = floorLit !== null ? (floorLit && R() < 0.9) : R() < litFrac;
    const g = on ? B.lit : B.room;
    rgb(g, on ? pick(R, litSet) : pick(R, DARK));
    fquad(g, f, u0 + k * w, u0 + (k + 1) * w, y0, y1, depth);
  }
}

// ───────── 파사드 모드 ─────────
// o: { mode, bay, depth, wall, frame, spandrel, slab, slabOut, unit, rail, lit, kind, accent }
function facade(B, f, R, y0, floors, fh, o) {
  const L = f.L, H = y0 + floors * fh;
  const nb = Math.max(1, Math.round(L / o.bay)), bw = L / nb;
  switch (o.mode) {
    case 'curtain': {
      fquad(B.glass, f, 0, L, y0, H, 0.04);
      rgb(B.solid, o.spandrel);
      for (let k = 0; k <= floors; k++) { const y = y0 + k * fh; fbox(B.solid, f, 0, L, Math.max(y0, y - 0.45), Math.min(H, y + 0.45), 0.4, 0.06); }
      for (let k = 0; k < floors; k++) rooms(B, f, R, 0, L, nb, y0 + k * fh + 0.45, y0 + (k + 1) * fh - 0.45, o.depth, o.lit, o.kind);
      rgb(B.metal, o.frame);
      for (let k = 0; k <= nb; k++) { const u = k * bw; fbox(B.metal, f, Math.max(0, u - 0.05), Math.min(L, u + 0.05), y0, H, 0.06, -0.14); }
      break;
    }
    case 'balcony': {
      const out = o.slabOut;
      fquad(B.glass, f, 0, L, y0, H, 0.05);
      for (let k = 0; k < floors; k++) {
        const y = y0 + k * fh;
        rgb(B.solid, o.slab || o.wall); fbox(B.solid, f, 0, L, y, y + 0.3, o.depth + 0.1, -out);
        rooms(B, f, R, 0, L, nb, y + 0.3, y + fh, o.depth, o.lit, o.kind);
        if (o.rail) {
          if (out > 0.3) fquad(B.glass, f, 0, L, y + 0.3, y + 1.15, -out + 0.04);
          rgb(B.metal, o.frame); fbox(B.metal, f, 0, L, y + 1.1, y + 1.16, -out + 0.1, -out);
        } else {
          rgb(B.metal, o.frame); fbox(B.metal, f, 0, L, y + 0.98, y + 1.03, 0.02, -0.06);
        }
      }
      rgb(B.solid, o.slab || o.wall); fbox(B.solid, f, 0, L, H, H + 0.3, o.depth + 0.1, -out);
      rgb(B.metal, o.frame);
      for (let k = 1; k < nb; k++) { const u = k * bw; if (o.unit && k % o.unit === 0) continue; fbox(B.metal, f, u - 0.04, u + 0.04, y0, H, 0.08, -0.02); }
      if (o.unit) { rgb(B.solid, o.wall); for (let k = o.unit; k < nb; k += o.unit) { const u = k * bw; fbox(B.solid, f, u - 0.28, u + 0.28, y0, H + 0.3, o.depth + 0.1, -out - 0.02); } }
      rgb(B.solid, o.wall);
      fbox(B.solid, f, 0, 0.45, y0, H + 0.3, o.depth + 0.1, -out - 0.02); fbox(B.solid, f, L - 0.45, L, y0, H + 0.3, o.depth + 0.1, -out - 0.02);
      break;
    }
    case 'ribbon': {
      const sill = o.sill ?? 1.0, head = o.head ?? 0.6;
      fquad(B.glass, f, 0, L, y0, H, 0.16);
      for (let k = 0; k < floors; k++) {
        const y = y0 + k * fh;
        rgb(B.solid, o.spandrel || o.wall); fbox(B.solid, f, 0, L, y, y + sill, 0.38, 0);
        rgb(B.solid, o.wall); fbox(B.solid, f, 0, L, y + fh - head, y + fh, 0.38, 0);
        rooms(B, f, R, 0, L, nb, y + sill, y + fh - head, 1.3, o.lit, o.kind);
      }
      rgb(B.metal, o.frame);
      for (let k = 0; k <= nb; k++) { const u = k * bw; fbox(B.metal, f, Math.max(0, u - 0.06), Math.min(L, u + 0.06), y0, H, 0.24, 0.1); }
      break;
    }
    case 'punched': {
      const ww = Math.min(o.win || 1.4, bw - 0.5), sill = o.sill ?? 0.9, top = o.top ?? 2.1;
      fquad(B.glass, f, 0, L, y0, H, 0.2);
      rgb(B.solid, o.wall);
      for (let k = 0; k < floors; k++) {
        const y = y0 + k * fh;
        fbox(B.solid, f, 0, L, y, y + sill, 0.35, 0);
        fbox(B.solid, f, 0, L, y + top, y + fh, 0.35, 0);
      }
      for (let k = 0; k <= nb; k++) {
        const c = k * bw;
        const a = k === 0 ? 0 : c - (bw - ww) / 2, b = k === nb ? L : c + (bw - ww) / 2;
        fbox(B.solid, f, a, b, y0, H, 0.35, 0);
      }
      // 창틀 (얇은 테두리)
      rgb(B.metal, o.frame);
      for (let k = 0; k < floors; k++) {
        const y = y0 + k * fh;
        fbox(B.metal, f, 0, L, y + sill - 0.06, y + sill, 0.1, -0.06);
      }
      for (let k = 0; k < floors; k++) for (let i = 0; i < nb; i++) {
        const c = (i + 0.5) * bw;
        rooms(B, f, R, c - ww / 2, c + ww / 2, 1, y0 + k * fh + sill, y0 + k * fh + top, 1.0, o.lit, o.kind);
        if (o.ac && (i % 2 === 0) && k > 0) { rgb(B.solid, [0.82, 0.83, 0.82]); fbox(B.solid, f, c - 0.45, c + 0.35, y0 + k * fh + 0.12, y0 + k * fh + 0.72, 0, -0.42); rgb(B.solid, o.wall); }
      }
      break;
    }
    case 'blank': {
      rgb(B.solid, o.wall); fbox(B.solid, f, 0, L, y0, H, 0.35, 0);
      if (o.accent) { rgb(B.solid, o.accent); fbox(B.solid, f, L * 0.38, L * 0.62, y0, H, 0, -0.06); }
      if (o.stairWin) {
        // 계단실 세로 창
        fquad(B.glass, f, L * 0.45, L * 0.55, y0, H, -0.08);
        rgb(B.room, [0.3, 0.32, 0.34]); fquad(B.room, f, L * 0.45, L * 0.55, y0, H, -0.07);
      }
      break;
    }
  }
}

// ───────── 옥상 ─────────
function roof(B, s, H, R, o = {}) {
  rgb(B.solid, o.roof || [0.55, 0.55, 0.54]);
  B.solid.box(s.x0, H, s.z0, s.x1, H + 0.3, s.z1);
  rgb(B.solid, o.parapet || o.wall || [0.85, 0.85, 0.83]);
  const p = 0.25, ph = o.ph ?? 1.1;
  B.solid.box(s.x0, H, s.z0, s.x1, H + ph, s.z0 + p); B.solid.box(s.x0, H, s.z1 - p, s.x1, H + ph, s.z1);
  B.solid.box(s.x0, H, s.z0, s.x0 + p, H + ph, s.z1); B.solid.box(s.x1 - p, H, s.z0, s.x1, H + ph, s.z1);
  const w = s.x1 - s.x0, d = s.z1 - s.z0;
  if (o.mech !== false) {
    rgb(B.solid, [0.68, 0.69, 0.7]);
    const n = Math.max(1, Math.floor(w * d / 120));
    for (let k = 0; k < n; k++) {
      const cx = s.x0 + 2 + R() * (w - 4), cz = s.z0 + 2 + R() * (d - 4);
      B.solid.cbox(cx, H + 0.9, cz, 1.6, 1.2, 1.1);
      rgb(B.metal, [0.3, 0.31, 0.32]); B.metal.addGeo(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 10).translate(cx, H + 1.54, cz)); rgb(B.solid, [0.68, 0.69, 0.7]);
    }
  }
}

// ───────── 건물 종류 ─────────
export function specH(s) { return s.y0 + s.floors * s.fh; }

export function buildNear(B, s) {
  const R = seeded(s.seed);
  const F = faces(s);
  const H = specH(s);
  const front = s.front || 'S';
  const opp = { S: 'N', N: 'S', E: 'W', W: 'E' };
  const sideOf = { S: ['E', 'W'], N: ['E', 'W'], E: ['S', 'N'], W: ['S', 'N'] };
  switch (s.type) {
    case 'apt': {
      // 판상형 아파트: 남향 발코니 + 북쪽 복도/창 + 측벽 줄무늬
      facade(B, F[front], R, s.y0, s.floors, s.fh, { mode: 'balcony', bay: 1.75, depth: 1.5, slabOut: 0.12, unit: 5, wall: s.color, frame: [0.85, 0.86, 0.87], lit: 0.42, kind: 'home' });
      facade(B, F[opp[front]], R, s.y0, s.floors, s.fh, { mode: 'punched', bay: 2.9, win: 1.5, wall: s.color, frame: [0.92, 0.92, 0.9], lit: 0.38, kind: 'home', ac: true });
      for (const k of sideOf[front]) facade(B, F[k], R, s.y0, s.floors, s.fh, { mode: 'blank', wall: s.color, accent: s.accent, stairWin: true });
      roof(B, s, H, R, { wall: s.color, mech: false });
      // 왕관 장식 (옥탑 + 프레임)
      const fr = F[front], L = fr.L;
      rgb(B.solid, s.color);
      for (const u of [L * 0.22, L * 0.78]) fbox(B.solid, fr, u - 3, u + 3, H, H + 4.2, 9, 3);
      rgb(B.solid, s.accent);
      fbox(B.solid, fr, 0.4, 1.1, H, H + 6.5, 1.5, 0.3); fbox(B.solid, fr, L - 1.1, L - 0.4, H, H + 6.5, 1.5, 0.3);
      fbox(B.solid, fr, 0.4, L - 0.4, H + 6, H + 6.6, 1.5, 0.3);
      // 1층 현관 캐노피 (북쪽)
      const bk = F[opp[front]];
      rgb(B.solid, [0.35, 0.36, 0.38]); fbox(B.solid, bk, bk.L / 2 - 2.2, bk.L / 2 + 2.2, s.y0 + 2.7, s.y0 + 2.95, 0, -2.4);
      rgb(B.lit, [1, 0.9, 0.75]); fquad(B.lit, bk, bk.L / 2 - 1.2, bk.L / 2 + 1.2, s.y0, s.y0 + 2.4, -0.03);
      break;
    }
    case 'tower': {
      // 탑상형 고층 주거 (사방 발코니 + 유리 난간)
      for (const k of ['S', 'N', 'E', 'W']) facade(B, F[k], R, s.y0, s.floors, s.fh, { mode: 'balcony', bay: 1.9, depth: 1.3, slabOut: 0.75, unit: 6, rail: true, wall: s.color, slab: [0.94, 0.94, 0.93], frame: [0.6, 0.62, 0.64], lit: 0.45, kind: 'home' });
      roof(B, s, H, R, { wall: s.color, mech: false });
      // 왕관: 2층 높이 유리+프레임
      for (const k of ['S', 'N', 'E', 'W']) { fquad(B.glass, F[k], 0.5, F[k].L - 0.5, H, H + 5, 0.3); }
      rgb(B.metal, s.accent);
      for (const [x, z] of [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]]) B.metal.cbox(x, H + 3, z, 0.8, 6, 0.8);
      B.metal.box(s.x0 - 0.4, H + 5.6, s.z0 - 0.4, s.x1 + 0.4, H + 6.2, s.z1 + 0.4);
      break;
    }
    case 'office': {
      for (const k of ['S', 'N', 'E', 'W']) facade(B, F[k], R, s.y0, s.floors, s.fh, { mode: 'curtain', bay: s.bay || 1.6, depth: 2.4, spandrel: s.spandrel || [0.16, 0.2, 0.24], frame: s.frame || [0.55, 0.58, 0.62], lit: s.lit ?? 0.55, kind: 'office' });
      roof(B, s, H, R, { roof: [0.4, 0.42, 0.44], parapet: s.spandrel || [0.16, 0.2, 0.24], ph: 0.3 });
      // 유리 왕관
      for (const k of ['S', 'N', 'E', 'W']) fquad(B.glass, F[k], 0, F[k].L, H, H + (s.crown || 4), 0.04);
      rgb(B.metal, s.frame || [0.55, 0.58, 0.62]);
      B.metal.box(s.x0, H + (s.crown || 4) - 0.25, s.z0, s.x1, H + (s.crown || 4), s.z1);
      rgb(B.solid, [0.5, 0.52, 0.55]); B.solid.box(s.x0 + 3, H, s.z0 + 3, s.x1 - 3, H + (s.crown || 4) - 0.6, s.z1 - 3);
      if (s.antenna) { rgb(B.metal, [0.8, 0.2, 0.2]); B.metal.addGeo(new THREE.CylinderGeometry(0.2, 0.3, 14, 6).translate((s.x0 + s.x1) / 2, H + 11, (s.z0 + s.z1) / 2)); }
      break;
    }
    case 'podium': case 'shop': {
      // 근린생활시설: 1층 상가 + 위층 띠창
      const streets = s.streets || [front];
      const gh = s.groundH || 4.6;
      for (const k of ['S', 'N', 'E', 'W']) {
        const f = F[k];
        if (k === streets[0]) shopRow(B, f, R, s.y0, gh, s);
        else if (streets.includes(k)) facade(B, f, R, s.y0, 1, gh, { mode: 'ribbon', bay: 2.2, wall: s.color, frame: [0.2, 0.21, 0.23], lit: 1, kind: 'shop', sill: 0.5, head: 1.2 });
        if (streets.includes(k)) {
          if (s.floors > 0) {
            if (s.upper === 'curtain') facade(B, f, R, s.y0 + gh, s.floors, s.fh, { mode: 'curtain', bay: 1.6, depth: 2, spandrel: s.spandrel || [0.2, 0.22, 0.25], frame: [0.5, 0.52, 0.55], lit: 0.5, kind: 'office' });
            else facade(B, f, R, s.y0 + gh, s.floors, s.fh, { mode: 'ribbon', bay: 1.7, wall: s.color, spandrel: s.accent2 || s.color, frame: [0.25, 0.27, 0.3], lit: 0.5, kind: 'office' });
          }
        } else {
          rgb(B.solid, s.color); fbox(B.solid, f, 0, f.L, s.y0, s.y0 + gh, 0.35, 0);
          if (s.floors > 0) facade(B, f, R, s.y0 + gh, s.floors, s.fh, { mode: 'punched', bay: 3.2, win: 1.6, wall: s.color, frame: [0.3, 0.3, 0.32], lit: 0.35, kind: 'office' });
        }
      }
      // 1층 천장 슬래브
      rgb(B.solid, [0.9, 0.9, 0.88]); B.solid.box(s.x0 + 0.1, s.y0 + gh - 0.35, s.z0 + 0.1, s.x1 - 0.1, s.y0 + gh, s.z1 - 0.1, { bottom: true });
      roof(B, s, s.y0 + gh + s.floors * s.fh, R, { wall: s.color });
      // 세로 간판
      if (s.floors >= 3 && R() < 0.7) {
        const f = F[streets[0]], u = R() < 0.5 ? 1.2 : f.L - 1.2;
        rgb(B.solid, [0.15, 0.15, 0.16]); fbox(B.solid, f, u - 0.08, u + 0.08, s.y0 + gh + 0.5, s.y0 + gh + Math.min(s.floors, 4) * s.fh, 0, -1.2);
        const tmv = tenantSlots(s);
        for (let k = 0; k < Math.min(s.floors, 4) - 0.5; k++) {
          let slot = Math.floor(R() * SHOP_NAMES.length);
          if (tmv) { const t = tmv.get(`${k + 2}:0`); slot = t ? (t.vacant ? VACANT_SLOT : t.slot) : slot; }
          const y = s.y0 + gh + 0.7 + k * s.fh;
          for (const side of [1, -1]) fsign(B.sign, sideFace(f, u, side), 0.05, 1.05, y, y + s.fh * 0.7, 0, slot);
        }
      }
      break;
    }
    case 'villa': {
      // 다세대 빌라: 필로티 주차 + 벽돌 + 작은 발코니
      const pil = 2.8, y1 = s.y0 + pil;
      rgb(B.solid, [0.72, 0.72, 0.7]);
      for (const [x, z] of [[s.x0 + 0.3, s.z0 + 0.3], [s.x1 - 0.3, s.z0 + 0.3], [s.x0 + 0.3, s.z1 - 0.3], [s.x1 - 0.3, s.z1 - 0.3], [(s.x0 + s.x1) / 2, s.z1 - 0.3]]) B.solid.cbox(x, s.y0 + pil / 2, z, 0.5, pil, 0.5);
      // 계단실 (뒤쪽)
      rgb(B.solid, s.color); B.solid.box(s.x1 - 4.2, s.y0, s.z0, s.x1 - 0.2, y1, s.z0 + 4);
      rgb(B.lit, [1, 0.92, 0.8]); B.lit.wall(s.x1 - 4.21, s.z0 + 0.4, s.x1 - 4.21, s.z0 + 1.6, s.y0, s.y0 + 2.2);
      rgb(B.solid, [0.82, 0.82, 0.8]); B.solid.box(s.x0, y1 - 0.3, s.z0, s.x1, y1, s.z1, { bottom: true });
      for (const k of ['S', 'N', 'E', 'W']) facade(B, F[k], R, y1, s.floors, s.fh, { mode: 'punched', bay: k === 'S' || k === 'N' ? 2.6 : 3.4, win: k === front ? 1.8 : 1.2, top: k === front ? 2.2 : 2.0, wall: s.color, frame: [0.95, 0.95, 0.93], lit: 0.45, kind: 'home', ac: k !== front });
      // 발코니
      const fr = F[front];
      for (let k = 0; k < s.floors; k++) {
        const y = y1 + k * s.fh;
        for (const u of [fr.L * 0.27, fr.L * 0.73]) {
          rgb(B.solid, [0.9, 0.9, 0.88]); fbox(B.solid, fr, u - 1.3, u + 1.3, y - 0.05, y + 0.12, 0, -0.95);
          rgb(B.metal, [0.25, 0.26, 0.28]);
          fbox(B.metal, fr, u - 1.3, u + 1.3, y + 0.95, y + 1.0, -0.88, -0.95);
          fbox(B.metal, fr, u - 1.3, u - 1.25, y + 0.12, y + 0.95, -0.88, -0.95); fbox(B.metal, fr, u + 1.25, u + 1.3, y + 0.12, y + 0.95, -0.88, -0.95);
          fquad(B.glass, fr, u - 1.25, u + 1.25, y + 0.12, y + 0.95, -0.92);
        }
      }
      const H2 = y1 + s.floors * s.fh;
      roof(B, s, H2, R, { wall: s.color, mech: false, ph: 0.9 });
      rgb(B.solid, [0.3, 0.45, 0.6]); B.solid.addGeo(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 12).translate(s.x0 + 2, H2 + 1.2, s.z0 + 2));
      if (s.hipRoof) { rgb(B.solid, [0.45, 0.22, 0.18]); const g = new THREE.ConeGeometry(Math.hypot(s.x1 - s.x0, s.z1 - s.z0) / 2, 2.2, 4, 1); g.rotateY(Math.PI / 4); g.scale((s.x1 - s.x0) / Math.hypot(s.x1 - s.x0, s.z1 - s.z0) * 1.42, 1, (s.z1 - s.z0) / Math.hypot(s.x1 - s.x0, s.z1 - s.z0) * 1.42); g.translate((s.x0 + s.x1) / 2, H2 + 2.0, (s.z0 + s.z1) / 2); B.solid.addGeo(g); }
      break;
    }
    case 'civic': {
      for (const k of ['S', 'N', 'E', 'W']) {
        facade(B, F[k], R, s.y0, s.floors, s.fh, { mode: 'curtain', bay: 1.5, depth: 2.2, spandrel: [0.75, 0.76, 0.74], frame: [0.85, 0.86, 0.86], lit: 0.4, kind: 'office' });
        // 세로 루버
        rgb(B.solid, [0.93, 0.93, 0.91]);
        const f = F[k], n = Math.round(f.L / 1.5);
        for (let i = 0; i <= n; i++) { const u = i * f.L / n; fbox(B.solid, f, Math.max(0, u - 0.1), Math.min(f.L, u + 0.1), s.y0 + s.fh, H, 0, -0.75); }
      }
      // 큰 지붕 캐노피
      rgb(B.solid, [0.95, 0.95, 0.94]); B.solid.box(s.x0 - 3, H, s.z0 - 3, s.x1 + 3, H + 0.8, s.z1 + 3, { bottom: true });
      // 정문 캐노피
      const fr = F[front];
      fbox(B.solid, fr, fr.L / 2 - 8, fr.L / 2 + 8, s.y0 + s.fh - 0.3, s.y0 + s.fh + 0.2, 0, -6, true);
      for (const u of [fr.L / 2 - 7.5, fr.L / 2 + 7.5]) fbox(B.solid, fr, u - 0.3, u + 0.3, s.y0, s.y0 + s.fh, -5.4, -6);
      break;
    }
    case 'upper': {
      // 1층(실내 공간) 위에 얹는 위층들 + 1층 천장
      const st = s.style || 'ribbon';
      for (const k of ['S', 'N', 'E', 'W']) {
        if (k === front || (st === 'punched')) facade(B, F[k], R, s.y0, s.floors, s.fh, st === 'punched' ? { mode: 'punched', bay: 2.8, win: 1.4, wall: s.color, frame: [0.95, 0.95, 0.93], lit: 0.4, kind: 'home', ac: k !== front } : { mode: 'ribbon', bay: 1.8, wall: s.color, spandrel: s.accent || s.color, frame: [0.25, 0.27, 0.3], lit: 0.45, kind: 'office' });
        else if (k === opp[front]) facade(B, F[k], R, s.y0, s.floors, s.fh, { mode: 'punched', bay: 3.2, win: 1.4, wall: s.color, frame: [0.3, 0.3, 0.32], lit: 0.35, kind: 'home' });
        else facade(B, F[k], R, s.y0, s.floors, s.fh, { mode: 'blank', wall: s.color });
      }
      rgb(B.solid, [0.92, 0.92, 0.9]); B.solid.box(s.x0, s.y0 - 0.3, s.z0, s.x1, s.y0, s.z1, { bottom: true });
      roof(B, s, H, R, { wall: s.color, mech: s.floors > 2 });
      break;
    }
    case 'school': {
      facade(B, F[front], R, s.y0, s.floors, s.fh, { mode: 'ribbon', bay: 3, wall: s.color, spandrel: s.accent, frame: [0.85, 0.86, 0.86], lit: 0.25, kind: 'office', sill: 1.0, head: 0.7 });
      facade(B, F[opp[front]], R, s.y0, s.floors, s.fh, { mode: 'ribbon', bay: 3, wall: s.color, frame: [0.85, 0.86, 0.86], lit: 0.2, kind: 'office', sill: 1.1, head: 0.8 });
      for (const k of sideOf[front]) facade(B, F[k], R, s.y0, s.floors, s.fh, { mode: 'blank', wall: s.color, accent: s.accent, stairWin: true });
      roof(B, s, H, R, { wall: s.color });
      if (s.clock) {
        const fr = F[front], u = fr.L / 2;
        rgb(B.solid, [0.62, 0.32, 0.24]); fbox(B.solid, fr, u - 3.5, u + 3.5, s.y0, H + 12, 4, -1.5);
        rgb(B.solid, [0.95, 0.95, 0.93]); B.solid.addGeo(new THREE.CylinderGeometry(1.8, 1.8, 0.2, 24).rotateX(Math.PI / 2).translate(...faceXYZ(fr, u, H + 8, -1.6)));
        rgb(B.solid, [0.1, 0.1, 0.1]); fbox(B.solid, fr, u - 0.06, u + 0.06, H + 8, H + 9.3, -1.6, -1.75); fbox(B.solid, fr, u, u + 1.0, H + 7.94, H + 8.06, -1.6, -1.75);
        rgb(B.solid, [0.35, 0.2, 0.16]); const g = new THREE.ConeGeometry(5.5, 4, 4); g.rotateY(Math.PI / 4); g.translate(...faceXYZ(fr, u, H + 14, 1)); B.solid.addGeo(g);
      }
      break;
    }
  }
}
function sideFace(f, u, side) {
  const n = [f.t[0] * side, f.t[1] * side];
  const t = [n[1], -n[0]];
  const base = fpt(f, u + side * 0.09, 0);
  const dot = t[0] * f.n[0] + t[1] * f.n[1];
  const p = dot > 0 ? base : [base[0] + f.n[0] * 1.1, base[1] + f.n[1] * 1.1];
  return { p, t, n, L: 1.1 };
}
function faceXYZ(f, u, y, d) { const p = fpt(f, u, d); return [p[0], y, p[1]]; }

// 건물 가게 (실내와 같은 규칙)
function tenantSlots(s) {
  if (!s.bkind || s.special) return null;
  try { const Bd = describe(s, { kind: s.bkind, name: s.bname, towers: s.towers }); return tenantMap(Bd); } catch (e) { return null; }
}
// 1층 상가 줄 (가게 여러 칸)
function shopRow(B, f, R, y0, gh, s) {
  const tm = tenantSlots(s), li = s.bkind ? lobbyUnit(s) : -1;
  const L = f.L;
  const n = Math.max(1, Math.round(L / (s.unitW || 7)));
  const uw = L / n;
  const h = gh - 1.4; // 유리 높이 (그 위로 간판 띠)
  for (let i = 0; i < n; i++) {
    const u0 = i * uw, u1 = (i + 1) * uw;
    const special = s.special && i === Math.floor(n / 2);
    // 유리 + 창틀
    fquad(B.glass, f, u0 + 0.15, u1 - 0.15, y0, y0 + h, 0.12);
    rgb(B.metal, [0.2, 0.21, 0.23]);
    fbox(B.metal, f, u0, u0 + 0.15, y0, y0 + h, 0.2, -0.02); fbox(B.metal, f, u1 - 0.15, u1, y0, y0 + h, 0.2, -0.02);
    fbox(B.metal, f, u0, u1, y0 + h - 0.1, y0 + h, 0.2, -0.02);
    fbox(B.metal, f, u0 + uw * 0.35, u0 + uw * 0.35 + 0.06, y0, y0 + 2.3, 0.2, 0.05);
    fbox(B.metal, f, u0 + uw * 0.35, u0 + uw * 0.65, y0 + 2.3, y0 + 2.36, 0.2, 0.05);
    // 매장 안: 밝은 뒷벽 + 칸막이 + 진열대
    const dIn = 5;
    rgb(B.shopLit, pick(R, LIT_SHOP)); fquad(B.shopLit, f, u0, u1, y0, y0 + gh - 0.35, dIn);
    rgb(B.solid, [0.86, 0.86, 0.84]);
    fbox(B.solid, f, u0, u0 + 0.12, y0, y0 + gh - 0.35, dIn, 0.2); fbox(B.solid, f, u1 - 0.12, u1, y0, y0 + gh - 0.35, dIn, 0.2);
    rgb(B.solid, [0.78, 0.78, 0.76]); fbox(B.solid, f, u0, u1, y0, y0 + 0.03, dIn, 0.2);
    const kind = Math.floor(R() * 4);
    for (let k = 0; k < 3; k++) {
      const a = u0 + 0.6 + R() * (uw - 2.2), b = a + 0.8 + R() * 0.8;
      const d0 = 1.5 + k * 1.1, hh = kind === 0 ? 0.75 : 0.9 + R() * 0.9;
      rgb(B.solid, kind === 0 ? [0.55, 0.38, 0.25] : pick(R, [[0.9, 0.9, 0.9], [0.3, 0.32, 0.35], [0.85, 0.55, 0.3], [0.4, 0.6, 0.45], [0.75, 0.3, 0.3]]));
      fbox(B.solid, f, a, Math.min(b, u1 - 0.3), y0, y0 + hh, d0 + 0.7, d0);
    }
    // 차양 + 간판
    rgb(B.solid, pick(R, [[0.15, 0.15, 0.16], [0.7, 0.2, 0.2], [0.2, 0.35, 0.6], [0.2, 0.5, 0.3], [0.85, 0.85, 0.82]]));
    fbox(B.solid, f, u0 + 0.1, u1 - 0.1, y0 + h + 0.02, y0 + h + 0.14, 0.1, -0.9);
    if (!special) {
      rgb(B.solid, [0.12, 0.12, 0.13]); fbox(B.solid, f, u0 + 0.2, u1 - 0.2, y0 + h + 0.25, y0 + gh - 0.15, 0.1, -0.2);
      const t = tm?.get(`1:${i}`);
      const slot = i === li ? LOBBY_SLOT : t ? (t.vacant ? VACANT_SLOT : t.slot) : (s.signBase + i * 7) % SHOP_NAMES.length;
      fsign(B.sign, f, u0 + 0.3, u1 - 0.3, y0 + h + 0.32, y0 + gh - 0.22, -0.21, slot);
    }
  }
  // 위쪽 벽 띠
  rgb(B.solid, s.color); fbox(B.solid, f, 0, L, y0 + gh - 0.1, y0 + gh, 0.35, 0);
}

// ───────── LOD: 중간 거리 · 먼 거리 ─────────
// 상세 모델 안쪽으로 살짝 들어간 상자라서, 가까이서 상세 모델이 보일 때는 그 속에 숨어요.
const INSET = { apt: 1.7, tower: 1.5, office: 2.6, shop: 1.45, podium: 2.1, villa: 1.15, civic: 2.4, school: 1.45, upper: 1.45 };
const FAR_BODY = { tower: [0.62, 0.7, 0.76], office: [0.36, 0.46, 0.56], civic: [0.74, 0.78, 0.8] };
export function lodFrame(s) {
  const gh = (s.type === 'shop' || s.type === 'podium') ? (s.groundH || 4.6) : s.type === 'villa' ? 2.8 : 0;
  const k = INSET[s.type] ?? 1.5;
  const b = { x0: s.x0 + k, x1: s.x1 - k, z0: s.z0 + k, z1: s.z1 - k };
  if (b.x1 - b.x0 < 1) { const c = (s.x0 + s.x1) / 2; b.x0 = c - 0.5; b.x1 = c + 0.5; }
  if (b.z1 - b.z0 < 1) { const c = (s.z0 + s.z1) / 2; b.z0 = c - 0.5; b.z1 = c + 0.5; }
  const y0 = s.y0 + gh, H = s.y0 + gh + s.floors * s.fh - 0.15;
  return { b, gh, y0, H, k };
}
// 중간 거리: 상자 + 층마다 창 띠 + (밤) 켜진 창
export function buildMid(F, s) {
  const R = seeded(s.seed + 7);
  const { b, y0, H, gh } = lodFrame(s);
  if (s.floors <= 0) return;
  const glassy = s.type === 'office' || s.type === 'tower' || s.type === 'civic' || s.upper === 'curtain';
  rgb(F.solid, FAR_BODY[s.type] || s.color || [0.85, 0.85, 0.83]);
  F.solid.box(b.x0, y0, b.z0, b.x1, H, b.z1);
  groundCore(F, s, gh);
  const fc = faces(b);
  for (const key of ['S', 'N', 'E', 'W']) {
    const f = fc[key];
    rgb(F.solid, glassy ? [0.2, 0.28, 0.36] : [0.3, 0.36, 0.42]);
    for (let i = 0; i < s.floors; i++) {
      const y = y0 + i * s.fh;
      if (glassy) fquad(F.solid, f, 0.2, f.L - 0.2, y + 0.45, y + s.fh - 0.4, -0.02);
      else fquad(F.solid, f, 0.6, f.L - 0.6, y + 0.95, y + s.fh - 0.55, -0.02);
    }
    const bw = 3.4, nb = Math.max(1, Math.floor(f.L / bw));
    const lf = s.type === 'office' ? 0.3 : s.type === 'school' ? 0.1 : 0.28;
    for (let i = 0; i < s.floors; i += 2) for (let k = 0; k < nb; k++) {
      if (R() > lf) continue;
      const y = y0 + i * s.fh, u = (k + 0.5) * f.L / nb;
      rgb(F.lit, pick(R, s.type === 'office' ? LIT_OFFICE : LIT_HOME));
      fquad(F.lit, f, u - bw * 0.36, u + bw * 0.36, y + 0.95, y + s.fh - 0.5, -0.04);
    }
  }
}
// 1층 상가(속이 비어 있음) 아래는 더 깊이 들어간 상자로
function groundCore(F, s, gh) {
  if (!gh || s.type === 'villa') return;
  const k = 5.4;
  if (s.x1 - s.x0 < 2 * k + 1 || s.z1 - s.z0 < 2 * k + 1) return;
  rgb(F.solid, [0.75, 0.75, 0.73]);
  F.solid.box(s.x0 + k, s.y0, s.z0 + k, s.x1 - k, s.y0 + gh, s.z1 - k);
}
// 먼 거리: 그냥 상자 + 띄엄띄엄 켜진 창 몇 개
export function buildBox(F, s) {
  const R = seeded(s.seed + 11);
  const { b, H, y0, gh } = lodFrame(s);
  if (s.floors <= 0) return;
  rgb(F.solid, FAR_BODY[s.type] || s.color || [0.85, 0.85, 0.83]);
  F.solid.box(b.x0, y0, b.z0, b.x1, H, b.z1);
  groundCore(F, s, gh);
  const fc = faces(b);
  const n = Math.min(26, 4 + Math.floor(s.floors * (b.x1 - b.x0 + b.z1 - b.z0) / 90));
  for (let k = 0; k < n; k++) {
    const f = fc[pick(R, ['S', 'N', 'E', 'W'])];
    const u = 1 + R() * (f.L - 3), y = s.y0 + 3 + R() * (H - s.y0 - 5);
    rgb(F.lit, pick(R, s.type === 'office' ? LIT_OFFICE : LIT_HOME));
    fquad(F.lit, f, u, u + 2.4, y, y + 1.6, -0.05);
  }
}

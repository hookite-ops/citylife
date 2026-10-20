import * as THREE from 'three';
import { GB } from './geo.js';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';
import { PRODUCTS } from './products.js';
import { SKUS, SECTION_SKUS, goodsMaterial, template, skuSize, GoodsBuilder, tagUV } from './goods.js';

// ───────── 편의점 실내 ─────────
// 좌표: x -7..7, z -6..6, 정면(유리벽·출입문)은 +z
const W = 14, D = 12, H = 3.0;

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
export function emojiSprite(emoji, size = 0.55, bg = 'rgba(15,20,28,0.85)') {
  const t = canvasTex(128, 128, (x) => {
    x.fillStyle = bg; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 5; x.stroke();
    x.font = '70px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emoji, 64, 70);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.setScalar(size); s.renderOrder = 10;
  return s;
}

// NPC 이동용 길 (노드 그래프)
const NODES = {
  D: [4.2, 4.9], A: [4.8, 2.8], H: [0.8, 2.8], I: [-2.9, 2.8],
  B: [5.3, -1.1], C: [5.3, -4.2], G: [0.8, -1.1], F: [-3.4, -1.1],
  K: [0.8, -4.3], E: [-3.4, -4.3], Ch: [-5.3, -3.4],
};
const EDGES = [['D', 'A'], ['A', 'H'], ['H', 'I'], ['A', 'B'], ['B', 'C'], ['B', 'G'], ['G', 'F'], ['C', 'K'], ['K', 'E'], ['E', 'F'], ['F', 'I'], ['E', 'Ch']];
const ADJ = {};
for (const [a, b] of EDGES) { (ADJ[a] = ADJ[a] || []).push(b); (ADJ[b] = ADJ[b] || []).push(a); }
function pathBetween(a, b) {
  const prev = { [a]: null }, q = [a];
  while (q.length) { const n = q.shift(); if (n === b) break; for (const m of ADJ[n]) if (!(m in prev)) { prev[m] = n; q.push(m); } }
  const out = []; let n = b; while (n) { out.unshift(n); n = prev[n]; }
  return out;
}

// 계산대 대기 줄 위치
export const QUEUE = [[-3.45, 2.6], [-3.1, 3.7], [-2.2, 4.4], [-1.2, 4.4]];

export class MartRoom {
  constructor() {
    this.W = W; this.D = D;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b2027);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.colliders = [];
    this.walls = [];
    this.zones = [];
    this.npcs = [];
    this.spills = [];
    this.stock = { chill: 1, drink: 1, ramen: 1, grocery: 1, snack: 1, ice: 1 };
    this.sections = [];
    this.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 });
    this.door = { x: 4.2, z: 5.5, x0: 3.2, x1: 5.2 };
    this.lights();
    this.build();
  }

  lights() { /* 실제 맵 안에서는 도시 조명을 그대로 씀 */ }

  wall(px, pz, qx, qz, y0, y1, mat) {
    const g = new GB(); g.wall(px, pz, qx, qz, y0, y1, 0, 1, 1);
    const geo = g.build();
    const idx = geo.index.array; for (let k = 0; k < idx.length; k += 3) { const t = idx[k]; idx[k] = idx[k + 2]; idx[k + 2] = t; }
    const nor = geo.attributes.normal; for (let k = 0; k < nor.count; k++) nor.setXYZ(k, -nor.getX(k), -nor.getY(k), -nor.getZ(k));
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
    return m;
  }

  build() {
    const R = this.root;
    // 바닥 타일
    const tile = canvasTex(256, 256, (x, w) => {
      x.fillStyle = '#c9ccce'; x.fillRect(0, 0, w, w);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const v = 205 + Math.random() * 14; x.fillStyle = `rgb(${v},${v + 2},${v + 4})`; x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124); }
      for (let k = 0; k < 400; k++) { x.fillStyle = `rgba(120,120,120,${Math.random() * 0.15})`; x.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
    }, true);
    tile.repeat.set(W / 1.2, D / 1.2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.25, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; R.add(floor);
    this.floor = floor;

    // 벽
    const wallTex = canvasTex(64, 256, (x, w, h) => {
      x.fillStyle = '#f3f3ef'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1f8a4c'; x.fillRect(0, h * 0.06, w, h * 0.09);
      x.fillStyle = '#e8b81e'; x.fillRect(0, h * 0.15, w, h * 0.02);
      x.fillStyle = '#d8d8d2'; x.fillRect(0, h * 0.95, w, h * 0.05);
    });
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
    const back = this.wall(W / 2, -D / 2, -W / 2, -D / 2, 0, H, wallMat); back.userData.n = [0, -1];
    const left = this.wall(-W / 2, -D / 2, -W / 2, D / 2, 0, H, wallMat); left.userData.n = [-1, 0];
    const right = this.wall(W / 2, D / 2, W / 2, -D / 2, 0, H, wallMat); right.userData.n = [1, 0];
    R.add(back, left, right); this.walls.push(back, left, right);
    // 정면 유리벽 (문 포함)
    const front = new THREE.Group(); front.userData.n = [0, 1];
    const glass = new THREE.MeshStandardMaterial({ color: 0xb8d4e0, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.4, side: THREE.DoubleSide, depthWrite: false });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.4, metalness: 0.6 });
    const fg = new GB();
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 1.75) fg.cbox(x, H / 2, D / 2, 0.08, H, 0.1);
    fg.cbox(0, H - 0.05, D / 2, W, 0.1, 0.12); fg.cbox(0, 0.05, D / 2, W, 0.1, 0.12); fg.cbox(0, 2.25, D / 2, W, 0.06, 0.1);
    front.add(new THREE.Mesh(fg.build(), frameMat));
    const pane1 = new THREE.Mesh(new THREE.PlaneGeometry(10.4, H), glass); pane1.position.set(-1.8, H / 2, D / 2); front.add(pane1);
    const pane2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, H), glass); pane2.position.set(6.1, H / 2, D / 2); front.add(pane2);
    this.doorL = new THREE.Mesh(new THREE.BoxGeometry(0.98, 2.2, 0.04), glass); this.doorL.position.set(3.7, 1.1, D / 2 - 0.12);
    this.doorR = new THREE.Mesh(new THREE.BoxGeometry(0.98, 2.2, 0.04), glass); this.doorR.position.set(4.7, 1.1, D / 2 - 0.12);
    front.add(this.doorL, this.doorR);
    R.add(front); this.walls.push(front);
    // 매트
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), new THREE.MeshStandardMaterial({ color: 0x2f3a33, roughness: 1 }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(4.2, 0.005, 5.2); R.add(mat);

    const fix = new GB();     // 집기류 (꼭짓점 색)
    const glassParts = [];
    // ─ 진열 곤돌라 (양면) ─
    const gondola = (x0, x1, z0, z1) => {
      fix.setColor(0xe9eaec); fix.box(x0, 0, z0, x1, 0.12, z1);
      fix.setColor(0xd2d5d9); fix.box(x0, 0.12, (z0 + z1) / 2 - 0.04, x1, 1.55, (z0 + z1) / 2 + 0.04);
      for (let k = 0; k < 4; k++) {
        fix.setColor(0xf3f4f5); fix.box(x0, 0.32 + k * 0.38, z0, x1, 0.35 + k * 0.38, z1);
        fix.setColor(0xfafafa); fix.box(x0, 0.28 + k * 0.38, z0 - 0.012, x1, 0.35 + k * 0.38, z0); fix.box(x0, 0.28 + k * 0.38, z1, x1, 0.35 + k * 0.38, z1 + 0.012);
      }
      fix.setColor(0x1f8a4c); fix.box(x0 - 0.02, 1.55, z0, x1 + 0.02, 1.62, z1);
      fix.setColor(0xd2d5d9); fix.box(x0 - 0.05, 0, z0, x0, 1.62, z1); fix.box(x1, 0, z0, x1 + 0.05, 1.62, z1);
      this.colliders.push({ x0: x0 - 0.05, x1: x1 + 0.05, z0, z1 });
    };
    gondola(-2.6, 4.2, -3.2, -2.2);
    gondola(-2.6, 4.2, 0.0, 1.0);
    // 오른쪽 벽 선반
    fix.setColor(0xe9eaec); fix.box(6.45, 0, -4.5, 7, 1.9, 3.0, { top: true });
    for (let k = 0; k < 5; k++) { fix.setColor(0xf3f4f5); fix.box(6.35, 0.3 + k * 0.36, -4.5, 7, 0.33 + k * 0.36, 3.0); }
    this.colliders.push({ x0: 6.35, x1: 7, z0: -4.5, z1: 3.0 });
    // 뒤쪽 워크인 냉장고 (유리문)
    fix.setColor(0x2b2f35);
    fix.box(-5.4, 0, -6, 3.6, 0.12, -5.15); fix.box(-5.4, 2.28, -6, 3.6, 2.35, -5.15);       // 바닥 · 천장
    fix.box(-5.45, 0, -6, -5.35, 2.35, -5.15); fix.box(3.55, 0, -6, 3.65, 2.35, -5.15);     // 옆판
    fix.box(-5.4, 0, -6, 3.6, 2.35, -5.96);                                                 // 뒤판
    fix.setColor(0xf6f9ff); fix.box(-5.3, 0.1, -5.95, 3.5, 2.25, -5.9); // 안쪽 밝은 벽
    for (let k = 0; k < 5; k++) { fix.setColor(0xb0b8c0); fix.box(-5.3, 0.25 + k * 0.42, -5.9, 3.5, 0.27 + k * 0.42, -5.25); }
    fix.setColor(0x1f8a4c); fix.box(-5.4, 2.35, -6, 3.6, 2.6, -5.1);
    for (let x = -5.4; x <= 3.61; x += 1.5) { fix.setColor(0x2b2f35); fix.box(x - 0.04, 0, -5.18, x + 0.04, 2.35, -5.1); }
    for (let x = -5.4; x < 3.6; x += 1.5) { fix.setColor(0xc8ccd2); fix.box(x + 1.32, 0.8, -5.08, x + 1.36, 1.7, -5.02); fix.box(x + 1.32, 0.8, -5.1, x + 1.36, 0.83, -5.02); fix.box(x + 1.32, 1.67, -5.1, x + 1.36, 1.7, -5.02); }
    fix.setColor(0x2b2f35); fix.box(-5.4, 0, -5.18, 3.6, 0.1, -5.1); fix.box(-5.4, 2.25, -5.18, 3.6, 2.35, -5.1);
    glassParts.push([-0.9, 1.2, -5.13, 9.0, 2.3]);
    this.colliders.push({ x0: -5.4, x1: 3.6, z0: -6, z1: -5.1 });
    // 왼쪽 오픈 냉장 매대 (도시락)
    fix.setColor(0x2b2f35); fix.box(-7, 0, -5.6, -6.15, 0.75, -1.6);
    fix.setColor(0xe8e8e8); fix.box(-7, 0.75, -5.6, -6.75, 2.1, -1.6);
    for (let k = 0; k < 3; k++) { fix.setColor(0xc8ccd0); fix.box(-6.95, 0.95 + k * 0.38, -5.6, -6.35 + k * 0.08, 0.97 + k * 0.38, -1.6); }
    fix.setColor(0x1f8a4c); fix.box(-7, 2.1, -5.6, -6.35, 2.3, -1.6);
    this.colliders.push({ x0: -7, x1: -6.15, z0: -5.6, z1: -1.6 });
    // 계산대
    fix.setColor(0xe9e4da); fix.box(-5.0, 0, -0.5, -4.2, 0.95, 3.8);
    fix.setColor(0x3a3e44); fix.box(-5.05, 0.95, -0.55, -4.15, 1.0, 3.85);
    fix.setColor(0x1f8a4c); fix.box(-4.21, 0.15, -0.5, -4.18, 0.85, 3.8);
    // POS · 카드 단말기 · 모니터
    fix.setColor(0x202226); fix.box(-4.95, 1.0, 2.3, -4.55, 1.12, 2.85);
    fix.setColor(0x15171a); fix.box(-4.9, 1.12, 2.45, -4.85, 1.5, 2.75);
    fix.setColor(0x4a90c8); fix.box(-4.85, 1.18, 2.47, -4.83, 1.47, 2.73);
    fix.setColor(0x30343a); fix.box(-4.45, 1.0, 1.85, -4.3, 1.12, 2.05);
    fix.setColor(0x6aa0d0); fix.box(-4.31, 1.08, 1.88, -4.29, 1.11, 2.02);
    // 스캐너 · 봉투
    fix.setColor(0x222222); fix.box(-4.7, 1.0, 3.0, -4.5, 1.2, 3.15);
    fix.setColor(0xf0f0f0); fix.box(-4.95, 1.0, 3.3, -4.6, 1.15, 3.7);
    // 따뜻한 음료 온장고
    fix.setColor(0xb02a2a); fix.box(-4.95, 1.0, -0.4, -4.35, 1.6, 0.4);
    glassParts.push([-4.34, 1.3, 0, 0.75, 0.5, 'x']);
    this.colliders.push({ x0: -5.05, x1: -4.15, z0: -0.55, z1: 3.85 });
    // 계산대 뒤 진열장
    fix.setColor(0x6a5a4a); fix.box(-7, 0, -0.2, -6.6, 2.2, 3.6);
    for (let k = 0; k < 5; k++) { fix.setColor(0x8a7a66); fix.box(-6.95, 0.3 + k * 0.4, -0.2, -6.55, 0.33 + k * 0.4, 3.6); }
    this.colliders.push({ x0: -7, x1: -6.55, z0: -0.2, z1: 3.6 });
    // 창고 문
    fix.setColor(0x8a8f96); fix.box(4.6, 0, -6, 5.8, 2.15, -5.95);
    fix.setColor(0x5a5f66); fix.box(5.55, 1.0, -5.96, 5.65, 1.1, -5.9);
    fix.setColor(0xd84a3a); fix.box(4.85, 1.7, -5.95, 5.55, 1.9, -5.93);
    // 온수기 + 전자레인지 캐비닛
    fix.setColor(0xe8e8e2); fix.box(5.7, 0, 3.7, 7, 0.95, 5.3);
    fix.setColor(0xf6f6f2); fix.box(5.8, 0.95, 4.45, 6.9, 1.35, 5.25);  // 전자레인지
    fix.setColor(0x111111); fix.box(5.78, 1.0, 4.55, 5.8, 1.3, 5.0);
    fix.setColor(0xd8d8d8); fix.box(6.2, 0.95, 3.8, 6.8, 1.65, 4.3);    // 온수기
    fix.setColor(0xc03030); fix.box(6.18, 1.25, 3.95, 6.2, 1.35, 4.15);
    this.colliders.push({ x0: 5.7, x1: 7, z0: 3.7, z1: 5.3 });
    // 창가 취식대 + 의자
    fix.setColor(0xb88a5a); fix.box(-1.6, 1.0, 5.4, 2.6, 1.05, 5.95);
    fix.setColor(0x6a6e74); fix.box(-1.5, 0, 5.85, 2.5, 1.0, 5.92);
    this.stools = [];
    for (let k = 0; k < 4; k++) {
      const x = -1.0 + k * 1.05;
      fix.setColor(0x3a3e44); fix.addGeo(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 6).translate(x, 0.35, 4.95));
      fix.setColor(0x1f8a4c); fix.addGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12).translate(x, 0.72, 4.95));
      this.stools.push([x, 4.95]);
    }
    this.colliders.push({ x0: -1.6, x1: 2.6, z0: 5.4, z1: 6 });
    // ATM · 택배 기계
    fix.setColor(0x2a4a7a); fix.box(-7, 0, 4.4, -6.4, 1.7, 5.4);
    fix.setColor(0x9ac0e8); fix.box(-6.41, 1.0, 4.6, -6.39, 1.4, 5.2);
    this.colliders.push({ x0: -7, x1: -6.4, z0: 4.4, z1: 5.4 });

    // 아이스크림 냉동고 (윗면 유리 미닫이)
    fix.setColor(0xf2f4f6);
    fix.box(1.2, 0, 3.3, 3.2, 0.3, 3.95);                                                    // 바닥
    fix.box(1.2, 0.3, 3.3, 3.2, 0.82, 3.37); fix.box(1.2, 0.3, 3.88, 3.2, 0.82, 3.95);       // 앞 · 뒤
    fix.box(1.2, 0.3, 3.37, 1.27, 0.82, 3.88); fix.box(3.13, 0.3, 3.37, 3.2, 0.82, 3.88);    // 옆
    fix.setColor(0x2f6fd6); fix.box(1.19, 0.55, 3.29, 3.21, 0.68, 3.3); fix.box(1.19, 0.55, 3.95, 3.21, 0.68, 3.96); fix.box(1.19, 0.55, 3.3, 1.2, 0.68, 3.95); fix.box(3.2, 0.55, 3.3, 3.21, 0.68, 3.95);
    fix.setColor(0xdfe8f0); fix.box(1.27, 0.3, 3.37, 3.13, 0.32, 3.88);
    fix.setColor(0x9aa4ae); fix.box(1.2, 0.82, 3.3, 3.2, 0.86, 3.34); fix.box(1.2, 0.82, 3.91, 3.2, 0.86, 3.95); fix.box(2.18, 0.82, 3.3, 2.22, 0.86, 3.95);
    glassParts.push([2.2, 0.85, 3.625, 1.96, 0.61, 'y']);
    this.colliders.push({ x0: 1.2, x1: 3.2, z0: 3.3, z1: 3.95 });
    const fm = new THREE.Mesh(fix.build(), this.vc); fm.castShadow = true; fm.receiveShadow = true; R.add(fm);
    // 냉장고 유리
    const gmat = new THREE.MeshStandardMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.16, roughness: 0.02, metalness: 0.5, depthWrite: false });
    for (const [cx, cy, cz, w, h, axis] of glassParts) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), gmat);
      g.position.set(cx, cy, cz); if (axis === 'x') g.rotation.y = Math.PI / 2; if (axis === 'y') g.rotation.x = -Math.PI / 2;
      R.add(g);
    }
    // 냉장고 안쪽 조명
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(8.9, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glow.position.set(-0.9, 2.28, -5.5); glow.rotation.x = Math.PI / 2; R.add(glow);
    // 천장 조명 패널 (아래에서만 보임)
    const panel = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide });
    for (const [x, z] of [[-3, -2], [3, -2], [-3, 3], [3, 3], [0, -4.5], [0, 0.5]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), panel); p.rotation.x = Math.PI / 2; p.position.set(x, H - 0.08, z); R.add(p);
    }
    // 간판 (뒷벽)
    const sign = canvasTex(512, 128, (x, w, h) => {
      x.fillStyle = '#1f8a4c'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; x.font = '800 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('24 마트', w / 2, h / 2 + 4);
    });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: sign }));
    sm.position.set(-0.9, 2.75, -5.08); R.add(sm);
    // 창고 표지
    const st = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#d84a3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '700 36px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('직원 전용', w / 2, h / 2 + 2); });
    const stm = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), new THREE.MeshBasicMaterial({ map: st })); stm.position.set(5.2, 1.8, -5.92); R.add(stm);

    // 천장에 매달린 코너 안내판
    for (const [txt, x, z, ry, col] of [['라면 · 식재료', 0.8, -2.7, 0, '#e8231e'], ['과자 · 빵', 0.8, 0.5, 0, '#ff8a00'], ['음료 · 우유', -0.9, -4.7, 0, '#1a6fd0'], ['도시락 · 김밥', -6.0, -3.6, Math.PI / 2, '#1f8a4c'], ['아이스크림', 2.2, 3.6, 0, '#2f6fd6']]) {
      const t = canvasTex(512, 128, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(0, h - 10, w, 10); c.font = '800 62px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
      m.position.set(x, 2.45, z); m.rotation.y = ry; R.add(m);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), frameMat); wire.position.set(x, 2.9, z); R.add(wire);
    }
    this.goodsMat = goodsMaterial();
    this.tagB = new GoodsBuilder();
    // ─ 상품 진열 (재고에 따라 보이는 양이 줄어듦) ─
    this.addSection('chill', { axis: 'x', u0: -5.5, u1: -1.7, fixed: -6.9, dir: 1, levels: [0.98, 1.36, 1.74], depth: 0.5, kind: 'chill' });
    this.addSection('drink', { axis: 'z', u0: -5.25, u1: 3.45, fixed: -5.86, dir: 1, levels: [0.28, 0.7, 1.12, 1.54, 1.96], depth: 0.6, kind: 'drink' });
    this.addSection('ramen', { axis: 'z', u0: -2.5, u1: 4.1, fixed: -2.76, dir: -1, levels: [0.35, 0.73, 1.11, 1.49], depth: 0.42, kind: 'ramen' });
    this.addSection('grocery', { axis: 'z', u0: -2.5, u1: 4.1, fixed: -2.64, dir: 1, levels: [0.35, 0.73, 1.11, 1.49], depth: 0.42, kind: 'grocery' });
    this.addSection('snack', { axis: 'z', u0: -2.5, u1: 4.1, fixed: 0.46, dir: -1, levels: [0.35, 0.73, 1.11, 1.49], depth: 0.42, kind: 'snack' });
    this.addSection('snack', { axis: 'z', u0: -2.5, u1: 4.1, fixed: 0.54, dir: 1, levels: [0.35, 0.73, 1.11, 1.49], depth: 0.42, kind: 'bread' });
    this.addSection('snack', { axis: 'x', u0: -4.4, u1: 2.9, fixed: 6.95, dir: -1, levels: [0.33, 0.69, 1.05, 1.41, 1.77], depth: 0.56, kind: 'snack' });
    this.addSection(null, { axis: 'x', u0: -0.1, u1: 3.5, fixed: -6.93, dir: 1, levels: [0.33, 0.73, 1.13, 1.53, 1.93], depth: 0.36, kind: 'misc' });
    this.addFreezer();
    const tm = new THREE.Mesh(this.tagB.build(), this.goodsMat); R.add(tm);

    // 상호작용 구역
    const Z = (id, x0, z0, x1, z1, extra = {}) => this.zones.push({ id, x0, z0, x1, z1, ...extra });
    Z('shelf', -6.2, -5.6, -4.6, -1.6, { cat: 'chill', label: '도시락·김밥 매대', spot: [-5.5, -3.6] });
    Z('shelf', -5.4, -5.1, 3.6, -4.4, { cat: 'drink', label: '음료 냉장고', spot: [-0.9, -4.6] });
    Z('shelf', -2.6, -4.4, 4.2, -3.2, { cat: 'ramen', label: '라면 코너', spot: [0.8, -3.8] });
    Z('shelf', -2.6, -2.2, 4.2, -1.3, { cat: 'grocery', label: '식재료 코너', spot: [0.8, -1.7] });
    Z('shelf', -2.6, -1.3, 4.2, 0.0, { cat: 'snack', label: '과자 코너', spot: [0.8, -0.6] });
    Z('shelf', -2.6, 1.0, 4.2, 2.2, { cat: 'snack', label: '빵·과자 코너', spot: [0.8, 1.6] });
    Z('shelf', 5.2, -4.5, 6.35, 3.0, { cat: 'snack', label: '과자 벽면 선반', spot: [5.8, -1] });
    Z('shelf', 1.0, 2.6, 3.4, 3.3, { cat: 'ice', label: '아이스크림 냉동고', spot: [2.2, 2.8] });
    Z('counter', -4.15, 1.3, -2.6, 3.9);
    Z('pos', -6.55, 1.2, -5.05, 3.9);
    Z('storage', 4.3, -5.1, 6.2, -4.3);
    Z('hot', 4.8, 3.6, 5.7, 5.4);
    Z('eat', -1.6, 4.2, 2.6, 5.4);
    Z('exit', 3.1, 5.0, 5.3, 6.0);

    // 경고 아이콘 (진열 부족)
    this.warn = {};
    for (const [cat, x, y, z] of [['chill', -6.4, 2.6, -3.6], ['drink', -0.9, 2.95, -5.4], ['ramen', 0.8, 2.0, -3.4], ['grocery', 0.8, 2.0, -2.0], ['snack', 0.8, 2.0, 0.5], ['ice', 2.2, 1.6, 3.6]]) {
      const s = emojiSprite('📦'); s.position.set(x, y, z); s.visible = false; R.add(s); this.warn[cat] = s;
    }
    // 들고 다니는 상자 / 대걸레
    const box = new GB(); box.setColor(0xb88a5a); box.cbox(0, 0, 0, 0.5, 0.35, 0.4); box.setColor(0x8a6440); box.cbox(0, 0.176, 0, 0.5, 0.01, 0.06);
    this.carryBox = new THREE.Mesh(box.build(), this.vc); this.carryBox.castShadow = true;
    // 물류 상자 (입구)
    this.deliveryBoxes = [];
    for (let k = 0; k < 3; k++) {
      const m = this.carryBox.clone(); m.position.set(2.6 + k * 0.55, 0.18 + (k === 2 ? 0.35 : 0), 4.6 - (k === 2 ? 0.0 : 0)); if (k === 2) m.position.x = 2.85;
      m.visible = false; R.add(m); this.deliveryBoxes.push(m);
    }
    // 흘린 음료 자국
    this.spillMat = new THREE.MeshStandardMaterial({ color: 0x6a3a1a, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    // 직원 NPC (내가 근무 중이 아닐 때)
    this.staff = createPed({ skin: 0xf2c49b, hair: 0x1a1410, shirt: 0x1f8a4c, pants: 0x23262b, shoes: 0x222222, face: 'smile', logo: 0xffffff });
    this.staff.root.position.set(-5.75, 0, 2.6); this.staff.root.rotation.y = Math.PI / 2;
    R.add(this.staff.root);
    // 김 (컵라면·도시락 연출용)
    this.steam = [];
  }

  // 진열 상품 생성: 같은 상품끼리 줄지어(페이싱) 놓고 맨 앞줄만 정밀 모델
  addSection(cat, o) {
    const skus = SECTION_SKUS[o.kind];
    const rot = o.axis === 'z' ? (o.dir > 0 ? 0 : Math.PI) : (o.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const pos = (along, across) => o.axis === 'z' ? [along, across] : [across, along];
    const facings = [];
    let prev = null;
    o.levels.forEach((y, li) => {
      const space = (o.levels[li + 1] ?? (y + 0.42)) - y - 0.05;
      let u = o.u0 + 0.04, guard = 0;
      while (u < o.u1 - 0.08 && guard++ < 400) {
        let id; do { id = skus[Math.floor(Math.random() * skus.length)]; } while (id === prev && skus.length > 1);
        prev = id;
        let { w, h, d } = skuSize(id);
        if (h > space) continue;
        const run = 2 + Math.floor(Math.random() * 3);
        const stack = ['bag', 'pet', 'tri', 'wedge', 'jar'].includes(SKUS[id].shape) ? 1 : Math.max(1, Math.min(3, Math.floor(space / (h + 0.004))));
        const rows = Math.max(1, Math.floor(o.depth / (d + 0.008)));
        // 가격표
        const [tx, tz] = pos(u + w / 2, o.fixed + o.dir * (o.depth + 0.04));
        this.tagB.quad(tx, y - 0.068, tz, rot, 0.075, 0.037, tagUV(id));
        for (let f = 0; f < run && u + w < o.u1; f++) {
          const items = [];
          for (let k = 0; k < rows; k++) for (let q = 0; q < stack; q++) {
            const front = k === rows - 1 && q === stack - 1 || k === rows - 1 && stack > 1;
            const [x, z] = pos(u + w / 2, o.fixed + o.dir * (k + 0.5) * (d + 0.008));
            items.push({ id, lo: !front, x, y: y + q * (h + 0.003), z, r: rot + (front ? (Math.random() - 0.5) * 0.08 : 0) });
          }
          facings.push(items);
          u += w + 0.01;
        }
        u += 0.015;
      }
    });
    this.buildFacings(cat, facings);
  }
  buildFacings(cat, facings) {
    for (let i = facings.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [facings[i], facings[j]] = [facings[j], facings[i]]; }
    const gb = new GoodsBuilder();
    const offsets = [0];
    for (const f of facings) {
      for (const it of f) gb.add(template(it.id, it.lo), it.x, it.y, it.z, it.r, it.tilt || 0);
      offsets.push(gb.count);
    }
    if (!gb.count) return;
    const mesh = new THREE.Mesh(gb.build(), this.goodsMat);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.sections.push({ cat, mesh, offsets });
  }
  // 냉동고 안: 위에서 보이게 칸칸이
  addFreezer() {
    const skus = SECTION_SKUS.ice, facings = [];
    let x = 1.32, k = 0;
    while (x < 3.02) {
      const id = skus[k++ % skus.length];
      const { w, h, d } = skuSize(id);
      const zs = SKUS[id].shape === 'bar' ? [3.52, 3.74] : [3.46, 3.57, 3.68, 3.79];
      for (const z of zs) {
        const n = 2 + Math.floor(Math.random() * 3), items = [];
        for (let q = 0; q < n; q++) items.push({ id, lo: q < n - 1, x: x + w / 2 + (Math.random() - 0.5) * 0.01, y: 0.32 + q * (h + 0.002), z, r: (Math.random() - 0.5) * 0.12 });
        facings.push(items);
      }
      x += w + 0.015;
    }
    this.buildFacings('ice', facings);
  }

  refreshStock() {
    for (const s of this.sections) {
      if (!s.cat) continue;
      const ratio = THREE.MathUtils.clamp(this.stock[s.cat], 0, 1);
      const n = s.offsets.length - 1;
      const keep = Math.round(n * (0.08 + 0.92 * ratio));
      s.mesh.geometry.setDrawRange(0, s.offsets[keep]);
    }
  }

  // ─ 충돌 ─
  collide(pos, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.x0, Math.min(pos.x, c.x1)), nz = Math.max(c.z0, Math.min(pos.z, c.z1));
      const dx = pos.x - nx, dz = pos.z - nz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-4) {
          const opts = [[c.x0 - r - pos.x, 0], [c.x1 + r - pos.x, 0], [0, c.z0 - r - pos.z], [0, c.z1 + r - pos.z]];
          opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          pos.x += opts[0][0]; pos.z += opts[0][1];
        } else { pos.x = nx + dx / d * r; pos.z = nz + dz / d * r; }
      }
    }
    const inDoor = pos.x > 3.25 + r && pos.x < 5.15 - r;
    pos.x = Math.max(-W / 2 + r, Math.min(W / 2 - r, pos.x));
    pos.z = Math.max(-D / 2 + r, Math.min(inDoor ? D / 2 + 1.5 : D / 2 - 0.25, pos.z));
  }
  zoneAt(pos) {
    let best = null;
    for (const z of this.zones) if (pos.x >= z.x0 && pos.x <= z.x1 && pos.z >= z.z0 && pos.z <= z.z1) { best = z; if (z.id !== 'shelf') break; }
    return best;
  }

  // ─ 흘린 자국 ─
  addSpill() {
    const spots = [[1.5, -4.2], [-1.0, -1.1], [2.5, 2.6], [5.3, -2.5], [-3.4, -3.0], [0.2, 2.9]];
    const [x, z] = spots[Math.floor(Math.random() * spots.length)];
    if (this.spills.some(s => Math.hypot(s.x - x, s.z - z) < 1)) return null;
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.45 + Math.random() * 0.2, 18), this.spillMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); m.scale.set(1, 0.7 + Math.random() * 0.5, 1);
    this.root.add(m);
    const icon = emojiSprite('🧽', 0.45); icon.position.set(x, 1.2, z); this.root.add(icon);
    const s = { x, z, m, icon };
    this.spills.push(s);
    return s;
  }
  removeSpill(s) { this.root.remove(s.m, s.icon); this.spills.splice(this.spills.indexOf(s), 1); }

  // ─ 손님 NPC ─
  spawnCustomer(opts = {}) {
    const female = Math.random() < 0.5;
    const p = createPed({
      skin: SKINS[Math.floor(Math.random() * SKINS.length)], hair: HAIRS[Math.floor(Math.random() * HAIRS.length)],
      shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)], pants: PANTS[Math.floor(Math.random() * PANTS.length)],
      shoes: SHOES[Math.floor(Math.random() * SHOES.length)], hairStyle: female ? (Math.random() < 0.6 ? 'long' : 'bun') : 'short',
      bag: Math.random() < 0.3 ? 0x2a2a2a : null,
    });
    p.root.scale.setScalar(female ? 0.94 : 1);
    p.root.position.set(4.2, 0, 6.6);
    this.root.add(p.root);
    // 살 물건 정하기
    const shelfZones = this.zones.filter(z => z.id === 'shelf');
    const visits = [];
    const n = 1 + (Math.random() < 0.45 ? 1 : 0);
    for (let k = 0; k < n; k++) visits.push(shelfZones[Math.floor(Math.random() * shelfZones.length)]);
    const c = {
      p, pos: p.root.position, state: 'enter', visits, items: [], path: [], wait: 0, patience: 1, id: Math.random(),
      icon: null, mood: 1, ...opts,
    };
    this.go(c, NODES.D);
    this.npcs.push(c);
    return c;
  }
  // 목표 지점까지 노드 경로 만들기
  go(c, target) {
    const near = (x, z) => Object.entries(NODES).sort((a, b) => Math.hypot(a[1][0] - x, a[1][1] - z) - Math.hypot(b[1][0] - x, b[1][1] - z))[0][0];
    const a = near(c.pos.x, c.pos.z), b = near(target[0], target[1]);
    const pts = pathBetween(a, b).map(n => NODES[n]);
    if (c.pos.z > 5.3) pts.unshift([4.2, 5.4]);
    pts.push(target);
    c.path = pts;
  }
  removeNpc(c) {
    this.root.remove(c.p.root);
    if (c.icon) this.root.remove(c.icon);
    this.npcs.splice(this.npcs.indexOf(c), 1);
  }
  setIcon(c, emoji) {
    if (c.icon) { this.root.remove(c.icon); c.icon = null; }
    if (emoji) { c.icon = emojiSprite(emoji, 0.42); this.root.add(c.icon); }
  }
  queueIndex(c) { return this.queue ? this.queue.indexOf(c) : -1; }

  // dt: 실제 초. hooks: 계산대 처리 콜백
  updateNpcs(dt, playerPos, hooks) {
    this.queue = this.queue || [];
    for (const c of [...this.npcs]) {
      // 경로 따라 이동
      let moving = false;
      if (c.path.length) {
        const [tx, tz] = c.path[0];
        const dx = tx - c.pos.x, dz = tz - c.pos.z, d = Math.hypot(dx, dz);
        // 플레이어와 부딪히지 않게 잠시 멈춤
        const px = playerPos.x - c.pos.x, pz = playerPos.z - c.pos.z;
        const blocked = Math.hypot(px, pz) < 0.75 && (px * dx + pz * dz) > 0;
        if (!blocked) {
          const sp = 1.15 * dt;
          if (d <= sp) { c.pos.x = tx; c.pos.z = tz; c.path.shift(); }
          else { c.pos.x += dx / d * sp; c.pos.z += dz / d * sp; moving = true; }
          const want = Math.atan2(dx, dz);
          let dh = want - c.p.root.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
          c.p.root.rotation.y += dh * Math.min(1, dt * 9);
        }
      }
      c.p.animate(dt, moving ? 1.15 : 0);
      if (c.icon) c.icon.position.set(c.pos.x, 2.15, c.pos.z);
      if (c.path.length) continue;
      // 상태 진행
      switch (c.state) {
        case 'enter': c.state = 'toShelf'; this.go(c, c.visits[0].spot); break;
        case 'toShelf': c.state = 'browse'; c.wait = 2 + Math.random() * 3; c.p.root.rotation.y = this.faceShelf(c.visits[0]); break;
        case 'browse':
          c.wait -= dt;
          if (c.wait <= 0) {
            const z = c.visits.shift();
            this.pick(c, z.cat);
            if (c.visits.length) { c.state = 'toShelf'; this.go(c, c.visits[0].spot); }
            else if (!c.items.length) { c.state = 'leave'; this.go(c, [4.2, 5.4]); }
            else { c.state = 'toQueue'; this.queue.push(c); this.go(c, QUEUE[Math.min(this.queue.length - 1, QUEUE.length - 1)]); }
          }
          break;
        case 'toQueue': c.state = 'queue'; c.p.root.rotation.y = -Math.PI / 2; break;
        case 'queue': {
          const qi = this.queue.indexOf(c);
          const spot = QUEUE[Math.min(qi, QUEUE.length - 1)];
          if (Math.hypot(spot[0] - c.pos.x, spot[1] - c.pos.z) > 0.1) { c.path = [spot]; c.state = 'toQueue'; break; }
          c.p.root.rotation.y = qi === 0 ? -Math.PI / 2 : Math.PI;
          if (qi === 0) hooks.atCounter(c, dt);
          break;
        }
        case 'paid': c.state = 'leave'; this.queue.splice(this.queue.indexOf(c), 1); this.go(c, [4.2, 5.4]); this.setIcon(c, c.mood > 0.6 ? null : '😠'); break;
        case 'leave': c.state = 'out'; c.path = [[4.2, 6.8]]; break;
        case 'out': this.removeNpc(c); break;
      }
    }
  }
  faceShelf(z) {
    const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2;
    if (z.cat === 'chill') return -Math.PI / 2;
    if (z.label.includes('벽면')) return Math.PI / 2;
    if (z.cat === 'drink' || z.cat === 'ramen') return Math.PI;
    if (z.label.startsWith('식재료')) return Math.PI;
    if (z.label.startsWith('과자 코너')) return 0;
    if (z.label.startsWith('빵')) return Math.PI;
    return 0;
  }
  pick(c, cat) {
    if (this.stock[cat] < 0.05) { c.mood -= 0.25; this.setIcon(c, '❓'); return; }
    const list = PRODUCTS.filter(p => p.cat === cat);
    const n = 1 + Math.floor(Math.random() * (cat === 'drink' || cat === 'snack' ? 3 : 2));
    for (let k = 0; k < n; k++) c.items.push(list[Math.floor(Math.random() * list.length)]);
    this.stock[cat] = Math.max(0, this.stock[cat] - 0.055 * n);
    this.refreshStock();
  }

  updateDoor(dt, playerPos) {
    const near = [playerPos, ...this.npcs.map(c => c.pos)].some(p => Math.abs(p.x - 4.2) < 1.6 && p.z > 3.9);
    this.doorOpen = THREE.MathUtils.clamp((this.doorOpen || 0) + (near ? dt * 3 : -dt * 2), 0, 1);
    this.doorL.position.x = 3.7 - this.doorOpen * 0.95;
    this.doorR.position.x = 4.7 + this.doorOpen * 0.95;
  }

  updateWarn(onShift, t) {
    for (const k in this.warn) {
      const s = this.warn[k];
      s.visible = onShift && this.stock[k] < 0.4;
      if (s.visible) s.scale.setScalar(0.5 + Math.sin(t * 5) * 0.05);
    }
    for (const sp of this.spills) sp.icon.scale.setScalar(0.42 + Math.sin(t * 5) * 0.04);
  }

  // 컵라면/도시락 김
  puff(x, y, z) {
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
      s.position.set(x + (Math.random() - 0.5) * 0.1, y, z + (Math.random() - 0.5) * 0.1);
      s.scale.setScalar(0.08);
      s.userData = { life: 0, delay: k * 0.25 };
      this.root.add(s); this.steam.push(s);
    }
  }
  updateFx(dt) {
    for (const s of [...this.steam]) {
      const u = s.userData;
      if (u.delay > 0) { u.delay -= dt; s.visible = false; continue; }
      s.visible = true;
      u.life += dt;
      s.position.y += dt * 0.35; s.position.x += Math.sin(u.life * 3) * dt * 0.05;
      s.scale.setScalar(0.08 + u.life * 0.18);
      s.material.opacity = Math.max(0, 0.45 - u.life * 0.3);
      if (u.life > 1.5) { this.root.remove(s); this.steam.splice(this.steam.indexOf(s), 1); }
    }
  }

  updateWalls(camera) {
    for (const w of this.walls) {
      const [nx, nz] = w.userData.n;
      const dot = camera.position.x * nx + camera.position.z * nz;
      const lim = nx ? W / 2 : D / 2;
      w.visible = dot < lim + 0.5;
    }
  }

  clearNpcs() { for (const c of [...this.npcs]) this.removeNpc(c); this.queue = []; }
}

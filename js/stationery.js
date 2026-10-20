import * as THREE from 'three';
import { GB } from './geo.js';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';
import { MartRoom, canvasTex, emojiSprite } from './mart.js';
import { SKUS, goodsMaterial, template, skuSize, GoodsBuilder, tagUV } from './goods.js';

// ───────── 문구랜드 실내 ─────────
// 좌표: x -5.5..5.5, z -4.5..4.5, 정면(유리벽·출입문)은 +z, 출입문 x 2.7..4.3
const W = 11, D = 9, H = 3.0;
export const STAT_DOOR = { x: 3.5, x0: 2.7, x1: 4.3 };

// 손님 이동용 길
const NODES = {
  D: [3.5, 3.9], F1: [3.5, 1.9], F2: [0.6, 1.9], F3: [-1.9, 1.5], C: [-3.2, 2.2],
  M1: [3.5, -1.05], M2: [0.6, -1.05], M3: [-3.4, -1.05],
  B1: [3.5, -3.35], B2: [0.6, -3.35], B3: [-3.4, -3.35], T: [-4.2, -1.6], P: [4.1, -0.2],
};
const EDGES = [['D', 'F1'], ['F1', 'F2'], ['F2', 'F3'], ['F3', 'C'], ['F1', 'M1'], ['M1', 'M2'], ['M2', 'M3'], ['M1', 'B1'], ['B1', 'B2'], ['B2', 'B3'], ['B3', 'M3'], ['M3', 'T'], ['M3', 'F3'], ['M1', 'P'], ['P', 'F1']];
const ADJ = {};
for (const [a, b] of EDGES) { (ADJ[a] = ADJ[a] || []).push(b); (ADJ[b] = ADJ[b] || []).push(a); }
function pathBetween(a, b) {
  const prev = { [a]: null }, q = [a];
  while (q.length) { const n = q.shift(); if (n === b) break; for (const m of ADJ[n]) if (!(m in prev)) { prev[m] = n; q.push(m); } }
  const out = []; let n = b; while (n) { out.unshift(n); n = prev[n]; }
  return out;
}

export class StatRoom {
  constructor() {
    this.W = W; this.D = D;
    this.scene = new THREE.Scene();
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.colliders = [];
    this.walls = [];
    this.zones = [];
    this.npcs = [];
    this.sections = [];
    this.stock = { snote: 1, sart: 1, soffice: 1, spen: 1, stoy: 1, ssnack: 1 };
    this.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.03 });
    this.door = { x: STAT_DOOR.x, z: D / 2 - 0.4, x0: STAT_DOOR.x0, x1: STAT_DOOR.x1 };
    this.build();
    this.addOwner();
  }

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
    // 바닥: 밝은 나무무늬 장판
    const floorTex = canvasTex(512, 512, (x, w) => {
      for (let i = 0; i < 8; i++) {
        const v = 200 + Math.random() * 20;
        x.fillStyle = `rgb(${v + 20},${v},${v - 40})`; x.fillRect(0, i * 64, w, 64);
        x.strokeStyle = 'rgba(120,90,50,0.25)'; x.lineWidth = 2; x.strokeRect(0, i * 64, w, 64);
        for (let k = 0; k < 30; k++) { x.strokeStyle = `rgba(150,110,60,${Math.random() * 0.15})`; x.beginPath(); const y = i * 64 + Math.random() * 64; x.moveTo(Math.random() * w, y); x.lineTo(Math.random() * w, y + (Math.random() - 0.5) * 6); x.stroke(); }
        x.fillStyle = 'rgba(90,60,30,0.3)'; x.fillRect((i * 173) % w, i * 64, 2, 64);
      }
    }, true);
    floorTex.repeat.set(W / 2.4, D / 2.4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; R.add(floor);

    // 벽: 크림색 + 파스텔 띠
    const wallTex = canvasTex(64, 256, (x, w, h) => {
      x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffb84a'; x.fillRect(0, h * 0.05, w, h * 0.05);
      x.fillStyle = '#5ab0ff'; x.fillRect(0, h * 0.1, w, h * 0.02);
      x.fillStyle = '#e8dcc6'; x.fillRect(0, h * 0.95, w, h * 0.05);
    });
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
    const back = this.wall(W / 2, -D / 2, -W / 2, -D / 2, 0, H, wallMat); back.userData.n = [0, -1];
    const left = this.wall(-W / 2, -D / 2, -W / 2, D / 2, 0, H, wallMat); left.userData.n = [-1, 0];
    const right = this.wall(W / 2, D / 2, W / 2, -D / 2, 0, H, wallMat); right.userData.n = [1, 0];
    R.add(back, left, right); this.walls.push(back, left, right);

    // 정면 유리벽 + 출입문
    const front = new THREE.Group(); front.userData.n = [0, 1];
    const glass = new THREE.MeshStandardMaterial({ color: 0xc8e4f0, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.4, side: THREE.DoubleSide, depthWrite: false });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.4, metalness: 0.2 });
    const fg = new GB();
    for (const x of [-W / 2, -2.6, 0.2, STAT_DOOR.x0, STAT_DOOR.x1, W / 2]) fg.cbox(x, H / 2, D / 2, 0.09, H, 0.1);
    fg.cbox(0, H - 0.05, D / 2, W, 0.1, 0.12); fg.cbox(0, 0.05, D / 2, W, 0.1, 0.12); fg.cbox(0, 2.25, D / 2, W, 0.06, 0.1);
    front.add(new THREE.Mesh(fg.build(), frameMat));
    for (const [x0, x1] of [[-W / 2, -2.6], [-2.6, 0.2], [0.2, STAT_DOOR.x0], [STAT_DOOR.x1, W / 2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, H), glass); p.position.set((x0 + x1) / 2, H / 2, D / 2); front.add(p); }
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, H - 2.25), glass); p2.position.set(STAT_DOOR.x, (H + 2.25) / 2, D / 2); front.add(p2);
    // 여닫이 문 (손잡이 달린 유리문)
    this.doorPivot = new THREE.Group(); this.doorPivot.position.set(STAT_DOOR.x0 + 0.05, 0, D / 2 - 0.03);
    const dpanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.18, 0.03), glass); dpanel.position.set(0.75, 1.11, 0); this.doorPivot.add(dpanel);
    const dfr = new GB();
    dfr.cbox(0.75, 0.04, 0, 1.5, 0.08, 0.05); dfr.cbox(0.75, 2.18, 0, 1.5, 0.06, 0.05); dfr.cbox(0.02, 1.1, 0, 0.05, 2.2, 0.05); dfr.cbox(1.48, 1.1, 0, 0.05, 2.2, 0.05);
    dfr.cbox(1.32, 1.05, 0.04, 0.03, 0.5, 0.03); dfr.cbox(1.32, 1.05, -0.04, 0.03, 0.5, 0.03);
    this.doorPivot.add(new THREE.Mesh(dfr.build(), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.7, roughness: 0.3 })));
    // 문에 붙은 영업시간 스티커
    const hours = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#ff6a1a'; x.fillRect(0, 0, w, 34); x.fillStyle = '#fff'; x.font = '800 24px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('OPEN', w / 2, 18); x.fillStyle = '#333'; x.font = '700 26px sans-serif'; x.fillText('08:00 ~ 21:00', w / 2, 66); x.font = '600 20px sans-serif'; x.fillText('연중무휴', w / 2, 102); });
    const hs = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: hours })); hs.position.set(0.75, 1.5, 0.02); this.doorPivot.add(hs);
    front.add(this.doorPivot);
    R.add(front); this.walls.push(front);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), new THREE.MeshStandardMaterial({ color: 0x3a4a6a, roughness: 1 }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(STAT_DOOR.x, 0.005, D / 2 - 0.6); R.add(mat);

    const fix = new GB();
    const shelfUnit = (x0, x1, z0, z1, levels, top, side = 0xf6f6f4, edge = 0x5ab0ff) => {
      fix.setColor(side); fix.box(x0, 0, z0, x1, 0.1, z1);
      for (const y of levels) { fix.setColor(0xfafaf8); fix.box(x0, y - 0.03, z0, x1, y, z1); fix.setColor(edge); fix.box(x0, y - 0.075, z1 - 0.012, x1, y - 0.03, z1 + 0.004); fix.box(x0, y - 0.075, z0 - 0.004, x1, y - 0.03, z0 + 0.012); }
      fix.setColor(side); fix.box(x0 - 0.04, 0, z0, x0, top, z1); fix.box(x1, 0, z0, x1 + 0.04, top, z1);
    };
    // ─ 뒷벽 선반 (공책 · 미술용품) ─
    const BL = [0.32, 0.7, 1.08, 1.46, 1.84];
    shelfUnit(-5.3, 5.3, -4.5, -4.02, BL, 2.2);
    fix.setColor(0xf2ece0); fix.box(-5.3, 0.1, -4.5, 5.3, 2.2, -4.46);
    fix.setColor(0xffb84a); fix.box(-5.34, 2.2, -4.5, 5.34, 2.32, -4.0);
    this.colliders.push({ x0: -5.5, x1: 5.5, z0: -4.5, z1: -3.98 });
    // ─ 왼쪽 벽: 장난감 선반 ─
    const TL = [0.32, 0.76, 1.2, 1.64];
    fix.setColor(0xf6f6f4); fix.box(-5.5, 0, -3.95, -5.0, 0.1, 0.4);
    for (const y of TL) { fix.setColor(0xfafaf8); fix.box(-5.5, y - 0.03, -3.95, -5.0, y, 0.4); fix.setColor(0xff7ab0); fix.box(-5.012, y - 0.075, -3.95, -4.996, y - 0.03, 0.4); }
    fix.setColor(0xf2ece0); fix.box(-5.5, 0.1, -3.95, -5.46, 2.0, 0.4);
    fix.setColor(0xf6f6f4); fix.box(-5.5, 0, 0.4, -5.0, 2.0, 0.44); fix.box(-5.5, 0, -3.99, -5.0, 2.0, -3.95);
    this.colliders.push({ x0: -5.5, x1: -4.98, z0: -3.99, z1: 0.44 });
    // ─ 오른쪽 벽: 타공판 걸이 진열 ─
    fix.setColor(0xe8e0d0); fix.box(5.44, 0.4, -3.9, 5.5, 2.2, 2.4);
    fix.setColor(0xf6f6f4); fix.box(5.0, 0, -3.9, 5.5, 0.4, 2.4);
    this.pegRows = [0.62, 0.95, 1.28, 1.61, 1.94];
    this.colliders.push({ x0: 5.0, x1: 5.5, z0: -3.9, z1: 2.4 });
    // ─ 가운데 진열대 2개 (양면) ─
    const GL = [0.32, 0.68, 1.04, 1.4];
    const gondola = (x0, x1, z0, z1) => {
      const zc = (z0 + z1) / 2;
      fix.setColor(0xf6f6f4); fix.box(x0, 0, z0, x1, 0.1, z1);
      fix.setColor(0xe8e4dc); fix.box(x0, 0.1, zc - 0.03, x1, 1.55, zc + 0.03);
      for (const y of GL) { fix.setColor(0xfafaf8); fix.box(x0, y - 0.03, z0, x1, y, z1); fix.setColor(0xffb84a); fix.box(x0, y - 0.075, z0 - 0.012, x1, y - 0.03, z0); fix.box(x0, y - 0.075, z1, x1, y - 0.03, z1 + 0.012); }
      fix.setColor(0x5ab0ff); fix.box(x0 - 0.02, 1.55, z0, x1 + 0.02, 1.62, z1);
      fix.setColor(0xf6f6f4); fix.box(x0 - 0.05, 0, z0, x0, 1.62, z1); fix.box(x1, 0, z0, x1 + 0.05, 1.62, z1);
      this.colliders.push({ x0: x0 - 0.05, x1: x1 + 0.05, z0, z1 });
    };
    gondola(-2.6, 2.6, -2.62, -1.78);
    gondola(-1.6, 2.6, -0.32, 0.52);
    // ─ 추억의 간식 낮은 진열대 (창가) ─
    const SL = [0.28, 0.58, 0.88];
    fix.setColor(0xffe0a0); fix.box(-2.6, 0, 2.62, -0.8, 0.1, 3.2);
    for (const y of SL) { fix.setColor(0xfff4dc); fix.box(-2.6, y - 0.03, 2.62, -0.8, y, 3.2); fix.setColor(0xff6a1a); fix.box(-2.6, y - 0.075, 2.608, -0.8, y - 0.03, 2.62); }
    fix.setColor(0xffe0a0); fix.box(-2.6, 0.1, 3.16, -0.8, 1.0, 3.2); fix.box(-2.64, 0, 2.62, -2.6, 1.0, 3.2); fix.box(-0.8, 0, 2.62, -0.76, 1.0, 3.2);
    this.colliders.push({ x0: -2.64, x1: -0.76, z0: 2.62, z1: 3.2 });
    // ─ 계산대 ─
    fix.setColor(0xfff4dc); fix.box(-4.4, 0, 0.9, -3.75, 0.95, 3.5);
    fix.setColor(0x8a5a3a); fix.box(-4.45, 0.95, 0.85, -3.7, 1.0, 3.55);
    fix.setColor(0xffb84a); fix.box(-3.76, 0.15, 0.9, -3.73, 0.85, 3.5);
    fix.setColor(0x202226); fix.box(-4.35, 1.0, 1.4, -4.0, 1.12, 1.85);   // 금전등록기
    fix.setColor(0x15171a); fix.box(-4.3, 1.12, 1.5, -4.26, 1.4, 1.75); fix.setColor(0x4a90c8); fix.box(-4.26, 1.16, 1.52, -4.25, 1.37, 1.73);
    fix.setColor(0x30343a); fix.box(-3.95, 1.0, 1.95, -3.82, 1.1, 2.12);    // 카드 단말기
    // 계산대 위 사탕 통 3개
    for (let k = 0; k < 3; k++) { fix.setColor([0xff6ac8, 0x5ab0ff, 0xffd21a][k]); fix.addGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 14).translate(-4.05, 1.11, 2.5 + k * 0.28)); fix.setColor(0xf2f2f2); fix.addGeo(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 14).translate(-4.05, 1.235, 2.5 + k * 0.28)); }
    this.colliders.push({ x0: -4.45, x1: -3.7, z0: 0.85, z1: 3.55 });
    // 계산대 뒤 작은 선반
    fix.setColor(0xf6f6f4); fix.box(-5.5, 0, 0.9, -5.15, 1.9, 3.5);
    for (const y of [0.4, 0.8, 1.2, 1.6]) { fix.setColor(0xfafaf8); fix.box(-5.5, y - 0.02, 0.9, -5.12, y, 3.5); }
    this.colliders.push({ x0: -5.5, x1: -5.1, z0: 0.9, z1: 3.5 });
    // ─ 뽑기 기계 2대 (입구 옆) ─
    this.gacha = [];
    for (const [gx, col, top] of [[4.72, 0xff4a8a, 0xffd21a], [5.22, 0x3a8aff, 0x7ad84a]]) {
      fix.setColor(col); fix.box(gx - 0.23, 0, 3.85, gx + 0.23, 0.75, 4.35);
      fix.setColor(0xffffff); fix.box(gx - 0.17, 0.42, 3.83, gx + 0.17, 0.6, 3.85);
      fix.setColor(0xc8ccd2); fix.addGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16).rotateX(Math.PI / 2).translate(gx, 0.5, 3.82));
      fix.setColor(0x2a2a2a); fix.box(gx - 0.08, 0.12, 3.82, gx + 0.08, 0.26, 3.86);
      fix.setColor(top); fix.box(gx - 0.24, 1.43, 3.84, gx + 0.24, 1.53, 4.36);
      this.gacha.push(gx);
    }
    this.colliders.push({ x0: 4.47, x1: 5.5, z0: 3.83, z1: 4.4 });
    const fm = new THREE.Mesh(fix.build(), this.vc); fm.castShadow = true; fm.receiveShadow = true; R.add(fm);
    // 뽑기 기계 유리 돔 + 안의 캡슐
    const capG = new THREE.SphereGeometry(0.035, 10, 8);
    const capCols = [0xff4a8a, 0xffd21a, 0x3a8aff, 0x7ad84a, 0xb04aff, 0xffffff, 0xff8a1a];
    const caps = new THREE.InstancedMesh(capG, new THREE.MeshStandardMaterial({ roughness: 0.25 }), 60);
    let ci = 0; const m4 = new THREE.Matrix4(), c = new THREE.Color();
    for (const gx of this.gacha) for (let k = 0; k < 30; k++) {
      m4.makeTranslation(gx + (Math.random() - 0.5) * 0.34, 0.8 + Math.random() * 0.3 * (1 - Math.abs(k / 30 - 0.5)), 4.1 + (Math.random() - 0.5) * 0.36);
      caps.setMatrixAt(ci, m4); caps.setColorAt(ci, c.set(capCols[(k * 3 + gx * 10) % capCols.length | 0])); ci++;
    }
    R.add(caps);
    const dome = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.3, depthWrite: false });
    for (const gx of this.gacha) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.68, 0.5), dome); b.position.set(gx, 1.09, 4.1); R.add(b); }
    for (const [gx, txt, col] of [[4.72, '1000원 캐릭터', '#ff4a8a'], [5.22, '500원 스티커', '#3a8aff']]) {
      const t = canvasTex(256, 64, (x, w, h) => { x.fillStyle = col; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '800 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.115), new THREE.MeshBasicMaterial({ map: t })); m.position.set(gx, 1.48, 3.835); m.rotation.y = Math.PI; R.add(m);
    }
    // 천장 조명
    const panel = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
    for (const [x, z] of [[-2.5, -2.8], [2.5, -2.8], [-2.5, 0.8], [2.5, 0.8], [0, 2.8]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), panel); p.rotation.x = Math.PI / 2; p.position.set(x, H - 0.06, z); R.add(p); }
    // 가게 이름 (뒷벽 위)
    const sign = canvasTex(512, 128, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#ff8a3a'); g.addColorStop(1, '#ffb84a');
      x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, w, h, 30); x.fill();
      x.fillStyle = '#fff'; x.font = '900 70px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✏️ 문구랜드', w / 2, h / 2 + 4);
    });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: sign, transparent: true })); sm.position.set(0, 2.52, -4.44); R.add(sm);
    // 코너 안내판
    for (const [txt, x, z, ry, col] of [['공책 · 노트', -2.6, -4.0, 0, '#3a8ae8'], ['미술용품', 2.6, -4.0, 0, '#ff6a8a'], ['장난감', -5.0, -1.8, Math.PI / 2, '#b04aff'], ['필기구', 5.0, -0.8, -Math.PI / 2, '#2aa84a'], ['추억의 간식', -1.7, 3.2, Math.PI, '#ff6a1a']]) {
      const t = canvasTex(256, 64, (x2, w, h) => { x2.fillStyle = col; x2.beginPath(); x2.roundRect(0, 0, w, h, 16); x2.fill(); x2.fillStyle = '#fff'; x2.font = '800 34px sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(txt, w / 2, h / 2 + 2); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, transparent: true }));
      m.position.set(x, x === -1.7 ? 1.18 : 2.42, z + (ry === 0 ? 0.02 : 0)); m.rotation.y = ry; R.add(m);
    }

    // ─ 상품 ─
    this.goodsMat = goodsMaterial();
    this.tagB = new GoodsBuilder();
    this.addSection('snote', { axis: 'z', u0: -5.25, u1: -0.1, fixed: -4.46, dir: 1, levels: BL, depth: 0.42, kind: 'st_note' });
    this.addSection('sart', { axis: 'z', u0: 0.1, u1: 5.25, fixed: -4.46, dir: 1, levels: BL, depth: 0.42, kind: 'st_art' });
    this.addSection('stoy', { axis: 'x', u0: -3.9, u1: 0.35, fixed: -5.45, dir: 1, levels: TL, depth: 0.42, kind: 'st_toy' });
    this.addSection('soffice', { axis: 'z', u0: -2.55, u1: 2.55, fixed: -2.23, dir: -1, levels: GL, depth: 0.36, kind: 'st_office' });
    this.addSection('snote', { axis: 'z', u0: -2.55, u1: 2.55, fixed: -2.17, dir: 1, levels: GL, depth: 0.36, kind: 'st_note' });
    this.addSection('sart', { axis: 'z', u0: -1.55, u1: 2.55, fixed: 0.07, dir: -1, levels: GL, depth: 0.36, kind: 'st_art' });
    this.addSection('soffice', { axis: 'z', u0: -1.55, u1: 2.55, fixed: 0.13, dir: 1, levels: GL, depth: 0.36, kind: 'st_office' });
    this.addSection('ssnack', { axis: 'z', u0: -2.55, u1: -0.85, fixed: 3.16, dir: -1, levels: SL, depth: 0.5, kind: 'st_snack' });
    this.addSection(null, { axis: 'x', u0: 0.95, u1: 3.45, fixed: -5.48, dir: 1, levels: [0.4, 0.8, 1.2, 1.6], depth: 0.3, kind: 'st_office' });
    this.addPegboard();
    R.add(new THREE.Mesh(this.tagB.build(), this.goodsMat));

    // 상호작용 구역
    const Z = (id, x0, z0, x1, z1, extra = {}) => this.zones.push({ id, x0, z0, x1, z1, ...extra });
    Z('shelf', -5.0, -3.98, 0, -3.0, { cat: 'snote', label: '공책·노트 선반', spot: [-2.5, -3.35] });
    Z('shelf', 0, -3.98, 5.0, -3.0, { cat: 'sart', label: '미술용품 선반', spot: [2.6, -3.35] });
    Z('shelf', -2.6, -3.0, 2.6, -2.62, { cat: 'soffice', label: '사무용품 코너', spot: [0.6, -3.35] });
    Z('shelf', -2.6, -1.78, 2.6, -1.06, { cat: 'snote', label: '공책 코너', spot: [0.6, -1.05] });
    Z('shelf', -2.6, -1.06, 2.6, -0.32, { cat: 'sart', label: '미술용품 코너', spot: [0.6, -1.05] });
    Z('shelf', -1.6, 0.52, 2.6, 1.3, { cat: 'soffice', label: '사무용품 코너', spot: [0.6, 1.9] });
    Z('shelf', 4.2, -3.9, 5.0, 2.4, { cat: 'spen', label: '필기구 걸이', spot: [4.1, -0.2] });
    Z('shelf', -5.0, -3.9, -4.0, 0.4, { cat: 'stoy', label: '장난감 선반', spot: [-4.2, -1.6] });
    Z('shelf', -2.7, 1.8, -0.7, 2.62, { cat: 'ssnack', label: '추억의 간식', spot: [-1.9, 1.5] });
    Z('counter', -3.7, 0.9, -2.7, 3.5);
    Z('gacha', 4.3, 3.0, 5.5, 3.83);
  }

  // 타공판: 고리에 걸린 블리스터 상품
  addPegboard() {
    const skus = ['pen3', 'mech', 'hili', 'eraser', 'scissors', 'tape', 'keyring'];
    const facings = [], hooks = new GB();
    hooks.setColor(0xb8bcc2);
    // 타공판 구멍 무늬
    const holes = canvasTex(128, 128, (x, w) => { x.fillStyle = '#ece4d4'; x.fillRect(0, 0, w, w); x.fillStyle = '#b8ad98'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 4, 0, 7); x.fill(); } }, true);
    holes.repeat.set(6.3 / 0.25, 1.8 / 0.25);
    const pb = new THREE.Mesh(new THREE.PlaneGeometry(6.3, 1.8), new THREE.MeshStandardMaterial({ map: holes, roughness: 0.9 }));
    pb.position.set(5.435, 1.3, -0.75); pb.rotation.y = -Math.PI / 2; this.root.add(pb);
    let k = 0;
    for (const y of this.pegRows) {
      let z = -3.75;
      while (z < 2.25) {
        const id = skus[(k++ * 5 + Math.floor(y * 7)) % skus.length];
        const { w, h, d } = skuSize(id);
        if (z + w > 2.3) break;
        const n = 3 + Math.floor(Math.random() * 3), items = [];
        const hy = y + 0.25 - h;   // 위쪽 구멍이 고리에 걸림
        for (let q = 0; q < n; q++) items.push({ id, lo: q < n - 1, x: 5.4 - (q + 0.5) * (d + 0.01), y: hy, z: z + w / 2, r: -Math.PI / 2 + (q === n - 1 ? (Math.random() - 0.5) * 0.08 : 0) });
        facings.push(items);
        hooks.addGeo(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 5).rotateZ(Math.PI / 2).translate(5.32, y + 0.24, z + w / 2));
        this.tagB.quad(5.2, y + 0.245, z + w / 2, -Math.PI / 2, 0.06, 0.03, tagUV(id));
        z += w + 0.05;
      }
    }
    this.buildFacings('spen', facings);
    this.root.add(new THREE.Mesh(hooks.build(), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.3 })));
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
    for (const n of this.npcs) {
      const dx = pos.x - n.pos.x, dz = pos.z - n.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.45 && d > 1e-4) { pos.x = n.pos.x + dx / d * 0.45; pos.z = n.pos.z + dz / d * 0.45; }
    }
    const inDoor = pos.x > STAT_DOOR.x0 + 0.05 + r && pos.x < STAT_DOOR.x1 - 0.05 - r;
    pos.x = Math.max(-W / 2 + r, Math.min(W / 2 - r, pos.x));
    pos.z = Math.max(-D / 2 + r, Math.min(inDoor ? D / 2 + 1.5 : D / 2 - 0.25, pos.z));
  }
  zoneAt(pos) {
    let best = null;
    for (const z of this.zones) if (pos.x >= z.x0 && pos.x <= z.x1 && pos.z >= z.z0 && pos.z <= z.z1) { best = z; if (z.id !== 'shelf') break; }
    return best;
  }
  updateWalls(camera) {
    for (const w of this.walls) {
      const [nx, nz] = w.userData.n;
      const dot = camera.position.x * nx + camera.position.z * nz;
      w.visible = dot < (nx ? W / 2 : D / 2) + 0.5;
    }
  }
  updateDoor(dt, pos) {
    const near = [pos, ...this.npcs.map(n => n.pos)].some(p => p.x > STAT_DOOR.x0 - 0.3 && p.x < STAT_DOOR.x1 + 0.3 && Math.abs(p.z - D / 2) < 1.3);
    this.doorOpen = THREE.MathUtils.clamp((this.doorOpen || 0) + (near ? dt * 3 : -dt * 2), 0, 1);
    this.doorPivot.rotation.y = -this.doorOpen * 1.45;
  }

  // ─ 사장님 · 손님 ─
  addOwner() {
    if (this.owner) return;
    this.owner = createPed({ skin: 0xe8c09a, hair: 0x6a6a6a, shirt: 0xffb84a, pants: 0x3a3a40, shoes: 0x2a2a2a, face: 'smile', hairStyle: 'short' });
    this.owner.root.position.set(-4.85, 0, 2.2); this.owner.root.rotation.y = Math.PI / 2;
    // 앞치마
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.36), new THREE.MeshStandardMaterial({ color: 0x3a6ad8, roughness: 0.6 }));
    apron.position.set(0, 0.98, 0.01); this.owner.root.add(apron);
    this.root.add(this.owner.root);
  }
  spawnCustomer(kid) {
    const p = createPed({
      skin: SKINS[Math.floor(Math.random() * SKINS.length)], hair: HAIRS[Math.floor(Math.random() * HAIRS.length)],
      shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)], pants: PANTS[Math.floor(Math.random() * PANTS.length)],
      shoes: SHOES[Math.floor(Math.random() * SHOES.length)], hairStyle: Math.random() < 0.5 ? (Math.random() < 0.5 ? 'long' : 'bun') : 'short',
      bag: kid ? [0xff4a8a, 0x3a8aff, 0xffd21a, 0x2aa84a][Math.floor(Math.random() * 4)] : (Math.random() < 0.3 ? 0x2a2a2a : null),
    });
    p.root.scale.setScalar(kid ? 0.68 + Math.random() * 0.08 : 0.95);
    p.root.position.set(STAT_DOOR.x, 0, D / 2 + 1.2);
    this.root.add(p.root);
    const shelves = ['B2', 'B1', 'B3', 'M2', 'M3', 'T', 'P', 'F3', 'F2'];
    const visits = []; for (let k = 0; k < 1 + Math.floor(Math.random() * 3); k++) visits.push(shelves[Math.floor(Math.random() * shelves.length)]);
    if (kid && Math.random() < 0.6) visits.push('G');
    const n = { p, pos: p.root.position, kid, visits, path: [[STAT_DOOR.x, D / 2 - 0.6]], node: 'D', state: 'enter', wait: 0 };
    this.npcs.push(n);
    return n;
  }
  goNode(n, target) {
    if (target === 'G') { n.path = pathBetween(n.node, 'D').map(k => NODES[k]); n.path.push([4.6, 3.4]); n.node = 'D'; return; }
    n.path = pathBetween(n.node, target).map(k => NODES[k]); n.node = target;
  }
  clearNpcs() { for (const n of [...this.npcs]) this.root.remove(n.p.root); this.npcs = []; }
  update(dt, playerPos, hours) {
    this.updateDoor(dt, playerPos);
    // 손님 수: 하교 시간에는 아이들이 많이 와요
    const kidTime = hours >= 13 && hours < 18, open = hours >= 8 && hours < 21;
    const want = !open ? 0 : kidTime ? 4 : hours < 9.5 ? 2 : 1;
    this.spawnT = (this.spawnT ?? 3) - dt;
    if (this.spawnT <= 0 && this.npcs.length < want) { this.spawnCustomer(kidTime && Math.random() < 0.85); this.spawnT = 6 + Math.random() * 8; }
    for (const n of [...this.npcs]) {
      let moving = false;
      if (n.path.length) {
        const [tx, tz] = n.path[0];
        const dx = tx - n.pos.x, dz = tz - n.pos.z, d = Math.hypot(dx, dz);
        const px = playerPos.x - n.pos.x, pz = playerPos.z - n.pos.z;
        const blocked = Math.hypot(px, pz) < 0.7 && (px * dx + pz * dz) > 0;
        if (!blocked) {
          const sp = (n.kid ? 1.35 : 1.1) * dt;
          if (d <= sp) { n.pos.x = tx; n.pos.z = tz; n.path.shift(); } else { n.pos.x += dx / d * sp; n.pos.z += dz / d * sp; moving = true; }
          const want2 = Math.atan2(dx, dz); let dh = want2 - n.p.root.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
          n.p.root.rotation.y += dh * Math.min(1, dt * 9);
        }
      }
      n.p.animate(dt, moving ? 1.2 : 0);
      if (n.path.length) continue;
      n.wait -= dt;
      if (n.wait > 0) continue;
      if (n.state === 'enter' || n.state === 'browse') {
        if (n.visits.length) {
          const v = n.visits.shift(); this.goNode(n, v); n.state = 'browse'; n.wait = 2 + Math.random() * 4;
        } else { n.state = 'pay'; this.goNode(n, 'C'); n.wait = 2.5; }
      } else if (n.state === 'pay') { n.p.root.rotation.y = -Math.PI / 2; n.state = 'leave'; n.wait = 2; }
      else if (n.state === 'leave') { this.goNode(n, 'D'); n.path.push([STAT_DOOR.x, D / 2 + 1.4]); n.state = 'out'; }
      else if (n.state === 'out') { this.root.remove(n.p.root); this.npcs.splice(this.npcs.indexOf(n), 1); }
    }
  }
}
// 진열 함수는 편의점과 같은 것을 씀
StatRoom.prototype.addSection = MartRoom.prototype.addSection;
StatRoom.prototype.buildFacings = MartRoom.prototype.buildFacings;
StatRoom.prototype.refreshStock = MartRoom.prototype.refreshStock;

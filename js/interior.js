import * as THREE from 'three';
import { GB } from './geo.js';
import * as T from './textures.js';
import { FURNITURE, HOMES } from './config.js';

const fMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.05 });
const screenMat = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.1, metalness: 0.6, emissive: 0x6a8ab8, emissiveIntensity: 0 });

// 가구 모델 (원점 = 바닥 중앙, +z가 앞)
export function furnitureGeo(id) {
  const b = new GB();
  const spec = FURNITURE.find(f => f.id === id);
  const w = spec.w, d = spec.d;
  const wood = 0x9a6b44, dark = 0x2a2a2c;
  switch (id) {
    case 'bed': case 'bed2': {
      b.setColor(0x6b4a30); b.cbox(0, 0.18, 0, w, 0.28, d);
      b.setColor(0x5a3a24); b.cbox(0, 0.55, -d / 2 + 0.05, w, 1.0, 0.1);
      b.setColor(0xf2f0ea); b.cbox(0, 0.42, 0.02, w - 0.06, 0.2, d - 0.14);
      b.setColor(id === 'bed2' ? 0x8aa0b8 : 0x6a8a9a); b.cbox(0, 0.535, 0.25, w - 0.02, 0.05, d * 0.62);
      b.setColor(0xffffff); b.cbox(-w / 4 + 0.02, 0.58, -d / 2 + 0.35, w / 2 - 0.12, 0.12, 0.38); if (w > 1.4) b.cbox(w / 4 - 0.02, 0.58, -d / 2 + 0.35, w / 2 - 0.12, 0.12, 0.38);
      break;
    }
    case 'fridge': {
      b.setColor(0xd8dcdf); b.cbox(0, 0.92, 0, w, 1.84, d);
      b.setColor(0x9aa0a6); b.cbox(0, 1.25, d / 2 + 0.005, w - 0.04, 0.012, 0.01);
      b.setColor(0x6a6e72); b.cbox(w / 2 - 0.08, 1.45, d / 2 + 0.03, 0.03, 0.4, 0.04); b.cbox(w / 2 - 0.08, 0.85, d / 2 + 0.03, 0.03, 0.4, 0.04);
      break;
    }
    case 'desk': {
      b.setColor(0xc9a27a); b.cbox(0, 0.74, 0, w, 0.04, d);
      b.setColor(0x333333); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cbox(sx * (w / 2 - 0.04), 0.36, sz * (d / 2 - 0.04), 0.04, 0.72, 0.04);
      b.setColor(0x222222); b.cbox(0.25, 0.77, -0.1, 0.36, 0.02, 0.25); b.setColor(0x777777); b.cbox(0.25, 0.9, -0.22, 0.36, 0.24, 0.01);
      b.setColor(0xe8e0d0); b.cbox(-0.35, 0.77, 0.05, 0.22, 0.03, 0.3);
      break;
    }
    case 'chair': {
      b.setColor(0x2a2a2a); b.cbox(0, 0.46, 0, 0.5, 0.06, 0.5); b.cbox(0, 0.8, -0.22, 0.48, 0.6, 0.05);
      b.setColor(0x777777); b.cbox(0, 0.22, 0, 0.05, 0.44, 0.05); b.cbox(0, 0.04, 0, 0.5, 0.04, 0.06); b.cbox(0, 0.04, 0, 0.06, 0.04, 0.5);
      break;
    }
    case 'sofa': {
      b.setColor(0x5c6a78); b.cbox(0, 0.22, 0.05, w, 0.3, d - 0.1);
      b.cbox(0, 0.6, -d / 2 + 0.12, w, 0.6, 0.24);
      b.cbox(-w / 2 + 0.1, 0.45, 0.02, 0.2, 0.36, d - 0.05); b.cbox(w / 2 - 0.1, 0.45, 0.02, 0.2, 0.36, d - 0.05);
      b.setColor(0x6c7a88); for (let k = -1; k <= 1; k++) b.cbox(k * (w - 0.4) / 3, 0.43, 0.1, (w - 0.45) / 3 - 0.02, 0.14, d - 0.35);
      b.setColor(0xd0a060); b.cbox(-w / 2 + 0.45, 0.62, -0.18, 0.4, 0.35, 0.12);
      break;
    }
    case 'table': {
      b.setColor(0xb07a4a); b.cbox(0, 0.74, 0, w, 0.05, d);
      b.setColor(0x8a5a34); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cbox(sx * (w / 2 - 0.08), 0.36, sz * (d / 2 - 0.08), 0.06, 0.72, 0.06);
      b.setColor(0xf2f2f2); b.cbox(0.3, 0.8, 0.1, 0.25, 0.06, 0.25); b.setColor(0x4a8a5a); b.cbox(-0.3, 0.86, -0.1, 0.12, 0.18, 0.12);
      break;
    }
    case 'tv': {
      b.setColor(0x3a3a3c); b.cbox(0, 0.25, 0, w, 0.5, d);
      b.setColor(0x101012); b.cbox(0, 0.52, 0, 0.3, 0.04, 0.2); b.cbox(0, 0.6, 0, 0.06, 0.15, 0.06);
      b.setColor(0x111111); b.cbox(0, 1.05, 0, w - 0.05, 0.85, 0.04);
      break;
    }
    case 'shelf': {
      b.setColor(0xb08a60); b.cbox(-w / 2 + 0.02, 0.9, 0, 0.04, 1.8, d); b.cbox(w / 2 - 0.02, 0.9, 0, 0.04, 1.8, d); b.cbox(0, 0.9, -d / 2 + 0.01, w, 1.8, 0.02);
      for (let k = 0; k < 5; k++) b.cbox(0, 0.02 + k * 0.44, 0, w, 0.03, d);
      const cols = [0x8a2a2a, 0x2a4a7a, 0xd8c070, 0x2a6a4a, 0x444444, 0xc06030, 0xe0e0e0];
      for (let k = 0; k < 4; k++) { let x = -w / 2 + 0.08; while (x < w / 2 - 0.12) { const bw = 0.03 + Math.random() * 0.04, bh = 0.24 + Math.random() * 0.12; b.setColor(cols[Math.floor(Math.random() * cols.length)]); b.cbox(x + bw / 2, 0.05 + k * 0.44 + bh / 2, 0, bw, bh, d * 0.8); x += bw + 0.005; if (Math.random() < 0.08) x += 0.15; } }
      break;
    }
    case 'plant': {
      b.setColor(0xd8d0c4); b.addGeo(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 12).translate(0, 0.2, 0));
      b.setColor(0x2f6a34);
      for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, r = 0.18 + (k % 3) * 0.06; const g = new THREE.SphereGeometry(0.17, 6, 4); g.scale(1.2, 0.35, 0.8); g.rotateZ(0.5); g.rotateY(a); g.translate(Math.cos(a) * r, 0.75 + (k % 4) * 0.15, Math.sin(a) * r); b.addGeo(g); }
      b.setColor(0x3a5a2a); b.addGeo(new THREE.CylinderGeometry(0.015, 0.02, 0.6, 5).translate(0, 0.65, 0));
      break;
    }
    case 'lamp': {
      b.setColor(0x222222); b.addGeo(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 16).translate(0, 0.015, 0)); b.addGeo(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6).translate(0, 0.76, 0));
      b.setColor(0xf6ead0); b.addGeo(new THREE.CylinderGeometry(0.14, 0.22, 0.3, 16, 1, true).translate(0, 1.55, 0));
      break;
    }
    case 'rug': {
      b.setColor(0xb8a890); b.cbox(0, 0.006, 0, w, 0.012, d);
      b.setColor(0x8a5a4a); b.cbox(0, 0.013, 0, w - 0.3, 0.004, d - 0.3);
      b.setColor(0xd8c8a8); b.cbox(0, 0.016, 0, w - 0.6, 0.004, d - 0.6);
      break;
    }
    case 'pc': {
      b.setColor(0x1a1a1c); b.cbox(0, 0.74, 0, w, 0.04, d);
      for (const sx of [-1, 1]) b.cbox(sx * (w / 2 - 0.05), 0.36, 0, 0.06, 0.72, d - 0.1);
      b.setColor(0x0a0a0a); b.cbox(-0.25, 1.05, -0.22, 0.72, 0.42, 0.03); b.cbox(0.42, 1.0, -0.2, 0.5, 0.32, 0.03);
      b.setColor(0x2a2a2a); b.cbox(-0.25, 0.8, -0.22, 0.04, 0.14, 0.04); b.cbox(0, 0.765, 0.1, 0.45, 0.02, 0.14);
      b.setColor(0x3a2a5a); b.cbox(w / 2 - 0.2, 0.25, 0, 0.22, 0.48, 0.45);
      break;
    }
    case 'wardrobe': {
      b.setColor(0xe6e0d4); b.cbox(0, 1.0, 0, w, 2.0, d);
      b.setColor(0xbab2a4); b.cbox(0, 1.0, d / 2 + 0.003, 0.01, 1.96, 0.01);
      b.setColor(0x8a8a8a); b.cbox(-0.06, 1.0, d / 2 + 0.02, 0.02, 0.3, 0.02); b.cbox(0.06, 1.0, d / 2 + 0.02, 0.02, 0.3, 0.02);
      break;
    }
    case 'piano': {
      b.setColor(0x111111); b.cbox(0, 0.65, -0.1, w, 1.3, d - 0.2);
      b.cbox(0, 0.68, d / 2 - 0.12, w, 0.06, 0.25);
      b.setColor(0xf6f6f2); b.cbox(0, 0.72, d / 2 - 0.12, w - 0.1, 0.02, 0.15);
      b.setColor(0x111111); for (let k = 0; k < 36; k++) if ([1, 3, 6, 8, 10].includes(k % 12)) b.cbox(-w / 2 + 0.05 + k * (w - 0.1) / 36, 0.74, d / 2 - 0.16, 0.02, 0.02, 0.08);
      b.setColor(0x222222); b.cbox(0, 0.25, d / 2 + 0.25, 0.7, 0.5, 0.35);
      break;
    }
  }
  return b.build();
}

const geoCache = {};
function getGeo(id) { return geoCache[id] || (geoCache[id] = furnitureGeo(id)); }

export const INTERACT = {
  bed: '잠자기', bed2: '잠자기', fridge: '냉장고 열기', tv: 'TV 보기', piano: '피아노 치기', pc: '게임하기', desk: '자격증 공부', sofa: '소파에서 쉬기', shelf: '책 읽기',
};

export class Interior {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b2027);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.items = [];
    this.hemi = new THREE.HemisphereLight(0xfff4e6, 0x504438, 0.7);
    this.sunL = new THREE.DirectionalLight(0xfff0dc, 1.2);
    this.sunL.castShadow = true; this.sunL.shadow.mapSize.set(1024, 1024);
    const sc = this.sunL.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 0.5; sc.far = 40;
    this.sunL.shadow.bias = -0.0005;
    this.ceil = new THREE.PointLight(0xffd9a8, 0, 18, 1.6);
    this.scene.add(this.hemi, this.sunL, this.sunL.target, this.ceil);
    this.lampLights = [];
    this.floorTex = T.floorWood();
  }

  build(homeId, placed) {
    this.root.clear();
    this.items = [];
    const h = HOMES.find(x => x.id === homeId);
    this.home = h;
    const W = h.w, D = h.d, H = 2.7;
    this.W = W; this.D = D;
    this.floorTex.repeat.set(1, 1);
    const floor = new GB(); floor.top(-W / 2, -D / 2, W / 2, D / 2, 0, 1.6, 1.6);
    const fm = new THREE.Mesh(floor.build(), new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.55 }));
    fm.receiveShadow = true; this.root.add(fm);
    this.floor = fm;
    const wallColor = homeId === 'pent' ? '#e9e6e0' : homeId === 'apt' ? '#efe8dc' : '#e6ded0';
    const wallMat = new THREE.MeshStandardMaterial({ map: T.wallpaper(wallColor), roughness: 0.9 });
    this.walls = [];
    // 벽: [p, q, 바깥 방향]
    const winW = homeId === 'pent' ? W - 1 : homeId === 'apt' ? 4 : 2;
    const defs = [
      { name: 'back', n: [0, -1], build: (g) => this.wallWithWindow(g, W, H, -D / 2, winW, homeId === 'pent' ? 0.15 : 0.9, homeId === 'pent' ? 2.6 : 2.2) },
      { name: 'front', n: [0, 1], build: (g) => { g.wall(-W / 2, D / 2, W / 2 - 1.6, D / 2, 0, H); g.wall(W / 2 - 0.6, D / 2, W / 2, D / 2, 0, H); g.wall(W / 2 - 1.6, D / 2, W / 2 - 0.6, D / 2, 2.1, H); } },
      { name: 'left', n: [-1, 0], build: (g) => g.wall(-W / 2, -D / 2, -W / 2, D / 2, 0, H) },
      { name: 'right', n: [1, 0], build: (g) => g.wall(W / 2, D / 2, W / 2, -D / 2, 0, H) },
    ];
    // 벽은 안쪽에서 보이도록: 바깥 노멀 방향과 반대로 그림 (안쪽 면)
    for (const def of defs) {
      const g = new GB();
      def.build(g);
      const geo = g.build();
      // 안쪽을 보게 뒤집기
      const idx = geo.index.array; for (let k = 0; k < idx.length; k += 3) { const t = idx[k]; idx[k] = idx[k + 2]; idx[k + 2] = t; }
      const nor = geo.attributes.normal; for (let k = 0; k < nor.count; k++) nor.setXYZ(k, -nor.getX(k), -nor.getY(k), -nor.getZ(k));
      const m = new THREE.Mesh(geo, wallMat); m.receiveShadow = true;
      m.userData.n = def.n;
      this.root.add(m); this.walls.push(m);
    }
    // 걸레받이
    const trim = new GB(); trim.setColor(0xf6f4ef);
    trim.cbox(0, 0.05, -D / 2 + 0.01, W, 0.1, 0.02); trim.cbox(-W / 2 + 0.01, 0.05, 0, 0.02, 0.1, D); trim.cbox(W / 2 - 0.01, 0.05, 0, 0.02, 0.1, D);
    // 주방 (왼쪽 벽 앞)
    const kx = -W / 2 + 0.32, kz0 = D / 2 - 3.5;
    trim.setColor(0xf2f0ec); trim.cbox(kx, 0.45, kz0 + 1.2, 0.62, 0.9, 2.4);
    trim.setColor(0x3a3c40); trim.cbox(kx, 0.92, kz0 + 1.2, 0.64, 0.04, 2.42);
    trim.setColor(0xb0b4b8); trim.cbox(kx + 0.02, 0.93, kz0 + 0.6, 0.4, 0.02, 0.5);
    trim.setColor(0x111111); trim.cbox(kx + 0.02, 0.945, kz0 + 1.75, 0.45, 0.01, 0.55);
    trim.setColor(0xf2f0ec); trim.cbox(-W / 2 + 0.18, 1.85, kz0 + 1.2, 0.35, 0.7, 2.4);
    // 문
    trim.setColor(0x6a4a30); trim.cbox(W / 2 - 1.1, 1.05, D / 2 - 0.02, 0.95, 2.1, 0.05);
    trim.setColor(0xc0c0c0); trim.cbox(W / 2 - 0.75, 1.0, D / 2 - 0.06, 0.12, 0.03, 0.03);
    const tm = new THREE.Mesh(trim.build(), fMat); tm.receiveShadow = true; tm.castShadow = true; this.root.add(tm);
    this.kitchenBox = { x0: kx - 0.32, x1: kx + 0.32, z0: kz0, z1: kz0 + 2.4 };
    this.door = { x: W / 2 - 1.1, z: D / 2 - 0.6 };
    // 창밖 풍경
    const view = this.makeView(homeId, W);
    view.position.set(0, 0, -D / 2 - 0.35);
    this.root.add(view);
    this.view = view;
    // 천장등
    this.ceil.position.set(0, 2.5, 0);
    this.sunL.position.set(-3, 8, -D / 2 - 6);
    this.sunL.target.position.set(0, 0, 0);
    for (const p of placed) this.addItem(p);
    this.lampLights.forEach(l => this.scene.remove(l));
    this.lampLights = [];
  }

  wallWithWindow(g, W, H, z, ww, y0, y1) {
    const x0 = -ww / 2, x1 = ww / 2;
    g.wall(W / 2, z, x1, z, 0, H);
    g.wall(x0, z, -W / 2, z, 0, H);
    g.wall(x1, z, x0, z, 0, y0);
    g.wall(x1, z, x0, z, y1, H);
    // 창틀
    const f = new GB(); f.setColor(0x2a2c30);
    f.cbox(0, y0, z, ww, 0.06, 0.12); f.cbox(0, y1, z, ww, 0.06, 0.12);
    f.cbox(x0, (y0 + y1) / 2, z, 0.06, y1 - y0, 0.12); f.cbox(x1, (y0 + y1) / 2, z, 0.06, y1 - y0, 0.12);
    for (let x = x0 + 1.5; x < x1 - 0.5; x += 1.5) f.cbox(x, (y0 + y1) / 2, z, 0.04, y1 - y0, 0.08);
    const m = new THREE.Mesh(f.build(), fMat); this.root.add(m);
    // 유리
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, y1 - y0), new THREE.MeshStandardMaterial({ color: 0x9ab0c0, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.5 }));
    glass.position.set(0, (y0 + y1) / 2, z); this.root.add(glass);
    this.windowRect = { x0, x1, y0, y1 };
  }

  makeView(homeId, W) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const x = c.getContext('2d');
    const ce = document.createElement('canvas'); ce.width = 1024; ce.height = 512;
    const xe = ce.getContext('2d');
    x.clearRect(0, 0, 1024, 512); xe.fillStyle = '#000'; xe.fillRect(0, 0, 1024, 512);
    const base = homeId === 'pent' ? 300 : homeId === 'apt' ? 200 : 120;
    for (let layer = 0; layer < 3; layer++) {
      let px = -20;
      while (px < 1044) {
        const bw = 30 + Math.random() * 70, bh = (base - layer * 40) * (0.4 + Math.random() * 0.9);
        const shade = 60 + layer * 25;
        x.fillStyle = `rgb(${shade},${shade + 8},${shade + 18})`;
        x.fillRect(px, 512 - bh - layer * 10, bw, bh + layer * 10);
        for (let wy = 512 - bh; wy < 500; wy += 9) for (let wx = px + 4; wx < px + bw - 4; wx += 7) {
          x.fillStyle = 'rgba(160,190,210,0.25)'; x.fillRect(wx, wy, 4, 5);
          if (Math.random() < 0.3) { xe.fillStyle = Math.random() < 0.7 ? '#ffd9a0' : '#cfe4ff'; xe.fillRect(wx, wy, 4, 5); }
        }
        px += bw + Math.random() * 6;
      }
    }
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    const em = new THREE.CanvasTexture(ce); em.colorSpace = THREE.SRGBColorSpace;
    this.viewSkyMat = new THREE.MeshBasicMaterial({ color: 0x88aacc });
    this.viewMat = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, transparent: true, roughness: 1 });
    const g = new THREE.Group();
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(W, 2.7), this.viewSkyMat); sky.position.set(0, 1.35, -0.05); g.add(sky);
    const city = new THREE.Mesh(new THREE.PlaneGeometry(W, W * 0.5), this.viewMat); city.position.y = 2.2 - W * 0.25; g.add(city);
    city.renderOrder = 1;
    return g;
  }

  addItem(p) {
    const mesh = new THREE.Mesh(getGeo(p.id), fMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.rot * Math.PI / 2;
    mesh.userData.item = p;
    this.root.add(mesh);
    if (p.id === 'tv') {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), screenMat);
      scr.position.set(0, 1.05, 0.025); mesh.add(scr);
    }
    this.items.push(mesh);
    return mesh;
  }
  removeItem(mesh) {
    this.root.remove(mesh);
    this.items.splice(this.items.indexOf(mesh), 1);
  }

  footprint(p) {
    const s = FURNITURE.find(f => f.id === p.id);
    const rot = ((p.rot % 2) + 2) % 2;
    const w = rot ? s.d : s.w, d = rot ? s.w : s.d;
    return { x0: p.x - w / 2, x1: p.x + w / 2, z0: p.z - d / 2, z1: p.z + d / 2 };
  }
  clampItem(p) {
    const f = this.footprint(p);
    const hw = (f.x1 - f.x0) / 2, hd = (f.z1 - f.z0) / 2;
    p.x = Math.max(-this.W / 2 + hw + 0.02, Math.min(this.W / 2 - hw - 0.02, p.x));
    p.z = Math.max(-this.D / 2 + hd + 0.02, Math.min(this.D / 2 - hd - 0.02, p.z));
  }

  colliders() {
    const out = [];
    for (const m of this.items) {
      const p = m.userData.item;
      if (p.id === 'rug') continue;
      out.push(this.footprint(p));
    }
    out.push(this.kitchenBox);
    return out;
  }

  collide(pos, r) {
    for (const c of this.colliders()) {
      const nx = Math.max(c.x0, Math.min(pos.x, c.x1)), nz = Math.max(c.z0, Math.min(pos.z, c.z1));
      const dx = pos.x - nx, dz = pos.z - nz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-4) { pos.z = c.z1 + r; continue; }
        pos.x = nx + dx / d * r; pos.z = nz + dz / d * r;
      }
    }
    pos.x = Math.max(-this.W / 2 + r, Math.min(this.W / 2 - r, pos.x));
    pos.z = Math.max(-this.D / 2 + r, Math.min(this.D / 2 - r, pos.z));
  }

  nearest(pos) {
    let best = null, bd = 1.5;
    for (const m of this.items) {
      const p = m.userData.item;
      if (!INTERACT[p.id]) continue;
      const f = this.footprint(p);
      const nx = Math.max(f.x0, Math.min(pos.x, f.x1)), nz = Math.max(f.z0, Math.min(pos.z, f.z1));
      const d = Math.hypot(pos.x - nx, pos.z - nz);
      if (d < bd) { bd = d; best = m; }
    }
    if (Math.hypot(pos.x - this.door.x, pos.z - this.door.z) < 1.1 && (!best || bd > 0.5)) return 'door';
    return best;
  }

  update(night, skyTop, skyHorizon, camera) {
    this.viewSkyMat.color.copy(skyHorizon).lerp(skyTop, 0.4);
    this.viewMat.emissiveIntensity = night * 1.4;
    this.viewMat.color.setScalar(1 - night * 0.8);
    this.ceil.intensity = 0.4 + night * 9;
    this.sunL.intensity = (1 - night) * 2.2 + 0.05;
    this.hemi.intensity = 0.35 + (1 - night) * 0.5;
    screenMat.emissiveIntensity = this.tvOn ? 1.2 : 0;
    // 카메라 쪽 벽은 숨김 (인형의 집 시점)
    if (camera) {
      for (const w of this.walls) {
        const [nx, nz] = w.userData.n;
        const dot = camera.position.x * nx + camera.position.z * nz;
        const lim = nx ? this.W / 2 : this.D / 2;
        w.visible = dot < lim + 0.5;
      }
    }
  }

  // 스탠드 조명 실제 광원
  refreshLamps() {
    this.lampLights.forEach(l => this.scene.remove(l));
    this.lampLights = [];
    for (const m of this.items) {
      if (m.userData.item.id !== 'lamp' || this.lampLights.length >= 2) continue;
      const l = new THREE.PointLight(0xffc888, 3, 6, 1.8);
      l.position.set(m.position.x, 1.5, m.position.z);
      this.scene.add(l); this.lampLights.push(l);
    }
  }
}

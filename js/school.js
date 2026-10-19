import * as THREE from 'three';
import { GB } from './geo.js';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';

// ───────── 학교 실내 (한 층) ─────────
// x -13..13, z -8..8 · 앞쪽(+z)이 복도·현관
// 방: A 교실/강의실 (x<-4.5) · B 교무실/도서관 (가운데) · C 급식실/학생식당 (x>4.5)
const W = 26, D = 16, H = 3.0;
export const LEVEL_NAME = { elem: '초등학교', middle: '중학교', high: '고등학교', univ: '대학교' };

function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function label(text, bg = '#1f3a5a', w = 512, h = 96) {
  return tex(w, h, (x) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = `800 ${h * 0.5}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 3); });
}
export function emojiSprite(emoji, size = 0.5) {
  const t = tex(128, 128, (x) => { x.fillStyle = 'rgba(15,20,28,0.85)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.font = '70px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emoji, 64, 70); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.setScalar(size); s.renderOrder = 10;
  return s;
}

export class SchoolRoom {
  constructor() {
    this.W = W; this.D = D;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b2027);
    this.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.1);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.3);
    this.sun.position.set(-6, 14, -12); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(hemi, this.sun, this.sun.target);
    this.level = null;
  }

  build(level) {
    if (this.root) this.scene.remove(this.root);
    this.level = level;
    const R = this.root = new THREE.Group(); this.scene.add(R);
    this.colliders = []; this.walls = []; this.zones = []; this.seats = []; this.npcs = []; this.icons = [];
    const univ = level === 'univ';
    // 바닥: 교실 나무, 복도 타일
    const wood = tex(256, 256, (x, w) => { for (let i = 0; i < 8; i++) { const v = Math.random() * 16; x.fillStyle = `rgb(${176 + v},${136 + v},${92 + v})`; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(60,40,20,0.35)'; x.fillRect(0, i * 32, w, 1.5); x.fillRect((i * 83) % 220 + 18, i * 32, 1.5, 32); } }, true);
    wood.repeat.set(6, 4);
    const tile = tex(128, 128, (x, w) => { x.fillStyle = '#d6d8d4'; x.fillRect(0, 0, w, w); x.fillStyle = '#c4c7c2'; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64); }, true);
    tile.repeat.set(W / 1.2, 4.5 / 1.2);
    const f1 = new THREE.Mesh(new THREE.PlaneGeometry(W, 11.5), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 }));
    f1.rotation.x = -Math.PI / 2; f1.position.set(0, 0, -2.25); f1.receiveShadow = true;
    const f2 = new THREE.Mesh(new THREE.PlaneGeometry(W, 4.5), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.3 }));
    f2.rotation.x = -Math.PI / 2; f2.position.set(0, 0, 5.75); f2.receiveShadow = true;
    R.add(f1, f2);

    // 바깥 벽 (뒤·좌·우, 뒤쪽은 창문)
    const wallMat = new THREE.MeshStandardMaterial({ color: univ ? 0xe8e2d6 : 0xf0ece2, roughness: 0.9 });
    const mkWall = (px, pz, qx, qz, y0, y1, n) => {
      const g = new GB(); g.wall(px, pz, qx, qz, y0, y1);
      const geo = g.build();
      const idx = geo.index.array; for (let k = 0; k < idx.length; k += 3) { const t = idx[k]; idx[k] = idx[k + 2]; idx[k + 2] = t; }
      const nor = geo.attributes.normal; for (let k = 0; k < nor.count; k++) nor.setXYZ(k, -nor.getX(k), -nor.getY(k), -nor.getZ(k));
      const m = new THREE.Mesh(geo, wallMat); m.receiveShadow = true; m.userData.n = n;
      R.add(m); this.walls.push(m); return m;
    };
    // 뒷벽: 창문 띠 (0.9~2.3)
    const back = new THREE.Group(); back.userData.n = [0, -1];
    for (const [y0, y1] of [[0, 0.9], [2.3, H]]) { const m = mkWall(W / 2, -D / 2, -W / 2, -D / 2, y0, y1, [0, -1]); this.walls.pop(); R.remove(m); back.add(m); }
    const fr = new GB(); fr.setColor(0xd0d4d8);
    for (let x = -W / 2; x <= W / 2; x += 2.6) fr.cbox(x, 1.6, -D / 2, 0.1, 1.4, 0.12);
    fr.cbox(0, 0.9, -D / 2 + 0.08, W, 0.08, 0.3);
    back.add(new THREE.Mesh(fr.build(), this.vc));
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.4), new THREE.MeshBasicMaterial({ color: 0xbfe0f6 }));
    sky.position.set(0, 1.6, -D / 2 - 0.05); back.add(sky); this.skyPlane = sky;
    R.add(back); this.walls.push(back);
    mkWall(-W / 2, -D / 2, -W / 2, D / 2, 0, H, [-1, 0]);
    mkWall(W / 2, D / 2, W / 2, -D / 2, 0, H, [1, 0]);
    // 정면 (유리 현관)
    const front = new THREE.Group(); front.userData.n = [0, 1];
    const glass = new THREE.MeshStandardMaterial({ color: 0xb8d4e0, transparent: true, opacity: 0.18, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glass); fp.position.set(0, H / 2, D / 2); front.add(fp);
    R.add(front); this.walls.push(front);

    const fx = new GB();
    // 칸막이 벽 (낮게 잘린 벽 · 위에서 안이 보이게)
    const ph = 1.15;
    const part = (x0, z0, x1, z1) => { fx.setColor(univ ? 0xd8d0c0 : 0xe6e0d0); fx.box(x0, 0, z0, x1, ph, z1); fx.setColor(0x8a7a66); fx.box(x0, ph, z0, x1, ph + 0.05, z1); this.colliders.push({ x0, x1, z0, z1 }); };
    const dz = 3.5, t = 0.12;
    const doors = [-8.75, 0, 8.75];
    let x = -W / 2;
    for (const d of doors) { part(x, dz - t, d - 0.9, dz + t); x = d + 0.9; }
    part(x, dz - t, W / 2, dz + t);
    part(-4.5 - t, -D / 2, -4.5 + t, dz); part(4.5 - t, -D / 2, 4.5 + t, dz);
    // 문틀
    for (const d of doors) { fx.setColor(0x6a5038); fx.box(d - 0.95, 0, dz - 0.15, d - 0.85, 2.1, dz + 0.15); fx.box(d + 0.85, 0, dz - 0.15, d + 0.95, 2.1, dz + 0.15); }

    // ─ 방 A: 교실 / 강의실 ─
    const kid = level === 'elem';
    fx.setColor(0x2a4a3a); fx.box(-W / 2, 0.9, -5.2, -W / 2 + 0.06, 2.3, 0.7);          // 칠판
    fx.setColor(0x8a6a4a); fx.box(-W / 2, 0.85, -5.3, -W / 2 + 0.15, 0.92, 0.8);
    fx.setColor(0x222222); fx.box(-W / 2 + 0.05, 2.35, -2.6, -W / 2 + 0.12, 2.75, -1.2); // TV
    fx.setColor(0xb08a60); fx.box(-11.8, 0, -3.2, -11.0, 0.8, -1.3);                  // 교탁
    this.colliders.push({ x0: -11.8, x1: -11.0, z0: -3.2, z1: -1.3 });
    fx.setColor(0x4a6a8a); fx.box(-12.2, 0, 1.6, -11.2, 1.2, 2.3);                    // 사물함
    const rows = univ ? [-10, -8.4, -6.8, -5.4] : [-9.8, -8.4, -7.0, -5.6];
    const cols = univ ? [-6.6, -5.2, -3.8, -2.4, -1.0, 0.4, 1.8] : [-6.6, -5.1, -3.6, -2.1, -0.6, 0.9, 2.4];
    const dh = kid ? 0.62 : 0.74, cw = 0.6, cd = 0.42;
    for (const rx of rows) for (const cz of cols) {
      if (univ && rx === -5.4 && cz > 1) continue;
      fx.setColor(univ ? 0x9a7a5a : 0xc8a878); fx.box(rx - cd / 2, dh - 0.03, cz - cw / 2, rx + cd / 2, dh, cz + cw / 2);
      fx.setColor(0x6a6e74); fx.box(rx - 0.03, 0, cz - 0.03, rx + 0.03, dh - 0.03, cz + 0.03);
      // 의자
      fx.setColor(univ ? 0x2a3a5a : 0x3a6a9a); fx.box(rx + 0.28, dh * 0.6, cz - 0.2, rx + 0.62, dh * 0.6 + 0.04, cz + 0.2);
      fx.box(rx + 0.6, dh * 0.6, cz - 0.2, rx + 0.64, dh * 0.6 + 0.4, cz + 0.2);
      this.colliders.push({ x0: rx - cd / 2, x1: rx + cd / 2, z0: cz - cw / 2, z1: cz + cw / 2 });
      this.seats.push({ x: rx + 0.45, z: cz, desk: [rx, cz], taken: false });
    }
    // 교실 이름판
    const cname = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.28), new THREE.MeshBasicMaterial({ map: label(univ ? '강의실 301' : kid ? '3학년 2반' : '2학년 3반') }));
    cname.position.set(-8.75, 2.25, dz + 0.14); R.add(cname);

    // ─ 방 B: 교무실 / 도서관 ─
    this.myDesk = null;
    if (!univ) {
      for (const [gx, gz] of [[-1.6, -5.6], [1.6, -5.6], [-1.6, -1.6], [1.6, -1.6]]) {
        for (const [ox, oz] of [[-0.75, -0.42], [0.75, -0.42], [-0.75, 0.42], [0.75, 0.42]]) {
          const x0 = gx + ox, z0 = gz + oz;
          fx.setColor(0xe0dcd2); fx.box(x0 - 0.7, 0.72, z0 - 0.4, x0 + 0.7, 0.75, z0 + 0.4);
          fx.setColor(0x9a9ea4); fx.box(x0 - 0.68, 0, z0 - 0.38, x0 + 0.68, 0.72, z0 - 0.3);
          fx.setColor(0x15171a); fx.box(x0 - 0.25, 0.75, z0 - 0.05 * Math.sign(oz) - 0.03, x0 + 0.25, 1.1, z0 - 0.05 * Math.sign(oz) + 0.03);
          fx.setColor(0xf2f2f2); fx.box(x0 + 0.3, 0.75, z0 - 0.1, x0 + 0.6, 0.8, z0 + 0.15);
        }
        this.colliders.push({ x0: gx - 1.5, x1: gx + 1.5, z0: gz - 0.85, z1: gz + 0.85 });
      }
      this.myDesk = { x: -2.35, z: -0.6 };
      fx.setColor(0xd8d8d2); fx.box(-4.3, 0, -7.9, 4.3, 1.9, -7.4);                  // 캐비닛
      fx.setColor(0x6a6e74); fx.box(3.0, 0, 1.6, 4.2, 1.1, 2.5);                     // 복사기
      this.colliders.push({ x0: -4.3, x1: 4.3, z0: -8, z1: -7.4 }, { x0: 3, x1: 4.2, z0: 1.6, z1: 2.5 });
      const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.28), new THREE.MeshBasicMaterial({ map: label('교무실') })); bn.position.set(0, 2.25, dz + 0.14); R.add(bn);
    } else {
      const cols2 = [0xa02a2a, 0x2a4a8a, 0x2a6a3a, 0xd0a030, 0x5a3a7a, 0x6a4a2a, 0xe0e0e0];
      for (const sz of [-7.2, -5.4, -3.6]) {
        fx.setColor(0x8a6a48); fx.box(-3.8, 0, sz - 0.25, 3.8, 1.9, sz + 0.25);
        for (let k = 0; k < 4; k++) for (let bx = -3.7; bx < 3.6; bx += 0.06 + Math.random() * 0.04) {
          fx.setColor(cols2[Math.floor(Math.random() * cols2.length)]);
          const bh = 0.24 + Math.random() * 0.12;
          fx.box(bx, 0.08 + k * 0.45, sz - 0.27, bx + 0.05, 0.08 + k * 0.45 + bh, sz + 0.27);
        }
        this.colliders.push({ x0: -3.8, x1: 3.8, z0: sz - 0.27, z1: sz + 0.27 });
      }
      for (const tx of [-2, 2]) {
        fx.setColor(0xb88a5a); fx.box(tx - 1.2, 0.72, -1.6, tx + 1.2, 0.76, 0.2);
        fx.setColor(0x6a5038); fx.box(tx - 1.15, 0, -1.5, tx - 1.05, 0.72, 0.1); fx.box(tx + 1.05, 0, -1.5, tx + 1.15, 0.72, 0.1);
        fx.setColor(0xf2e6c0); fx.box(tx - 0.9, 0.76, -0.9, tx + 0.9, 0.78, -0.5);
        this.colliders.push({ x0: tx - 1.2, x1: tx + 1.2, z0: -1.6, z1: 0.2 });
      }
      const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.28), new THREE.MeshBasicMaterial({ map: label('도서관', '#4a3a2a') })); bn.position.set(0, 2.25, dz + 0.14); R.add(bn);
      // 행정 창구 (복도)
      fx.setColor(0xe8e2d6); fx.box(-6, 0, 4.0, -3.4, 1.05, 4.6);
      fx.setColor(0x6a5038); fx.box(-6.05, 1.05, 3.95, -3.35, 1.1, 4.65);
      this.colliders.push({ x0: -6.05, x1: -3.35, z0: 3.9, z1: 4.65 });
      const an = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.28), new THREE.MeshBasicMaterial({ map: label('행정실 · 학사', '#1a2a5a') })); an.position.set(-4.7, 2.0, 3.64); R.add(an);
    }

    // ─ 방 C: 급식실 / 학생식당 ─
    fx.setColor(0xc8ccd0); fx.box(12.0, 0, -7.5, 13, 0.95, 2.5);
    fx.setColor(0xa8acb0); fx.box(11.9, 0.95, -7.5, 13, 1.0, 2.5);
    const foodC = [0xf2f0ea, 0xd04a2a, 0x3a8a3a, 0xe0b040, 0x8a5a3a];
    for (let k = 0; k < 6; k++) { fx.setColor(foodC[k % foodC.length]); fx.box(12.2, 1.0, -6.8 + k * 1.4, 12.8, 1.08, -6.0 + k * 1.4); }
    fx.setColor(0xe8e8e8); fx.box(11.0, 0, 1.4, 11.8, 1.0, 2.4);                       // 식판대
    this.colliders.push({ x0: 11.9, x1: 13, z0: -7.5, z1: 2.5 }, { x0: 11, x1: 11.8, z0: 1.4, z1: 2.4 });
    this.cafSeats = [];
    for (const tz of [-6.2, -3.7, -1.2]) {
      fx.setColor(univ ? 0xd8c8a8 : 0xe8e8e2); fx.box(5.6, 0.72, tz - 0.45, 10.4, 0.76, tz + 0.45);
      fx.setColor(0x8a8e92); fx.box(5.8, 0, tz - 0.05, 10.2, 0.72, tz + 0.05);
      for (let sx = 6.0; sx < 10.3; sx += 0.8) for (const s of [-1, 1]) { fx.setColor(0x4a7aaa); fx.box(sx - 0.17, 0.42, tz + s * 0.75 - 0.17, sx + 0.17, 0.46, tz + s * 0.75 + 0.17); this.cafSeats.push({ x: sx, z: tz + s * 0.75, face: s > 0 ? Math.PI : 0 }); }
      this.colliders.push({ x0: 5.6, x1: 10.4, z0: tz - 0.45, z1: tz + 0.45 });
    }
    const cn = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.28), new THREE.MeshBasicMaterial({ map: label(univ ? '학생식당' : '급식실', '#7a3a1a') })); cn.position.set(8.75, 2.25, dz + 0.14); R.add(cn);
    // 메뉴판
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: tex(512, 256, (x, w, h) => { x.fillStyle = '#20302a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffe7a0'; x.font = '700 34px sans-serif'; x.fillText(univ ? '오늘의 학식 4,500원' : '오늘의 급식', 24, 52); x.fillStyle = '#fff'; x.font = '500 28px sans-serif'; ['잡곡밥 · 미역국', '제육볶음 · 계란말이', '배추김치 · 요구르트'].forEach((t, i) => x.fillText(t, 24, 110 + i * 46)); }) }));
    menu.position.set(W / 2 - 0.02, 1.9, -2.5); menu.rotation.y = -Math.PI / 2; R.add(menu);

    // ─ 복도 ─
    if (!univ) {
      fx.setColor(0x8a9aaa); fx.box(-8, 0, 7.4, -2.2, 1.4, 7.95);                     // 신발장
      for (let k = 0; k < 18; k++) { fx.setColor(0x6a7a8a); fx.box(-7.9 + (k % 9) * 0.64, 0.2 + Math.floor(k / 9) * 0.6, 7.38, -7.36 + (k % 9) * 0.64, 0.7 + Math.floor(k / 9) * 0.6, 7.4); }
      this.colliders.push({ x0: -8, x1: -2.2, z0: 7.35, z1: 8 });
    }
    fx.setColor(0xd8e4ec); fx.box(9.5, 0, 7.4, 10.1, 1.3, 7.95);                      // 정수기
    fx.setColor(0x3a6aaa); fx.box(9.6, 1.0, 7.38, 10.0, 1.2, 7.4);
    this.colliders.push({ x0: 9.5, x1: 10.1, z0: 7.35, z1: 8 });
    fx.setColor(0xc8a878); fx.box(-1.5, 1.2, 3.62, 1.5, 2.1, 3.66);                    // 게시판
    const fm = new THREE.Mesh(fx.build(), this.vc); fm.castShadow = true; fm.receiveShadow = true; R.add(fm);

    // 상호작용 구역
    const Z = (id, x0, z0, x1, z1, extra = {}) => this.zones.push({ id, x0, z0, x1, z1, ...extra });
    Z('exit', -1.5, 6.8, 1.5, 8);
    Z('board', -12.6, -5.2, -10.2, 1.4);
    Z('seat', -10.3, -7.2, -4.7, 3.2);
    if (!univ) Z('mydesk', -3.4, -1.3, -1.3, 0.3);
    if (univ) { Z('library', -4.3, -8, 4.3, 3.3); Z('admin', -6.2, 4.65, -3.2, 5.8); }
    if (!univ) Z('office', -4.3, -8, 4.3, 3.3);
    Z('cafeteria', 10.6, -7.5, 11.9, 2.5);
    Z('cafeseat', 5.0, -7.2, 10.6, 0.2);
    this.door = { x: 0, z: 7.2 };
    // 큰 소리 아이콘 (떠드는 학생 등) 은 schoolgame에서
  }

  // 시간대에 맞춰 NPC 배치
  populate(period, opts = {}) {
    for (const n of this.npcs) this.root.remove(n.p.root);
    for (const i of this.icons) this.root.remove(i);
    this.npcs = []; this.icons = [];
    for (const s of this.seats) s.taken = false;
    const lv = this.level;
    const scale = { elem: 0.72, middle: 0.88, high: 0.96, univ: 1 }[lv];
    const uniform = lv === 'middle' || lv === 'high';
    const mk = (adult) => {
      const female = Math.random() < 0.5;
      const o = adult || !uniform ? {
        skin: SKINS[Math.floor(Math.random() * SKINS.length)], hair: HAIRS[Math.floor(Math.random() * 5)],
        shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)], pants: PANTS[Math.floor(Math.random() * PANTS.length)], shoes: SHOES[Math.floor(Math.random() * SHOES.length)],
        longHair: female && Math.random() < 0.7, bag: !adult && Math.random() < 0.4 ? 0x2a3a5a : null,
      } : { skin: SKINS[Math.floor(Math.random() * 4)], hair: HAIRS[Math.floor(Math.random() * 4)], shirt: lv === 'high' ? 0x2a2e4a : 0x1f3a6a, pants: female ? 0x3a3e4a : 0x4a4e58, shoes: 0xf2f2f2, longHair: female && Math.random() < 0.8 };
      const p = createPed(o);
      p.root.scale.setScalar((adult ? 1 : scale) * (female ? 0.96 : 1));
      this.root.add(p.root);
      return p;
    };
    const sit = (p, x, z, face) => {
      p.root.position.set(x, -0.42 * p.root.scale.y, z);
      p.root.rotation.y = face;
      // 다리 앞으로 (앉은 자세)
      p.root.children.forEach((c, i) => { if (i === 1 || i === 3) c.rotation.x = -1.45; });
      p.seated = true;
    };
    if (period === 'class' || period === 'exam') {
      const n = Math.min(this.seats.length - 1, lv === 'univ' ? 18 : 22);
      const free = [...this.seats].sort(() => Math.random() - 0.5).slice(0, n);
      for (const s of free) { const p = mk(false); sit(p, s.x, s.z, -Math.PI / 2); s.taken = true; this.npcs.push({ p, seat: s, type: 'student' }); }
      if (!opts.playerTeaching) { const t = mk(true); t.root.position.set(-11.9, 0, -0.6); t.root.rotation.y = Math.PI / 2; this.npcs.push({ p: t, type: 'teacher' }); }
    } else if (period === 'lunch') {
      const seats = [...this.cafSeats].sort(() => Math.random() - 0.5).slice(0, 26);
      for (const s of seats) { const p = mk(false); sit(p, s.x, s.z, s.face); this.npcs.push({ p, type: 'student' }); }
      for (let k = 0; k < 4; k++) { const p = mk(false); p.root.position.set(11.2, 0, -5 + k * 0.9); p.root.rotation.y = Math.PI / 2; this.npcs.push({ p, type: 'line' }); }
    } else if (period === 'break' || period === 'after') {
      const n = period === 'break' ? 10 : 3;
      for (let k = 0; k < n; k++) {
        const p = mk(false); const x = -11 + Math.random() * 22, z = 4.2 + Math.random() * 2.5;
        p.root.position.set(x, 0, z);
        this.npcs.push({ p, type: 'walker', vx: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6), wait: Math.random() * 3 });
      }
      if (lv === 'univ') for (let k = 0; k < 5; k++) { const p = mk(false); const s = this.cafSeats[Math.floor(Math.random() * this.cafSeats.length)]; sit(p, s.x, s.z, s.face); this.npcs.push({ p, type: 'student' }); }
    }
    // 교무실·도서관 어른/학생
    if (lv !== 'univ') {
      for (const [x, z, f] of [[0.85, -5.18, 0], [2.35, -6.02, Math.PI], [0.85, -1.18, 0]]) { const t = mk(true); sit(t, x, z + (f ? -0.35 : 0.35), f); this.npcs.push({ p: t, type: 'staff' }); }
    } else if (period !== 'exam') {
      for (const [x, z] of [[-2.6, -1.95], [1.4, -1.95], [2.6, 0.55]]) { const t = mk(false); sit(t, x, z, z < -1 ? 0 : Math.PI); this.npcs.push({ p: t, type: 'student' }); }
    }
  }

  update(dt, playerPos) {
    for (const n of this.npcs) {
      if (n.type === 'walker') {
        if (n.wait > 0) { n.wait -= dt; n.p.animate(dt, 0); continue; }
        const p = n.p.root.position;
        p.x += n.vx * dt;
        if (p.x < -12 || p.x > 12) { n.vx *= -1; n.wait = 1 + Math.random() * 3; }
        if (Math.hypot(p.x - playerPos.x, p.z - playerPos.z) < 0.7) p.x -= n.vx * dt;
        n.p.root.rotation.y = n.vx > 0 ? Math.PI / 2 : -Math.PI / 2;
        n.p.animate(dt, Math.abs(n.vx));
      }
    }
    for (const i of this.icons) i.scale.setScalar(0.45 + Math.sin(performance.now() / 160) * 0.04);
  }

  collide(pos, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.x0, Math.min(pos.x, c.x1)), nz = Math.max(c.z0, Math.min(pos.z, c.z1));
      const dx = pos.x - nx, dz = pos.z - nz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-4) { pos.z = c.z1 + r; continue; }
        pos.x = nx + dx / d * r; pos.z = nz + dz / d * r;
      }
    }
    pos.x = Math.max(-W / 2 + r, Math.min(W / 2 - r, pos.x));
    pos.z = Math.max(-D / 2 + r, Math.min(D / 2 - 0.3, pos.z));
    // 의자에 앉은 NPC
    for (const n of this.npcs) {
      const q = n.p.root.position, dx = pos.x - q.x, dz = pos.z - q.z, d = Math.hypot(dx, dz);
      if (d < 0.45 && d > 1e-4) { pos.x = q.x + dx / d * 0.45; pos.z = q.z + dz / d * 0.45; }
    }
  }
  zoneAt(pos) {
    let best = null;
    for (const z of this.zones) if (pos.x >= z.x0 && pos.x <= z.x1 && pos.z >= z.z0 && pos.z <= z.z1) { if (!best || (z.x1 - z.x0) * (z.z1 - z.z0) < (best.x1 - best.x0) * (best.z1 - best.z0)) best = z; }
    return best;
  }
  nearestFreeSeat(pos) {
    let best = null, bd = 1e9;
    for (const s of this.seats) { if (s.taken) continue; const d = Math.hypot(s.x - pos.x, s.z - pos.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  nearestCafSeat(pos) {
    const taken = this.npcs.map(n => n.p.root.position);
    let best = null, bd = 1e9;
    for (const s of this.cafSeats) { if (taken.some(t => Math.hypot(t.x - s.x, t.z - s.z) < 0.3)) continue; const d = Math.hypot(s.x - pos.x, s.z - pos.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  updateWalls(camera, night) {
    for (const w of this.walls) {
      const [nx, nz] = w.userData.n;
      const dot = camera.position.x * nx + camera.position.z * nz;
      w.visible = dot < (nx ? W / 2 : D / 2) + 0.5;
    }
    this.skyPlane.material.color.setHSL(0.57, 0.6, 0.85 - night * 0.7);
    this.sun.intensity = 0.4 + (1 - night) * 1.0;
  }
}

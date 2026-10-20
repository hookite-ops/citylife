import * as THREE from 'three';
import { N, ROAD, MEDIAN, SIDEWALK, ROADS, STOP, HALF, blockRect, hasEdge, nodeExists, REMOVED, nearestRoad, blockIndex } from './config.js';
import { GB, seeded } from './geo.js';
import * as T from './textures.js';
import { Bld, buildNear, buildFar, makeMaterials, specH, faces, fbox, fquad } from './buildings.js';

// ───────── 한빛신도시 구역 지도 (행 j: 북→남, 열 i: 서→동) ─────────
// A 아파트단지 · S 근린상가 · C 업무지구(오피스) · T 주상복합 · V 빌라촌 · G 시청 · L 중앙 호수공원 · P 근린공원
// E 초등 · M 중 · H 고 · U 대학
export const ZONES = [
  'AAPAAMAA',
  'AESVVSAA',
  'ASCCCCSA',
  'HSTLLGSA',
  'ASTLLTSA',
  'AASTTSAA',
  'UASVSAPA',
  'AAAAAAAA',
];
export const ZONE_COLOR = { A: '#5d6b5e', S: '#6e6a62', C: '#58626e', T: '#62606e', V: '#6e5f58', G: '#6a6a60', L: '#3f6a3a', P: '#46703e', E: '#6a6248', M: '#6a6248', H: '#6a6248', U: '#5a6448' };

export const SCHOOLS = {
  E: { type: 'elem', name: '한빛초등학교', icon: '🎒', color: '#2a7a4a', floors: 4 },
  M: { type: 'middle', name: '한빛중학교', icon: '🏫', color: '#2a4a8a', floors: 4 },
  H: { type: 'high', name: '한빛고등학교', icon: '🏫', color: '#6a2a2a', floors: 5 },
  U: { type: 'univ', name: '한빛대학교', icon: '🎓', color: '#1a2a5a', floors: 6 },
};

// 특수 건물: "i,j,slot"  (S블록 슬롯: 0~2 북쪽줄, 3~5 남쪽줄, 6~7 서쪽, 8~9 동쪽)
export const SPECIALS = {
  '3,1,home': { id: 'home', name: '우리집 · 한빛빌라', sign: ['한빛빌라', '#4a3426', '#ffe9c8', 'HANBIT VILLA'], icon: '🏠' },
  '2,1,5': { id: 'mart', name: '24시 편의점', sign: ['24 마트', '#1f8a4c', '#ffffff', '24시간 편의점'], icon: '🏪' },
  '5,1,3': { id: 'rest', name: '한끼식당', sign: ['한끼식당', '#8a2a1a', '#ffe7b0', '한식 · 백반 · 갈비'], icon: '🍚' },
  '6,2,6': { id: 'delivery', name: '번개배달 센터', sign: ['번개배달', '#e0a20a', '#1a1a1a', '배달 기사 모집'], icon: '🛵' },
  '6,3,6': { id: 'cars', name: '드림모터스 전시장', sign: ['DREAM MOTORS', '#111418', '#f2f2f2', '신차 · 중고차'], icon: '🚗', showroom: true },
  '1,2,8': { id: 'furn', name: '홈데코 가구점', sign: ['홈데코', '#2f4a3a', '#f1ead8', '가구 · 인테리어'], icon: '🛋️' },
  '2,5,0': { id: 'realty', name: '행복 부동산', sign: ['행복 부동산', '#1d3b6e', '#ffffff', '매매 · 전세 · 월세'], icon: '🏘️' },
  '5,5,1': { id: 'mart', name: '24시 편의점', sign: ['24 마트', '#1f8a4c', '#ffffff', '24시간 편의점'], icon: '🏪' },
  '1,4,9': { id: 'gym', name: '헬스장 · 핏라이프', sign: ['FIT LIFE', '#202020', '#ff5a2a', '24시 헬스 · 샤워'], icon: '💪' },
  '3,2,hq': { id: 'office', name: '한빛그룹 본사', sign: ['HANBIT GROUP', '#0f2a44', '#e8f1ff', '한빛그룹'], icon: '🏢' },
};

// 호수
const LAKE_C = [0, 0];
export function lakeR(th) { return 74 + 8 * Math.sin(2 * th + 0.6) + 6 * Math.sin(3 * th + 1.9) + 3.5 * Math.sin(5 * th + 0.3); }
const PARK = { x0: ROADS[3] + ROAD / 2, x1: ROADS[5] - ROAD / 2, z0: ROADS[3] + ROAD / 2, z1: ROADS[5] - ROAD / 2 };

const APT_COLORS = [[0.94, 0.93, 0.89], [0.92, 0.91, 0.88], [0.9, 0.9, 0.9], [0.95, 0.92, 0.86], [0.88, 0.89, 0.9]];
const APT_ACCENT = [[0.32, 0.48, 0.6], [0.55, 0.4, 0.3], [0.3, 0.45, 0.35], [0.5, 0.5, 0.52], [0.62, 0.32, 0.3], [0.25, 0.3, 0.42]];
const SHOP_COLORS = [[0.86, 0.85, 0.82], [0.78, 0.78, 0.78], [0.42, 0.44, 0.47], [0.82, 0.76, 0.66], [0.9, 0.9, 0.88], [0.55, 0.42, 0.34], [0.3, 0.32, 0.35]];
const VILLA_COLORS = [[0.62, 0.36, 0.28], [0.7, 0.45, 0.35], [0.82, 0.78, 0.7], [0.55, 0.33, 0.27], [0.88, 0.86, 0.8], [0.66, 0.6, 0.52]];
const APT_NAMES = ['한빛마을', '푸른숲', '호수마을', '새솔마을', '가온마을', '도담마을', '나래마을', '늘봄마을', '햇살마을', '다정마을'];
const Y0 = 0.18;

export class City {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.colliders = [];
    this.entrances = [];
    this.doors = [];
    this.parking = {};
    this.parkedSpots = [];
    this.poleGrid = new Map();
    this.blocks = [];
    this.night = 0;
    this.signalT = 0;
    this.signs = [];
    this.rand = seeded(20261020);
    this.group = new THREE.Group();
    scene.add(this.group);
    this.nearR = 230;
    this.makeMaterials();
    this.static = { props: new GB(), side: new GB(), curb: new GB(), grass: new GB(), pave: new GB(), asph: new GB(), white: new GB(), yellow: new GB(), hedge: new GB() };
    this.treeList = [];
    this.lampList = [];
    this.buildPlan();
    this.buildGround();
    this.buildMarkings();
    this.buildLakePark();
    this.buildStreetFurniture();
    this.buildSignals();
    this.flushStatic();
    this.buildFarAll();
    this.buildOutskirts();
  }

  makeMaterials() {
    const asp = T.asphalt();
    asp.repeat.set(1 / 14, 1 / 14);
    this.mat = {
      asphalt: new THREE.MeshStandardMaterial({ map: asp, roughness: 0.92 }),
      sidewalk: new THREE.MeshStandardMaterial({ map: T.sidewalk(), roughness: 0.9 }),
      pave: new THREE.MeshStandardMaterial({ map: T.sidewalk(), roughness: 0.85, color: 0xd8d2c8 }),
      curb: new THREE.MeshStandardMaterial({ color: 0x8c8a86, roughness: 0.85 }),
      grass: new THREE.MeshStandardMaterial({ map: T.grass(), roughness: 1 }),
      white: new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xe5b420, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.5, metalness: 0.6 }),
      props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1 }),
      hedge: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
      water: new THREE.MeshStandardMaterial({ color: 0x2c5462, roughness: 0.06, metalness: 0.85, envMapIntensity: 1.4 }),
      lampHead: new THREE.MeshStandardMaterial({ color: 0xdedbd2, emissive: 0xffd9a0, emissiveIntensity: 0 }),
      pool: new THREE.MeshBasicMaterial({ map: T.lightPool(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      ring: new THREE.MeshBasicMaterial({ color: 0x46d1ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
      jet: new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.55, depthWrite: false }),
    };
    this.B = makeMaterials();
  }

  // ───────── 마스터플랜: 블록별 건물 배치 ─────────
  buildPlan() {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const zone = ZONES[j][i];
      const r = blockRect(i, j);
      const blk = { i, j, zone, r, specs: [], near: null, far: null, extras: [], seed: 1000 + i * 37 + j * 101 };
      this.blocks.push(blk);
      const R = seeded(blk.seed);
      if (zone === 'A') this.planApt(blk, R);
      else if (zone === 'S') this.planShops(blk, R);
      else if (zone === 'C') this.planOffice(blk, R);
      else if (zone === 'T') this.planMixed(blk, R);
      else if (zone === 'V') this.planVillas(blk, R);
      else if (zone === 'G') this.planCivic(blk, R);
      else if (zone === 'P') this.planPark(blk, R);
      else if (SCHOOLS[zone]) this.planSchool(blk, R, SCHOOLS[zone]);
      for (const s of blk.specs) {
        if (s.noCollide) continue;
        this.colliders.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, h: specH(s) + (s.groundH || 0) + (s.type === 'villa' ? 2.8 : 0) });
      }
    }
    // 입구 링
    const ringGeo = new THREE.RingGeometry(0.9, 1.15, 40); ringGeo.rotateX(-Math.PI / 2);
    for (const e of this.entrances) { const ring = new THREE.Mesh(ringGeo, this.mat.ring); ring.position.set(e.x, Y0 + 0.06, e.z); this.group.add(ring); }
  }

  addEntrance(sp, s, faceKey, u, extra = {}) {
    const f = faces(s)[faceKey];
    const px = f.p[0] + f.t[0] * u + f.n[0] * 2.2, pz = f.p[1] + f.t[1] * u + f.n[1] * 2.2;
    const e = { id: sp.id, name: sp.name, icon: sp.icon, x: px, z: pz, nx: f.n[0], nz: f.n[1], face: Math.atan2(f.n[0], f.n[1]), ...extra };
    this.entrances.push(e);
    return e;
  }
  addSign(sp, s, faceKey, u, y, scale = 1) {
    const f = faces(s)[faceKey];
    const t = T.sign(sp.sign[0], sp.sign[1], sp.sign[2], sp.sign[3]);
    const mat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5 });
    const w = 8 * scale, h = w / 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(f.p[0] + f.t[0] * u + f.n[0] * 0.3, y, f.p[1] + f.t[1] * u + f.n[1] * 0.3);
    m.rotation.y = Math.atan2(f.n[0], f.n[1]);
    this.group.add(m);
    this.signs.push(mat);
    return m;
  }
  // 도로 갓길 위치 (건물 앞 도로)
  curbSpot(s, faceKey, u) {
    const f = faces(s)[faceKey];
    const x = f.p[0] + f.t[0] * u, z = f.p[1] + f.t[1] * u;
    // 가까운 도로 중심선
    let rx, rz, rot;
    if (f.n[0]) { const k = nearestRoad(x + f.n[0] * 12); rx = ROADS[k] - f.n[0] * (ROAD / 2 - 1.1); rz = z; rot = f.n[0] > 0 ? 0 : Math.PI; }
    else { const k = nearestRoad(z + f.n[1] * 12); rz = ROADS[k] - f.n[1] * (ROAD / 2 - 1.1); rx = x; rot = f.n[1] > 0 ? -Math.PI / 2 : Math.PI / 2; }
    return { x: rx, z: rz, rot };
  }

  // 아파트 단지
  planApt(blk, R) {
    const r = blk.r, m = SIDEWALK + 7;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    const w = x1 - x0, d = z1 - z0;
    const color = APT_COLORS[Math.floor(R() * APT_COLORS.length)], accent = APT_ACCENT[Math.floor(R() * APT_ACCENT.length)];
    const baseF = 16 + Math.floor(R() * 12);
    const rows = d > 92 ? 3 : 2;
    const depth = 12.5;
    const gap = (d - rows * depth) / (rows - 0.4);
    const cols = 2;
    const len = Math.min(34, (w - 14) / cols);
    let n = 0;
    blk.name = APT_NAMES[(blk.i * 3 + blk.j * 5) % APT_NAMES.length] + ' ' + (1 + (blk.i + blk.j * N) % 9) + '단지';
    for (let rr = 0; rr < rows; rr++) {
      const tz0 = z0 + gap * 0.3 + rr * (depth + gap);
      for (let c = 0; c < cols; c++) {
        // 단지 상가 자리 (남동쪽)
        if (rr === rows - 1 && c === cols - 1 && rows === 2 && R() < 0.5) continue;
        const stagger = (c % 2) * (R() * 4 - 2);
        const tx0 = x0 + 4 + c * (w - 8 - len) / Math.max(1, cols - 1);
        const s = { type: 'apt', x0: tx0, x1: tx0 + len, z0: tz0 + stagger, z1: tz0 + stagger + depth, y0: Y0, floors: baseF + Math.floor(R() * 6) - 2 + (rr === 0 ? 4 : 0), fh: 2.9, color, accent, seed: blk.seed * 10 + n++, front: 'S' };
        blk.specs.push(s);
        this.doors.push({ x: (s.x0 + s.x1) / 2, z: s.z0 - 2.5, name: `${blk.name} ${100 + n}동` });
      }
    }
    // 단지 상가 (남쪽 길가)
    const ss = { type: 'shop', x0: x1 - 30, x1: x1 - 2, z0: r.z1 - SIDEWALK - 16, z1: r.z1 - SIDEWALK - 2, y0: Y0, floors: 1, fh: 3.4, groundH: 4.6, color: SHOP_COLORS[Math.floor(R() * SHOP_COLORS.length)], seed: blk.seed * 10 + 9, front: 'S', streets: ['S'], signBase: Math.floor(R() * 40), unitW: 7 };
    blk.specs.push(ss);
    // 단지 녹지 · 산책로 · 울타리
    const st = this.static;
    st.grass.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.02, 6, 6);
    // 단지 안 산책로 (동 앞뒤)
    for (let rr = 0; rr <= rows; rr++) {
      const z = z0 + gap * 0.3 + rr * (depth + gap) - 4.5;
      st.pave.top(x0 - 2, z - 1.5, x1 + 2, z + 1.5, Y0 + 0.035, 4, 4);
    }
    st.pave.top((x0 + x1) / 2 - 1.6, z0 - 6, (x0 + x1) / 2 + 1.6, z1 + 2, Y0 + 0.036, 4, 4);
    // 생울타리 (정문 자리만 비움)
    const hx0 = r.x0 + SIDEWALK + 0.5, hx1 = r.x1 - SIDEWALK - 0.5, hz0 = r.z0 + SIDEWALK + 0.5, hz1 = r.z1 - SIDEWALK - 0.5, cx = (hx0 + hx1) / 2;
    const hedge = (a, b, c, d) => { st.hedge.setRGB(0.22 + R() * 0.05, 0.36 + R() * 0.06, 0.18); st.hedge.box(a, Y0, b, c, Y0 + 1.1, d); this.colliders.push({ x0: a, z0: b, x1: c, z1: d, h: 1.1, soft: true }); };
    hedge(hx0, hz0, cx - 4, hz0 + 0.8); hedge(cx + 4, hz0, hx1, hz0 + 0.8);
    hedge(hx0, hz0, hx0 + 0.8, hz1); hedge(hx1 - 0.8, hz0, hx1, hz1);
    hedge(hx0, hz1 - 0.8, x1 - 32, hz1);
    // 정문 기둥 + 단지 이름판
    const p = st.props;
    p.setColor(0x8a8478); p.cbox(cx - 4.5, Y0 + 1.6, hz0 + 0.4, 1.0, 3.2, 1.0); p.cbox(cx + 4.5, Y0 + 1.6, hz0 + 0.4, 1.0, 3.2, 1.0);
    blk.gateSign = { cx, z: hz0 - 0.15 };
    // 나무
    for (let k = 0; k < 26; k++) {
      const tx = x0 + R() * w, tz = z0 + R() * d;
      if (blk.specs.some(s => tx > s.x0 - 3 && tx < s.x1 + 3 && tz > s.z0 - 3 && tz < s.z1 + 3)) continue;
      this.treeList.push([tx, tz, 0.8 + R() * 0.5, R() < 0.2 ? 'pink' : null]);
    }
    // 놀이터 · 지하주차장 입구 (가까이서만)
    blk.extras.push((B) => {
      const px = x0 + 8, pz = z1 - 10;
      const g = B.solid;
      g.setRGB(0.85, 0.55, 0.35); g.box(px - 6, Y0, pz - 5, px + 6, Y0 + 0.06, pz + 5);
      g.setRGB(0.95, 0.75, 0.15); g.box(px - 3, Y0, pz - 1, px - 1, Y0 + 2.6, pz + 1);
      g.setRGB(0.2, 0.55, 0.85); const sl = new THREE.BoxGeometry(0.9, 0.1, 3.4); sl.rotateX(-0.6); sl.translate(px - 2, Y0 + 1.4, pz + 2.4); g.addGeo(sl);
      g.setRGB(0.85, 0.25, 0.25); g.box(px + 1.5, Y0, pz - 2, px + 1.62, Y0 + 2.2, pz + 2); g.box(px + 4.5, Y0, pz - 2, px + 4.62, Y0 + 2.2, pz + 2); g.box(px + 1.5, Y0 + 2.2, pz - 2, px + 4.62, Y0 + 2.32, pz + 2);
      g.setRGB(0.3, 0.3, 0.3); g.box(px + 2.4, Y0 + 0.5, pz - 0.6, px + 3.6, Y0 + 0.56, pz - 0.2); g.box(px + 2.4, Y0 + 0.5, pz + 0.6, px + 3.6, Y0 + 0.56, pz + 1.0);
      // 벤치
      for (let k = 0; k < 4; k++) { g.setRGB(0.5, 0.34, 0.22); g.box(px - 6 + k * 3.5, Y0 + 0.42, pz + 6, px - 4.4 + k * 3.5, Y0 + 0.5, pz + 6.5); }
      // 지하주차장 경사로
      const rx = x0 + w / 2 + 8, rz = r.z0 + SIDEWALK + 5;
      g.setRGB(0.45, 0.46, 0.48); g.box(rx - 3.5, Y0, rz, rx + 3.5, Y0 + 3.2, rz + 0.3); g.box(rx - 3.5, Y0, rz, rx - 3.2, Y0 + 3.2, rz + 9); g.box(rx + 3.2, Y0, rz, rx + 3.5, Y0 + 3.2, rz + 9);
      g.setRGB(0.92, 0.92, 0.9); g.box(rx - 3.6, Y0 + 3.2, rz - 0.3, rx + 3.6, Y0 + 3.45, rz + 9.2);
      g.setRGB(0.12, 0.12, 0.13); g.box(rx - 3.2, Y0 - 0.0, rz + 0.3, rx + 3.2, Y0 + 3.1, rz + 0.35);
    });
  }

  // 근린상가 블록: 길을 따라 건물 줄 + 가운데 주차장
  planShops(blk, R) {
    const r = blk.r, sw = SIDEWALK + 1.2;
    const x0 = r.x0 + sw, x1 = r.x1 - sw, z0 = r.z0 + sw, z1 = r.z1 - sw;
    const dep = 17, alley = 4;
    const rowW = (x1 - x0 - 2 * alley) / 3;
    const colL = (z1 - z0 - 2 * dep - 3 * alley) / 2;
    const slots = [];
    for (let k = 0; k < 3; k++) slots.push({ x0: x0 + k * (rowW + alley), x1: x0 + k * (rowW + alley) + rowW, z0, z1: z0 + dep, front: 'N', streets: k === 0 ? ['N', 'W'] : k === 2 ? ['N', 'E'] : ['N'] });
    for (let k = 0; k < 3; k++) slots.push({ x0: x0 + k * (rowW + alley), x1: x0 + k * (rowW + alley) + rowW, z0: z1 - dep, z1, front: 'S', streets: k === 0 ? ['S', 'W'] : k === 2 ? ['S', 'E'] : ['S'] });
    for (let k = 0; k < 2; k++) { const a = z0 + dep + alley + k * (colL + alley); slots.push({ x0, x1: x0 + dep - 2, z0: a, z1: a + colL, front: 'W', streets: ['W'] }); }
    for (let k = 0; k < 2; k++) { const a = z0 + dep + alley + k * (colL + alley); slots.push({ x0: x1 - dep + 2, x1, z0: a, z1: a + colL, front: 'E', streets: ['E'] }); }
    slots.forEach((sl, k) => {
      const sp = SPECIALS[`${blk.i},${blk.j},${k}`];
      const s = {
        type: 'shop', ...sl, y0: Y0, floors: sp ? (sp.showroom ? 1 : 2 + Math.floor(R() * 2)) : 3 + Math.floor(R() * 5), fh: 3.4, groundH: sp?.showroom ? 7 : 4.6,
        color: SHOP_COLORS[Math.floor(R() * SHOP_COLORS.length)], accent2: R() < 0.5 ? [0.3, 0.32, 0.35] : null,
        seed: blk.seed * 10 + k, signBase: Math.floor(R() * 48), unitW: sp ? 30 : 6.5 + R() * 2, special: !!sp, upper: R() < 0.25 ? 'curtain' : 'ribbon',
      };
      blk.specs.push(s);
      const f = faces(s)[s.front];
      if (sp) {
        const L = f.L;
        this.addEntrance(sp, s, s.front, L / 2);
        this.addSign(sp, s, s.front, L / 2, Y0 + s.groundH - 0.75, sp.showroom ? 1.3 : 0.95);
        const cs = this.curbSpot(s, s.front, L / 2 + 6);
        this.parking[sp.id === 'cars' ? 'cars' : `${blk.i},${blk.j},${k}`] = cs;
        if (sp.showroom) {
          // 전시장 안 차 2대
          for (const du of [-0.25, 0.25]) {
            const px = f.p[0] + f.t[0] * (L / 2 + du * L) - f.n[0] * 7, pz = f.p[1] + f.t[1] * (L / 2 + du * L) - f.n[1] * 7;
            this.parkedSpots.push({ x: px, z: pz, rot: Math.atan2(f.t[0], f.t[1]) + 0.5, showroom: true, noCollide: true });
          }
        }
      } else {
        this.doors.push({ x: f.p[0] + f.t[0] * f.L / 2 + f.n[0] * 1.8, z: f.p[1] + f.t[1] * f.L / 2 + f.n[1] * 1.8, name: this.placeName(R, 'shop') });
      }
      // 길가 주차 차량
      if (!sp && R() < 0.4) { const cs = this.curbSpot(s, s.front, f.L * (0.3 + R() * 0.4)); this.parkedSpots.push(cs); }
    });
    const st = this.static;
    st.pave.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 4, 4);
    // 가운데 주차장
    st.asph.top(x0 + dep - 1, z0 + dep + 1, x1 - dep + 1, z1 - dep - 1, Y0 + 0.02, 1, 1);
    for (let x = x0 + dep + 2; x < x1 - dep - 2; x += 2.6) { st.white.top(x, z0 + dep + 3, x + 0.12, z0 + dep + 8, Y0 + 0.03); st.white.top(x, z1 - dep - 8, x + 0.12, z1 - dep - 3, Y0 + 0.03); }
  }

  // 업무지구
  planOffice(blk, R) {
    const r = blk.r, m = SIDEWALK + 6;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    const hq = SPECIALS[`${blk.i},${blk.j},hq`];
    const tw = 30 + R() * 6, td = 26 + R() * 4;
    const cx = (x0 + x1) / 2 + (R() - 0.5) * 10, cz = (z0 + z1) / 2 + (R() - 0.5) * 10;
    const spandrels = [[0.16, 0.2, 0.24], [0.2, 0.24, 0.22], [0.26, 0.24, 0.22], [0.12, 0.14, 0.18]];
    const sp = spandrels[Math.floor(R() * spandrels.length)];
    const main = { type: 'office', x0: cx - tw / 2, x1: cx + tw / 2, z0: cz - td / 2, z1: cz + td / 2, y0: Y0, floors: hq ? 42 : 18 + Math.floor(R() * 20), fh: 3.8, seed: blk.seed * 10, spandrel: sp, antenna: !!hq || R() < 0.3, crown: 4 + R() * 4, front: 'S' };
    blk.specs.push(main);
    // 저층 별동
    const lx0 = R() < 0.5 ? x0 : x1 - 26, lz0 = cz < (z0 + z1) / 2 ? z1 - 22 : z0;
    const low = { type: 'podium', x0: lx0, x1: lx0 + 26, z0: lz0, z1: lz0 + 22, y0: Y0, floors: 3 + Math.floor(R() * 4), fh: 3.8, groundH: 4.8, color: [0.8, 0.8, 0.8], seed: blk.seed * 10 + 1, front: lz0 === z0 ? 'N' : 'S', streets: [lz0 === z0 ? 'N' : 'S'], upper: 'curtain', spandrel: sp, signBase: Math.floor(R() * 48), unitW: 8 };
    if (!(low.x1 > main.x0 - 3 && low.x0 < main.x1 + 3 && low.z1 > main.z0 - 3 && low.z0 < main.z1 + 3)) blk.specs.push(low);
    this.static.pave.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 4, 4);
    this.doors.push({ x: cx, z: main.z1 + 2, name: this.placeName(R, 'office') });
    if (hq) {
      this.addEntrance(hq, main, 'S', tw / 2);
      this.addSign(hq, main, 'S', tw / 2, Y0 + 5.5, 1.5);
      this.addSign(hq, main, 'S', tw / 2, specH(main) - 4, 2.2);
      this.parking.office = this.curbSpot(main, 'S', tw / 2);
    }
    // 광장 조형물 · 화단
    const p = this.static.props;
    p.setColor(0x7a8a70); p.box(r.x0 + SIDEWALK + 2, Y0, r.z0 + SIDEWALK + 2, r.x0 + SIDEWALK + 10, Y0 + 0.6, r.z0 + SIDEWALK + 4);
    p.setColor(0xb04030); const sc = new THREE.TorusKnotGeometry(1.2, 0.35, 48, 8); sc.translate(r.x1 - SIDEWALK - 6, Y0 + 3, r.z1 - SIDEWALK - 6); p.addGeo(sc);
    p.setColor(0x8a8478); p.cbox(r.x1 - SIDEWALK - 6, Y0 + 0.75, r.z1 - SIDEWALK - 6, 2, 1.5, 2);
    for (let k = 0; k < 8; k++) this.treeList.push([x0 + R() * (x1 - x0), (R() < 0.5 ? z0 + 2 : z1 - 2), 0.8 + R() * 0.3, null]);
  }

  // 주상복합: 저층 상가 + 고층 탑상형 2동
  planMixed(blk, R) {
    const r = blk.r, m = SIDEWALK + 2;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    // 호수 쪽 면을 정면으로
    const towardLake = blk.i < 3 ? 'E' : blk.i > 4 ? 'W' : blk.j < 3 ? 'S' : 'N';
    const podFloors = 2, podFh = 4.4, gh = 5;
    const pod = { type: 'podium', x0, x1, z0, z1, y0: Y0, floors: podFloors, fh: podFh, groundH: gh, color: [0.85, 0.84, 0.8], seed: blk.seed * 10, front: towardLake, streets: [towardLake, ...['N', 'S', 'E', 'W'].filter(k => k !== towardLake)], upper: 'curtain', spandrel: [0.6, 0.6, 0.58], signBase: Math.floor(R() * 48), unitW: 7.5 };
    blk.specs.push(pod);
    const top = Y0 + gh + podFloors * podFh + 0.3;
    const color = APT_COLORS[Math.floor(R() * APT_COLORS.length)], accent = APT_ACCENT[Math.floor(R() * APT_ACCENT.length)];
    const ts = 25;
    const along = towardLake === 'E' || towardLake === 'W';
    for (let k = 0; k < 2; k++) {
      let tx, tz;
      if (along) { tx = (x0 + x1) / 2 - ts / 2 + (k ? 14 : -14); tz = k ? z0 + 12 : z1 - 12 - ts; }
      else { tz = (z0 + z1) / 2 - ts / 2 + (k ? 14 : -14); tx = k ? x0 + 12 : x1 - 12 - ts; }
      blk.specs.push({ type: 'tower', x0: tx, x1: tx + ts, z0: tz, z1: tz + ts, y0: top, floors: 36 + Math.floor(R() * 14), fh: 3.0, color, accent, seed: blk.seed * 10 + 1 + k, noCollide: true });
      this.doors.push({ x: tx + ts / 2, z: z1 + 2, name: `한빛 ${['레이크', '센트럴', '파크', '리버'][(blk.i + blk.j + k) % 4]}타워 ${k + 1}동` });
    }
    this.static.pave.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 4, 4);
    // 옥상 정원
    blk.extras.push((B) => { B.solid.setRGB(0.3, 0.48, 0.25); B.solid.box(x0 + 3, top, z0 + 3, x1 - 3, top + 0.08, z1 - 3); });
  }

  // 빌라촌
  planVillas(blk, R) {
    const r = blk.r, m = SIDEWALK + 1;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    const vw = 13, vd = 12, gx = 5, gz = 6;
    const cols = Math.floor((x1 - x0 + gx) / (vw + gx)), rows = Math.floor((z1 - z0 + gz) / (vd + gz));
    const offX = (x1 - x0 - (cols * vw + (cols - 1) * gx)) / 2, offZ = (z1 - z0 - (rows * vd + (rows - 1) * gz)) / 2;
    const homeSp = SPECIALS[`${blk.i},${blk.j},home`];
    let n = 0;
    for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
      const vx = x0 + offX + c * (vw + gx), vz = z0 + offZ + rr * (vd + gz);
      const isHome = homeSp && rr === rows - 1 && c === 1;
      const s = { type: 'villa', x0: vx, x1: vx + vw, z0: vz, z1: vz + vd, y0: Y0, floors: isHome ? 4 : 3 + Math.floor(R() * 2), fh: 2.8, color: isHome ? [0.62, 0.36, 0.28] : VILLA_COLORS[Math.floor(R() * VILLA_COLORS.length)], seed: blk.seed * 10 + n++, front: rr === rows - 1 ? 'S' : rr === 0 ? 'N' : 'S', hipRoof: R() < 0.3 };
      blk.specs.push(s);
      if (isHome) {
        this.addEntrance(homeSp, s, 'S', vw / 2);
        this.addSign(homeSp, s, 'S', vw / 2, Y0 + 3.4, 0.55);
        this.parking.home = this.curbSpot(s, 'S', vw / 2 + 5);
      } else this.doors.push({ x: vx + vw / 2, z: s.front === 'S' ? vz + vd + 1.6 : vz - 1.6, name: this.placeName(R, 'villa') });
    }
    this.static.asph.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 1, 1);
    for (let k = 0; k < 10; k++) this.treeList.push([x0 + R() * (x1 - x0), z0 + R() * (z1 - z0), 0.6 + R() * 0.3, null]);
    this.treeList = this.treeList.filter(t => !blk.specs.some(s => t[0] > s.x0 - 2 && t[0] < s.x1 + 2 && t[1] > s.z0 - 2 && t[1] < s.z1 + 2));
  }

  // 시청
  planCivic(blk, R) {
    const r = blk.r;
    const s = { type: 'civic', x0: r.cx - 14, x1: r.cx + 26, z0: r.cz - 34, z1: r.cz + 34, y0: Y0, floors: 6, fh: 4.2, seed: blk.seed * 10, front: 'W' };
    blk.specs.push(s);
    this.addSign({ sign: ['한빛시청', '#1d3b5e', '#ffffff', 'HANBIT CITY HALL'] }, s, 'W', 34, Y0 + 6.6, 1.3);
    this.doors.push({ x: s.x0 - 2, z: r.cz, name: '한빛시청' });
    const st = this.static;
    st.pave.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 4, 4);
    const p = st.props;
    // 국기 게양대
    for (let k = 0; k < 3; k++) { p.setColor(0xd8d8d8); p.addGeo(new THREE.CylinderGeometry(0.08, 0.1, 14, 6).translate(r.x0 + 14, Y0 + 7, r.cz - 8 + k * 8)); p.setColor([0xf2f2f2, 0x2050a0, 0x2a7a4a][k]); p.box(r.x0 + 14.1, Y0 + 11.5, r.cz - 8 + k * 8, r.x0 + 14.15, Y0 + 13.5, r.cz - 5 + k * 8); }
    // 분수
    p.setColor(0x9a968e); p.addGeo(new THREE.CylinderGeometry(6, 6.4, 0.6, 32).translate(r.x0 + 24, Y0 + 0.3, r.cz));
    const wm = new THREE.Mesh(new THREE.CircleGeometry(5.6, 32).rotateX(-Math.PI / 2), this.mat.water); wm.position.set(r.x0 + 24, Y0 + 0.55, r.cz); this.group.add(wm);
    this.jets = this.jets || [];
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.8, 5, 12, 1, true), this.mat.jet); jet.position.set(r.x0 + 24, Y0 + 3, r.cz); this.group.add(jet); this.jets.push(jet);
    this.colliders.push({ x0: r.x0 + 18, x1: r.x0 + 30, z0: r.cz - 6, z1: r.cz + 6, h: 0.6, soft: true });
    for (let k = 0; k < 12; k++) this.treeList.push([r.x0 + 8 + (k % 2) * 30, r.z0 + 10 + Math.floor(k / 2) * 18, 0.9, null]);
  }

  planPark(blk, R) {
    const r = blk.r, st = this.static;
    const s = SIDEWALK;
    st.grass.top(r.x0 + s, r.z0 + s, r.x1 - s, r.z1 - s, Y0 + 0.02, 6, 6);
    st.pave.top(r.x0 + s, r.cz - 1.5, r.x1 - s, r.cz + 1.5, Y0 + 0.035, 4, 4);
    st.pave.top(r.cx - 1.5, r.z0 + s, r.cx + 1.5, r.z1 - s, Y0 + 0.035, 4, 4);
    const p = st.props;
    // 정자
    p.setColor(0x6b3d24);
    for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) p.cbox(r.cx - 20 + dx, Y0 + 1.6, r.cz - 18 + dz, 0.3, 3, 0.3);
    p.setColor(0x3f4a44); const rg = new THREE.ConeGeometry(4.8, 1.8, 4); rg.rotateY(Math.PI / 4); rg.translate(r.cx - 20, Y0 + 3.9, r.cz - 18); p.addGeo(rg);
    p.setColor(0x8a6a4a); p.cbox(r.cx - 20, Y0 + 0.5, r.cz - 18, 5, 0.15, 5);
    for (let k = 0; k < 8; k++) { const bx = r.cx + (k % 2 ? 3 : -3), bz = r.z0 + 12 + k * 10; p.setColor(0x7a5236); p.cbox(bx, Y0 + 0.45, bz, 0.5, 0.08, 1.8); }
    // 운동기구
    p.setColor(0x2a7ad0); for (let k = 0; k < 4; k++) p.cbox(r.cx + 16 + k * 3, Y0 + 1, r.cz + 16, 0.15, 2, 0.15);
    for (let k = 0; k < 40; k++) {
      const tx = r.x0 + 8 + R() * (r.w - 16), tz = r.z0 + 8 + R() * (r.d - 16);
      if (Math.abs(tx - r.cx) < 3 || Math.abs(tz - r.cz) < 3 || Math.hypot(tx - r.cx + 20, tz - r.cz + 18) < 5) continue;
      this.treeList.push([tx, tz, 0.9 + R() * 0.7, R() < 0.25 ? 'pink' : null]);
    }
  }

  planSchool(blk, R, sc) {
    const r = blk.r;
    const ix0 = r.x0 + SIDEWALK, iz0 = r.z0 + SIDEWALK, ix1 = r.x1 - SIDEWALK, iz1 = r.z1 - SIDEWALK;
    const cx = r.cx, univ = sc.type === 'univ';
    const bz1 = iz1 - 4, bz0 = bz1 - (univ ? 20 : 16);
    const s = { type: 'school', x0: ix0 + 6, x1: ix1 - 6, z0: bz0, z1: bz1, y0: Y0, floors: sc.floors, fh: 3.6, color: univ ? [0.86, 0.8, 0.7] : [0.95, 0.93, 0.88], accent: new THREE.Color(sc.color).toArray().map(v => Math.min(1, v * 2.2)), seed: blk.seed * 10, front: 'N', clock: univ };
    blk.specs.push(s);
    const st = this.static, p = st.props;
    // 현관
    p.setColor(0xd8d8d2); p.cbox(cx, Y0 + 3.6, bz0 - 1.6, 8, 0.25, 3.2);
    p.setColor(0x9a9a94); p.cbox(cx - 3.8, Y0 + 1.8, bz0 - 3.0, 0.3, 3.6, 0.3); p.cbox(cx + 3.8, Y0 + 1.8, bz0 - 3.0, 0.3, 3.6, 0.3);
    // 운동장 / 잔디
    const fz0 = iz0 + 3, fz1 = bz0 - 5, fx0 = ix0 + 3, fx1 = ix1 - 3;
    const field = new THREE.Mesh(new THREE.PlaneGeometry(fx1 - fx0, fz1 - fz0), univ ? this.mat.grass : this.fieldMat());
    field.rotation.x = -Math.PI / 2; field.position.set((fx0 + fx1) / 2, Y0 + 0.015, (fz0 + fz1) / 2); field.receiveShadow = true;
    this.group.add(field);
    st.pave.top(ix0, iz0, ix1, iz1, Y0 + 0.005, 4, 4);
    if (!univ) {
      for (const sd of [-1, 1]) {
        const gx = (fx0 + fx1) / 2 + sd * ((fx1 - fx0) / 2 - 1.5), gz = (fz0 + fz1) / 2;
        p.setColor(0xf2f2f2); p.cbox(gx, Y0 + 1.1, gz - 2.5, 0.12, 2.2, 0.12); p.cbox(gx, Y0 + 1.1, gz + 2.5, 0.12, 2.2, 0.12); p.cbox(gx, Y0 + 2.2, gz, 0.12, 0.12, 5.1);
      }
      p.setColor(0xb0a898); p.cbox(cx + 18, Y0 + 0.5, fz1 + 2, 7, 1.0, 3.2);
    } else {
      p.setColor(0xc8c0b0); p.cbox(cx, Y0 + 0.03, (fz0 + fz1) / 2, 5, 0.04, fz1 - fz0);
      for (let k = 0; k < 8; k++) { p.setColor(0x7a5236); p.cbox(cx + (k % 2 ? 4.5 : -4.5), Y0 + 0.45, fz0 + 4 + k * 5, 0.6, 0.1, 1.8); }
      for (let k = 0; k < 20; k++) this.treeList.push([fx0 + 4 + R() * (fx1 - fx0 - 8), fz0 + 4 + R() * (fz1 - fz0 - 8), 1 + R() * 0.4, null]);
    }
    // 담장
    p.setColor(univ ? 0x8a7a6a : 0x3a6a4a);
    const fh = univ ? 0.9 : 1.6, gate = 5;
    const fence = (a, b, c, d) => { p.box(a, Y0, b, c, Y0 + fh, d); this.colliders.push({ x0: a, z0: b, x1: c, z1: d, h: fh, soft: true }); };
    fence(ix0, iz0, cx - gate, iz0 + 0.25); fence(cx + gate, iz0, ix1, iz0 + 0.25);
    fence(ix0, iz0, ix0 + 0.25, iz1); fence(ix1 - 0.25, iz0, ix1, iz1);
    fence(ix0, iz1 - 0.25, ix1, iz1);
    p.setColor(0xb8b0a0); p.cbox(cx - gate - 0.4, Y0 + 1.4, iz0 + 0.1, 0.8, 2.8, 0.8); p.cbox(cx + gate + 0.4, Y0 + 1.4, iz0 + 0.1, 0.8, 2.8, 0.8);
    this.addSign({ sign: [sc.name, sc.color, '#ffffff', univ ? 'HANBIT UNIVERSITY' : ''] }, s, 'N', s.x1 - s.x0 - 14, specH(s) - 2.4, 1.1);
    this.addEntrance({ id: 'school', name: sc.name, icon: sc.icon }, s, 'N', cx - s.x0, { school: sc.type, key: 'school-' + sc.type });
    this.doors.push({ x: cx, z: iz0 - 1.5, name: sc.name + ' 정문' });
  }

  placeName(R, kind) {
    const a = ['그린', '스카이', '해피', '드림', '푸른', '새솔', '미래', '중앙', '호수', '새봄', '은하', '한빛'];
    const b = kind === 'villa' ? ['빌라', '맨션', '하우스', '빌'] : kind === 'office' ? ['타워', '빌딩', '센터', '파이낸스센터'] : ['프라자', '타워', '빌딩', '메디컬센터', '스퀘어'];
    return a[Math.floor(R() * a.length)] + b[Math.floor(R() * b.length)] + (kind === 'villa' ? ` ${1 + Math.floor(R() * 9)}차` : '');
  }

  fieldMat() {
    if (this._field) return this._field;
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#b8936a'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},${50 + Math.random() * 30},0.25)`; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 4;
    x.beginPath(); x.roundRect(40, 90, 432, 332, 166); x.stroke();
    x.beginPath(); x.roundRect(70, 120, 372, 272, 136); x.stroke();
    x.beginPath(); x.moveTo(256, 120); x.lineTo(256, 392); x.stroke();
    x.beginPath(); x.arc(256, 256, 40, 0, 7); x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    this._field = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
    return this._field;
  }

  // ───────── 지면 ─────────
  buildGround() {
    const size = HALF * 2 + ROAD + 10;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.mat.asphalt);
    road.rotation.x = -Math.PI / 2; road.receiveShadow = true;
    const uv = road.geometry.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * size, uv.getY(k) * size);
    this.group.add(road);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), this.mat.grass);
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.6;
    const ou = outer.geometry.attributes.uv; for (let k = 0; k < ou.count; k++) ou.setXY(k, ou.getX(k) * 500, ou.getY(k) * 500);
    this.group.add(outer);
    const st = this.static;
    const ring = (x0, z0, x1, z1) => {
      const s = SIDEWALK;
      st.side.top(x0, z0, x1, z0 + s, Y0, 4, 4); st.side.top(x0, z1 - s, x1, z1, Y0, 4, 4);
      st.side.top(x0, z0 + s, x0 + s, z1 - s, Y0, 4, 4); st.side.top(x1 - s, z0 + s, x1, z1 - s, Y0, 4, 4);
      st.curb.box(x0, 0, z0, x1, Y0, z1, { top: false });
    };
    for (const b of this.blocks) { if (b.zone === 'L') continue; ring(b.r.x0, b.r.z0, b.r.x1, b.r.z1); }
    ring(PARK.x0, PARK.z0, PARK.x1, PARK.z1);
    // 외곽 보도
    const e = HALF + ROAD / 2, w = 6;
    st.side.top(-e - w, -e - w, e + w, -e, Y0, 4, 4); st.side.top(-e - w, e, e + w, e + w, Y0, 4, 4);
    st.side.top(-e - w, -e, -e, e, Y0, 4, 4); st.side.top(e, -e, e + w, e, Y0, 4, 4);
    st.curb.wall(-e, -e, e, -e, 0, Y0); st.curb.wall(e, e, -e, e, 0, Y0); st.curb.wall(e, -e, e, e, 0, Y0); st.curb.wall(-e, e, -e, -e, 0, Y0);
  }

  // 차선·횡단보도·중앙분리대
  buildMarkings() {
    const st = this.static, Wm = st.white, Ym = st.yellow;
    const yy = 0.02;
    const strip = (gb, x0, z0, x1, z1) => gb.top(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), yy);
    const edges = [];
    for (let k = 0; k <= N; k++) for (let s = 0; s < N; s++) {
      if (hasEdge(k, s, [0, 1])) edges.push({ axis: 'z', c: ROADS[k], a: ROADS[s], b: ROADS[s + 1] });
      if (hasEdge(s, k, [1, 0])) edges.push({ axis: 'x', c: ROADS[k], a: ROADS[s], b: ROADS[s + 1] });
    }
    this.edges = edges;
    for (const e of edges) {
      const { axis, c } = e;
      const L = (u0, u1, o0, o1, gb) => axis === 'x' ? strip(gb, u0, c + o0, u1, c + o1) : strip(gb, c + o0, u0, c + o1, u1);
      const a = e.a + STOP, b = e.b - STOP;
      // 중앙분리대 (화단) + 양옆 황색선
      const ma = e.a + STOP + 1, mb = e.b - STOP - 1;
      if (axis === 'x') { st.curb.box(ma, 0, c - MEDIAN, mb, 0.22, c + MEDIAN); st.hedge.setRGB(0.25, 0.4, 0.2); st.hedge.box(ma + 0.5, 0.22, c - MEDIAN + 0.25, mb - 0.5, 0.75, c + MEDIAN - 0.25); this.colliders.push({ x0: ma, x1: mb, z0: c - MEDIAN, z1: c + MEDIAN, h: 0.5, soft: true, median: true }); }
      else { st.curb.box(c - MEDIAN, 0, ma, c + MEDIAN, 0.22, mb); st.hedge.setRGB(0.25, 0.4, 0.2); st.hedge.box(c - MEDIAN + 0.25, 0.22, ma + 0.5, c + MEDIAN - 0.25, 0.75, mb - 0.5); this.colliders.push({ x0: c - MEDIAN, x1: c + MEDIAN, z0: ma, z1: mb, h: 0.5, soft: true, median: true }); }
      L(a, ma, -MEDIAN - 0.15, -MEDIAN, Ym); L(a, ma, MEDIAN, MEDIAN + 0.15, Ym);
      L(mb, b, -MEDIAN - 0.15, -MEDIAN, Ym); L(mb, b, MEDIAN, MEDIAN + 0.15, Ym);
      for (let u = a + 2; u < b - 3; u += 9) { L(u, u + 4, -4.57, -4.43, Wm); L(u, u + 4, 4.43, 4.57, Wm); }
      L(a - 3.5, b + 3.5, -8.1, -7.95, Wm); L(a - 3.5, b + 3.5, 7.95, 8.1, Wm);
      // 횡단보도
      for (const [u0, u1] of [[e.a + ROAD / 2 + 0.6, e.a + ROAD / 2 + 3.8], [e.b - ROAD / 2 - 3.8, e.b - ROAD / 2 - 0.6]]) for (let o = -9.4; o < 9.4; o += 1.0) L(u0, u1, o, o + 0.5, Wm);
      // 정지선
      if (axis === 'x') { L(a - 0.5, a, -8, -MEDIAN, Wm); L(b, b + 0.5, MEDIAN, 8, Wm); }
      else { L(a - 0.5, a, MEDIAN, 8, Wm); L(b, b + 0.5, -8, -MEDIAN, Wm); }
    }
  }

  // ───────── 중앙 호수공원 ─────────
  buildLakePark() {
    const R = seeded(77);
    const st = this.static, p = st.props;
    const S = 200, pts = [];
    for (let k = 0; k < S; k++) { const th = k / S * Math.PI * 2; const r = lakeR(th); pts.push([Math.cos(th) * r, Math.sin(th) * r, th, r]); }
    // 잔디 (호수 구멍)
    const x0 = PARK.x0 + SIDEWALK, x1 = PARK.x1 - SIDEWALK, z0 = PARK.z0 + SIDEWALK, z1 = PARK.z1 - SIDEWALK;
    const shape = new THREE.Shape([new THREE.Vector2(x0, -z0), new THREE.Vector2(x0, -z1), new THREE.Vector2(x1, -z1), new THREE.Vector2(x1, -z0)]);
    const hole = new THREE.Path(pts.slice().reverse().map(([x, z]) => new THREE.Vector2(x * 1.0 + Math.cos(Math.atan2(z, x)) * 9.5, -(z + Math.sin(Math.atan2(z, x)) * 9.5))));
    shape.holes.push(hole);
    const gg = new THREE.ShapeGeometry(shape); gg.rotateX(-Math.PI / 2);
    const uv = gg.attributes.uv; const pos = gg.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) / 6, pos.getZ(k) / 6);
    const grass = new THREE.Mesh(gg, this.mat.grass); grass.position.y = Y0 + 0.02; grass.receiveShadow = true; this.group.add(grass);
    // 산책로 (호수 둘레 링)
    const ringGeo = (r0, r1, y, uvs = 4) => {
      const v = [], n = [], u = [], idx = [];
      for (let k = 0; k <= S; k++) {
        const [,, th, r] = pts[k % S];
        const c = Math.cos(th), s = Math.sin(th);
        v.push(c * (r + r0), y, s * (r + r0), c * (r + r1), y, s * (r + r1));
        n.push(0, 1, 0, 0, 1, 0);
        u.push(c * (r + r0) / uvs, s * (r + r0) / uvs, c * (r + r1) / uvs, s * (r + r1) / uvs);
        if (k < S) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
      g.setIndex(idx); return g;
    };
    const path = new THREE.Mesh(ringGeo(3.5, 9.5, Y0 + 0.03), this.mat.pave); path.receiveShadow = true; this.group.add(path);
    const rim = new THREE.Mesh(ringGeo(0, 3.5, Y0 + 0.05), this.mat.curb); rim.receiveShadow = true; this.group.add(rim);
    // 물가 벽 (안쪽)
    const wall = new GB(); wall.setColor(0x7a766e);
    for (let k = 0; k < S; k++) { const a = pts[k], b = pts[(k + 1) % S]; wall.wall(a[0], a[1], b[0], b[1], -0.6, Y0 + 0.05); }
    this.group.add(new THREE.Mesh(wall.build(), this.mat.props));
    // 물
    const ws = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const wg = new THREE.ShapeGeometry(ws, 4); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, this.mat.water); water.position.y = 0.02; this.group.add(water);
    this.lakeWater = water;
    // 다리 (호수 가로지르는 목재 데크)
    const bx0 = -lakeR(Math.PI) - 4, bx1 = lakeR(0) + 4;
    p.setColor(0x8a6440); p.box(bx0, 0.55, -1.8, bx1, 0.7, 1.8);
    p.setColor(0x5a4030);
    for (let x = bx0 + 2; x < bx1; x += 6) { p.box(x, -0.5, -1.7, x + 0.3, 0.55, -1.4); p.box(x, -0.5, 1.4, x + 0.3, 0.55, 1.7); }
    p.setColor(0x3a3e44);
    p.box(bx0, 1.65, -1.85, bx1, 1.72, -1.75); p.box(bx0, 1.65, 1.75, bx1, 1.72, 1.85);
    for (let x = bx0; x < bx1; x += 2) { p.box(x, 0.7, -1.84, x + 0.06, 1.66, -1.78); p.box(x, 0.7, 1.78, x + 0.06, 1.66, 1.84); }
    this.bridge = { x0: bx0, x1: bx1, z0: -1.8, z1: 1.8 };
    // 음악분수
    const fz = -36;
    p.setColor(0x9a968e); p.addGeo(new THREE.TorusGeometry(5, 0.4, 8, 32).rotateX(Math.PI / 2).translate(0, 0.3, fz));
    this.jets = this.jets || [];
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2, rr = k === 0 ? 0 : 3.2;
      const jet = new THREE.Mesh(new THREE.ConeGeometry(k === 0 ? 0.9 : 0.35, k === 0 ? 10 : 5, 10, 1, true), this.mat.jet);
      jet.position.set(Math.cos(a) * rr * (k ? 1 : 0), k === 0 ? 5 : 2.5, fz + Math.sin(a) * rr * (k ? 1 : 0));
      this.group.add(jet); this.jets.push(jet);
    }
    // 수변 무대 (남쪽 물가)
    const sz = lakeR(Math.PI / 2) - 6;
    p.setColor(0x8a6440); p.box(-12, 0.2, sz, 12, 0.6, sz + 14);
    p.setColor(0xf2f2f0); for (const x of [-11, -4, 4, 11]) p.box(x - 0.2, 0.6, sz + 12, x + 0.2, 6.2, sz + 12.4);
    const canopy = new THREE.CylinderGeometry(14, 14, 0.4, 32, 1, false, Math.PI * 0.25, Math.PI * 0.5); canopy.scale(1, 1, 0.5); canopy.translate(0, 6.4, sz + 12); p.addGeo(canopy);
    this.colliders.push({ x0: -12, x1: 12, z0: sz + 11.9, z1: sz + 12.5, h: 6, soft: true });
    // 벤치 · 산책로 조명 · 꽃밭
    this.parkLamps = [];
    for (let k = 0; k < S; k += 5) {
      const [,, th, r] = pts[k];
      const c = Math.cos(th), s = Math.sin(th), rr = r + 10.3;
      if (k % 10 === 0) this.parkLamps.push([c * rr, s * rr]);
      else { p.setColor(0x7a5236); const g = new THREE.BoxGeometry(1.8, 0.08, 0.5); g.rotateY(-th + Math.PI / 2); g.translate(c * rr, Y0 + 0.45, s * rr); p.addGeo(g); }
    }
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2 + 0.2, r = lakeR(a) + 22 + R() * 8;
      const cols = [0xd04070, 0xf0c020, 0xf07030, 0xa050d0, 0xf2f2f2];
      for (let q = 0; q < 5; q++) { p.setColor(cols[(k + q) % cols.length]); p.cbox(Math.cos(a) * r + (q - 2) * 1.1, Y0 + 0.2, Math.sin(a) * r, 1, 0.35, 1.8); }
    }
    // 나무 (벚꽃 길 + 숲)
    for (let k = 0; k < S; k += 3) { const [,, th, r] = pts[k]; this.treeList.push([Math.cos(th) * (r + 13), Math.sin(th) * (r + 13), 0.95, 'pink']); }
    for (let k = 0; k < 170; k++) {
      const tx = x0 + 4 + R() * (x1 - x0 - 8), tz = z0 + 4 + R() * (z1 - z0 - 8);
      const th = Math.atan2(tz, tx), d = Math.hypot(tx, tz);
      if (d < lakeR(th) + 16) continue;
      if (Math.abs(tx) < 3 || Math.abs(tz) < 3) continue;
      this.treeList.push([tx, tz, 0.9 + R() * 0.8, R() < 0.15 ? 'pink' : null]);
    }
    // 공원 진입로 (네 방향)
    st.pave.top(-2.5, z0, 2.5, -lakeR(-Math.PI / 2) - 9, Y0 + 0.04, 4, 4);
    st.pave.top(-2.5, lakeR(Math.PI / 2) + 9, 2.5, z1, Y0 + 0.04, 4, 4);
    st.pave.top(x0, -2.5, -lakeR(Math.PI) - 9, 2.5, Y0 + 0.04, 4, 4);
    st.pave.top(lakeR(0) + 9, -2.5, x1, 2.5, Y0 + 0.04, 4, 4);
    this.lakePts = pts;
  }

  // ───────── 가로등 · 가로수 · 정류장 ─────────
  buildStreetFurniture() {
    const R = this.rand;
    const lamps = [];
    const props = this.static.props;
    for (const e of this.edges) {
      const L = e.b - e.a;
      const a = e.a + 16, b = e.b - 16;
      const n = Math.max(2, Math.round((b - a) / 30) + 1);
      for (const side of [-1, 1]) {
        const off = side * (ROAD / 2 + 0.7);
        for (let k = 0; k < n; k++) {
          const u = a + (b - a) * k / (n - 1);
          lamps.push(e.axis === 'z' ? { x: e.c + off, z: u, rot: side, axis: 'z' } : { x: u, z: e.c + off, rot: side, axis: 'x' });
        }
        for (let u = a + 6; u < b - 4; u += 11) {
          if (R() < 0.08) continue;
          const toff = side * (ROAD / 2 + 2.3);
          this.treeList.push(e.axis === 'z' ? [e.c + toff, u, 0.85 + R() * 0.3, null] : [u, e.c + toff, 0.85 + R() * 0.3, null]);
        }
        const mid = (a + b) / 2;
        if (R() < 0.25) this.busStop(props, side, e.c, mid + 12, e.axis);
        props.setColor(0x2f5f3a);
        if (e.axis === 'z') props.cbox(e.c + side * (ROAD / 2 + 1.2), Y0 + 0.5, mid - 7, 0.5, 0.95, 0.5); else props.cbox(mid - 7, Y0 + 0.5, e.c + side * (ROAD / 2 + 1.2), 0.5, 0.95, 0.5);
      }
    }
    // 가로등 (인스턴스) + 공원 조명
    const poleG = new THREE.CylinderGeometry(0.09, 0.14, 8.5, 6, 1, true); poleG.translate(0, 4.25, 0);
    const armG = new THREE.BoxGeometry(0.12, 0.12, 2.6); armG.translate(0, 8.4, -1.3);
    const headG = new THREE.BoxGeometry(0.42, 0.16, 0.9); headG.translate(0, 8.32, -2.6);
    const parkPole = new THREE.CylinderGeometry(0.06, 0.08, 3.6, 6); parkPole.translate(0, 1.8, 0);
    const parkHead = new THREE.SphereGeometry(0.28, 10, 8); parkHead.translate(0, 3.75, 0);
    const pl = this.parkLamps || [];
    const tot = lamps.length + pl.length;
    const pole = new THREE.InstancedMesh(poleG, this.mat.darkMetal, lamps.length);
    const arm = new THREE.InstancedMesh(armG, this.mat.darkMetal, lamps.length);
    const head = new THREE.InstancedMesh(headG, this.mat.lampHead, lamps.length);
    const ppole = new THREE.InstancedMesh(parkPole, this.mat.darkMetal, pl.length);
    const phead = new THREE.InstancedMesh(parkHead, this.mat.lampHead, pl.length);
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.mat.pool, tot);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    lamps.forEach((l, k) => {
      const ry = l.axis === 'z' ? (l.rot > 0 ? Math.PI / 2 : -Math.PI / 2) : (l.rot > 0 ? 0 : Math.PI);
      e.set(0, ry, 0); q.setFromEuler(e);
      m4.compose(v.set(l.x, Y0, l.z), q, one);
      pole.setMatrixAt(k, m4); arm.setMatrixAt(k, m4); head.setMatrixAt(k, m4);
      const hx = l.x + (l.axis === 'z' ? -l.rot * 2.6 : 0), hz = l.z + (l.axis === 'x' ? -l.rot * 2.6 : 0);
      m4.compose(v.set(hx, 0.06, hz), new THREE.Quaternion(), new THREE.Vector3(14, 1, 14));
      pools.setMatrixAt(k, m4);
      this.addPole(l.x, l.z);
    });
    pl.forEach(([x, z], k) => {
      m4.compose(v.set(x, Y0, z), new THREE.Quaternion(), one);
      ppole.setMatrixAt(k, m4); phead.setMatrixAt(k, m4);
      m4.compose(v.set(x, Y0 + 0.07, z), new THREE.Quaternion(), new THREE.Vector3(7, 1, 7));
      pools.setMatrixAt(lamps.length + k, m4);
      this.addPole(x, z);
    });
    pole.castShadow = true;
    for (const im of [pole, arm, head, ppole, phead, pools]) this.group.add(im);
    pools.renderOrder = 2;
    this.lampCount = tot;
    this.buildTrees();
  }

  // 나무: 6×6 구역 · 가까우면 상세, 멀면 단순한 덩어리
  buildTrees() {
    const R = seeded(99);
    const trunkG = new THREE.CylinderGeometry(0.15, 0.24, 3.2, 5, 1, true); trunkG.translate(0, 1.6, 0);
    const leafG = new THREE.IcosahedronGeometry(2.2, 1); leafG.translate(0, 4.6, 0);
    const pos = leafG.attributes.position;
    for (let k = 0; k < pos.count; k++) { const n = 1 + (Math.sin(pos.getX(k) * 3.1) + Math.cos(pos.getZ(k) * 2.7 + pos.getY(k))) * 0.08; pos.setXYZ(k, pos.getX(k) * n, 4.6 + (pos.getY(k) - 4.6) * 0.85 * n, pos.getZ(k) * n); }
    leafG.computeVertexNormals();
    const leaf2 = new THREE.IcosahedronGeometry(1.5, 0); leaf2.translate(0.9, 5.8, 0.4);
    const lowG = new THREE.IcosahedronGeometry(2.3, 0); lowG.scale(1, 1.15, 1); lowG.translate(0, 4.4, 0);
    const lowTrunk = new THREE.BoxGeometry(0.35, 3, 0.35); lowTrunk.translate(0, 1.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4532, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const G = 6, cell = (HALF * 2 + 60) / G;
    const buckets = Array.from({ length: G * G }, () => []);
    for (const t of this.treeList) {
      const gi = Math.min(G - 1, Math.max(0, Math.floor((t[0] + HALF + 30) / cell)));
      const gj = Math.min(G - 1, Math.max(0, Math.floor((t[1] + HALF + 30) / cell)));
      buckets[gi + gj * G].push(t);
      this.addPole(t[0], t[1]);
    }
    this.treeChunks = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), col = new THREE.Color();
    buckets.forEach((list, idx) => {
      if (!list.length) return;
      const near = new THREE.Group(), far = new THREE.Group();
      const trunk = new THREE.InstancedMesh(trunkG, trunkMat, list.length);
      const leaves = new THREE.InstancedMesh(leafG, leafMat, list.length);
      const leaves2 = new THREE.InstancedMesh(leaf2, leafMat, list.length);
      const low = new THREE.InstancedMesh(lowG, leafMat, list.length);
      const lowT = new THREE.InstancedMesh(lowTrunk, trunkMat, list.length);
      list.forEach(([x, z, sc, kind], k) => {
        e.set(0, R() * 6.28, 0); q.setFromEuler(e);
        m4.compose(v.set(x, Y0, z), q, new THREE.Vector3(sc, sc, sc));
        trunk.setMatrixAt(k, m4); leaves.setMatrixAt(k, m4); leaves2.setMatrixAt(k, m4); low.setMatrixAt(k, m4); lowT.setMatrixAt(k, m4);
        if (kind === 'pink') col.setHSL(0.93 + R() * 0.04, 0.55, 0.78 + R() * 0.08);
        else col.setHSL(0.22 + R() * 0.08, 0.38 + R() * 0.2, 0.22 + R() * 0.1);
        leaves.setColorAt(k, col); low.setColorAt(k, col); col.offsetHSL(0.01, 0, 0.04); leaves2.setColorAt(k, col);
      });
      for (const im of [trunk, leaves, leaves2]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); near.add(im); }
      for (const im of [low]) { im.computeBoundingSphere(); far.add(im); }
      const gi = idx % G, gj = Math.floor(idx / G);
      const c = [-HALF - 30 + (gi + 0.5) * cell, -HALF - 30 + (gj + 0.5) * cell];
      this.group.add(near, far);
      this.treeChunks.push({ near, far, c, half: cell / 2 });
    });
    this.treeCount = this.treeList.length;
  }

  busStop(gb, side, c, u, axis) {
    const off = side * (ROAD / 2 + 2.6);
    const [x, z] = axis === 'z' ? [c + off, u] : [u, c + off];
    const w = 4.5, d = 1.5;
    const W = axis === 'z' ? d : w, D = axis === 'z' ? w : d;
    gb.setColor(0x3a3f45); gb.cbox(x, Y0 + 2.6, z, W + 0.2, 0.12, D + 0.2);
    gb.setColor(0x2a2e33);
    gb.cbox(x - W / 2, Y0 + 1.3, z - D / 2, 0.1, 2.6, 0.1); gb.cbox(x + W / 2, Y0 + 1.3, z + D / 2, 0.1, 2.6, 0.1);
    gb.cbox(x - W / 2, Y0 + 1.3, z + D / 2, 0.1, 2.6, 0.1); gb.cbox(x + W / 2, Y0 + 1.3, z - D / 2, 0.1, 2.6, 0.1);
    gb.setColor(0x8fb4c9);
    if (axis === 'z') gb.cbox(x + side * d / 2, Y0 + 1.5, z, 0.05, 2, w); else gb.cbox(x, Y0 + 1.5, z + side * d / 2, w, 2, 0.05);
    gb.setColor(0x6b4a2e); gb.cbox(x + (axis === 'z' ? side * 0.3 : 0), Y0 + 0.5, z + (axis === 'x' ? side * 0.3 : 0), axis === 'z' ? 0.45 : 3, 0.08, axis === 'z' ? 3 : 0.45);
    gb.setColor(0x1d6fb8); gb.cbox(x + (axis === 'z' ? -side * 0.9 : -2.6), Y0 + 2.1, z + (axis === 'x' ? -side * 0.9 : -2.6), 0.6, 0.6, 0.06);
  }

  buildSignals() {
    const poles = [], heads = { '+z': [], '-z': [], '+x': [], '-x': [] };
    const o = ROAD / 2 + 0.6;
    this.cameras = new Set();
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) {
      if (!nodeExists(a, b)) continue;
      const X = ROADS[a], Z = ROADS[b];
      if (this.rand() < 0.3) this.cameras.add(a + ',' + b);
      const list = [
        [X - o, Z - o, Math.PI, '+z', hasEdge(a, b, [0, -1])],
        [X + o, Z + o, 0, '-z', hasEdge(a, b, [0, 1])],
        [X - o, Z + o, -Math.PI / 2, '+x', hasEdge(a, b, [-1, 0])],
        [X + o, Z - o, Math.PI / 2, '-x', hasEdge(a, b, [1, 0])],
      ];
      for (const [x, z, ry, ap, ok] of list) {
        if (!ok) continue;
        poles.push([x, z, ry]); heads[ap].push([x, z, ry]); this.addPole(x, z);
      }
    }
    const poleG = new THREE.CylinderGeometry(0.13, 0.16, 6.6, 8); poleG.translate(0, 3.3, 0);
    const armG = new THREE.BoxGeometry(7.4, 0.17, 0.17); armG.translate(-3.7, 6.3, 0);
    const boxG = new THREE.BoxGeometry(1.25, 0.45, 0.35); boxG.translate(-6.1, 5.95, 0);
    const lampG = new THREE.CircleGeometry(0.15, 12);
    const dm = this.mat.darkMetal;
    const P1 = new THREE.InstancedMesh(poleG, dm, poles.length), P2 = new THREE.InstancedMesh(armG, dm, poles.length), P3 = new THREE.InstancedMesh(boxG, new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.6 }), poles.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
    poles.forEach(([x, z, ry], k) => { e.set(0, ry, 0); q.setFromEuler(e); m4.compose(v.set(x, Y0, z), q, one); P1.setMatrixAt(k, m4); P2.setMatrixAt(k, m4); P3.setMatrixAt(k, m4); });
    P1.castShadow = true; P2.castShadow = true;
    this.group.add(P1, P2, P3);
    const colors = { r: 0xff2a1a, y: 0xffb000, g: 0x22ff88 };
    this.sigMats = {};
    for (const ap of Object.keys(heads)) {
      this.sigMats[ap] = {};
      const list = heads[ap];
      for (const [ci, c] of [['r', -0.4], ['y', 0], ['g', 0.4]]) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x222222, fog: false });
        this.sigMats[ap][ci] = { mat, on: new THREE.Color(colors[ci]).multiplyScalar(1.6), off: new THREE.Color(0x1d1d1d) };
        const im = new THREE.InstancedMesh(lampG, mat, list.length);
        list.forEach(([x, z, ry], k) => {
          e.set(0, ry, 0); q.setFromEuler(e);
          const base = new THREE.Matrix4().compose(v.set(x, Y0, z), q, one);
          im.setMatrixAt(k, base.multiply(new THREE.Matrix4().makeTranslation(-6.1 + c, 5.95, 0.18)));
        });
        this.group.add(im);
      }
    }
  }

  flushStatic() {
    const st = this.static;
    const add = (gb, mat, shadow) => { if (gb.empty) return; const m = new THREE.Mesh(gb.build(), mat); m.receiveShadow = true; m.castShadow = !!shadow; this.group.add(m); };
    add(st.side, this.mat.sidewalk); add(st.curb, this.mat.curb); add(st.grass, this.mat.grass); add(st.pave, this.mat.pave); add(st.asph, this.mat.asphalt);
    add(st.white, this.mat.white); add(st.yellow, this.mat.yellow); add(st.hedge, this.mat.hedge, true); add(st.props, this.mat.props, true);
    this.static = null;
  }

  // ───────── 건물 LOD ─────────
  buildFarAll() {
    this.farLitMeshes = [];
    for (const b of this.blocks) {
      if (!b.specs.length) continue;
      const F = { solid: new GB(), lit: new GB() };
      for (const s of b.specs) buildFar(F, s);
      const g = new THREE.Group();
      const sm = new THREE.Mesh(F.solid.build(), this.B.solid); sm.receiveShadow = true; g.add(sm);
      if (!F.lit.empty) { const lm = new THREE.Mesh(F.lit.build(), this.B.lit); lm.visible = false; g.add(lm); this.farLitMeshes.push(lm); b.farLit = lm; }
      b.far = g; this.group.add(g);
    }
  }
  buildNearBlock(b) {
    const B = new Bld();
    for (const s of b.specs) buildNear(B, s);
    for (const fn of b.extras) fn(B);
    const g = new THREE.Group();
    for (const m of B.meshes(this.B)) g.add(m);
    if (b.gateSign) {
      // 단지 이름판
      const t = T.sign(b.name, '#2f3a33', '#f2efe6', '', 512, 96);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
      m.position.set(b.gateSign.cx, Y0 + 3.6, b.gateSign.z); m.rotation.y = Math.PI; g.add(m);
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 1.1), this.mat.props); m2.position.set(b.gateSign.cx, Y0 + 3.2, b.gateSign.z + 0.55); g.add(m2);
    }
    this.group.add(g);
    b.near = g;
  }
  disposeNear(b) {
    if (!b.near) return;
    this.group.remove(b.near);
    b.near.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material.map && !Object.values(this.B).includes(o.material) && o.material !== this.mat.props) { o.material.map.dispose(); o.material.dispose(); } } });
    b.near = null;
  }
  setNearRadius(r) { this.nearR = r; }
  blockDist(b, p) {
    const r = b.r;
    const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1), dz = Math.max(r.z0 - p.z, 0, p.z - r.z1);
    return Math.hypot(dx, dz);
  }
  // 매 프레임: 가까운 블록은 상세 모델, 먼 블록은 단순 모델
  updateLOD(camPos, budget = 1) {
    let built = 0;
    const order = this.blocks.filter(b => b.specs.length).map(b => [b, this.blockDist(b, camPos)]).sort((a, b) => a[1] - b[1]);
    for (const [b, d] of order) {
      const want = d < this.nearR;
      if (want && !b.near && built < budget) { this.buildNearBlock(b); built++; }
      if (b.near) {
        const show = d < this.nearR + 30;
        b.near.visible = show;
        if (b.far) b.far.visible = !show;
        if (d > this.nearR * 1.8 + 80) { this.disposeNear(b); if (b.far) b.far.visible = true; }
      } else if (b.far) b.far.visible = true;
    }
    if (this.treeChunks) for (const t of this.treeChunks) {
      const dx = Math.max(0, Math.abs(t.c[0] - camPos.x) - t.half), dz = Math.max(0, Math.abs(t.c[1] - camPos.z) - t.half);
      const d = Math.hypot(dx, dz);
      t.near.visible = d < 120;
      t.far.visible = d >= 120 && d < 900;
    }
  }
  warmup(camPos) { this.updateLOD(camPos, 99); }

  buildOutskirts() {
    const R = this.rand;
    const F = { solid: new GB(), lit: new GB() };
    for (let k = 0; k < 220; k++) {
      const ang = R() * Math.PI * 2, rad = HALF + 160 + Math.pow(R(), 0.7) * 600;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (Math.abs(x) < HALF + 120 && Math.abs(z) < HALF + 120) continue;
      const apt = R() < 0.7;
      const w = apt ? 30 : 20 + R() * 20, d = apt ? 12 : 20 + R() * 20;
      F.solid.setRGB(0, 0, 0);
      buildFar(F, { type: apt ? 'apt' : 'office', x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: 0, floors: apt ? 15 + Math.floor(R() * 15) : 8 + Math.floor(R() * 25), fh: apt ? 2.9 : 3.8, color: APT_COLORS[Math.floor(R() * APT_COLORS.length)], accent: APT_ACCENT[Math.floor(R() * APT_ACCENT.length)], seed: 5000 + k, front: 'S' });
    }
    this.group.add(new THREE.Mesh(F.solid.build(), this.B.solid));
    const lm = new THREE.Mesh(F.lit.build(), this.B.lit); lm.visible = false; this.group.add(lm); this.farLitMeshes.push(lm);
    const mtn = new THREE.MeshStandardMaterial({ color: 0x3c5048, roughness: 1, flatShading: true });
    for (let k = 0; k < 16; k++) {
      const ang = k / 16 * Math.PI * 2 + R() * 0.3, rad = 1750 + R() * 300;
      const m = new THREE.Mesh(new THREE.ConeGeometry(300 + R() * 260, 160 + R() * 220, 7), mtn);
      m.position.set(Math.cos(ang) * rad, 50, Math.sin(ang) * rad); m.rotation.y = R() * 3;
      this.group.add(m);
    }
  }

  // 신호: 4현시 × 10초 (녹 8초 + 황 2초)
  signal(ap) {
    const order = ['+z', '-z', '+x', '-x'];
    const t = this.signalT % 40, idx = Math.floor(t / 10);
    if (order[idx] !== ap) return 'r';
    return t % 10 < 8 ? 'g' : 'y';
  }

  // 차도 위인지 판단 (아니면 보도·블록 위)
  onRoad(x, z) {
    const lim = HALF + ROAD / 2;
    if (Math.abs(x) > lim || Math.abs(z) > lim) return false;
    const kx = nearestRoad(x), kz = nearestRoad(z);
    const inX = Math.abs(x - ROADS[kx]) < ROAD / 2, inZ = Math.abs(z - ROADS[kz]) < ROAD / 2;
    if (inX && inZ) return nodeExists(kx, kz);
    if (inX) return !REMOVED.has(`v:${kx}:${blockIndex(z)}`);
    if (inZ) return !REMOVED.has(`h:${kz}:${blockIndex(x)}`);
    return false;
  }
  isOnBlock(x, z) { return !this.onRoad(x, z); }
  onBridge(x, z) { const b = this.bridge; return b && x > b.x0 && x < b.x1 && z > b.z0 - 0.2 && z < b.z1 + 0.2; }
  groundY(x, z) {
    if (this.onBridge(x, z)) return 0.7;
    if (this.onRoad(x, z)) {
      // 중앙분리대
      return 0;
    }
    return Y0;
  }

  addPole(x, z) {
    const k = Math.floor(x / 10) + ',' + Math.floor(z / 10);
    if (!this.poleGrid.has(k)) this.poleGrid.set(k, []);
    this.poleGrid.get(k).push(x, z);
  }
  nearPole(x, z, r) {
    const gx = Math.floor(x / 10), gz = Math.floor(z / 10);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.poleGrid.get((gx + i) + ',' + (gz + j));
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) if (Math.abs(a[k] - x) < r && Math.abs(a[k + 1] - z) < r && Math.hypot(a[k] - x, a[k + 1] - z) < r) return true;
    }
    return false;
  }

  // 원(반지름 r) 충돌 → 밀어내기
  collide(pos, r, opts = {}) {
    let hit = false;
    for (const c of this.colliders) {
      if (pos.x + r < c.x0 || pos.x - r > c.x1 || pos.z + r < c.z0 || pos.z - r > c.z1) continue;
      if (c.median && opts.walker) continue;
      const nx = Math.max(c.x0, Math.min(pos.x, c.x1)), nz = Math.max(c.z0, Math.min(pos.z, c.z1));
      const dx = pos.x - nx, dz = pos.z - nz, d = Math.hypot(dx, dz);
      if (d < r) {
        hit = true;
        if (d < 1e-4) {
          const l = pos.x - c.x0, rr = c.x1 - pos.x, t = pos.z - c.z0, b = c.z1 - pos.z;
          const mn = Math.min(l, rr, t, b);
          if (mn === l) pos.x = c.x0 - r; else if (mn === rr) pos.x = c.x1 + r; else if (mn === t) pos.z = c.z0 - r; else pos.z = c.z1 + r;
        } else { pos.x = nx + dx / d * r; pos.z = nz + dz / d * r; }
      }
    }
    // 호수
    if (pos.x > PARK.x0 && pos.x < PARK.x1 && pos.z > PARK.z0 && pos.z < PARK.z1 && !this.onBridge(pos.x, pos.z)) {
      const th = Math.atan2(pos.z, pos.x), d = Math.hypot(pos.x, pos.z), lr = lakeR(th) + 0.6 + r;
      if (d < lr) { pos.x = Math.cos(th) * lr; pos.z = Math.sin(th) * lr; hit = true; }
    }
    // 기둥
    const gx = Math.floor(pos.x / 10), gz = Math.floor(pos.z / 10), pr = r + 0.18;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.poleGrid.get((gx + i) + ',' + (gz + j));
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) {
        const dx = pos.x - a[k], dz = pos.z - a[k + 1];
        if (Math.abs(dx) > pr || Math.abs(dz) > pr) continue;
        const d = Math.hypot(dx, dz);
        if (d < pr && d > 1e-4) { pos.x = a[k] + dx / d * pr; pos.z = a[k + 1] + dz / d * pr; hit = true; }
      }
    }
    const L = HALF + ROAD / 2 + 5;
    if (pos.x < -L) { pos.x = -L; hit = true; } if (pos.x > L) { pos.x = L; hit = true; }
    if (pos.z < -L) { pos.z = -L; hit = true; } if (pos.z > L) { pos.z = L; hit = true; }
    return hit;
  }

  update(dt, night, time, camPos) {
    this.signalT += dt;
    this.night = night;
    const B = this.B;
    B.lit.emissiveIntensity = night * 1.25;
    B.shopLit.emissiveIntensity = 0.35 + night * 0.9;
    B.sign.emissiveIntensity = 0.2 + night * 0.9;
    for (const m of this.farLitMeshes) m.visible = night > 0.2;
    this.mat.lampHead.emissiveIntensity = night > 0.3 ? 2.2 : 0;
    this.mat.pool.opacity = Math.max(0, night - 0.25) * 0.6;
    for (const s of this.signs) s.emissiveIntensity = 0.12 + night * 0.9;
    for (const ap in this.sigMats) {
      const st = this.signal(ap);
      for (const c of ['r', 'y', 'g']) { const m = this.sigMats[ap][c]; m.mat.color.copy(c === st ? m.on : m.off); }
    }
    this.mat.ring.opacity = 0.55 + Math.sin(time * 4) * 0.25;
    if (this.jets) this.jets.forEach((j, k) => { j.scale.y = 0.75 + Math.sin(time * 2.2 + k) * 0.25; this.mat.jet.color.setHSL(night > 0.4 ? (time * 0.05 + k * 0.1) % 1 : 0.58, night > 0.4 ? 0.7 : 0.2, 0.85); });
    if (camPos) this.updateLOD(camPos);
  }
}

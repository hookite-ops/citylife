import * as THREE from 'three';
import { N, ROAD, MEDIAN, SIDEWALK, ROADS, STOP, HALF, blockRect, hasEdge, nodeExists, REMOVED, nearestRoad, blockIndex, HOMES } from './config.js';
import { GB, seeded } from './geo.js';
import * as T from './textures.js';
import { Bld, buildNear, buildMid, buildBox, makeMaterials, specH, faces } from './buildings.js';
import { describe, entrancesOf } from './bplan.js';
import { TYPES } from './tenants.js';

// ───────── 한빛신도시 (실제 크기, 약 2.9km) ─────────
// 행 j: 북→남, 열 i: 서→동
// A 아파트단지 · S 근린상가 · C 업무 · T 주상복합 · V 빌라촌 · G 시청·문화 · L 호수공원 · P 근린공원
// E 초등 · M 중 · H 고 · U 대학
export const ZONES = [
  'AAAPAAAAAAAA',
  'AEAAAMAAPAAA',
  'AAVSAAAASAAA',
  'PASCCTTCCSAA',
  'AASTCGGCTSHA',
  'AAATTLLTTAAA',
  'AAACTLLTCAAP',
  'AASCCTTCCSAA',
  'AAASAAAASVAA',
  'AAAAAPAAAAEA',
  'UAPAAAAAAAAA',
  'AAAAAAAAAAAA',
];
export const ZONE_COLOR = { A: '#5d6b5e', S: '#6e6a62', C: '#58626e', T: '#62606e', V: '#6e5f58', G: '#6a6a60', L: '#3f6a3a', P: '#46703e', E: '#6a6248', M: '#6a6248', H: '#6a6248', U: '#5a6448' };

export const SCHOOLS = {
  E: { type: 'elem', name: '한빛초등학교', icon: '🎒', color: '#2a7a4a', floors: 4 },
  M: { type: 'middle', name: '한빛중학교', icon: '🏫', color: '#2a4a8a', floors: 4 },
  H: { type: 'high', name: '한빛고등학교', icon: '🏫', color: '#6a2a2a', floors: 5 },
  U: { type: 'univ', name: '한빛대학교', icon: '🎓', color: '#1a2a5a', floors: 6 },
};

const SP = {
  home: { id: 'home', homeId: 'oneroom', name: '우리집 · 한빛원룸', sign: ['한빛원룸', '#4a3426', '#ffe9c8', 'HANBIT ROOM'], icon: '🏠' },
  mart: { id: 'mart', name: '24시 편의점', sign: ['24 마트', '#1f8a4c', '#ffffff', '24시간 편의점'], icon: '🏪' },
  rest: { id: 'rest', name: '한끼식당', sign: ['한끼식당', '#8a2a1a', '#ffe7b0', '한식 · 백반 · 갈비'], icon: '🍚' },
  delivery: { id: 'delivery', name: '번개배달 센터', sign: ['번개배달', '#e0a20a', '#1a1a1a', '배달 기사 모집'], icon: '🛵' },
  cars: { id: 'cars', name: '드림모터스 전시장', sign: ['DREAM MOTORS', '#111418', '#f2f2f2', '신차 · 중고차'], icon: '🚗', showroom: true },
  furn: { id: 'furn', name: '홈데코 가구점', sign: ['홈데코', '#2f4a3a', '#f1ead8', '가구 · 인테리어'], icon: '🛋️' },
  realty: { id: 'realty', name: '행복 부동산', sign: ['행복 부동산', '#1d3b6e', '#ffffff', '매매 · 전세 · 월세'], icon: '🏘️' },
  gym: { id: 'gym', name: '헬스장 · 핏라이프', sign: ['FIT LIFE', '#202020', '#ff5a2a', '24시 헬스 · 샤워'], icon: '💪' },
  stat: { id: 'stat', name: '문구랜드', sign: ['문구랜드', '#ff8a3a', '#ffffff', '문구 · 완구 · 팬시'], icon: '✏️' },
  office: { id: 'office', name: '한빛그룹 본사', sign: ['HANBIT GROUP', '#0f2a44', '#e8f1ff', '한빛그룹'], icon: '🏢' },
};
export const SPECIALS = SP;
const BLOCK_SP = {
  '3,2': ['mart', 'stat', 'rest'], '2,3': ['furn'], '2,4': ['realty'], '2,7': ['gym'], '9,3': ['delivery'], '9,4': ['cars'], '8,8': ['mart'],
};
const APT_HOME_BLOCK = '1,2', PENT_BLOCK = '4,5', HQ_BLOCK = '4,4', HOME_BLOCK = '2,2';

export function lakeR(th) { return 160 + 18 * Math.sin(2 * th + 0.6) + 12 * Math.sin(3 * th + 1.9) + 7 * Math.sin(5 * th + 0.3); }
const PARK = { x0: ROADS[5] + ROAD / 2, x1: ROADS[7] - ROAD / 2, z0: ROADS[5] + ROAD / 2, z1: ROADS[7] - ROAD / 2 };

const APT_COLORS = [[0.97, 0.96, 0.92], [0.95, 0.94, 0.9], [0.94, 0.94, 0.96], [0.98, 0.94, 0.86], [0.92, 0.94, 0.97]];
const APT_ACCENT = [[0.2, 0.52, 0.86], [0.85, 0.42, 0.22], [0.24, 0.66, 0.38], [0.5, 0.52, 0.56], [0.9, 0.28, 0.26], [0.36, 0.34, 0.75], [0.98, 0.68, 0.16]];
const SHOP_COLORS = [[0.94, 0.92, 0.88], [0.84, 0.84, 0.84], [0.44, 0.46, 0.5], [0.9, 0.8, 0.66], [0.97, 0.97, 0.95], [0.66, 0.44, 0.32], [0.3, 0.32, 0.36], [0.6, 0.74, 0.86], [0.95, 0.8, 0.6]];
const VILLA_COLORS = [[0.74, 0.38, 0.28], [0.82, 0.5, 0.36], [0.92, 0.86, 0.76], [0.66, 0.34, 0.27], [0.95, 0.93, 0.87], [0.76, 0.66, 0.56], [0.9, 0.72, 0.48]];
const APT_NAMES = ['한빛마을', '푸른숲', '호수마을', '새솔마을', '가온마을', '도담마을', '나래마을', '늘봄마을', '햇살마을', '다정마을', '새뜸마을', '해밀마을'];
const Y0 = 0.18;

// 충돌 검사용 공간 해시
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); this.stamp = 0; }
  key(i, j) { return i * 100003 + j; }
  add(c) {
    const s = this.cell;
    for (let i = Math.floor(c.x0 / s); i <= Math.floor(c.x1 / s); i++) for (let j = Math.floor(c.z0 / s); j <= Math.floor(c.z1 / s); j++) {
      const k = this.key(i, j); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(c);
    }
  }
  query(x0, z0, x1, z1, out) {
    const s = this.cell; out.length = 0; this.stamp++;
    for (let i = Math.floor(x0 / s); i <= Math.floor(x1 / s); i++) for (let j = Math.floor(z0 / s); j <= Math.floor(z1 / s); j++) {
      const a = this.map.get(this.key(i, j)); if (!a) continue;
      for (const c of a) if (c._st !== this.stamp) { c._st = this.stamp; out.push(c); }
    }
    return out;
  }
}

export class City {
  constructor(scene, quality, lazy) {
    this.scene = scene;
    this.colliders = [];
    this.grid = new Grid(40);
    this.entrances = [];
    this.doors = [];
    this.parking = {};
    this.parkedSpots = [];
    this.poleGrid = new Map();
    this.treeGrid = new Map();
    this.blocks = [];
    this.chunks = [];
    this.sites = [];
    this.farLit = [];
    this.night = 0;
    this.signalT = 0;
    this.signs = [];
    this.jets = [];
    this.rand = seeded(20261020);
    this.group = new THREE.Group();
    scene.add(this.group);
    this.setNearRadius(220);
    this.makeMaterials();
    this.static = { props: new GB(), side: new GB(), curb: new GB(), grass: new GB(), pave: new GB(), asph: new GB(), white: new GB(), yellow: new GB(), hedge: new GB() };
    // 단계별로 지어서 로딩 화면에 진행률을 보여줄 수 있게
    this.steps = [
      ['도시 계획을 세우는 중', () => this.buildPlan()],
      ['도로와 인도를 까는 중', () => { this.buildGround(); this.buildMarkings(); }],
      ['호수공원을 꾸미는 중', () => this.buildLakePark()],
      ['가로등과 신호등을 세우는 중', () => { this.buildStreetFurniture(); this.buildSignals(); }],
      ['건물을 짓는 중', () => { this.assignChunks(); this.flushStatic(); this.buildFarAll(); this.buildBldgs(); }],
      ['가게와 집 안을 꾸미는 중', () => this.buildSites()],
      ['도시 외곽을 그리는 중', () => { this.buildOutskirts(); this.buildRings(); this.finishGrid(); }],
    ];
    if (!lazy) for (const [, f] of this.steps) f();
  }
  finishGrid() {
    for (const c of this.colliders) this.grid.add(c);
    // 나중에 colliders.push 로 추가되는 것도 격자에 들어가게
    const grid = this.grid, arr = this.colliders, push = arr.push.bind(arr);
    arr.push = (...cs) => { for (const c of cs) grid.add(c); return push(...cs); };
  }
  setNearRadius(n) { this.nearR = n; this.midR = Math.max(650, n * 3.4); this.treeNearR = Math.max(120, n * 0.75); this.treeMidR = Math.max(500, n * 2.6); this.siteR = Math.max(380, n * 1.8); }

  makeMaterials() {
    const asp = T.asphalt();
    this.mat = {
      asphalt: new THREE.MeshStandardMaterial({ map: asp, roughness: 0.92 }),
      sidewalk: new THREE.MeshStandardMaterial({ map: T.sidewalk(), roughness: 0.85 }),
      pave: new THREE.MeshStandardMaterial({ map: T.sidewalk(), roughness: 0.8, color: 0xeee8de }),
      curb: new THREE.MeshStandardMaterial({ color: 0xa6a49f, roughness: 0.8 }),
      grass: new THREE.MeshStandardMaterial({ map: T.grass(), roughness: 1, color: 0xd2f8a0 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xf6c41c, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.5, metalness: 0.3 }),
      plain: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.6 }),
      props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.02 }),
      hedge: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
      water: new THREE.MeshStandardMaterial({ color: 0x2f8fc0, roughness: 0.08, metalness: 0.45, envMapIntensity: 1.3 }),
      pool: new THREE.MeshBasicMaterial({ map: T.lightPool(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      ring: new THREE.MeshBasicMaterial({ color: 0x46d1ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
      jet: new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.55, depthWrite: false }),
    };
    this.B = makeMaterials();
    this.treeMats = { trunk: new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 1 }), leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }) };
  }

  blockAt(x, z) { return this.blocks[blockIndex(z) * N + blockIndex(x)]; }

  // ───────── 마스터플랜 ─────────
  buildPlan() {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const zone = ZONES[j][i];
      const r = blockRect(i, j);
      this.blocks.push({ i, j, zone, r, specs: [], extras: [], trees: [], lamps: [], parkLamps: [], seed: 1000 + i * 37 + j * 101, mid: null });
    }
    for (const blk of this.blocks) {
      const R = seeded(blk.seed);
      const key = `${blk.i},${blk.j}`;
      const zone = blk.zone;
      if (zone === 'A') this.planApt(blk, R, key === APT_HOME_BLOCK);
      else if (zone === 'S') this.planShops(blk, R, BLOCK_SP[key] || []);
      else if (zone === 'C') this.planOffice(blk, R, key === HQ_BLOCK);
      else if (zone === 'T') this.planMixed(blk, R, key === PENT_BLOCK);
      else if (zone === 'V') this.planVillas(blk, R, key === HOME_BLOCK);
      else if (zone === 'G') this.planCivic(blk, R);
      else if (zone === 'P') this.planPark(blk, R);
      else if (SCHOOLS[zone]) this.planSchool(blk, R, SCHOOLS[zone]);
      for (const s of blk.specs) {
        if (s.noCollide) continue;
        const gh = (s.type === 'shop' || s.type === 'podium') ? (s.groundH || 4.6) : s.type === 'villa' ? 2.8 : 0;
        this.colliders.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, h: specH(s) + gh, spec: s });
      }
    }
  }
  buildRings() {
    const ringGeo = new THREE.RingGeometry(0.9, 1.15, 40); ringGeo.rotateX(-Math.PI / 2);
    for (const e of this.entrances) { const ring = new THREE.Mesh(ringGeo, this.mat.ring); ring.position.set(e.x, Y0 + 0.06, e.z); this.group.add(ring); e.ring = ring; }
  }

  addEntrance(sp, s, faceKey, u, extra = {}) {
    const f = faces(s)[faceKey];
    const e = { id: sp.id, homeId: sp.homeId, name: sp.name, icon: sp.icon, x: f.p[0] + f.t[0] * u + f.n[0] * 2.2, z: f.p[1] + f.t[1] * u + f.n[1] * 2.2, nx: f.n[0], nz: f.n[1], face: Math.atan2(f.n[0], f.n[1]), ...extra };
    this.entrances.push(e);
    return e;
  }
  signMat(sp) {
    const t = T.sign(sp[0], sp[1], sp[2], sp[3]);
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5 });
    this.signs.push(m);
    return m;
  }
  addSign(sp, s, faceKey, u, y, scale = 1, d = 0.3) {
    const f = faces(s)[faceKey];
    const w = 8 * scale, h = w / 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.signMat(sp.sign));
    m.position.set(f.p[0] + f.t[0] * u + f.n[0] * d, y, f.p[1] + f.t[1] * u + f.n[1] * d);
    m.rotation.y = Math.atan2(f.n[0], f.n[1]);
    this.group.add(m);
    return m;
  }
  curbSpot(s, faceKey, u) {
    const f = faces(s)[faceKey];
    const x = f.p[0] + f.t[0] * u, z = f.p[1] + f.t[1] * u;
    let rx, rz, rot;
    if (f.n[0]) { const k = nearestRoad(x + f.n[0] * 16); rx = ROADS[k] - f.n[0] * (ROAD / 2 - 1.1); rz = z; rot = f.n[1] === 0 && f.n[0] > 0 ? 0 : Math.PI; }
    else { const k = nearestRoad(z + f.n[1] * 16); rz = ROADS[k] - f.n[1] * (ROAD / 2 - 1.1); rx = x; rot = f.n[1] > 0 ? -Math.PI / 2 : Math.PI / 2; }
    return { x: rx, z: rz, rot };
  }
  tree(blk, x, z, s, kind) {
    if (blk.zone === 'L') blk = this.blockAt(x, z);
    blk.trees.push([x, z, s, kind]);
  }

  // 아파트 단지 (판상형 약 40~53m · 층고 2.9m)
  planApt(blk, R, aptHome) {
    const r = blk.r, m = SIDEWALK + 12;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    const w = x1 - x0, d = z1 - z0;
    const color = APT_COLORS[Math.floor(R() * APT_COLORS.length)], accent = APT_ACCENT[Math.floor(R() * APT_ACCENT.length)];
    const baseF = 18 + Math.floor(R() * 12);
    const depth = 13, pitch = depth + 34;
    const rows = Math.max(2, Math.floor((d + 34 - 10) / pitch));
    const len = 13 * (R() < 0.5 ? 4 : 3) + 1;
    const cols = Math.max(1, Math.floor((w + 18) / (len + 18)));
    const gapX = cols > 1 ? (w - cols * len) / (cols - 1) : 0;
    blk.name = APT_NAMES[(blk.i * 3 + blk.j * 5) % APT_NAMES.length] + ' ' + (1 + (blk.i + blk.j * N) % 9) + '단지';
    let n = 0; const towers = [];
    const shopSpot = { x0: x1 - 34, z0: r.z1 - SIDEWALK - 18 };
    for (let rr = 0; rr < rows; rr++) {
      const tz0 = z0 + 6 + rr * ((d - 12 - depth) / Math.max(1, rows - 1));
      for (let c = 0; c < cols; c++) {
        const stagger = ((c + rr) % 2) * 3;
        const tx0 = cols === 1 ? x0 + (w - len) / 2 : x0 + c * (len + gapX);
        const s = { type: 'apt', x0: tx0, x1: tx0 + len, z0: tz0 + stagger, z1: tz0 + stagger + depth, y0: Y0, floors: Math.max(12, baseF + Math.floor(R() * 6) - 2 + (rr === 0 ? 4 : 0)), fh: 2.9, color, accent, seed: blk.seed * 100 + n++, front: 'S' };
        if (s.z1 > shopSpot.z0 - 6 && s.x1 > shopSpot.x0 - 4) continue;
        blk.specs.push(s); towers.push(s);
        this.doors.push({ x: (s.x0 + s.x1) / 2, z: s.z0 - 3, name: `${blk.name} ${100 + towers.length}동` });
        s.bkind = 'apt'; s.bname = `${blk.name} ${100 + towers.length}동`;
      }
    }
    if (aptHome && towers.length) {
      // 우리 아파트: 남쪽 줄, 가운데에 가장 가까운 동의 12층
      let t = towers[0];
      for (const b of towers) { if (b.z0 > t.z0 + 1 || (Math.abs(b.z0 - t.z0) < 4 && Math.abs((b.x0 + b.x1) / 2 - r.cx) < Math.abs((t.x0 + t.x1) / 2 - r.cx))) t = b; }
      t.site = 'apt'; t.floors = Math.max(t.floors, 20); t.bkind = null;
      this.aptHomeTower = t;
      const dong = 100 + towers.indexOf(t) + 1;
      this.addEntrance({ ...SP.home, homeId: 'apt', name: `우리집 · ${blk.name} ${dong}동 1204호` }, t, 'N', (t.x1 - t.x0) / 2, { homeId: 'apt', elevator: true });
      this.parking.apt = this.curbSpot({ x0: t.x0, x1: t.x1, z0: r.z0, z1: r.z0 + 1 }, 'N', 10);
    }
    // 단지 상가
    blk.specs.push({ type: 'shop', x0: shopSpot.x0, x1: shopSpot.x0 + 32, z0: shopSpot.z0, z1: shopSpot.z0 + 16, y0: Y0, floors: 1, fh: 3.4, groundH: 4.6, color: SHOP_COLORS[Math.floor(R() * SHOP_COLORS.length)], seed: blk.seed * 100 + 90, front: 'S', streets: ['S'], signBase: Math.floor(R() * 48), unitW: 6.5, bkind: 'shop', bname: blk.name + ' 상가' });
    const st = this.static;
    st.grass.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.02, 6, 6);
    for (const s of towers) st.pave.top(s.x0 - 3, s.z0 - 6, s.x1 + 3, s.z0 - 1, Y0 + 0.035, 4, 4);
    const cx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    st.pave.top(cx - 3, r.z0 + SIDEWALK, cx + 3, r.z1 - SIDEWALK, Y0 + 0.036, 4, 4);
    st.pave.top(r.x0 + SIDEWALK, mz - 2.5, r.x1 - SIDEWALK, mz + 2.5, Y0 + 0.037, 4, 4);
    st.pave.top(shopSpot.x0 - 2, shopSpot.z0 + 16, shopSpot.x0 + 34, r.z1 - SIDEWALK, Y0 + 0.038, 4, 4);
    // 생울타리 (정문·후문·옆문은 비움)
    const hx0 = r.x0 + SIDEWALK + 0.5, hx1 = r.x1 - SIDEWALK - 0.5, hz0 = r.z0 + SIDEWALK + 0.5, hz1 = r.z1 - SIDEWALK - 0.5;
    const hedge = (a, b, c, d2) => { if (c - a < 0.5 || d2 - b < 0.5) return; st.hedge.setRGB(0.25 + R() * 0.05, 0.56 + R() * 0.06, 0.2); st.hedge.box(a, Y0, b, c, Y0 + 1.1, d2); this.colliders.push({ x0: a, z0: b, x1: c, z1: d2, h: 1.1, soft: true }); };
    hedge(hx0, hz0, cx - 6, hz0 + 0.8); hedge(cx + 6, hz0, hx1, hz0 + 0.8);
    hedge(hx0, hz0, hx0 + 0.8, mz - 4); hedge(hx0, mz + 4, hx0 + 0.8, hz1);
    hedge(hx1 - 0.8, hz0, hx1, mz - 4); hedge(hx1 - 0.8, mz + 4, hx1, hz1);
    hedge(hx0, hz1 - 0.8, cx - 6, hz1); hedge(cx + 6, hz1 - 0.8, shopSpot.x0 - 3, hz1);
    const p = st.props;
    p.setColor(0x8a8478); p.cbox(cx - 6.5, Y0 + 1.8, hz0 + 0.4, 1.2, 3.6, 1.2); p.cbox(cx + 6.5, Y0 + 1.8, hz0 + 0.4, 1.2, 3.6, 1.2);
    blk.gateSign = { cx, z: hz0 + 0.4 };
    for (let k = 0; k < 90; k++) {
      const tx = r.x0 + SIDEWALK + 3 + R() * (r.w - 2 * SIDEWALK - 6), tz = r.z0 + SIDEWALK + 3 + R() * (r.d - 2 * SIDEWALK - 6);
      if (blk.specs.some(s => tx > s.x0 - 4 && tx < s.x1 + 4 && tz > s.z0 - 7 && tz < s.z1 + 3)) continue;
      if (Math.abs(tx - cx) < 4 || Math.abs(tz - mz) < 3.5) continue;
      this.tree(blk, tx, tz, 0.8 + R() * 0.6, R() < 0.15 ? 'pink' : null);
    }
    // 놀이터 2곳 · 지하주차장 입구
    const spots = [[x0 + 14, z1 - 8], [x1 - 14, mz + 12]];
    blk.extras.push({ x: cx, z: mz, fn: (B) => {
      const g = B.solid;
      for (const [px, pz] of spots) {
        g.setRGB(0.95, 0.6, 0.35); g.box(px - 7, Y0, pz - 5, px + 7, Y0 + 0.06, pz + 5);
        g.setRGB(1, 0.8, 0.15); g.box(px - 3.5, Y0, pz - 1.2, px - 1.2, Y0 + 2.8, pz + 1.2);
        g.setRGB(0.15, 0.6, 0.95); const sl = new THREE.BoxGeometry(1, 0.1, 3.8); sl.rotateX(-0.6); sl.translate(px - 2.35, Y0 + 1.5, pz + 2.6); g.addGeo(sl);
        g.setRGB(0.95, 0.25, 0.25); g.box(px + 1.5, Y0, pz - 2, px + 1.65, Y0 + 2.3, pz + 2); g.box(px + 5, Y0, pz - 2, px + 5.15, Y0 + 2.3, pz + 2); g.box(px + 1.5, Y0 + 2.3, pz - 2, px + 5.15, Y0 + 2.45, pz + 2);
        g.setRGB(0.25, 0.25, 0.28); g.box(px + 2.6, Y0 + 0.55, pz - 0.7, px + 4, Y0 + 0.6, pz - 0.2); g.box(px + 2.6, Y0 + 0.55, pz + 0.7, px + 4, Y0 + 0.6, pz + 1.2);
        for (let k = 0; k < 4; k++) { g.setRGB(0.55, 0.36, 0.22); g.box(px - 7 + k * 3.8, Y0 + 0.42, pz + 6.2, px - 5.2 + k * 3.8, Y0 + 0.5, pz + 6.7); }
      }
      const rx = cx + 16, rz = r.z0 + SIDEWALK + 6;
      g.setRGB(0.5, 0.52, 0.55); g.box(rx - 3.5, Y0, rz, rx + 3.5, Y0 + 3.2, rz + 0.3); g.box(rx - 3.5, Y0, rz, rx - 3.2, Y0 + 3.2, rz + 10); g.box(rx + 3.2, Y0, rz, rx + 3.5, Y0 + 3.2, rz + 10);
      g.setRGB(0.95, 0.95, 0.93); g.box(rx - 3.6, Y0 + 3.2, rz - 0.3, rx + 3.6, Y0 + 3.45, rz + 10.2);
      g.setRGB(0.12, 0.12, 0.13); g.box(rx - 3.2, Y0, rz + 0.3, rx + 3.2, Y0 + 3.1, rz + 0.35);
    } });
    this.colliders.push({ x0: cx + 12.5, x1: cx + 19.5, z0: r.z0 + SIDEWALK + 6, z1: r.z0 + SIDEWALK + 16.2, h: 3.4 });
  }

  // 근린상가: 등을 맞댄 건물 줄 + 사이사이 보행자 골목
  planShops(blk, R, specials) {
    const r = blk.r, m = SIDEWALK + 1;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    const dep = 18, alley = 12;
    const pairs = Math.max(1, Math.floor((z1 - z0 + alley) / (2 * dep + alley)));
    const al = pairs > 1 ? (z1 - z0 - pairs * 2 * dep) / (pairs - 1) : 0;
    const st = this.static;
    st.pave.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 4, 4);
    const lots = [];
    for (let p = 0; p < pairs; p++) {
      const zt = z0 + p * (2 * dep + al);
      for (const [rz0, front] of [[zt, 'N'], [zt + dep, 'S']]) {
        let x = x0, k = 0;
        while (x < x1 - 14) {
          let lw = 24 + R() * 12;
          if (x1 - x - lw < 16) lw = x1 - x;
          lots.push({ x0: x, x1: x + lw, z0: rz0, z1: rz0 + dep, front, outer: (p === 0 && front === 'N') || (p === pairs - 1 && front === 'S'), west: x === x0, east: x + lw >= x1 - 0.1 });
          x += lw; k++;
          if (k % 3 === 0) x += 8;
        }
      }
      if (p < pairs - 1) {
        const az = zt + 2 * dep + al / 2;
        for (let x = x0 + 10; x < x1 - 10; x += 22) this.tree(blk, x, az, 0.75, R() < 0.3 ? 'pink' : null);
      }
    }
    // 특수 가게 자리: 큰길 쪽 넓은 필지에 고르게 배치
    const cand = lots.map((l, i) => i).filter(i => lots[i].outer && lots[i].x1 - lots[i].x0 > 15);
    const spAt = {}, used = new Set();
    specials.forEach((id, j) => {
      let c = Math.min(cand.length - 1, Math.floor((j + 0.5) * cand.length / specials.length));
      for (let t = 0; t < cand.length && used.has(c); t++) c = (c + 1) % cand.length;
      if (cand[c] !== undefined && !used.has(c)) { used.add(c); spAt[cand[c]] = id; }
    });
    lots.forEach((lot, k) => {
      const streets = [lot.front]; if (lot.west) streets.push('W'); if (lot.east) streets.push('E');
      const spId = spAt[k] || null;
      const shop = (a, b, fl, seed) => blk.specs.push({ type: 'shop', x0: a, x1: b, z0: lot.z0, z1: lot.z1, y0: Y0, floors: fl, fh: 3.4, groundH: 4.6, color: SHOP_COLORS[Math.floor(R() * SHOP_COLORS.length)], seed, front: lot.front, streets: [lot.front], signBase: Math.floor(R() * 48), unitW: 6.5, bkind: 'shop', bname: this.placeName(R, 'shop') });
      if (spId === 'mart' || spId === 'stat') {
        // 편의점 · 문구점: 실제 크기 실내 공간이 들어가는 건물
        const front = lot.front, cx = (lot.x0 + lot.x1) / 2;
        const fz = front === 'N' ? lot.z0 : lot.z1;
        const [SW, SD] = spId === 'mart' ? [14, 12] : [11, 9];
        const hw = SW / 2 + 0.4, hd = SD / 2 + 0.3;
        this.sites.push({ kind: spId, id: spId, W: SW, D: SD, wall: 0.3, x: cx, z: fz + (front === 'N' ? hd : -hd), rot: front === 'N' ? Math.PI : 0, floors: spId === 'mart' ? 3 : 2 + Math.floor(R() * 2), fh: 3.3, color: SHOP_COLORS[Math.floor(R() * SHOP_COLORS.length)], sp: SP[spId], idx: this.sites.filter(s => s.kind === spId).length });
        if (lot.x1 - cx - hw > 9) shop(cx + hw, lot.x1, 2 + Math.floor(R() * 3), blk.seed * 100 + k);
        if (cx - hw - lot.x0 > 9) shop(lot.x0, cx - hw, 2 + Math.floor(R() * 3), blk.seed * 100 + k + 500);
        // 뒤쪽 남는 자리
        const bz0 = front === 'N' ? lot.z0 + 2 * hd + 0.2 : lot.z0, bz1 = front === 'N' ? lot.z1 : lot.z1 - 2 * hd - 0.2;
        if (bz1 - bz0 > 3) this.colliders.push({ x0: cx - hw + 0.1, x1: cx + hw - 0.1, z0: bz0, z1: bz1, h: 13 });
        return;
      }
      const sp = spId ? SP[spId] : null;
      const tall = !sp && lot.outer && R() < 0.22;
      const s = {
        type: tall ? 'podium' : 'shop', x0: lot.x0, x1: lot.x1, z0: lot.z0, z1: lot.z1, front: lot.front, y0: Y0,
        floors: sp ? (sp.showroom ? 1 : 2 + Math.floor(R() * 2)) : tall ? 9 + Math.floor(R() * 7) : 2 + Math.floor(R() * 5),
        fh: tall ? 3.2 : 3.4, groundH: sp?.showroom ? 7 : 4.6, streets,
        color: SHOP_COLORS[Math.floor(R() * SHOP_COLORS.length)], accent2: R() < 0.5 ? [0.3, 0.32, 0.36] : null,
        seed: blk.seed * 100 + k, signBase: Math.floor(R() * 48), unitW: sp ? 40 : 6 + R() * 2.5, special: !!sp, upper: tall || R() < 0.2 ? 'curtain' : 'ribbon', spandrel: [0.25, 0.32, 0.4],
      };
      blk.specs.push(s);
      const f = faces(s)[s.front];
      if (sp) {
        this.addEntrance(sp, s, s.front, f.L / 2);
        this.addSign(sp, s, s.front, f.L / 2, Y0 + s.groundH - 0.75, sp.showroom ? 1.4 : 1.0);
        this.parking[sp.id] = this.curbSpot(s, s.front, f.L / 2 + 6);
        if (sp.showroom) for (const du of [-0.25, 0.25]) {
          this.parkedSpots.push({ x: f.p[0] + f.t[0] * (f.L / 2 + du * f.L) - f.n[0] * 8, z: f.p[1] + f.t[1] * (f.L / 2 + du * f.L) - f.n[1] * 8, rot: Math.atan2(f.t[0], f.t[1]) + 0.5, showroom: true, noCollide: true });
        }
      } else {
        const nm = this.placeName(R, 'shop');
        this.doors.push({ x: f.p[0] + f.t[0] * f.L / 2 + f.n[0] * 1.8, z: f.p[1] + f.t[1] * f.L / 2 + f.n[1] * 1.8, name: nm });
        s.bkind = 'shop'; s.bname = nm;
        if (lot.outer && R() < 0.35) this.parkedSpots.push(this.curbSpot(s, s.front, f.L * (0.3 + R() * 0.4)));
      }
    });
  }

  planOffice(blk, R, hq) {
    const r = blk.r, m = SIDEWALK + 8;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    const sp = [[0.16, 0.24, 0.34], [0.2, 0.28, 0.26], [0.28, 0.26, 0.24], [0.12, 0.18, 0.26]][Math.floor(R() * 4)];
    const st = this.static;
    st.pave.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 4, 4);
    const slots = [[x0, z0], [x1 - 40, z0], [x0, z1 - 34], [x1 - 40, z1 - 34]];
    slots.forEach(([sx, sz], k) => {
      const isHq = hq && k === 3;
      if (k === 3 && !isHq && R() < 0.4) return;
      const tw = 32 + R() * 8, td = 28 + R() * 6;
      const s = { type: 'office', x0: sx, x1: sx + tw, z0: sz, z1: sz + td, y0: Y0, floors: isHq ? 48 : 14 + Math.floor(R() * 26), fh: 3.9, seed: blk.seed * 100 + k, spandrel: sp, antenna: isHq || R() < 0.25, crown: 4 + R() * 4, front: k < 2 ? 'N' : 'S' };
      blk.specs.push(s);
      const onm = isHq ? '한빛그룹 본사' : this.placeName(R, 'office');
      this.doors.push({ x: sx + tw / 2, z: k < 2 ? sz - 2 : sz + td + 2, name: onm });
      s.bname = onm; s.bkind = isHq ? null : 'office';
      if (isHq) {
        this.addEntrance(SP.office, s, 'S', tw / 2);
        this.addSign(SP.office, s, 'S', tw / 2, Y0 + 5.5, 1.6);
        this.addSign(SP.office, s, 'S', tw / 2, specH(s) - 5, 2.6);
        this.parking.office = this.curbSpot(s, 'S', tw / 2);
      }
    });
    blk.specs.push({ type: 'podium', x0: r.cx - 22, x1: r.cx + 22, z0: r.cz - 14, z1: r.cz + 14, y0: Y0, floors: 3, fh: 4, groundH: 5, color: [0.88, 0.88, 0.87], seed: blk.seed * 100 + 9, front: 'S', streets: ['S', 'N'], upper: 'curtain', spandrel: sp, signBase: Math.floor(R() * 48), unitW: 8, bkind: 'shop', officePodium: true, bname: this.placeName(R, 'shop') });
    const p = st.props;
    p.setColor(0xe8402a); const sc = new THREE.TorusKnotGeometry(1.6, 0.45, 64, 8); sc.translate(r.x0 + SIDEWALK + 12, Y0 + 4, r.cz); p.addGeo(sc);
    p.setColor(0x9a968e); p.cbox(r.x0 + SIDEWALK + 12, Y0 + 1, r.cz, 3, 2, 3);
    this.colliders.push({ x0: r.x0 + SIDEWALK + 10.5, x1: r.x0 + SIDEWALK + 13.5, z0: r.cz - 1.5, z1: r.cz + 1.5, h: 2 });
    for (let k = 0; k < 24; k++) this.tree(blk, x0 + R() * (x1 - x0), r.cz + (R() < 0.5 ? -20 : 20), 0.85 + R() * 0.3, null);
  }

  // 주상복합 (4~5층 포디움 + 40~55층 타워 4동)
  planMixed(blk, R, pent) {
    const r = blk.r, m = SIDEWALK + 3;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    const lake = blk.i < 5 ? 'E' : blk.i > 6 ? 'W' : blk.j < 5 ? 'S' : 'N';
    const pf = 2, pfh = 4.4, gh = 5;
    const pod = { type: 'podium', x0, x1, z0, z1, y0: Y0, floors: pf, fh: pfh, groundH: gh, color: [0.92, 0.9, 0.86], seed: blk.seed * 100, front: lake, streets: [lake, ...['N', 'S', 'E', 'W'].filter(k => k !== lake)], upper: 'curtain', spandrel: [0.62, 0.62, 0.6], signBase: Math.floor(R() * 48), unitW: 7.5, bkind: 'mall', mall: true, bname: `한빛 ${['레이크', '센트럴', '파크', '리버'][(blk.i + blk.j) % 4]}몰` };
    blk.specs.push(pod);
    const top = Y0 + gh + pf * pfh + 0.3;
    const color = APT_COLORS[Math.floor(R() * APT_COLORS.length)], accent = APT_ACCENT[Math.floor(R() * APT_ACCENT.length)];
    const ts = 27;
    const pos = [[x0 + 22, z0 + 22], [x1 - 22 - ts, z0 + 22], [x0 + 22, z1 - 22 - ts], [x1 - 22 - ts, z1 - 22 - ts]];
    const towers = [];
    pos.forEach(([tx, tz], k) => {
      const s = { type: 'tower', x0: tx, x1: tx + ts, z0: tz, z1: tz + ts, y0: top, floors: 40 + Math.floor(R() * 16), fh: 3.0, color, accent, seed: blk.seed * 100 + 1 + k, noCollide: true };
      blk.specs.push(s); towers.push(s);
      const tnm = `한빛 ${['레이크', '센트럴', '파크', '리버'][(blk.i + blk.j + k) % 4]}타워 ${k + 1}동`;
      this.doors.push({ x: tx + ts / 2, z: k < 2 ? z0 - 2 : z1 + 2, name: tnm });
      Object.assign(s, { bkind: 'tower', bname: tnm, tfront: k < 2 ? 'N' : 'S', podium: pod, lobbyLen: k < 2 ? tz - z0 : z1 - (tz + ts) });
    });
    pod.towers = towers;
    if (pent) {
      const lx = lake === 'E' ? 1 : lake === 'W' ? -1 : 0, lz = lake === 'S' ? 1 : lake === 'N' ? -1 : 0;
      let t = towers[0];
      for (const b of towers) if (b.x0 * lx + b.z0 * lz > t.x0 * lx + t.z0 * lz + 1) t = b;
      t.site = 'pent'; t.floors = 52; t.bkind = null;
      this.pentTower = t; this.pentLake = lake;
      const f = faces(pod)[lake];
      // 로비: 포디움 호수 쪽 면에서 그 탑과 마주 보는 위치
      const tc = [(t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2];
      const u = (tc[0] - f.p[0]) * f.t[0] + (tc[1] - f.p[1]) * f.t[1];
      this.addEntrance({ ...SP.home, homeId: 'pent', name: '우리집 · 한빛 레이크타워 펜트하우스' }, pod, lake, u, { homeId: 'pent', elevator: true });
      this.parking.pent = this.curbSpot(pod, lake, u + 8);
    }
    this.static.pave.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 4, 4);
    blk.extras.push({ x: r.cx, z: r.cz, fn: (B) => {
      B.solid.setRGB(0.35, 0.66, 0.3); B.solid.box(x0 + 3, top, z0 + 3, x1 - 3, top + 0.08, z1 - 3);
      for (let k = 0; k < 6; k++) { B.solid.setRGB(0.95, 0.95, 0.93); B.solid.box(r.cx - 30 + k * 12, top + 0.08, r.cz - 1, r.cx - 27 + k * 12, top + 0.5, r.cz + 1); }
    } });
  }

  // 빌라촌
  planVillas(blk, R, home) {
    const r = blk.r, m = SIDEWALK + 1;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    const vw = 13, vd = 12, gx = 6, gz = 7;
    const cols = Math.floor((x1 - x0 + gx) / (vw + gx)), rows = Math.floor((z1 - z0 + gz) / (vd + gz));
    const offX = (x1 - x0 - (cols * vw + (cols - 1) * gx)) / 2, offZ = (z1 - z0 - (rows * vd + (rows - 1) * gz)) / 2;
    let n = 0;
    for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
      const vx = x0 + offX + c * (vw + gx), vz = z0 + offZ + rr * (vd + gz);
      if (home && rr === rows - 1 && c === 2) {
        // 우리집 원룸 건물: 1층 왼쪽 호실이 실제 크기 원룸
        const W = HOMES[0].w, D = HOMES[0].d;
        this.sites.push({ kind: 'home', id: 'home', homeId: 'oneroom', W, D, wall: 0.3, x: vx + 3.1, z: vz + vd - D / 2 - 0.3, rot: 0, floors: 3, fh: 2.8, color: [0.74, 0.42, 0.32], sp: SP.home, neighbor: 6.4 });
        continue;
      }
      const s = { type: 'villa', x0: vx, x1: vx + vw, z0: vz, z1: vz + vd, y0: Y0, floors: 3 + Math.floor(R() * 2), fh: 2.8, color: VILLA_COLORS[Math.floor(R() * VILLA_COLORS.length)], seed: blk.seed * 100 + n++, front: rr === 0 ? 'N' : 'S', hipRoof: R() < 0.3 };
      blk.specs.push(s);
      const vnm = this.placeName(R, 'villa');
      this.doors.push({ x: vx + vw / 2, z: s.front === 'S' ? vz + vd + 1.6 : vz - 1.6, name: vnm });
      s.bkind = 'villa'; s.bname = vnm;
    }
    this.static.asph.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 14, 14);
    for (let k = 0; k < 30; k++) {
      const tx = x0 + R() * (x1 - x0), tz = z0 + R() * (z1 - z0);
      if (blk.specs.some(s => tx > s.x0 - 2 && tx < s.x1 + 2 && tz > s.z0 - 2 && tz < s.z1 + 2)) continue;
      if (this.sites.some(s => Math.abs(tx - s.x - 3) < 9 && Math.abs(tz - s.z) < 7)) continue;
      this.tree(blk, tx, tz, 0.6 + R() * 0.3, null);
    }
  }

  planCivic(blk, R) {
    const r = blk.r;
    const hall = blk.i === 5;
    const s = { type: 'civic', x0: r.cx - 45, x1: r.cx + 45, z0: r.cz - 16, z1: r.cz + 34, y0: Y0, floors: hall ? 7 : 4, fh: hall ? 4.2 : 5.5, seed: blk.seed * 100, front: 'N', bkind: 'civic', hall, bname: hall ? '한빛시청' : '한빛아트센터' };
    blk.specs.push(s);
    this.addSign({ sign: hall ? ['한빛시청', '#1d3b5e', '#ffffff', 'HANBIT CITY HALL'] : ['한빛아트센터', '#5a1d3b', '#ffffff', '문화예술회관'] }, s, 'N', 45, Y0 + 8, 1.8);
    this.doors.push({ x: r.cx, z: s.z0 - 3, name: hall ? '한빛시청' : '한빛아트센터' });
    const st = this.static, p = st.props;
    st.pave.top(r.x0 + SIDEWALK, r.z0 + SIDEWALK, r.x1 - SIDEWALK, r.z1 - SIDEWALK, Y0 + 0.01, 4, 4);
    st.grass.top(r.cx - 60, r.z0 + 20, r.cx - 20, s.z0 - 12, Y0 + 0.02, 6, 6); st.grass.top(r.cx + 20, r.z0 + 20, r.cx + 60, s.z0 - 12, Y0 + 0.02, 6, 6);
    for (let k = 0; k < 3; k++) { p.setColor(0xd8d8d8); p.addGeo(new THREE.CylinderGeometry(0.1, 0.12, 16, 6).translate(r.cx - 10 + k * 10, Y0 + 8, s.z0 - 10)); p.setColor([0xf2f2f2, 0x2050a0, 0x2a7a4a][k]); p.box(r.cx - 9.9 + k * 10, Y0 + 13, s.z0 - 10, r.cx - 9.85 + k * 10, Y0 + 15.5, s.z0 - 6.5); }
    const fx = r.cx, fz = r.z0 + 40;
    p.setColor(0x9a968e); p.addGeo(new THREE.CylinderGeometry(9, 9.5, 0.7, 40).translate(fx, Y0 + 0.35, fz));
    const wm = new THREE.Mesh(new THREE.CircleGeometry(8.4, 40).rotateX(-Math.PI / 2), this.mat.water); wm.position.set(fx, Y0 + 0.62, fz); this.group.add(wm);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(1, 7, 12, 1, true), this.mat.jet); jet.position.set(fx, Y0 + 4, fz); this.group.add(jet); this.jets.push(jet);
    this.colliders.push({ x0: fx - 9, x1: fx + 9, z0: fz - 9, z1: fz + 9, h: 0.7, soft: true });
    for (let k = 0; k < 20; k++) this.tree(blk, r.x0 + 12 + (k % 2) * (r.w - 24), r.z0 + 14 + Math.floor(k / 2) * ((r.d - 28) / 9), 1, null);
  }

  planPark(blk, R) {
    const r = blk.r, st = this.static, s = SIDEWALK;
    st.grass.top(r.x0 + s, r.z0 + s, r.x1 - s, r.z1 - s, Y0 + 0.02, 6, 6);
    st.pave.top(r.x0 + s, r.cz - 2, r.x1 - s, r.cz + 2, Y0 + 0.035, 4, 4);
    st.pave.top(r.cx - 2, r.z0 + s, r.cx + 2, r.z1 - s, Y0 + 0.035, 4, 4);
    const p = st.props;
    const fw = Math.min(70, r.w / 2 - 14), fx0 = r.cx + 8;
    p.setColor(0x4a9a4a); p.box(fx0, Y0 + 0.03, r.z0 + 16, fx0 + fw, Y0 + 0.05, r.z0 + 60);
    p.setColor(0xf2f2f2); for (const dz of [0, 44]) p.box(fx0, Y0 + 0.05, r.z0 + 16 + dz - 0.1, fx0 + fw, Y0 + 0.06, r.z0 + 16 + dz + 0.1); p.box(fx0 + fw / 2 - 0.1, Y0 + 0.05, r.z0 + 16, fx0 + fw / 2 + 0.1, Y0 + 0.06, r.z0 + 60);
    for (const gx of [fx0 + 1, fx0 + fw - 1]) { p.cbox(gx, Y0 + 1.2, r.z0 + 35, 0.12, 2.4, 0.12); p.cbox(gx, Y0 + 1.2, r.z0 + 41, 0.12, 2.4, 0.12); p.cbox(gx, Y0 + 2.4, r.z0 + 38, 0.12, 0.12, 6.1); }
    p.setColor(0xd8603a); p.box(r.cx - 50, Y0 + 0.03, r.cz + 14, r.cx - 22, Y0 + 0.05, r.cz + 40);
    p.setColor(0x6b3d24);
    const gx = r.cx - 34, gz = r.cz - 34;
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) p.cbox(gx + dx, Y0 + 1.6, gz + dz, 0.35, 3.2, 0.35);
    p.setColor(0x3f4a44); const rg = new THREE.ConeGeometry(5.8, 2, 4); rg.rotateY(Math.PI / 4); rg.translate(gx, Y0 + 4.2, gz); p.addGeo(rg);
    for (let k = 0; k < 140; k++) {
      const tx = r.x0 + 8 + R() * (r.w - 16), tz = r.z0 + 8 + R() * (r.d - 16);
      if (Math.abs(tx - r.cx) < 4 || Math.abs(tz - r.cz) < 4) continue;
      if (tx > fx0 - 4 && tx < fx0 + fw + 4 && tz < r.z0 + 64) continue;
      if (tx > r.cx - 54 && tx < r.cx - 18 && tz > r.cz + 10 && tz < r.cz + 44) continue;
      if (Math.abs(tx - gx) < 8 && Math.abs(tz - gz) < 8) continue;
      this.tree(blk, tx, tz, 0.9 + R() * 0.8, R() < 0.25 ? 'pink' : null);
    }
  }

  planSchool(blk, R, sc) {
    const r = blk.r;
    const ix0 = r.x0 + SIDEWALK, iz0 = r.z0 + SIDEWALK, ix1 = r.x1 - SIDEWALK, iz1 = r.z1 - SIDEWALK;
    const cx = r.cx, univ = sc.type === 'univ';
    const bw = 64, bd = 18;
    const bz0 = iz1 - 8 - bd;
    const accent = new THREE.Color(sc.color).toArray().map(v => Math.min(1, v * 2.4));
    const color = univ ? [0.92, 0.84, 0.72] : [0.98, 0.96, 0.91];
    // 본관: 1층 가운데에 실제 크기 학교 공간 (사이트)
    const main = { x0: cx - bw / 2, x1: cx + bw / 2, z0: bz0, z1: bz0 + bd };
    this.sites.push({ kind: 'school', id: 'school', school: sc.type, name: sc.name, icon: sc.icon, W: 26, D: 16, wall: 0.3, x: cx, z: bz0 + 8, rot: Math.PI, bld: main, floors: sc.floors - 1, color, accent, clock: univ });
    blk.specs.push({ type: 'school', x0: ix0 + 12, x1: ix0 + 42, z0: bz0 - 4, z1: bz0 + 22, y0: Y0, floors: 2, fh: 5, color, accent, seed: blk.seed * 100 + 2, front: 'N' });
    if (univ) {
      for (const [ox, oz, w2, d2, fl] of [[ix1 - 44, iz0 + 20, 32, 18, 5], [ix1 - 44, iz0 + 60, 32, 18, 7], [ix0 + 12, iz0 + 20, 30, 16, 4]]) blk.specs.push({ type: 'school', x0: ox, x1: ox + w2, z0: oz, z1: oz + d2, y0: Y0, floors: fl, fh: 3.6, color, accent, seed: blk.seed * 100 + ox, front: 'S' });
    }
    const st = this.static, p = st.props;
    st.pave.top(ix0, iz0, ix1, iz1, Y0 + 0.005, 4, 4);
    if (!univ) {
      const fw = Math.min(100, r.w - 70), fd = Math.min(70, bz0 - iz0 - 16);
      const fx0 = ix0 + 50, fz0 = iz0 + 6;
      const field = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), this.fieldMat());
      field.rotation.x = -Math.PI / 2; field.position.set(fx0 + fw / 2, Y0 + 0.015, fz0 + fd / 2); field.receiveShadow = true; this.group.add(field);
      for (const sd of [-1, 1]) {
        const gx = fx0 + fw / 2 + sd * (fw / 2 - 2), gz = fz0 + fd / 2;
        p.setColor(0xf2f2f2); p.cbox(gx, Y0 + 1.2, gz - 3.6, 0.12, 2.4, 0.12); p.cbox(gx, Y0 + 1.2, gz + 3.6, 0.12, 2.4, 0.12); p.cbox(gx, Y0 + 2.4, gz, 0.12, 0.12, 7.3);
      }
      p.setColor(0xb0a898); p.cbox(fx0 + fw / 2, Y0 + 0.6, fz0 + fd + 3, 9, 1.2, 4);
      this.colliders.push({ x0: fx0 + fw / 2 - 4.5, x1: fx0 + fw / 2 + 4.5, z0: fz0 + fd + 1, z1: fz0 + fd + 5, h: 1.2 });
    } else {
      st.grass.top(cx - 50, iz0 + 6, cx + 30, bz0 - 8, Y0 + 0.02, 6, 6);
      for (let k = 0; k < 40; k++) this.tree(blk, cx - 48 + R() * 76, iz0 + 8 + R() * (bz0 - iz0 - 18), 1 + R() * 0.4, R() < 0.3 ? 'pink' : null);
    }
    p.setColor(univ ? 0x8a7a6a : 0x3a8a4a);
    const fh = univ ? 0.9 : 1.6, gate = 6;
    const fence = (a, b, c, d) => { p.box(a, Y0, b, c, Y0 + fh, d); this.colliders.push({ x0: a, z0: b, x1: c, z1: d, h: fh, soft: true }); };
    fence(ix0, iz0, cx - gate, iz0 + 0.25); fence(cx + gate, iz0, ix1, iz0 + 0.25);
    fence(ix0, iz0, ix0 + 0.25, iz1); fence(ix1 - 0.25, iz0, ix1, iz1);
    fence(ix0, iz1 - 0.25, ix1, iz1);
    p.setColor(0xb8b0a0); for (const x of [cx - gate - 0.5, cx + gate + 0.5]) p.cbox(x, Y0 + 1.5, iz0 + 0.1, 1, 3, 1);
    this.doors.push({ x: cx, z: iz0 - 1.5, name: sc.name + ' 정문' });
    for (let k = 0; k < 30; k++) this.tree(blk, ix0 + 4 + (k % 2) * (ix1 - ix0 - 8), iz0 + 6 + Math.floor(k / 2) * ((iz1 - iz0 - 12) / 15), 0.9, null);
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
    x.fillStyle = '#d6a678'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${110 + Math.random() * 60},${85 + Math.random() * 40},${60 + Math.random() * 30},0.2)`; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 4;
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
    const uv = road.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * size / 14, uv.getY(k) * size / 14);
    this.group.add(road);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), this.mat.grass);
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.6;
    const ou = outer.geometry.attributes.uv; for (let k = 0; k < ou.count; k++) ou.setXY(k, ou.getX(k) * 900, ou.getY(k) * 900);
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
    const e = HALF + ROAD / 2, w = 6;
    st.side.top(-e - w, -e - w, e + w, -e, Y0, 4, 4); st.side.top(-e - w, e, e + w, e + w, Y0, 4, 4);
    st.side.top(-e - w, -e, -e, e, Y0, 4, 4); st.side.top(e, -e, e + w, e, Y0, 4, 4);
  }

  buildMarkings() {
    const st = this.static, Wm = st.white, Ym = st.yellow;
    const yy = 0.02;
    const strip = (gb, x0, z0, x1, z1) => gb.top(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), yy);
    const edges = [];
    for (let k = 0; k <= N; k++) for (let s = 0; s < N; s++) {
      if (hasEdge(k, s, [0, 1])) edges.push({ axis: 'z', c: ROADS[k], a: ROADS[s], b: ROADS[s + 1], k, s });
      if (hasEdge(s, k, [1, 0])) edges.push({ axis: 'x', c: ROADS[k], a: ROADS[s], b: ROADS[s + 1], k, s });
    }
    this.edges = edges;
    for (const e of edges) {
      const { axis, c } = e;
      const L = (u0, u1, o0, o1, gb) => axis === 'x' ? strip(gb, u0, c + o0, u1, c + o1) : strip(gb, c + o0, u0, c + o1, u1);
      const a = e.a + STOP, b = e.b - STOP;
      const ma = a + 1, mb = b - 1;
      st.hedge.setRGB(0.28, 0.58, 0.22);
      if (axis === 'x') { st.curb.box(ma, 0, c - MEDIAN, mb, 0.22, c + MEDIAN); st.hedge.box(ma + 0.5, 0.22, c - MEDIAN + 0.25, mb - 0.5, 0.75, c + MEDIAN - 0.25); this.colliders.push({ x0: ma, x1: mb, z0: c - MEDIAN, z1: c + MEDIAN, h: 0.5, soft: true, median: true }); }
      else { st.curb.box(c - MEDIAN, 0, ma, c + MEDIAN, 0.22, mb); st.hedge.box(c - MEDIAN + 0.25, 0.22, ma + 0.5, c + MEDIAN - 0.25, 0.75, mb - 0.5); this.colliders.push({ x0: c - MEDIAN, x1: c + MEDIAN, z0: ma, z1: mb, h: 0.5, soft: true, median: true }); }
      L(a, ma, -MEDIAN - 0.15, -MEDIAN, Ym); L(a, ma, MEDIAN, MEDIAN + 0.15, Ym);
      L(mb, b, -MEDIAN - 0.15, -MEDIAN, Ym); L(mb, b, MEDIAN, MEDIAN + 0.15, Ym);
      for (let u = a + 2; u < b - 3; u += 12) { L(u, u + 5, -4.57, -4.43, Wm); L(u, u + 5, 4.43, 4.57, Wm); }
      L(a - 3.5, b + 3.5, -8.1, -7.95, Wm); L(a - 3.5, b + 3.5, 7.95, 8.1, Wm);
      for (const [u0, u1] of [[e.a + ROAD / 2 + 0.6, e.a + ROAD / 2 + 3.8], [e.b - ROAD / 2 - 3.8, e.b - ROAD / 2 - 0.6]]) for (let o = -9.4; o < 9.4; o += 1.0) L(u0, u1, o, o + 0.5, Wm);
      if (axis === 'x') { L(a - 0.5, a, -8, -MEDIAN, Wm); L(b, b + 0.5, MEDIAN, 8, Wm); }
      else { L(a - 0.5, a, MEDIAN, 8, Wm); L(b, b + 0.5, -8, -MEDIAN, Wm); }
    }
  }

  // ───────── 중앙 호수공원 (약 500m) ─────────
  buildLakePark() {
    const R = seeded(77);
    const st = this.static, p = st.props;
    const S = 360, pts = [];
    for (let k = 0; k < S; k++) { const th = k / S * Math.PI * 2; const r = lakeR(th); pts.push([Math.cos(th) * r, Math.sin(th) * r, th, r]); }
    const x0 = PARK.x0 + SIDEWALK, x1 = PARK.x1 - SIDEWALK, z0 = PARK.z0 + SIDEWALK, z1 = PARK.z1 - SIDEWALK;
    const shape = new THREE.Shape([new THREE.Vector2(x0, -z0), new THREE.Vector2(x0, -z1), new THREE.Vector2(x1, -z1), new THREE.Vector2(x1, -z0)]);
    shape.holes.push(new THREE.Path(pts.slice().reverse().map(([, , th, r]) => new THREE.Vector2(Math.cos(th) * (r + 12), -Math.sin(th) * (r + 12)))));
    const gg = new THREE.ShapeGeometry(shape); gg.rotateX(-Math.PI / 2);
    const uv = gg.attributes.uv, pos = gg.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) / 6, pos.getZ(k) / 6);
    const grass = new THREE.Mesh(gg, this.mat.grass); grass.position.y = Y0 + 0.02; grass.receiveShadow = true; this.group.add(grass);
    const ringGeo = (r0, r1, y, uvs = 4) => {
      const v = [], n = [], u = [], idx = [];
      for (let k = 0; k <= S; k++) {
        const [, , th, r] = pts[k % S];
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
    const path = new THREE.Mesh(ringGeo(4, 12, Y0 + 0.03), this.mat.pave); path.receiveShadow = true; this.group.add(path);
    const rim = new THREE.Mesh(ringGeo(0, 4, Y0 + 0.05), this.mat.curb); rim.receiveShadow = true; this.group.add(rim);
    const wall = new GB(); wall.setColor(0x8a8680);
    for (let k = 0; k < S; k++) { const a = pts[k], b = pts[(k + 1) % S]; wall.wall(a[0], a[1], b[0], b[1], -0.6, Y0 + 0.05); }
    this.group.add(new THREE.Mesh(wall.build(), this.mat.props));
    const wg = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), 4); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, this.mat.water); water.position.y = 0.02; this.group.add(water);
    // 목재 다리 (동서)
    const bx0 = -lakeR(Math.PI) - 5, bx1 = lakeR(0) + 5;
    p.setColor(0x9a6a42); p.box(bx0, 0.55, -2.2, bx1, 0.7, 2.2);
    p.setColor(0x6a4a32); for (let x = bx0 + 2; x < bx1; x += 8) { p.box(x, -0.5, -2.1, x + 0.35, 0.55, -1.75); p.box(x, -0.5, 1.75, x + 0.35, 0.55, 2.1); }
    p.setColor(0x3a3e44); p.box(bx0, 1.65, -2.25, bx1, 1.72, -2.15); p.box(bx0, 1.65, 2.15, bx1, 1.72, 2.25);
    for (let x = bx0; x < bx1; x += 2.5) { p.box(x, 0.7, -2.24, x + 0.06, 1.66, -2.18); p.box(x, 0.7, 2.18, x + 0.06, 1.66, 2.24); }
    this.bridge = { x0: bx0, x1: bx1, z0: -2.2, z1: 2.2 };
    // 음악분수
    const fz = -70;
    p.setColor(0x9a968e); p.addGeo(new THREE.TorusGeometry(9, 0.5, 8, 40).rotateX(Math.PI / 2).translate(0, 0.3, fz));
    for (let k = 0; k < 9; k++) {
      const a = k / 8 * Math.PI * 2, rr = k === 0 ? 0 : 6;
      const jet = new THREE.Mesh(new THREE.ConeGeometry(k === 0 ? 1.4 : 0.5, k === 0 ? 18 : 8, 10, 1, true), this.mat.jet);
      jet.position.set(Math.cos(a) * rr, k === 0 ? 9 : 4, fz + Math.sin(a) * rr);
      this.group.add(jet); this.jets.push(jet);
    }
    // 수변 무대 (남쪽)
    const sz = lakeR(Math.PI / 2) - 10;
    p.setColor(0x9a6a42); p.box(-20, 0.2, sz, 20, 0.6, sz + 22);
    p.setColor(0xf6f6f4); for (const x of [-18, -6, 6, 18]) p.box(x - 0.3, 0.6, sz + 19, x + 0.3, 8.6, sz + 19.6);
    const canopy = new THREE.CylinderGeometry(22, 22, 0.5, 40, 1, false, Math.PI * 0.25, Math.PI * 0.5); canopy.scale(1, 1, 0.5); canopy.translate(0, 8.8, sz + 19); p.addGeo(canopy);
    this.colliders.push({ x0: -20, x1: 20, z0: sz + 18.9, z1: sz + 19.7, h: 8, soft: true });
    // 전망대 (북동쪽)
    const ox = 170, oz = -170;
    p.setColor(0xf2f2ee); p.addGeo(new THREE.CylinderGeometry(2.2, 3, 32, 12).translate(ox, Y0 + 16, oz));
    p.setColor(0x2f6fd6); p.addGeo(new THREE.CylinderGeometry(7, 6, 4, 16).translate(ox, Y0 + 33, oz));
    p.setColor(0xf2f2ee); p.addGeo(new THREE.ConeGeometry(7.5, 4, 16).translate(ox, Y0 + 37, oz));
    this.colliders.push({ x0: ox - 3, x1: ox + 3, z0: oz - 3, z1: oz + 3, h: 35 });
    // 조명 · 벤치 · 꽃밭 · 나무
    this.parkLamps = [];
    for (let k = 0; k < S; k += 6) {
      const [, , th, r] = pts[k];
      const c = Math.cos(th), s = Math.sin(th), rr = r + 12.8;
      if (k % 12 === 0) this.parkLamps.push([c * rr, s * rr]);
      else { p.setColor(0x7a5236); const g = new THREE.BoxGeometry(1.8, 0.08, 0.5); g.rotateY(-th + Math.PI / 2); g.translate(c * rr, Y0 + 0.45, s * rr); p.addGeo(g); }
    }
    const L = this.blocks.find(b => b.zone === 'L');
    const cols = [0xe8407a, 0xf6c820, 0xf47a30, 0xb050e0, 0xf6f6f6];
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2 + 0.2, r = lakeR(a) + 26 + R() * 10;
      for (let q = 0; q < 6; q++) { p.setColor(cols[(k + q) % cols.length]); p.cbox(Math.cos(a) * r + (q - 3) * 1.2, Y0 + 0.2, Math.sin(a) * r, 1.1, 0.35, 2.2); }
    }
    for (let k = 0; k < S; k += 3) { const [, , th, r] = pts[k]; if (Math.abs(Math.sin(th) * (r + 16)) < 4 || Math.abs(Math.cos(th) * (r + 16)) < 4) continue; this.tree(L, Math.cos(th) * (r + 16), Math.sin(th) * (r + 16), 1, 'pink'); }
    for (let k = 0; k < 520; k++) {
      const tx = x0 + 4 + R() * (x1 - x0 - 8), tz = z0 + 4 + R() * (z1 - z0 - 8);
      const th = Math.atan2(tz, tx), d = Math.hypot(tx, tz);
      if (d < lakeR(th) + 20) continue;
      if (Math.abs(tx) < 4 || Math.abs(tz) < 4 || Math.hypot(tx - ox, tz - oz) < 8) continue;
      this.tree(L, tx, tz, 0.9 + R() * 0.9, R() < 0.15 ? 'pink' : null);
    }
    st.pave.top(-3, z0, 3, -lakeR(-Math.PI / 2) - 12, Y0 + 0.04, 4, 4);
    st.pave.top(-3, lakeR(Math.PI / 2) + 12, 3, z1, Y0 + 0.04, 4, 4);
    st.pave.top(x0, -3, -lakeR(Math.PI) - 12, 3, Y0 + 0.04, 4, 4);
    st.pave.top(lakeR(0) + 12, -3, x1, 3, Y0 + 0.04, 4, 4);
  }

  // ───────── 가로등 · 가로수 · 정류장 ─────────
  buildStreetFurniture() {
    const R = this.rand;
    const props = this.static.props;
    for (const e of this.edges) {
      const a = e.a + 16, b = e.b - 16;
      const n = Math.max(2, Math.round((b - a) / 32) + 1);
      for (const side of [-1, 1]) {
        const off = side * (ROAD / 2 + 0.7);
        for (let k = 0; k < n; k++) {
          const u = a + (b - a) * k / (n - 1);
          const l = e.axis === 'z' ? { x: e.c + off, z: u, rot: side, axis: 'z' } : { x: u, z: e.c + off, rot: side, axis: 'x' };
          this.blockAt(l.x, l.z).lamps.push(l);
          this.addPole(l.x, l.z);
        }
        for (let u = a + 6; u < b - 4; u += 11) {
          if (R() < 0.08) continue;
          const toff = side * (ROAD / 2 + 2.3);
          const [tx, tz] = e.axis === 'z' ? [e.c + toff, u] : [u, e.c + toff];
          if (this.sites.some(st => Math.hypot(st.x - tx, st.z - tz) < 15)) continue;
          this.tree(this.blockAt(tx, tz), tx, tz, 0.85 + R() * 0.3, null);
        }
        if (R() < 0.3) this.busStop(props, side, e.c, (a + b) / 2 + 14, e.axis);
      }
    }
    for (const [x, z] of this.parkLamps || []) { this.blockAt(x, z).parkLamps.push([x, z]); this.addPole(x, z); }
  }

  busStop(gb, side, c, u, axis) {
    const off = side * (ROAD / 2 + 2.6);
    const [x, z] = axis === 'z' ? [c + off, u] : [u, c + off];
    (this.busStops = this.busStops || []).push({ x, z, axis, side, c, u, nx: axis === 'z' ? -side : 0, nz: axis === 'x' ? -side : 0 });
    const w = 4.5, d = 1.5;
    const W = axis === 'z' ? d : w, D = axis === 'z' ? w : d;
    gb.setColor(0x2f6fd6); gb.cbox(x, Y0 + 2.6, z, W + 0.2, 0.12, D + 0.2);
    gb.setColor(0x2a2e33);
    gb.cbox(x - W / 2, Y0 + 1.3, z - D / 2, 0.1, 2.6, 0.1); gb.cbox(x + W / 2, Y0 + 1.3, z + D / 2, 0.1, 2.6, 0.1);
    gb.cbox(x - W / 2, Y0 + 1.3, z + D / 2, 0.1, 2.6, 0.1); gb.cbox(x + W / 2, Y0 + 1.3, z - D / 2, 0.1, 2.6, 0.1);
    gb.setColor(0x9ac4d9);
    if (axis === 'z') gb.cbox(x + side * d / 2, Y0 + 1.5, z, 0.05, 2, w); else gb.cbox(x, Y0 + 1.5, z + side * d / 2, w, 2, 0.05);
    gb.setColor(0x7b5a3e); gb.cbox(x + (axis === 'z' ? side * 0.3 : 0), Y0 + 0.5, z + (axis === 'x' ? side * 0.3 : 0), axis === 'z' ? 0.45 : 3, 0.08, axis === 'z' ? 3 : 0.45);
  }

  buildSignals() {
    const poles = [], heads = { '+z': [], '-z': [], '+x': [], '-x': [] };
    const o = ROAD / 2 + 0.6;
    this.cameras = new Set();
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) {
      if (!nodeExists(a, b)) continue;
      const X = ROADS[a], Z = ROADS[b];
      if (this.rand() < 0.3) this.cameras.add(a + ',' + b);
      const list = [[X - o, Z - o, Math.PI, '+z', hasEdge(a, b, [0, -1])], [X + o, Z + o, 0, '-z', hasEdge(a, b, [0, 1])], [X - o, Z + o, -Math.PI / 2, '+x', hasEdge(a, b, [-1, 0])], [X + o, Z - o, Math.PI / 2, '-x', hasEdge(a, b, [1, 0])]];
      for (const [x, z, ry, ap, ok] of list) { if (!ok) continue; poles.push([x, z, ry]); heads[ap].push([x, z, ry]); this.addPole(x, z); }
    }
    const poleG = new THREE.CylinderGeometry(0.13, 0.16, 6.6, 6, 1, true); poleG.translate(0, 3.3, 0);
    const armG = new THREE.BoxGeometry(7.4, 0.17, 0.17); armG.translate(-3.7, 6.3, 0);
    const boxG = new THREE.BoxGeometry(1.25, 0.45, 0.35); boxG.translate(-6.1, 5.95, 0);
    const lampG = new THREE.CircleGeometry(0.15, 10);
    const dm = this.mat.darkMetal;
    const P1 = new THREE.InstancedMesh(poleG, dm, poles.length), P2 = new THREE.InstancedMesh(armG, dm, poles.length), P3 = new THREE.InstancedMesh(boxG, new THREE.MeshStandardMaterial({ color: 0xf2c020, roughness: 0.6 }), poles.length);
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
        list.forEach(([x, z, ry], k) => { e.set(0, ry, 0); q.setFromEuler(e); const base = new THREE.Matrix4().compose(v.set(x, Y0, z), q, one); im.setMatrixAt(k, base.multiply(new THREE.Matrix4().makeTranslation(-6.1 + c, 5.95, 0.18))); });
        this.group.add(im);
      }
    }
  }

  // 블록을 4조각으로 나눠서 가까운 조각만 상세 모델
  assignChunks() {
    for (const b of this.blocks) {
      const r = b.r, mx = r.cx, mz = r.cz;
      const cs = [];
      for (let q = 0; q < 4; q++) {
        const qx = q % 2, qz = Math.floor(q / 2);
        cs.push({ b, x0: qx ? mx : r.x0 - ROAD / 2, x1: qx ? r.x1 + ROAD / 2 : mx, z0: qz ? mz : r.z0 - ROAD / 2, z1: qz ? r.z1 + ROAD / 2 : mz, specs: [], extras: [], trees: [], lamps: [], parkLamps: [], near: null });
      }
      const pickC = (x, z) => cs[(x >= mx ? 1 : 0) + (z >= mz ? 2 : 0)];
      for (const s of b.specs) { s.blk = b; if (s.site) continue; const c = pickC((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2); c.specs.push(s); s.chunk = c; }
      for (const e of b.extras) pickC(e.x, e.z).extras.push(e);
      for (const t of b.trees) pickC(t[0], t[1]).trees.push(t);
      for (const l of b.lamps) pickC(l.x, l.z).lamps.push(l);
      for (const l of b.parkLamps) pickC(l[0], l[1]).parkLamps.push(l);
      // 조각 범위를 내용물에 맞게 넓힘 (큰 건물이 경계를 넘을 때)
      for (const c of cs) for (const s of c.specs) { c.x0 = Math.min(c.x0, s.x0); c.x1 = Math.max(c.x1, s.x1); c.z0 = Math.min(c.z0, s.z0); c.z1 = Math.max(c.z1, s.z1); }
      for (const t of b.trees) { const k = Math.floor(t[0] / 10) + ',' + Math.floor(t[1] / 10); let a = this.treeGrid.get(k); if (!a) this.treeGrid.set(k, a = []); a.push(t); }
      b.chunks = cs.filter(c => c.specs.length || c.extras.length || c.trees.length || c.lamps.length || c.parkLamps.length);
      this.chunks.push(...b.chunks);
    }
  }

  flushStatic() {
    const st = this.static;
    const add = (gb, mat, shadow) => { if (gb.empty) return; const m = new THREE.Mesh(gb.build(), mat); m.receiveShadow = true; m.castShadow = !!shadow; this.group.add(m); };
    add(st.side, this.mat.sidewalk); add(st.curb, this.mat.curb); add(st.grass, this.mat.grass); add(st.pave, this.mat.pave); add(st.asph, this.mat.asphalt);
    add(st.white, this.mat.white); add(st.yellow, this.mat.yellow); add(st.hedge, this.mat.hedge, true); add(st.props, this.mat.props, true);
    this.static = null;
  }

  // ───────── LOD ─────────
  buildFarAll() {
    // 먼 거리 상자: 4×4 구역으로 묶어서 항상 그림 (상세 모델 속에 숨음)
    const G = 4, cell = (HALF * 2) / G;
    this.farRegions = Array.from({ length: G * G }, () => ({ specs: [], meshes: [] }));
    for (const b of this.blocks) for (const s of b.specs) {
      if (s.site) continue;
      const gi = Math.min(G - 1, Math.max(0, Math.floor(((s.x0 + s.x1) / 2 + HALF) / cell))), gj = Math.min(G - 1, Math.max(0, Math.floor(((s.z0 + s.z1) / 2 + HALF) / cell)));
      s.farR = gi + gj * G; this.farRegions[s.farR].specs.push(s);
    }
    this.farRegions.forEach((_, i) => this.buildFarRegion(i));
  }
  buildFarRegion(i) {
    const R = this.farRegions[i];
    for (const m of R.meshes) { this.group.remove(m); m.geometry.dispose(); const k = this.farLit.indexOf(m); if (k >= 0) this.farLit.splice(k, 1); }
    R.meshes = [];
    const F = { solid: new GB(), lit: new GB() };
    for (const s of R.specs) if (!s.hidden) buildBox(F, s);
    if (F.solid.empty) return;
    const m = new THREE.Mesh(F.solid.build(), this.B.solid); this.group.add(m); R.meshes.push(m);
    if (!F.lit.empty) { const lm = new THREE.Mesh(F.lit.build(), this.B.lit); lm.visible = this.night > 0.2; this.group.add(lm); this.farLit.push(lm); R.meshes.push(lm); }
  }
  // 건물 안에 들어가면 그 건물 겉모습을 숨겨요 (창밖으로 도시가 보이게)
  setHidden(specs) {
    const want = new Set(specs || []);
    const prev = this.hiddenSpecs || new Set();
    const changed = [...want].filter(s => !prev.has(s)).concat([...prev].filter(s => !want.has(s)));
    if (!changed.length) return;
    for (const s of prev) s.hidden = false;
    for (const s of want) s.hidden = true;
    this.hiddenSpecs = want;
    const chunks = new Set(), blocks = new Set(), regions = new Set();
    for (const s of changed) { if (s.chunk) chunks.add(s.chunk); if (s.blk) blocks.add(s.blk); if (s.farR !== undefined) regions.add(s.farR); }
    for (const c of chunks) if (c.near) { this.disposeGroup(c.near); c.near = null; this.buildNearChunk(c); }
    for (const b of blocks) if (b.mid) { const v = b.mid.visible; this.disposeGroup(b.mid); b.mid = null; this.buildMidBlock(b); b.mid.visible = v; }
    for (const i of regions) this.buildFarRegion(i);
  }
  // 가게가 바뀐 건물 다시 그리기 (간판)
  refreshSpec(s) {
    this.onRefresh?.(s);
    s.B = null;
    const c = s.chunk; if (c?.near) { this.disposeGroup(c.near); c.near = null; this.buildNearChunk(c); }
    // 문 이름도 새로
    const old = this.bdoors.filter(d => d.spec === s);
    for (const d of old) { this.bdoors.splice(this.bdoors.indexOf(d), 1); const k = Math.floor(d.x / 20) + ',' + Math.floor(d.z / 20); const a = this.bdGrid.get(k); if (a) a.splice(a.indexOf(d), 1); }
    try { for (const e of entrancesOf(this.bldgOf(s))) this.addBDoor(s, e); } catch (e) { console.warn(e); }
  }
  // 들어갈 수 있는 건물들 + 문 위치
  buildBldgs() {
    this.bdoors = []; this.bdGrid = new Map(); this.bldgs = [];
    for (const b of this.blocks) for (const s of b.specs) {
      if (!s.bkind || s.site || s.special) continue;
      this.bldgs.push(s);
      let B;
      try { B = this.bldgOf(s); } catch (e) { console.warn('bldg', e); continue; }
      if (s.bkind === 'tower') continue; // 타워 로비 문은 아래에서
      for (const e of entrancesOf(B)) this.addBDoor(s, e);
    }
    // 주상복합 타워: 포디움 가장자리 로비 문
    for (const s of this.bldgs) if (s.bkind === 'tower') { const B = this.bldgOf(s); for (const e of entrancesOf(B)) this.addBDoor(s, e); }
  }
  addBDoor(s, e) {
    const t = e.unit?.tenant;
    const d = { x: e.x, z: e.z, nx: e.nx, nz: e.nz, spec: s, n: e.n, door: e.door, unitK: e.unit?.k ?? null, villa: e.villa };
    if (t && !t.vacant) { d.name = t.name; d.icon = TYPES[t.type]?.icon || '🏪'; d.tenant = t; }
    else if (t?.vacant) { d.name = '빈 가게 (임대 문의)'; d.icon = '🏷️'; d.vacant = true; }
    else { d.name = s.bname || '건물'; d.icon = s.bkind === 'apt' || s.bkind === 'tower' || s.bkind === 'villa' ? '🏢' : s.bkind === 'office' ? '🏢' : s.bkind === 'civic' ? '🏛️' : '🚪'; d.lobby = true; }
    this.bdoors.push(d);
    const k = Math.floor(d.x / 20) + ',' + Math.floor(d.z / 20);
    let a = this.bdGrid.get(k); if (!a) this.bdGrid.set(k, a = []); a.push(d);
  }
  bldgOf(s) {
    if (!s.B) s.B = describe(s, { kind: s.bkind, name: s.bname, front: s.tfront, podium: s.podium, towers: s.towers, hall: s.hall, lobbyLen: s.lobbyLen });
    return s.B;
  }
  nearestBDoor(x, z, r = 2.4) {
    let best = null, bd = r;
    const gx = Math.floor(x / 20), gz = Math.floor(z / 20);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const d of this.bdGrid?.get((gx + i) + ',' + (gz + j)) || []) { const dd = Math.hypot(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = d; } }
    return best;
  }
  buildMidBlock(b) {
    const F = { solid: new GB(), lit: new GB() };
    for (const s of b.specs) if (!s.site && !s.hidden) buildMid(F, s);
    const g = new THREE.Group();
    if (!F.solid.empty) g.add(new THREE.Mesh(F.solid.build(), this.B.solid));
    if (!F.lit.empty) { const lm = new THREE.Mesh(F.lit.build(), this.B.lit); lm.userData.night = true; g.add(lm); }
    this.group.add(g);
    b.mid = g;
  }
  treeGeos() {
    if (this._tg) return this._tg;
    const trunk = new THREE.CylinderGeometry(0.15, 0.24, 3.2, 5, 1, true); trunk.translate(0, 1.6, 0);
    const leaf = new THREE.IcosahedronGeometry(2.2, 1); leaf.translate(0, 4.6, 0);
    const pos = leaf.attributes.position;
    for (let k = 0; k < pos.count; k++) { const n = 1 + (Math.sin(pos.getX(k) * 3.1) + Math.cos(pos.getZ(k) * 2.7 + pos.getY(k))) * 0.08; pos.setXYZ(k, pos.getX(k) * n, 4.6 + (pos.getY(k) - 4.6) * 0.85 * n, pos.getZ(k) * n); }
    leaf.computeVertexNormals();
    const leaf2 = new THREE.IcosahedronGeometry(1.5, 0); leaf2.translate(0.9, 5.8, 0.4);
    const low = new THREE.IcosahedronGeometry(2.3, 0); low.scale(1, 1.15, 1); low.translate(0, 4.4, 0);
    return (this._tg = { trunk, leaf, leaf2, low });
  }
  treeMesh(list, geos, castShadow) {
    const out = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), col = new THREE.Color(), sc = new THREE.Vector3();
    for (const [geo, mat, kind] of geos) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, z, s, pink], k) => {
        e.set(0, ((x * 13.1 + z * 7.3) % 6.28), 0); q.setFromEuler(e);
        m4.compose(v.set(x, Y0, z), q, sc.set(s, s, s)); im.setMatrixAt(k, m4);
        if (kind) {
          const h = Math.abs(Math.sin(x * 0.37 + z * 0.71));
          if (pink) col.setHSL(0.93 + h * 0.04, 0.7, 0.8 + h * 0.06); else col.setHSL(0.25 + h * 0.07, 0.6 + h * 0.15, 0.34 + h * 0.08);
          if (kind === 2) col.offsetHSL(0.01, 0, 0.05);
          im.setColorAt(k, col);
        }
      });
      im.castShadow = castShadow; im.receiveShadow = castShadow; im.computeBoundingSphere();
      out.push(im);
    }
    return out;
  }
  buildNearChunk(c) {
    const B = new Bld();
    for (const s of c.specs) if (!s.hidden) buildNear(B, s);
    for (const e of c.extras) e.fn(B);
    for (const l of c.lamps) {
      const ry = l.axis === 'z' ? (l.rot > 0 ? Math.PI / 2 : -Math.PI / 2) : (l.rot > 0 ? 0 : Math.PI);
      const dx = Math.sin(ry), dz = Math.cos(ry);
      B.metal.setRGB(0.18, 0.19, 0.21);
      B.metal.addGeo(new THREE.CylinderGeometry(0.09, 0.13, 8.5, 6, 1, true).translate(l.x, Y0 + 4.25, l.z));
      B.metal.box(Math.min(l.x, l.x - dx * 2.6) - 0.06, Y0 + 8.35, Math.min(l.z, l.z - dz * 2.6) - 0.06, Math.max(l.x, l.x - dx * 2.6) + 0.06, Y0 + 8.47, Math.max(l.z, l.z - dz * 2.6) + 0.06);
      B.lit.setRGB(1, 0.9, 0.72); B.lit.cbox(l.x - dx * 2.6, Y0 + 8.3, l.z - dz * 2.6, 0.5, 0.14, 0.5);
    }
    for (const [x, z] of c.parkLamps) {
      B.metal.setRGB(0.18, 0.19, 0.21); B.metal.addGeo(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 6, 1, true).translate(x, Y0 + 1.8, z));
      B.lit.setRGB(1, 0.92, 0.78); B.lit.addGeo(new THREE.SphereGeometry(0.28, 8, 6).translate(x, Y0 + 3.75, z));
    }
    const g = new THREE.Group();
    for (const m of B.meshes(this.B)) g.add(m);
    const pl = c.lamps.length + c.parkLamps.length;
    if (pl) {
      const pools = new THREE.InstancedMesh(this.poolGeo || (this.poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), this.mat.pool, pl);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
      let k = 0;
      for (const l of c.lamps) { const ry = l.axis === 'z' ? (l.rot > 0 ? Math.PI / 2 : -Math.PI / 2) : (l.rot > 0 ? 0 : Math.PI); m4.compose(v.set(l.x - Math.sin(ry) * 2.6, 0.06, l.z - Math.cos(ry) * 2.6), q, s.set(14, 1, 14)); pools.setMatrixAt(k++, m4); }
      for (const [x, z] of c.parkLamps) { m4.compose(v.set(x, Y0 + 0.07, z), q, s.set(7, 1, 7)); pools.setMatrixAt(k++, m4); }
      pools.renderOrder = 2; pools.frustumCulled = false; g.add(pools);
    }
    const gs = c.b.gateSign;
    if (gs && gs.cx >= c.x0 && gs.cx < c.x1 && gs.z >= c.z0 && gs.z < c.z1) {
      const t = T.sign(c.b.name, '#2f3a33', '#f2efe6', '', 512, 96);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.4), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
      m.position.set(gs.cx, Y0 + 4.1, gs.z - 0.66); m.rotation.y = Math.PI; m.userData.own = true; g.add(m);
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(14, 0.9, 1.2), this.mat.plain); m2.position.set(gs.cx, Y0 + 4.1, gs.z); g.add(m2);
    }
    this.group.add(g);
    c.near = g;
  }
  buildTrees(c, near) {
    const tg = this.treeGeos();
    const g = new THREE.Group();
    const geos = near ? [[tg.trunk, this.treeMats.trunk, 0], [tg.leaf, this.treeMats.leaf, 1], [tg.leaf2, this.treeMats.leaf, 2]] : [[tg.low, this.treeMats.leaf, 1]];
    for (const im of this.treeMesh(c.trees, geos, near)) g.add(im);
    this.group.add(g);
    return g;
  }
  disposeGroup(g) {
    if (!g) return;
    this.group.remove(g);
    const shared = new Set([this.poolGeo, ...Object.values(this._tg || {})]);
    g.traverse(o => { if (o.isMesh) { if (!shared.has(o.geometry)) o.geometry.dispose(); if (o.userData.own) { o.material.map?.dispose(); o.material.dispose(); } } });
  }
  dist(c, p) { const dx = Math.max(c.x0 - p.x, 0, p.x - c.x1), dz = Math.max(c.z0 - p.z, 0, p.z - c.z1); return Math.hypot(dx, dz); }
  updateLOD(camPos, budget = 2) {
    let built = 0;
    const near = [];
    for (const c of this.chunks) {
      const d = this.dist(c, camPos);
      c.d = d;
      if (d < this.nearR && !c.near) near.push(c);
      if (c.near) { c.near.visible = d < this.nearR + 40; if (d > this.nearR * 1.7 + 100) { this.disposeGroup(c.near); c.near = null; } }
      if (c.trees.length) {
        const wantN = d < this.treeNearR, wantM = !wantN && d < this.treeMidR;
        if (wantN && !c.tn && built < budget + 2) { c.tn = this.buildTrees(c, true); built += 0.5; }
        if (wantM && !c.tm && built < budget + 2) { c.tm = this.buildTrees(c, false); built += 0.25; }
        if (c.tn) c.tn.visible = wantN || (d < this.treeNearR + 30 && !c.tm);
        if (c.tm) c.tm.visible = wantM || (!c.tn && d < this.treeNearR);
        if (c.tn && d > this.treeNearR * 2 + 80) { this.disposeGroup(c.tn); c.tn = null; }
        if (c.tm && d > this.treeMidR * 1.5) { this.disposeGroup(c.tm); c.tm = null; }
      }
    }
    near.sort((a, b) => a.d - b.d);
    for (const c of near) { if (built >= budget) break; this.buildNearChunk(c); built++; }
    for (const b of this.blocks) {
      if (!b.specs.length) continue;
      const d = this.dist(b.r, camPos);
      if (d < this.midR) { if (!b.mid && built < budget + 1) { this.buildMidBlock(b); built += 0.5; } if (b.mid) b.mid.visible = true; }
      else if (b.mid) { b.mid.visible = false; if (d > this.midR * 1.4) { this.disposeGroup(b.mid); b.mid = null; } }
      if (b.mid) for (const m of b.mid.children) if (m.userData.night) m.visible = this.night > 0.2;
    }
    for (const s of this.sites) {
      const d = Math.hypot(s.x - camPos.x, s.z - camPos.z);
      const nearS = d < this.siteR;
      s.shell.visible = nearS && !(s.inside && (s.kind === 'tower' || s.editing));
      if (s.far) s.far.visible = !nearS && !s.inside;
      s.anchor.visible = nearS;
      if (s.signs) s.signs.visible = !s.inside;
      if (s.stub) for (const m of s.stub) m.visible = !!s.inside;
    }
  }
  warmup(camPos) { for (let k = 0; k < 30; k++) this.updateLOD(camPos, 40); }

  // ───────── 사이트: 실제 크기 실내가 들어가는 건물 ─────────
  makeSiteFrame(s) {
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    s.toWorld = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
    s.toLocal = (wx, wz) => { const dx = wx - s.x, dz = wz - s.z; return [dx * c - dz * sn, dx * sn + dz * c]; };
    s.wrect = (lx0, lz0, lx1, lz1) => { const a = s.toWorld(lx0, lz0), b = s.toWorld(lx1, lz1); return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) }; };
    const [fx, fz] = s.toWorld(0, 1); const dx = fx - s.x, dz = fz - s.z;
    s.frontKey = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'E' : 'W') : (dz > 0 ? 'S' : 'N');
    s.normal = [dx, dz];
  }
  siteFar(s, specs) {
    const F = { solid: new GB(), lit: new GB() };
    for (const sp of specs) buildBox(F, sp);
    if (F.solid.empty) return;
    s.far = new THREE.Mesh(F.solid.build(), this.B.solid);
    s.group.add(s.far);
  }
  buildSites() {
    for (const s of this.sites) {
      const g = new THREE.Group(); s.group = g;
      const anchor = new THREE.Group(); anchor.position.set(s.x, Y0 + 0.03, s.z); anchor.rotation.y = s.rot; s.anchor = anchor; s.y = Y0 + 0.03;
      s.signs = new THREE.Group(); anchor.add(s.signs);
      g.add(anchor);
      const shell = new THREE.Group(); s.shell = shell; g.add(shell);
      this.makeSiteFrame(s);
      const wrect = s.wrect;
      const W = s.W, D = s.D, t = s.wall;
      const B = new Bld();
      const adj = (v, lim) => Math.abs(Math.abs(v) - lim) < 1e-6 ? v + Math.sign(v) * 0.025 : v;   // 실내 벽과 겹치지 않게
      const skin = (lx0, lz0, lx1, lz1, y0, y1, col) => { const r = wrect(adj(lx0, W / 2), adj(lz0, D / 2), adj(lx1, W / 2), adj(lz1, D / 2)); B.solid.setRGB(...col); B.solid.box(r.x0, Y0 + y0, r.z0, r.x1, Y0 + y1, r.z1); };
      const topH = Y0 + (s.kind === 'mart' || s.kind === 'stat' ? 3.3 : s.kind === 'home' ? 3.0 : 3.3) + s.floors * (s.fh || 3.6);
      const wallCol = (lx0, lz0, lx1, lz1, h = topH) => { this.colliders.push({ ...wrect(lx0, lz0, lx1, lz1), h }); };
      const [nx, nz] = s.normal;
      if (s.kind === 'mart' || s.kind === 'stat') {
        const gh = 3.3, mart = s.kind === 'mart';
        const dx0 = mart ? 3.2 : 2.7, dx1 = mart ? 5.2 : 4.3, dcx = (dx0 + dx1) / 2;
        const outer = wrect(-W / 2 - t, -D / 2 - t, W / 2 + t, D / 2 + t);
        const up = { type: 'upper', ...outer, y0: Y0 + gh, floors: s.floors, fh: s.fh, color: s.color, accent: [0.3, 0.32, 0.36], seed: 7000 + s.idx, front: s.frontKey };
        buildNear(B, up); s.specs = [up];
        skin(-W / 2 - t, -D / 2 - t, W / 2 + t, -D / 2, 0, gh, s.color);
        skin(-W / 2 - t, -D / 2, -W / 2, D / 2, 0, gh, s.color);
        skin(W / 2, -D / 2, W / 2 + t, D / 2, 0, gh, s.color);
        skin(-W / 2 - t, D / 2, W / 2 + t, D / 2 + t, 3.0, gh, mart ? [0.12, 0.55, 0.3] : [1, 0.55, 0.22]);
        skin(-W / 2 - t, D / 2, -W / 2, D / 2 + t, 0, 3, s.color); skin(W / 2, D / 2, W / 2 + t, D / 2 + t, 0, 3, s.color);
        wallCol(-W / 2 - t, -D / 2 - t, W / 2 + t, -D / 2); wallCol(-W / 2 - t, -D / 2, -W / 2, D / 2 + t); wallCol(W / 2, -D / 2, W / 2 + t, D / 2 + t);
        wallCol(-W / 2, D / 2 - 0.15, dx0, D / 2 + t); wallCol(dx1, D / 2 - 0.15, W / 2, D / 2 + t);
        const [ex, ez] = s.toWorld(dcx, D / 2 + 2.2);
        this.entrances.push({ id: s.kind, name: s.sp.name, icon: s.sp.icon, x: ex, z: ez, nx, nz, face: Math.atan2(nx, nz), site: s, walkIn: true });
        const sw = mart ? 6 : 5, sx = mart ? -1.5 : -1.8;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / 4), this.signMat(s.sp.sign)); sign.position.set(sx, gh + 1.0, D / 2 + t + 0.32); s.signs.add(sign);
        const sbk = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.3, sw / 4 + 0.2, 0.3), this.mat.plain); sbk.position.set(sx, gh + 1.0, D / 2 + t + 0.15); s.signs.add(sbk);
        if (!mart) {
          // 문구점 앞 차양 + 입간판
          const aw = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.1, 1.3), new THREE.MeshStandardMaterial({ color: 0xff8a3a, roughness: 0.6 })); aw.position.set(0, 3.05, D / 2 + t + 0.65); aw.rotation.x = 0.12; s.signs.add(aw);
          const bt = T.sign('오늘의 추천', '#ffffff', '#ff6a1a', '스케치북 · 뽑기', 256, 384);
          const pm = this.mat.plain, bm = new THREE.MeshStandardMaterial({ map: bt });
          const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.04), [pm, pm, pm, pm, bm, pm]);
          board.position.set(-W / 2 + 1.2, 0.5, D / 2 + t + 1.1); board.rotation.x = -0.12; s.signs.add(board);
        }
        this.parking[s.kind + s.idx] = this.curbSpot({ x0: outer.x0, x1: outer.x1, z0: outer.z0, z1: outer.z1 }, s.frontKey, W / 2);
      } else if (s.kind === 'home') {
        const gh = 3.0, nb = s.neighbor;
        const outer = wrect(-W / 2 - t, -D / 2 - t, W / 2 + t + nb, D / 2 + t);
        const up = { type: 'upper', ...outer, y0: Y0 + gh, floors: s.floors, fh: s.fh, color: s.color, seed: 7100, front: s.frontKey, style: 'punched' };
        buildNear(B, up); s.specs = [up];
        const col = s.color;
        // 내 원룸 바깥벽 (뒤 창문 · 앞 현관 구멍)
        const wx0 = -1, wx1 = 1;
        skin(-W / 2 - t, -D / 2 - t, wx0, -D / 2, 0, gh, col); skin(wx1, -D / 2 - t, W / 2 + t, -D / 2, 0, gh, col);
        skin(wx0, -D / 2 - t, wx1, -D / 2, 0, 0.9, col); skin(wx0, -D / 2 - t, wx1, -D / 2, 2.2, gh, col);
        skin(-W / 2 - t, -D / 2, -W / 2, D / 2 + t, 0, gh, col);
        skin(-W / 2, D / 2, W / 2 - 1.6, D / 2 + t, 0, gh, col); skin(W / 2 - 0.6, D / 2, W / 2 + t, D / 2 + t, 0, gh, col); skin(W / 2 - 1.6, D / 2, W / 2 - 0.6, D / 2 + t, 2.15, gh, col);
        // 옆 호실 (닫힌 공간 + 현관문)
        skin(W / 2, -D / 2 - t, W / 2 + t + nb, D / 2 + t, 0, gh, col);
        B.solid.setRGB(0.42, 0.28, 0.2); { const r = wrect(W / 2 + nb - 2, D / 2 + t, W / 2 + nb - 1, D / 2 + t + 0.05); B.solid.box(r.x0, Y0, r.z0, r.x1, Y0 + 2.1, r.z1); }
        B.solid.setRGB(0.92, 0.92, 0.9); { const r = wrect(-W / 2 - t, D / 2 + t, W / 2 + t + nb, D / 2 + t + 1.2); B.solid.box(r.x0, Y0 + 2.6, r.z0, r.x1, Y0 + 2.75, r.z1); }
        wallCol(-W / 2 - t, -D / 2 - t, W / 2 + t + nb, -D / 2); wallCol(-W / 2 - t, -D / 2, -W / 2, D / 2 + t); wallCol(W / 2, -D / 2, W / 2 + t + nb, D / 2 + t);
        wallCol(-W / 2, D / 2 - 0.1, W / 2 - 1.6, D / 2 + t); wallCol(W / 2 - 0.6, D / 2 - 0.1, W / 2, D / 2 + t);
        const [ex, ez] = s.toWorld(W / 2 - 1.1, D / 2 + 2.2);
        this.entrances.push({ id: 'home', homeId: 'oneroom', name: s.sp.name, icon: s.sp.icon, x: ex, z: ez, nx, nz, face: Math.atan2(nx, nz), site: s, walkIn: true });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), this.signMat(s.sp.sign)); sign.position.set(1 + nb / 2, gh + s.floors * s.fh - 1.4, D / 2 + t + 0.06); s.signs.add(sign);
        const pk = nearestRoad(outer.z1 + 12);
        this.parking.home = { x: (outer.x0 + outer.x1) / 2, z: ROADS[pk] - (ROAD / 2 - 1.1), rot: -Math.PI / 2 };
      } else if (s.kind === 'school') {
        const gh = 3.3, bl = s.bld;
        const up = { type: 'school', ...bl, y0: Y0 + gh, floors: s.floors, fh: 3.6, color: s.color, accent: s.accent, seed: 7200 + Math.round(s.x), front: 'N', clock: s.clock };
        buildNear(B, up); s.specs = [up];
        const cx = s.x, fz = bl.z0;     // 정문은 북쪽(운동장 · 정문 쪽)
        const col = s.color;
        B.solid.setRGB(...col);
        B.solid.box(bl.x0, Y0, fz, cx - W / 2, Y0 + gh, fz + 0.4); B.solid.box(cx + W / 2, Y0, fz, bl.x1, Y0 + gh, fz + 0.4);
        B.solid.box(cx - W / 2, Y0 + 3.0, fz - 0.05, cx + W / 2, Y0 + gh, fz + 0.4);
        B.solid.box(bl.x0, Y0, bl.z1 - 0.4, bl.x1, Y0 + gh, bl.z1);
        B.solid.box(bl.x0, Y0, fz, bl.x0 + 0.4, Y0 + gh, bl.z1); B.solid.box(bl.x1 - 0.4, Y0, fz, bl.x1, Y0 + gh, bl.z1);
        for (const [a, b] of [[bl.x0 + 1, cx - W / 2 - 1], [cx + W / 2 + 1, bl.x1 - 1]]) { B.room.setRGB(0.25, 0.28, 0.3); B.room.wall(b, fz - 0.01, a, fz - 0.01, Y0 + 1, Y0 + 2.4); }
        B.solid.setRGB(...s.accent); B.solid.box(bl.x0, Y0 + 3.0, fz - 0.06, bl.x1, Y0 + gh, fz);
        B.solid.setRGB(0.93, 0.93, 0.91); B.solid.box(bl.x0 + 0.4, Y0 + 3.0, fz + 0.4, bl.x1 - 0.4, Y0 + gh, bl.z1 - 0.4, { bottom: true });
        B.solid.setRGB(0.85, 0.85, 0.82); B.solid.box(cx - 5, Y0 + 3.4, fz - 3.6, cx + 5, Y0 + 3.65, fz);
        this.colliders.push({ x0: bl.x0, x1: cx - W / 2, z0: fz, z1: bl.z1, h: 20 }, { x0: cx + W / 2, x1: bl.x1, z0: fz, z1: bl.z1, h: 20 }, { x0: bl.x0, x1: bl.x1, z0: fz + D, z1: bl.z1, h: 20 });
        this.colliders.push({ x0: cx - W / 2, x1: cx - 1.5, z0: fz - 0.1, z1: fz + 0.25, h: topH }, { x0: cx + 1.5, x1: cx + W / 2, z0: fz - 0.1, z1: fz + 0.25, h: topH });
        const [ex, ez] = s.toWorld(0, D / 2 + 2.2);
        this.entrances.push({ id: 'school', school: s.school, name: s.name, icon: s.icon, x: ex, z: ez, nx, nz, face: Math.atan2(nx, nz), site: s, walkIn: true });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), this.signMat([s.name, '#1d3b5e', '#ffffff', s.school === 'univ' ? 'HANBIT UNIVERSITY' : ''])); sign.position.set(cx + 18, Y0 + gh + s.floors * 3.6 - 2, fz - 0.4); sign.rotation.y = Math.PI; g.add(sign);
      }
      for (const m of B.meshes(this.B)) shell.add(m);
      this.siteFar(s, s.specs);
      this.group.add(g);
    }
    // 아파트 · 펜트하우스: 동 전체를 따로 (들어가면 숨기고 아래층 덩어리만)
    for (const [kind, t] of [['apt', this.aptHomeTower], ['pent', this.pentTower]]) {
      if (!t) continue;
      const g = new THREE.Group();
      const B = new Bld(); buildNear(B, t);
      const shell = new THREE.Group(); for (const m of B.meshes(this.B)) shell.add(m); g.add(shell);
      const H = HOMES.find(h => h.id === kind);
      const fl = kind === 'apt' ? 11 : t.floors - 1;
      const y = t.y0 + fl * t.fh + 0.25;
      const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2;
      const rot = kind === 'apt' ? Math.PI : ({ E: -Math.PI / 2, W: Math.PI / 2, S: 0, N: Math.PI })[this.pentLake];
      const anchor = new THREE.Group(); anchor.position.set(cx, y, cz); anchor.rotation.y = rot; g.add(anchor);
      const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...t.color, THREE.SRGBColorSpace), roughness: 0.6 });
      const stub = new THREE.Mesh(new THREE.BoxGeometry(t.x1 - t.x0 - 0.4, y - 0.3 - t.y0, t.z1 - t.z0 - 0.4), bodyMat);
      stub.position.set(cx, (y - 0.3 + t.y0) / 2, cz); stub.visible = false; g.add(stub);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(t.x1 - t.x0 + 2, 0.3, t.z1 - t.z0 + 2), new THREE.MeshStandardMaterial({ color: 0xdedcd6, roughness: 0.8 }));
      slab.position.set(cx, y - 0.17, cz); slab.visible = false; g.add(slab);
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(H.w + 1, 0.3, H.d + 1), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.9 }));
      ceil.position.set(0, 2.85, 0); ceil.visible = false; anchor.add(ceil);
      const site = { kind: 'tower', id: 'home', homeId: kind, W: H.w, D: H.d, x: cx, z: cz, y, rot, group: g, shell, anchor, stub: [stub, slab, ceil], spec: t };
      this.makeSiteFrame(site);
      this.sites.push(site);
      this.siteFar(site, [t]);
      this.group.add(g);
    }
  }
  siteFor(kind, homeId) { return this.sites.find(s => (kind === 'home' ? s.homeId === homeId : s.kind === kind)); }

  buildOutskirts() {
    const R = this.rand;
    const F = { solid: new GB(), lit: new GB() };
    for (let k = 0; k < 260; k++) {
      const ang = R() * Math.PI * 2, rad = HALF + 260 + Math.pow(R(), 0.7) * 900;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (Math.abs(x) < HALF + 200 && Math.abs(z) < HALF + 200) continue;
      const apt = R() < 0.75;
      const w = apt ? 52 : 26 + R() * 20, d = apt ? 14 : 26 + R() * 20;
      buildBox(F, { type: apt ? 'apt' : 'office', x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: 0, floors: apt ? 18 + Math.floor(R() * 15) : 10 + Math.floor(R() * 25), fh: apt ? 2.9 : 3.8, color: APT_COLORS[Math.floor(R() * APT_COLORS.length)], seed: 5000 + k, front: 'S' });
    }
    this.group.add(new THREE.Mesh(F.solid.build(), this.B.solid));
    const lm = new THREE.Mesh(F.lit.build(), this.B.lit); lm.visible = false; this.group.add(lm); this.farLit.push(lm);
    const mtn = new THREE.MeshStandardMaterial({ color: 0x5a9a62, roughness: 1, flatShading: true });
    for (let k = 0; k < 18; k++) {
      const ang = k / 18 * Math.PI * 2 + R() * 0.3, rad = 2750 + R() * 350;
      const m = new THREE.Mesh(new THREE.ConeGeometry(500 + R() * 400, 260 + R() * 320, 7), mtn);
      m.position.set(Math.cos(ang) * rad, 80, Math.sin(ang) * rad); m.rotation.y = R() * 3;
      this.group.add(m);
    }
  }

  signal(ap) {
    const order = ['+z', '-z', '+x', '-x'];
    const t = this.signalT % 40, idx = Math.floor(t / 10);
    if (order[idx] !== ap) return 'r';
    return t % 10 < 8 ? 'g' : 'y';
  }
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
  groundY(x, z) { if (this.onBridge(x, z)) return 0.7; return this.onRoad(x, z) ? 0 : Y0; }

  addPole(x, z) { const k = Math.floor(x / 10) + ',' + Math.floor(z / 10); if (!this.poleGrid.has(k)) this.poleGrid.set(k, []); this.poleGrid.get(k).push(x, z); }
  nearPole(x, z, r) {
    const gx = Math.floor(x / 10), gz = Math.floor(z / 10);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.poleGrid.get((gx + i) + ',' + (gz + j));
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) if (Math.abs(a[k] - x) < r && Math.abs(a[k + 1] - z) < r && Math.hypot(a[k] - x, a[k + 1] - z) < r) return true;
    }
    return false;
  }
  // 카메라용: 점이 나뭇잎 속인지
  inCanopy(x, y, z) {
    const gx = Math.floor(x / 10), gz = Math.floor(z / 10);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.treeGrid.get((gx + i) + ',' + (gz + j));
      if (!a) continue;
      for (const [tx, tz, sc] of a) { const r = 2.6 * sc; if (y > 2.2 * sc && y < 7.2 * sc && Math.abs(tx - x) < r && Math.abs(tz - z) < r && Math.hypot(tx - x, tz - z) < r) return true; }
    }
    return false;
  }
  query(x0, z0, x1, z1) { return this.grid.query(x0, z0, x1, z1, this._q || (this._q = [])); }

  collide(pos, r, opts = {}) {
    let hit = false;
    // 걸어 들어가는 건물: 통째 상자 대신 1층 실제 벽
    for (const ob of opts.walker ? this.openBldgs || [] : []) {
      if (pos.x < ob.s.x0 - 3 || pos.x > ob.s.x1 + 3 || pos.z < ob.s.z0 - 3 || pos.z > ob.s.z1 + 3) continue;
      for (const c of ob.wcols) {
        if (c.src.open) continue;
        if (pos.x + r < c.x0 || pos.x - r > c.x1 || pos.z + r < c.z0 || pos.z - r > c.z1) continue;
        const nx = Math.max(c.x0, Math.min(pos.x, c.x1)), nz = Math.max(c.z0, Math.min(pos.z, c.z1));
        const dx = pos.x - nx, dz = pos.z - nz, d = Math.hypot(dx, dz);
        if (d < r) {
          hit = true;
          if (d < 1e-4) { const l = pos.x - c.x0, rr = c.x1 - pos.x, t = pos.z - c.z0, b = c.z1 - pos.z, mn = Math.min(l, rr, t, b); if (mn === l) pos.x = c.x0 - r; else if (mn === rr) pos.x = c.x1 + r; else if (mn === t) pos.z = c.z0 - r; else pos.z = c.z1 + r; }
          else { pos.x = nx + dx / d * r; pos.z = nz + dz / d * r; }
        }
      }
    }
    for (const c of this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r)) {
      if (c.spec?.open && opts.walker) continue;   // 걸어서만 들어갈 수 있어요 (차는 막힘)
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
    if (pos.x > PARK.x0 && pos.x < PARK.x1 && pos.z > PARK.z0 && pos.z < PARK.z1 && !this.onBridge(pos.x, pos.z)) {
      const th = Math.atan2(pos.z, pos.x), d = Math.hypot(pos.x, pos.z), lr = lakeR(th) + 0.6 + r;
      if (d < lr) { pos.x = Math.cos(th) * lr; pos.z = Math.sin(th) * lr; hit = true; }
    }
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
  // 카메라용: 점이 건물 안인지
  insideBuilding(x, y, z) {
    for (const ob of this.openBldgs || []) {
      if (x < ob.s.x0 - 0.3 || x > ob.s.x1 + 0.3 || z < ob.s.z0 - 0.3 || z > ob.s.z1 + 0.3) continue;
      if (y > ob.ceil) return y < specH(ob.s) + 6;
      for (const c of ob.wcols) if (!c.src.open && x > c.x0 - 0.2 && x < c.x1 + 0.2 && z > c.z0 - 0.2 && z < c.z1 + 0.2) return true;
    }
    for (const c of this.query(x - 0.3, z - 0.3, x + 0.3, z + 0.3)) if (!c.soft && !c.spec?.open && x > c.x0 - 0.3 && x < c.x1 + 0.3 && z > c.z0 - 0.3 && z < c.z1 + 0.3 && y < c.h + 0.5) return true;
    return false;
  }

  update(dt, night, time, camPos) {
    this.signalT += dt;
    this.night = night;
    const B = this.B;
    B.lit.emissiveIntensity = night * 1.25;
    B.shopLit.emissiveIntensity = 0.45 + night * 0.9;
    B.sign.emissiveIntensity = 0.25 + night * 0.9;
    for (const m of this.farLit) m.visible = night > 0.2;
    this.mat.pool.opacity = Math.max(0, night - 0.25) * 0.6;
    for (const s of this.signs) s.emissiveIntensity = 0.15 + night * 0.9;
    for (const ap in this.sigMats) {
      const st = this.signal(ap);
      for (const c of ['r', 'y', 'g']) { const m = this.sigMats[ap][c]; m.mat.color.copy(c === st ? m.on : m.off); }
    }
    this.mat.ring.opacity = 0.55 + Math.sin(time * 4) * 0.25;
    this.jets.forEach((j, k) => { j.scale.y = 0.75 + Math.sin(time * 2.2 + k) * 0.25; });
    this.mat.jet.color.setHSL(night > 0.4 ? (time * 0.05) % 1 : 0.58, night > 0.4 ? 0.7 : 0.2, 0.85);
    if (camPos) this.updateLOD(camPos);
  }
}

import * as THREE from 'three';
import { GB } from './geo.js';
import { N, ROAD, ROADS, STOP, LANE1, LANE2, hasEdge, segLen, nearestRoad } from './config.js';

// ───────── 차량 모델 ─────────
const PROFILES = {
  sedan: { L: 4.7, W: 1.82, cabW: 1.6, wr: 0.33, lower: [[-2.35, 0.3], [2.3, 0.3], [2.4, 0.5], [2.3, 0.8], [1.1, 0.97], [-1.5, 0.98], [-2.22, 0.95], [-2.38, 0.75], [-2.4, 0.45]], cabin: [[1.12, 0.95], [0.25, 1.42], [-0.78, 1.44], [-1.58, 0.97]], roof: [0.25, -0.78, 1.44], head: 0.62, tail: 0.82 },
  hatch: { L: 3.6, W: 1.6, cabW: 1.44, wr: 0.3, lower: [[-1.75, 0.3], [1.7, 0.3], [1.8, 0.5], [1.72, 0.75], [0.9, 0.92], [-1.65, 0.95], [-1.8, 0.75], [-1.8, 0.45]], cabin: [[0.92, 0.9], [0.1, 1.46], [-1.4, 1.5], [-1.68, 0.95]], roof: [0.1, -1.4, 1.5], head: 0.62, tail: 0.85 },
  suv: { L: 4.6, W: 1.9, cabW: 1.7, wr: 0.38, lower: [[-2.3, 0.42], [2.25, 0.42], [2.35, 0.65], [2.25, 1.0], [1.0, 1.12], [-2.25, 1.12], [-2.35, 0.9], [-2.35, 0.55]], cabin: [[1.02, 1.1], [0.2, 1.68], [-2.0, 1.7], [-2.24, 1.12]], roof: [0.2, -2.0, 1.7], head: 0.8, tail: 1.0 },
  sport: { L: 4.5, W: 1.95, cabW: 1.5, wr: 0.34, lower: [[-2.25, 0.25], [2.2, 0.25], [2.3, 0.42], [2.15, 0.62], [0.9, 0.8], [-1.4, 0.86], [-2.2, 0.82], [-2.28, 0.55]], cabin: [[0.92, 0.78], [-0.1, 1.2], [-0.8, 1.21], [-1.9, 0.84]], roof: [-0.1, -0.8, 1.21], head: 0.5, tail: 0.7 },
  taxi: null, truck: null,
};
PROFILES.taxi = PROFILES.sedan; PROFILES.police = PROFILES.sedan; PROFILES.ambulance = PROFILES.suv;

const geoCache = {};
function extrude(points, width, bevel = 0.04) {
  const s = new THREE.Shape();
  points.forEach(([z, y], i) => i ? s.lineTo(z, y) : s.moveTo(z, y));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.rotateY(-Math.PI / 2);
  g.translate((width - bevel * 2) / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

function wheelGeo(r, w) {
  const b = new GB();
  b.setColor(0x151515);
  const t = new THREE.CylinderGeometry(r, r, w, 18); t.rotateZ(Math.PI / 2); b.addGeo(t);
  b.setColor(0xb8bcc0);
  const rim = new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 10); rim.rotateZ(Math.PI / 2); b.addGeo(rim);
  b.setColor(0x55585c);
  const hub = new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.04, 8); hub.rotateZ(Math.PI / 2); b.addGeo(hub);
  return b.build();
}

export function carGeometry(type) {
  if (geoCache[type]) return geoCache[type];
  let out;
  if (type === 'bus') {
    // 시내버스 (저상): 길이 11m
    const body = new GB(), det = new GB(), lights = new GB();
    body.cbox(0, 1.75, 0, 2.5, 2.7, 11);
    det.setColor(0x10161c);
    det.cbox(-1.26, 2.05, -0.4, 0.04, 1.15, 8.6); det.cbox(1.26, 2.05, 0, 0.04, 1.15, 9.6);
    det.cbox(0, 2.0, 5.51, 2.2, 1.5, 0.04); det.cbox(0, 2.3, -5.51, 2.0, 0.9, 0.04);
    det.setColor(0x2a2e33); det.cbox(-1.27, 1.45, 4.3, 0.04, 2.3, 1.1); det.cbox(-1.27, 1.45, -0.6, 0.04, 2.3, 1.1);   // 문 (오른쪽 · 인도 쪽)
    det.setColor(0xf2f2ee); det.cbox(0, 3.12, 0, 2.3, 0.06, 10.6);
    det.setColor(0x222222); det.cbox(0, 0.42, 0, 2.3, 0.3, 10.6);
    const wg = wheelGeo(0.5, 0.32);
    for (const [x, z] of [[-1.05, 3.6], [1.05, 3.6], [-1.05, -3.2], [1.05, -3.2]]) det.addGeo(wg, new THREE.Matrix4().makeTranslation(x, 0.5, z));
    lights.setColor(0xfff4dc); lights.cbox(0.85, 0.85, 5.52, 0.4, 0.2, 0.05); lights.cbox(-0.85, 0.85, 5.52, 0.4, 0.2, 0.05);
    lights.setColor(0xff8a1a); lights.cbox(0, 2.95, 5.53, 1.6, 0.26, 0.04);   // 행선지 전광판
    lights.setColor(0xff2010); lights.cbox(1.0, 0.95, -5.52, 0.25, 0.4, 0.05); lights.cbox(-1.0, 0.95, -5.52, 0.25, 0.4, 0.05);
    out = { body: body.build(), detail: det.build(), lights: lights.build(), L: 11.2, W: 2.5, wheels: null };
  } else if (type === 'firetruck') {
    const body = new GB(), det = new GB(), lights = new GB();
    body.cbox(0, 1.7, -0.9, 2.4, 2.2, 5.6); body.cbox(0, 1.55, 2.75, 2.4, 2.1, 1.9);
    det.setColor(0x0d1216); det.cbox(0, 2.05, 3.71, 2.1, 0.8, 0.05); det.cbox(1.21, 2.0, 2.8, 0.04, 0.7, 1.2); det.cbox(-1.21, 2.0, 2.8, 0.04, 0.7, 1.2);
    det.setColor(0xd8dcdf); det.cbox(0, 2.95, -0.9, 0.9, 0.18, 6.4); det.cbox(0.4, 3.05, -0.9, 0.06, 0.12, 6.4); det.cbox(-0.4, 3.05, -0.9, 0.06, 0.12, 6.4);   // 사다리
    det.setColor(0xe8e8e8); det.cbox(1.21, 1.3, -0.9, 0.04, 0.12, 5.4); det.cbox(-1.21, 1.3, -0.9, 0.04, 0.12, 5.4);
    det.setColor(0x222222); det.cbox(0, 0.55, 0.4, 2.1, 0.3, 7.2);
    const wg = wheelGeo(0.5, 0.34);
    for (const [x, z] of [[-1.0, 2.8], [1.0, 2.8], [-1.0, -2.2], [1.0, -2.2], [-1.0, -1.1], [1.0, -1.1]]) det.addGeo(wg, new THREE.Matrix4().makeTranslation(x, 0.5, z));
    lights.setColor(0xff2010); lights.cbox(0.6, 2.7, 2.9, 0.5, 0.18, 0.4); lights.setColor(0x2050ff); lights.cbox(-0.6, 2.7, 2.9, 0.5, 0.18, 0.4);
    lights.setColor(0xfff4dc); lights.cbox(0.85, 0.9, 3.72, 0.35, 0.18, 0.05); lights.cbox(-0.85, 0.9, 3.72, 0.35, 0.18, 0.05);
    out = { body: body.build(), detail: det.build(), lights: lights.build(), L: 7.4, W: 2.4, wheels: null };
  } else if (type === 'truck') {
    const body = new GB(), det = new GB(), lights = new GB();
    body.cbox(0, 1.95, -0.9, 2.3, 2.3, 5.0);          // 화물칸
    body.cbox(0, 1.25, 2.45, 2.2, 1.5, 1.7);          // 캡 아래
    body.cbox(0, 2.25, 2.25, 2.2, 0.5, 1.3);
    det.setColor(0x0d1216); det.cbox(0, 2.15, 3.12, 2.0, 0.6, 0.05); det.cbox(1.11, 2.1, 2.4, 0.04, 0.55, 1.1); det.cbox(-1.11, 2.1, 2.4, 0.04, 0.55, 1.1);
    det.setColor(0x222222); det.cbox(0, 0.62, 0.4, 2.0, 0.3, 6.8);
    const wg = wheelGeo(0.45, 0.32);
    for (const [x, z] of [[-0.95, 2.4], [0.95, 2.4], [-0.95, -2.2], [0.95, -2.2], [-0.95, -1.2], [0.95, -1.2]]) det.addGeo(wg, new THREE.Matrix4().makeTranslation(x, 0.45, z));
    lights.setColor(0xfff4dc); lights.cbox(0.8, 0.85, 3.32, 0.35, 0.18, 0.05); lights.cbox(-0.8, 0.85, 3.32, 0.35, 0.18, 0.05);
    lights.setColor(0xff2010); lights.cbox(0.95, 0.95, -3.42, 0.25, 0.3, 0.05); lights.cbox(-0.95, 0.95, -3.42, 0.25, 0.3, 0.05);
    out = { body: body.build(), detail: det.build(), lights: lights.build(), L: 6.9, W: 2.3, wheels: null };
  } else {
    const p = PROFILES[type];
    const body = new GB();
    body.addGeo(extrude(p.lower, p.W, 0.06));
    // 지붕 + B필러
    const [rz0, rz1, ry] = p.roof;
    body.cbox(0, ry + 0.02, (rz0 + rz1) / 2, p.cabW + 0.02, 0.05, Math.abs(rz0 - rz1) + 0.05);
    const by = (p.cabin[0][1] + ry) / 2;
    body.cbox(0, by, (rz0 + rz1) / 2 - 0.05, p.cabW + 0.03, ry - p.cabin[0][1], 0.09);
    // 사이드미러
    body.cbox(p.W / 2 + 0.06, p.cabin[0][1] + 0.1, p.cabin[0][0] - 0.25, 0.14, 0.1, 0.18);
    body.cbox(-p.W / 2 - 0.06, p.cabin[0][1] + 0.1, p.cabin[0][0] - 0.25, 0.14, 0.1, 0.18);
    if (type === 'taxi') { body.cbox(0, ry + 0.17, (rz0 + rz1) / 2, 0.55, 0.25, 0.25); }
    const det = new GB();
    det.setColor(0x0b1014);
    det.addGeo(extrude(p.cabin, p.cabW, 0.03));
    // 그릴, 범퍼 하단
    det.setColor(0x1a1c1e);
    const fz = p.lower[2][0], rz = p.lower[p.lower.length - 1][0];
    det.cbox(0, p.lower[0][1] + 0.12, fz - 0.02, p.W * 0.55, 0.16, 0.06);
    det.cbox(0, p.lower[0][1] + 0.06, rz + 0.04, p.W * 0.8, 0.1, 0.06);
    // 바퀴 (트래픽용으로 합침)
    const wg = wheelGeo(p.wr, 0.24);
    const fa = p.L * 0.32, ra = -p.L * 0.31, wx = p.W / 2 - 0.13;
    const wheelPos = [[-wx, fa], [wx, fa], [-wx, ra], [wx, ra]];
    for (const [x, z] of wheelPos) det.addGeo(wg, new THREE.Matrix4().makeTranslation(x, p.wr, z));
    // 바퀴집 그림자 (검은 아치)
    const lights = new GB();
    lights.setColor(0xfff4dc);
    lights.cbox(p.W / 2 - 0.32, p.head, fz - 0.06, 0.38, 0.11, 0.08);
    lights.cbox(-p.W / 2 + 0.32, p.head, fz - 0.06, 0.38, 0.11, 0.08);
    lights.setColor(0xff1a0a);
    lights.cbox(p.W / 2 - 0.25, p.tail, rz + 0.03, 0.4, 0.12, 0.06);
    lights.cbox(-p.W / 2 + 0.25, p.tail, rz + 0.03, 0.4, 0.12, 0.06);
    // 번호판
    lights.setColor(0xe8e8e8);
    lights.cbox(0, p.lower[0][1] + 0.3, rz - 0.01, 0.52, 0.11, 0.02);
    if (type === 'police' || type === 'ambulance') {   // 경광등
      const zc = (rz0 + rz1) / 2;
      lights.setColor(0xff2010); lights.cbox(0.3, ry + 0.12, zc, 0.5, 0.14, 0.26);
      lights.setColor(0x2050ff); lights.cbox(-0.3, ry + 0.12, zc, 0.5, 0.14, 0.26);
    }
    const detNoWheel = new GB();
    detNoWheel.setColor(0x0b1014); detNoWheel.addGeo(extrude(p.cabin, p.cabW, 0.03));
    detNoWheel.setColor(0x1a1c1e);
    detNoWheel.cbox(0, p.lower[0][1] + 0.12, fz - 0.02, p.W * 0.55, 0.16, 0.06);
    detNoWheel.cbox(0, p.lower[0][1] + 0.06, rz + 0.04, p.W * 0.8, 0.1, 0.06);
    out = { body: body.build(), detail: det.build(), detailNoWheel: detNoWheel.build(), lights: lights.build(), wheel: wg, wheelPos, wr: p.wr, L: p.L, W: p.W };
  }
  geoCache[type] = out;
  return out;
}

const paintCache = new Map();
export function paint(color) {
  if (!paintCache.has(color)) paintCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.55, envMapIntensity: 1.4 }));
  return paintCache.get(color);
}
export const detailMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.6 });
export const trafficLightMat = new THREE.MeshBasicMaterial({ vertexColors: true });

export function buildCarMesh(type, color, { player = false } = {}) {
  const g = carGeometry(type);
  const root = new THREE.Group();
  const body = new THREE.Mesh(g.body, paint(type === 'taxi' ? 0xf28c1c : type === 'police' ? 0xf4f6f8 : type === 'ambulance' ? 0xf2f2f0 : type === 'firetruck' ? 0xc81e1e : color));
  const det = new THREE.Mesh(player && g.detailNoWheel ? g.detailNoWheel : g.detail, detailMat);
  const lightMat = player ? new THREE.MeshBasicMaterial({ vertexColors: true }) : trafficLightMat;
  const lights = new THREE.Mesh(g.lights, lightMat);
  body.castShadow = true; det.castShadow = true; body.receiveShadow = true;
  root.add(body, det, lights);
  const wheels = [];
  if (player && g.wheelPos) {
    for (const [x, z] of g.wheelPos) {
      const pivot = new THREE.Group(); pivot.position.set(x, g.wr, z);
      const w = new THREE.Mesh(g.wheel, detailMat); w.castShadow = true;
      pivot.add(w); root.add(pivot); wheels.push({ pivot, w, front: z > 0 });
    }
  }
  return { root, body, wheels, lightMat, L: g.L, W: g.W, wr: g.wr || 0.4 };
}

// ───────── 방향 유틸 ─────────
const DIRS = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
const right = (d) => [-d[1], d[0]];
function dirKey(d) { return d[0] > 0 ? '+x' : d[0] < 0 ? '-x' : d[1] > 0 ? '+z' : '-z'; }


// ───────── 교통 시스템 ─────────
const TRAFFIC_COLORS = [0xf2f2ee, 0xe9e9e6, 0x111316, 0x1a1c20, 0x8c9096, 0xa8adb2, 0x2b3a55, 0x6b1a1a, 0x3a4a3a, 0xc8c2b0, 0x24303c, 0xf2f2ee, 0x4a4f55];
const TYPES = ['sedan', 'sedan', 'sedan', 'hatch', 'suv', 'suv', 'taxi', 'taxi', 'truck', 'sport', 'bus'];
const BUS_COLORS = [0x2f6fd6, 0x2f6fd6, 0x3aa655, 0xd83a2a];

export class Traffic {
  constructor(scene, city, count) {
    this.scene = scene; this.city = city;
    this.cars = [];
    this.obstacles = [];      // 사고 차량 · 소방차 등 멈춰 있는 것
    this.group = new THREE.Group(); scene.add(this.group);
    // 야간 헤드라이트 빛 웅덩이
    const tex = city.mat.pool.map;
    this.poolMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: 0xfff2dd, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const pg = new THREE.PlaneGeometry(4, 9).rotateX(-Math.PI / 2).translate(0, 0.07, 6.5);
    this.pools = new THREE.InstancedMesh(pg, this.poolMat, 80);
    this.pools.frustumCulled = false;
    this.pools.count = 0;
    this.group.add(this.pools);
    this.setCount(count);
  }

  setCount(n) {
    while (this.cars.length > n) {
      const i = this.cars.findLastIndex(c => !c.script);   // 내가 탄 버스는 남겨요
      if (i < 0) break;
      const [c] = this.cars.splice(i, 1); this.group.remove(c.mesh.root);
    }
    let guard = 0;
    while (this.cars.length < n && guard++ < 500) this.spawn();
  }

  spawn(far) {
    const keys = Object.keys(DIRS);
    for (let tries = 0; tries < 30; tries++) {
      let a = Math.floor(Math.random() * (N + 1)), b = Math.floor(Math.random() * (N + 1));
      if (this.focus) {
        a = Math.max(0, Math.min(N, nearestRoad(this.focus.x) + Math.floor(Math.random() * 7) - 3));
        b = Math.max(0, Math.min(N, nearestRoad(this.focus.z) + Math.floor(Math.random() * 7) - 3));
      }
      const dk = keys[Math.floor(Math.random() * 4)], d = DIRS[dk];
      if (!hasEdge(a, b, d)) continue;
      const lane = Math.random() < 0.5 ? 1 : 2;
      const L = segLen(a, b, d);
      const u = ROAD / 2 + 2 + Math.random() * (L - STOP - ROAD / 2 - 6);
      const pos = this.lanePos(a, b, d, lane, u);
      if (this.cars.some(c => c.pos.distanceTo(pos) < 9)) continue;
      if (far && far.distanceTo(pos) < 120) continue;
      let type = TYPES[Math.floor(Math.random() * TYPES.length)];
      if (type === 'bus' && lane !== 2) type = 'sedan';
      const color = type === 'bus' ? BUS_COLORS[Math.floor(Math.random() * BUS_COLORS.length)] : TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
      const mesh = buildCarMesh(type, color);
      this.group.add(mesh.root);
      const car = {
        id: Math.random(), mesh, type, a, b, d, lane, u, L, state: 'straight', pos, heading: Math.atan2(d[0], d[1]),
        speed: 6, maxSpeed: (type === 'truck' || type === 'bus' ? 10 : 12) + Math.random() * 4, stuck: 0, len: mesh.L,
      };
      this.plan(car);
      this.cars.push(car);
      return car;
    }
  }

  lanePos(a, b, d, lane, u) {
    const off = lane === 1 ? LANE1 : LANE2;
    const r = right(d);
    return new THREE.Vector3(ROADS[a] + d[0] * u + r[0] * off, 0, ROADS[b] + d[1] * u + r[1] * off);
  }

  plan(car) {
    const ja = car.a + car.d[0], jb = car.b + car.d[1];
    const d = car.d, r = right(d), l = [-r[0], -r[1]];
    const sn = car.script?.next();
    if (sn && hasEdge(ja, jb, sn)) {
      car.next = sn;
      car.turnType = sn[0] === d[0] && sn[1] === d[1] ? 's' : (sn[0] === r[0] && sn[1] === r[1]) ? 'r' : 'l';
      return;
    }
    const opts = [];
    if (hasEdge(ja, jb, d)) opts.push(d, d);
    if (car.lane === 1 && hasEdge(ja, jb, l)) opts.push(l);
    if (car.lane === 2 && hasEdge(ja, jb, r)) opts.push(r);
    if (!opts.length) {
      if (hasEdge(ja, jb, l)) opts.push(l);
      if (hasEdge(ja, jb, r)) opts.push(r);
    }
    if (!opts.length) opts.push([-d[0], -d[1]]);
    car.next = opts[Math.floor(Math.random() * opts.length)];
    car.turnType = car.next === d ? 's' : (car.next[0] === r[0] && car.next[1] === r[1]) ? 'r' : 'l';
  }

  beginTurn(car) {
    const ja = car.a + car.d[0], jb = car.b + car.d[1];
    const J = new THREE.Vector3(ROADS[ja], 0, ROADS[jb]);
    const d = car.d, d2 = car.next;
    const off = car.lane === 1 ? LANE1 : LANE2;
    const r1 = right(d), r2 = right(d2);
    const E = new THREE.Vector3(J.x - d[0] * STOP + r1[0] * off, 0, J.z - d[1] * STOP + r1[1] * off);
    const X = new THREE.Vector3(J.x + d2[0] * ROAD / 2 + r2[0] * off, 0, J.z + d2[1] * ROAD / 2 + r2[1] * off);
    let K;
    if (car.turnType === 's') K = E.clone().lerp(X, 0.5);
    else { const s = (X.x - E.x) * d[0] + (X.z - E.z) * d[1]; K = new THREE.Vector3(E.x + d[0] * s, 0, E.z + d[1] * s); }
    car.bez = [E, K, X];
    car.bezLen = E.distanceTo(K) + K.distanceTo(X);
    if (car.turnType !== 's') car.bezLen *= 0.9;
    car.t = 0;
    car.state = 'turn';
    car.ja = ja; car.jb = jb;
  }

  reseed(p) { this.focus = p.clone(); const n = this.cars.length; this.setCount(0); this.setCount(n); }
  update(dt, playerPos, playerCar, night, camPos) {
    const cars = this.cars;
    this.focus = playerCar ? playerCar.pos : playerPos;
    this.farT = (this.farT || 0) + dt;
    if (this.farT > 0.5 && this.focus) {
      this.farT = 0;
      let n = 0;
      for (const c of cars.slice()) if (!c.script && c.pos.distanceTo(this.focus) > 560) { this.respawn(c, camPos || this.focus); if (++n >= 3) break; }
    }
    // 1) 앞차/장애물 감지
    for (const c of cars) {
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      let limit = c.maxSpeed;
      c.blockedBy = null;
      let best = 1e9;
      const check = (px, pz, len, who) => {
        const rx = px - c.pos.x, rz = pz - c.pos.z;
        const along = rx * fx + rz * fz;
        if (along <= 0 || along > 26) return;
        const lat = Math.abs(rx * fz - rz * fx);
        if (lat > 1.7) return;
        const gap = along - c.len / 2 - len / 2;
        if (gap < best) { best = gap; c.blockedBy = who; }
      };
      for (const o of cars) if (o !== c) check(o.pos.x, o.pos.z, o.len, o);
      for (const o of this.obstacles) check(o.x, o.z, o.len, 'obstacle');
      if (playerCar) check(playerCar.pos.x, playerCar.pos.z, 4.5, 'player');
      else if (playerPos && !this.ignorePlayer && !this.city.isOnBlock(playerPos.x, playerPos.z)) check(playerPos.x, playerPos.z, 0.6, 'player');
      c.gap = best;
    }
    for (const c of cars) {
      if (c.blockedBy && typeof c.blockedBy === 'object' && c.blockedBy.blockedBy === c && c.id < c.blockedBy.id) c.gap = 1e9;
    }
    // 2) 이동
    let pi = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    for (const c of cars) {
      let target = c.maxSpeed;
      if (c.state === 'straight') {
        const stopU = c.L - STOP;
        const distLine = stopU - c.u;
        // 신호
        const ja = c.a + c.d[0], jb = c.b + c.d[1];
        const sig = this.city.signalAt ? this.city.signalAt(ja, jb, dirKey(c.d)) : this.city.signal(dirKey(c.d));
        const mustStop = (sig === 'r' && !(c.turnType === 'r' && distLine < 2)) || (sig === 'y' && distLine > 6);
        if (mustStop && distLine > -0.5 && distLine < 40) target = Math.min(target, Math.max(0, Math.sqrt(Math.max(0, distLine - 0.6) * 2 * 4)));
        if (c.turnType !== 's' && distLine < 25) target = Math.min(target, 6 + distLine * 0.4);
      } else {
        target = c.turnType === 's' ? c.maxSpeed : 6;
      }
      if (c.script) target = Math.min(target, c.script.limit(c, dt));
      // 앞차 간격 유지
      if (c.gap < 1e8) {
        const safe = Math.max(0, (c.gap - 2.2)) * 1.1;
        target = Math.min(target, safe);
      }
      const accel = target > c.speed ? 3.2 : 8;
      c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), accel * dt);
      if (c.speed < 0.05) c.speed = 0;
      const step = c.speed * dt;
      if (c.state === 'straight') {
        c.u += step;
        if (c.u >= c.L - STOP) { const over = c.u - (c.L - STOP); this.beginTurn(c); c.t = over / c.bezLen; }
        else { c.pos.copy(this.lanePos(c.a, c.b, c.d, c.lane, c.u)); c.heading = Math.atan2(c.d[0], c.d[1]); }
      }
      if (c.state === 'turn') {
        c.t += step / c.bezLen;
        if (c.t >= 1) {
          c.a = c.ja; c.b = c.jb; c.d = c.next; c.u = ROAD / 2 + (c.t - 1) * c.bezLen; c.state = 'straight';
          c.L = segLen(c.a, c.b, c.d);
          c.script?.onEdge();
          this.plan(c);
          c.pos.copy(this.lanePos(c.a, c.b, c.d, c.lane, c.u));
          c.heading = Math.atan2(c.d[0], c.d[1]);
        } else {
          const [E, K, X] = c.bez, t = c.t, it = 1 - t;
          c.pos.set(it * it * E.x + 2 * it * t * K.x + t * t * X.x, 0, it * it * E.z + 2 * it * t * K.z + t * t * X.z);
          const dx = 2 * it * (K.x - E.x) + 2 * t * (X.x - K.x), dz = 2 * it * (K.z - E.z) + 2 * t * (X.z - K.z);
          c.heading = Math.atan2(dx, dz);
        }
      }
      // 막힘 감시: 오래 서 있으면 시야 밖에서 재배치
      c.stuck = c.speed < 0.1 ? c.stuck + dt : 0;
      const dCam = camPos ? c.pos.distanceTo(camPos) : 0;
      if (c.stuck > 25 && dCam > 70 && !c.script) { this.respawn(c, camPos); }
      const root = c.mesh.root;
      root.position.copy(c.pos);
      root.rotation.y = c.heading;
      root.visible = dCam < 330;
      // 밤 헤드라이트
      if (night > 0.35 && dCam < 140 && pi < 80) {
        e.set(0, c.heading, 0); q.setFromEuler(e);
        m4.compose(c.pos, q, one);
        this.pools.setMatrixAt(pi++, m4);
      }
    }
    this.pools.count = pi;
    this.pools.instanceMatrix.needsUpdate = true;
    this.poolMat.opacity = Math.max(0, night - 0.3) * 0.55;
    trafficLightMat.color.setScalar(night > 0.3 ? 1.8 : 0.85);
  }

  respawn(c, camPos) {
    this.group.remove(c.mesh.root);
    const i = this.cars.indexOf(c);
    this.cars.splice(i, 1);
    const n = this.spawn(camPos);
    if (!n) this.spawn();
  }

  // 플레이어 차와의 충돌 처리
  collidePlayer(pc) {
    let hit = 0;
    const fx = Math.sin(pc.heading), fz = Math.cos(pc.heading);
    const pts = [[pc.pos.x + fx * 1.3, pc.pos.z + fz * 1.3], [pc.pos.x - fx * 1.3, pc.pos.z - fz * 1.3]];
    for (const c of this.cars) {
      if (Math.abs(c.pos.x - pc.pos.x) > 8 || Math.abs(c.pos.z - pc.pos.z) > 8) continue;
      const cx = Math.sin(c.heading), cz = Math.cos(c.heading);
      const half = c.len / 2 - 0.9;
      const cpts = [[c.pos.x + cx * half, c.pos.z + cz * half], [c.pos.x, c.pos.z], [c.pos.x - cx * half, c.pos.z - cz * half]];
      for (const p of pts) for (const q of cpts) {
        const dx = p[0] - q[0], dz = p[1] - q[1], d = Math.hypot(dx, dz), R = 1.95;
        if (d < R && d > 1e-4) {
          const push = (R - d);
          pc.pos.x += dx / d * push; pc.pos.z += dz / d * push;
          p[0] += dx / d * push; p[1] += dz / d * push;
          hit = Math.max(hit, Math.abs(pc.speed));
        }
      }
    }
    return hit;
  }

  // 보행 플레이어와 충돌 (차에 밀림)
  collideWalker(pos) {
    for (const c of this.cars) {
      const dx = pos.x - c.pos.x, dz = pos.z - c.pos.z;
      if (Math.abs(dx) > 5 || Math.abs(dz) > 5) continue;
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      const along = dx * fx + dz * fz, lat = dx * fz - dz * fx;
      const hl = c.len / 2 + 0.3, hw = c.mesh.W / 2 + 0.3;
      if (Math.abs(along) < hl && Math.abs(lat) < hw) {
        const pa = hl - Math.abs(along), pl = hw - Math.abs(lat);
        if (pa < pl) { pos.x += fx * Math.sign(along) * pa; pos.z += fz * Math.sign(along) * pa; }
        else { pos.x += fz * Math.sign(lat) * pl; pos.z += -fx * Math.sign(lat) * pl; }
      }
    }
  }
}

// ───────── 플레이어 차량 ─────────
export class PlayerCar {
  constructor(scene, spec, color) {
    this.scene = scene;
    this.spec = spec;
    this.mesh = buildCarMesh(spec.type, color ?? spec.color, { player: true });
    scene.add(this.mesh.root);
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.y = 0;
    this.pitch = 0; this.roll = 0;
    this.brake = false;
    this.headlight = new THREE.SpotLight(0xfff2dd, 0, 60, 0.55, 0.5, 1.2);
    this.headlight.position.set(0, 0.8, 2);
    this.headlight.target.position.set(0, 0, 14);
    this.mesh.root.add(this.headlight, this.headlight.target);
  }
  get L() { return this.mesh.L; }
  place(x, z, heading) { this.pos.set(x, 0, z); this.heading = heading; this.speed = 0; this.sync(); }
  dispose() { this.scene.remove(this.mesh.root); }

  update(dt, input, city, night) {
    const sp = this.spec;
    const thr = input.y, st = input.x;
    const fwd = this.speed;
    this.brake = false;
    if (thr > 0.05) {
      if (fwd < -0.3) { this.speed += 16 * thr * dt; this.brake = true; }
      else this.speed += sp.accel * thr * (1 - Math.max(0, fwd) / sp.maxSpeed * 0.85) * dt;
    } else if (thr < -0.05) {
      if (fwd > 0.3) { this.speed += 16 * thr * dt; this.brake = true; }
      else this.speed += 5 * thr * dt;
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 1.8 * dt);
    }
    if (input.handbrake) { this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 14 * dt); this.brake = true; }
    this.speed = Math.max(-7, Math.min(sp.maxSpeed, this.speed));
    this.speed -= this.speed * 0.08 * dt;
    const maxSteer = 0.6 / (1 + Math.abs(this.speed) / 14);
    this.steer += (st * maxSteer - this.steer) * Math.min(1, dt * 7);
    const wb = this.L * 0.6;
    const yawRate = this.speed / wb * Math.tan(this.steer);
    this.heading -= yawRate * dt;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    // 건물 충돌 (앞/뒤 원)
    let impact = 0;
    const half = this.L / 2 - 0.9;
    for (const s of [1, -1]) {
      const p = { x: this.pos.x + fx * half * s, z: this.pos.z + fz * half * s };
      const ox = p.x, oz = p.z;
      if (city.collide(p, 1.05)) {
        this.pos.x += p.x - ox; this.pos.z += p.z - oz;
        impact = Math.max(impact, Math.abs(this.speed));
      }
    }
    if (impact) this.speed *= 0.25;
    // 높이 (보도턱)
    const gy = city.groundY(this.pos.x, this.pos.z);
    this.y += (gy - this.y) * Math.min(1, dt * 10);
    // 차체 기울임
    const lat = yawRate * this.speed;
    this.roll += (THREE.MathUtils.clamp(lat * 0.012, -0.07, 0.07) - this.roll) * Math.min(1, dt * 5);
    const acc = thr * (this.brake ? -1 : 1);
    this.pitch += ((this.brake ? 0.03 * Math.sign(this.speed) : -acc * 0.015) - this.pitch) * Math.min(1, dt * 4);
    // 바퀴
    for (const w of this.mesh.wheels) {
      w.w.rotation.x += this.speed / this.mesh.wr * dt;
      if (w.front) w.pivot.rotation.y = -this.steer;
    }
    this.headlight.intensity = night > 0.35 ? 40 : 0;
    this.mesh.lightMat.color.setScalar(night > 0.3 ? 1.8 : (this.brake ? 1.4 : 0.85));
    this.sync();
    return impact;
  }
  sync() {
    const r = this.mesh.root;
    r.position.set(this.pos.x, this.y, this.pos.z);
    r.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
  }
}

export { DIRS, dirKey, right };

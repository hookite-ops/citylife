// ───────── ④ 진짜 버스: 정류장에 버스가 와서 서고, 타면 실제 도로를 달려 목적지 정류장에 내려요 ─────────
import * as THREE from 'three';
import { ROADS, ROAD, N, hasEdge, segLen, nearestRoad } from './config.js';
import { buildCarMesh } from './vehicles.js';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';
import { toast } from './ui.js';

const DL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const same = (p, q) => p[0] === q[0] && p[1] === q[1];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const DOOR = 4.3;            // 앞문 위치 (버스 중심에서 앞으로)
const SEAT = [-0.62, 0.62, -1.6];  // 내 자리 (오른쪽 창가 · 중간) — 버스 기준 -x가 오른쪽(인도 쪽)

// 정류장이 있는 도로 구간과 진행 방향 (정류장 쪽 차로로 달리는 방향)
export function stopEdge(st) {
  let k = 0; while (k < N - 1 && ROADS[k + 1] < st.u) k++;
  if (st.axis === 'z') {
    const a = nearestRoad(st.c), d = [0, -st.side];
    const b = d[1] > 0 ? k : k + 1;
    return { a, b, d, u: Math.abs(st.u - ROADS[b]) };
  }
  const b = nearestRoad(st.c), d = [st.side, 0];
  const a = d[0] > 0 ? k : k + 1;
  return { a, b, d, u: Math.abs(st.u - ROADS[a]) };
}
const edgeKey = (e) => `${e.a},${e.b},${e.d[0]},${e.d[1]}`;

// 교차로마다 어느 쪽으로 갈지 (유턴 없이 · 가장 적게 꺾이는 짧은 길)
function planRoute(from, to) {
  if (edgeKey(from) === edgeKey(to) && to.u > from.u + 8) return [];
  const start = { a: from.a + from.d[0], b: from.b + from.d[1], din: from.d };
  const key = (s) => `${s.a},${s.b},${s.din[0]},${s.din[1]}`;
  const prev = new Map([[key(start), null]]);
  const q = [start];
  while (q.length) {
    const s = q.shift();
    if (s.a === to.a && s.b === to.b && !same(to.d, [-s.din[0], -s.din[1]])) {
      const dirs = [to.d];
      let c = s;
      while (prev.get(key(c))) { const p = prev.get(key(c)); dirs.unshift(c.din); c = p; }
      return dirs;
    }
    for (const d of DL) {
      if (same(d, [-s.din[0], -s.din[1]]) || !hasEdge(s.a, s.b, d)) continue;
      const n = { a: s.a + d[0], b: s.b + d[1], din: d };
      if (prev.has(key(n))) continue;
      prev.set(key(n), s); q.push(n);
    }
  }
  return null;
}

// 버스 안 (창 높이는 뚫려 있어서 바깥 도시가 보여요)
function busInterior() {
  const g = new THREE.Group();
  const inner = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.7, side: THREE.BackSide });
  const floorM = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.9 });
  const seatM = new THREE.MeshStandardMaterial({ color: 0x2f5fb0, roughness: 0.7 });
  const poleM = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.4, metalness: 0.3 });
  const W = 2.38, L = 10.8;
  const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  box(W, 0.06, L, 0, 0.6, 0, floorM);
  // 창 아래 · 창 위 벽, 천장 (안쪽 면만)
  const wall = (y0, y1) => { const o = new THREE.Mesh(new THREE.BoxGeometry(W, y1 - y0, L), inner); o.position.set(0, (y0 + y1) / 2, 0); g.add(o); };
  wall(0.62, 1.42); wall(2.6, 3.05);
  box(W, 0.04, L, 0, 3.04, 0, new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.6, emissive: 0xfff6e0, emissiveIntensity: 0.25 }));
  // 앞 · 뒤 창 기둥
  for (const x of [-1.1, 1.1]) for (let z = -4.8; z <= 4.8; z += 1.6) box(0.06, 1.2, 0.08, x, 2.0, z, inner);
  // 좌석 (2열씩)
  for (let z = -4.6; z <= 2.4; z += 1.0) for (const x of [-0.62, 0.62]) {
    if (x < 0 && z > -0.9 && z < 0.4) continue;   // 뒷문 앞은 비워 둬요
    box(0.9, 0.12, 0.5, x, 1.02, z, seatM); box(0.9, 0.6, 0.08, x, 1.36, z - 0.24, seatM);
  }
  // 손잡이 기둥 · 하차벨
  for (const z of [-3.2, -0.9, 0.9, 3.4]) box(0.05, 2.4, 0.05, -0.32, 1.85, z, poleM);
  box(0.06, 0.06, 7.6, 0.4, 2.72, -0.6, poleM); box(0.06, 0.06, 7.6, -0.4, 2.72, -0.6, poleM);
  for (const z of [-3.2, -0.9, 0.9]) box(0.08, 0.05, 0.08, -0.32, 1.55, z + 0.03, new THREE.MeshBasicMaterial({ color: 0xd8262a }));
  // 운전석 · 요금기
  box(0.5, 0.12, 0.5, 0.7, 1.02, 4.4, new THREE.MeshStandardMaterial({ color: 0x333333 }));
  box(0.22, 0.4, 0.18, -0.55, 1.4, 3.9, new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.4 }));
  // 안내 전광판
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, 2.82, 4.6); sign.rotation.y = Math.PI; g.add(sign);
  g.userData.sign = (text) => {
    const x = cv.getContext('2d');
    x.fillStyle = '#111'; x.fillRect(0, 0, 512, 64);
    x.fillStyle = '#ff9a2a'; x.font = 'bold 36px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 34); tex.needsUpdate = true;
  };
  return g;
}

export class BusRide {
  // ctx: { traffic, scene, player, human, S, audio, tap(kind), passTime(min), teleport(x,z,h), persist, missions, night() }
  constructor(ctx) { this.c = ctx; this.state = null; this.view = 'chase'; }
  get active() { return !!this.state; }
  get riding() { return this.state === 'ride'; }

  // 정류장에서 목적지를 고르면: 버스가 저 뒤에서 와서 정류장에 서요
  call(st, to, dest, stops) {
    if (this.state) this.cancel();
    const from = stopEdge(st), goal = stopEdge(to);
    if (!hasEdge(from.a, from.b, from.d) || !hasEdge(goal.a, goal.b, goal.d)) return false;
    const route = planRoute(from, goal);
    if (!route) return false;
    // 지나가는 길의 정류장들 (하차벨 누르면 거기서 내려요)
    const edges = [from];
    { let e = from; for (const d of route) { e = { a: e.a + e.d[0], b: e.b + e.d[1], d }; edges.push(e); } }
    const keyIdx = new Map(edges.map((e, i) => [edgeKey(e), i]));
    const on = [];
    for (const s of stops) {
      const e = stopEdge(s), i = keyIdx.get(edgeKey(e));
      if (i == null) continue;
      if (i === 0 && e.u <= from.u + 5) continue;
      if (i === edges.length - 1 && e.u >= goal.u - 5 && s !== to) continue;
      if (s === st) continue;
      on.push({ ei: i, u: e.u - DOOR, stop: s, dest: s === to });
    }
    if (!on.some(o => o.dest)) on.push({ ei: edges.length - 1, u: goal.u - DOOR, stop: to, dest: true });
    on.sort((p, q) => p.ei - q.ei || p.u - q.u);
    // 버스 등장: 정류장 60m 뒤 (구간이 짧으면 교차로 바로 뒤)
    const tr = this.c.traffic;
    const u0 = Math.max(ROAD / 2 + 2, from.u - DOOR - 60);
    const color = st.color === '#3aa655' ? 0x3aa655 : 0x2f6fd6;
    const mesh = buildCarMesh('bus', color);
    tr.group.add(mesh.root);
    const pos = tr.lanePos(from.a, from.b, from.d, 2, u0);
    const bus = {
      id: -1, mesh, type: 'bus', a: from.a, b: from.b, d: from.d, lane: 2, u: u0, L: segLen(from.a, from.b, from.d), state: 'straight', pos,
      heading: Math.atan2(from.d[0], from.d[1]), speed: 8, maxSpeed: 13, stuck: 0, len: mesh.L,
    };
    // 이 버스만 정해진 길로 달려요
    this.ei = 0; this.ri = 0;
    this.board = { ei: 0, u: from.u - DOOR, stop: st };
    bus.script = {
      next: () => route[this.ri],
      onEdge: () => { this.ri++; this.ei++; },
      limit: (c, dt) => this.limit(c, dt),
    };
    tr.plan(bus);
    tr.cars.push(bus);
    this.bus = bus; this.route = route; this.on = on; this.si = 0;
    this.st = st; this.to = to; this.dest = dest; this.line = st.line;
    this.state = 'come'; this.dwell = 0; this.bell = false; this.waitT = 0;
    this.c.audio?.play?.('door', 0.4);
    toast(`🚏 ${st.line}번 버스가 곧 와요 · 정류장에서 기다려요`, '', 3000);
    return true;
  }

  // 버스 속도 제한: 정류장에 서기 · 문 열고 기다리기
  limit(c, dt) {
    if (this.dwell > 0) {
      this.dwell -= dt;
      if (this.dwell <= 0) this.depart();
      return 0;
    }
    let tgt = null;
    if (this.state === 'come' || this.state === 'wait') tgt = this.board;
    else if (this.state === 'ride') {
      // 하차벨 · 목적지 · (가끔) 다른 승객 때문에 서요
      while (this.si < this.on.length && (this.on[this.si].ei < this.ei || (this.on[this.si].ei === this.ei && this.on[this.si].u < c.u - 1))) this.si++;
      tgt = this.on[this.si];
    }
    if (!tgt || tgt.ei !== this.ei || c.state !== 'straight') return 1e9;
    const dist = tgt.u - c.u;
    if (this.state === 'come') {   // 정류장에 서기 (조금 지나쳐도 거기서 서요)
      if (dist < 0.35) { if (c.speed < 0.6) this.arrived(tgt); return 0; }
      return Math.max(0.5, Math.sqrt(Math.max(0, dist - 0.2) * 2 * 2.6));
    }
    if (dist < 0) return 1e9;
    const stopHere = this.state !== 'ride' || tgt.dest || this.bell || tgt.busy;
    if (!stopHere) return 1e9;
    if (dist < 0.35 && c.speed < 0.6) { this.arrived(tgt); return 0; }
    return Math.max(0.5, Math.sqrt(Math.max(0, dist - 0.2) * 2 * 2.6));
  }
  arrived(t) {
    this.c.audio?.play?.('open', 0.5);
    if (this.state === 'come') {
      this.state = 'wait'; this.dwell = 1e9; this.waitT = 18;
      toast(`🚌 ${this.line}번 버스 도착! 앞문으로 타요`, 'good', 2600);
      return;
    }
    if (this.state === 'ride') {
      if (t.dest || this.bell) { this.alight(t.stop); return; }
      this.dwell = 2.2; this.si++;
    }
  }
  depart() {
    this.c.audio?.play?.('close', 0.5);
    if (this.state === 'wait') this.state = 'gone';
  }
  // 정류장에서 기다리는 동안 (안 타면 떠나요)
  tick(dt) {
    if (!this.state) return;
    const b = this.bus;
    if (this.state === 'wait') {
      this.waitT -= dt;
      if (this.waitT <= 0) { this.dwell = 0; this.state = 'gone'; this.c.audio?.play?.('close', 0.5); toast('🚌 버스가 떠났어요… 다음 버스를 기다려요', 'bad'); }
    }
    if (this.state === 'gone') {
      const p = this.c.player.pos;
      if (Math.hypot(b.pos.x - p.x, b.pos.z - p.z) > 140) this.cancel();
    }
    if (this.state === 'ride') {
      this.rideT += dt;
      // 경로가 끝났는데 (혹시) 못 섰으면 목적지로
      if (this.ri > this.route.length + 1) this.alight(this.to);
      if (this.signT === undefined || (this.signT -= dt) <= 0) {
        this.signT = 1;
        const nx = this.on[this.si];
        this.inside?.userData.sign(nx ? `다음 정류장 · ${nx.stop.name}${this.bell ? ' (하차벨)' : ''}` : `${this.line}번`);
      }
    }
  }
  // 앞문 근처면 타기 버튼
  boardAction(p) {
    if (this.state !== 'wait') return null;
    const b = this.bus, fx = Math.sin(b.heading), fz = Math.cos(b.heading);
    const dx = b.pos.x + fx * DOOR, dz = b.pos.z + fz * DOOR;
    if (Math.hypot(p.x - dx, p.z - dz) > 7) return null;
    return { label: `🚌 ${this.line}번 버스 타기 · 💳 삑`, fn: () => this.boardNow(), green: true };
  }
  boardNow() {
    if (this.state !== 'wait' || !this.c.tap('bus')) return;
    this.state = 'ride'; this.rideT = 0; this.view = 'chase'; this.lastH = null;
    this.c.traffic.ignorePlayer = true;
    // 버스 안 꾸미기 · 다른 승객들
    this.inside = busInterior();
    const seats = [];
    for (let z = -4.6; z <= 2.4; z += 1.0) for (const x of [-0.62, 0.62]) if (!(x < 0 && z > -0.9 && z < 0.4) && !(x === SEAT[0] && Math.abs(z - SEAT[2]) < 0.3)) seats.push([x, z]);
    const n = 2 + Math.floor(Math.random() * 5);
    this.riders = [];
    for (let k = 0; k < n && seats.length; k++) {
      const [x, z] = seats.splice(Math.floor(Math.random() * seats.length), 1)[0];
      const female = Math.random() < 0.5;
      const p = createPed({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick(SHOES), hairStyle: female ? pick(['long', 'bun']) : 'short' });
      p.sit(); p.root.position.set(x, 0.63, z + 0.08); p.root.scale.setScalar(0.92 + Math.random() * 0.08);
      p.kind = Math.random() < 0.6 ? 'phone' : 'idle';
      this.inside.add(p.root); this.riders.push(p);
    }
    this.bus.mesh.root.add(this.inside);
    this.c.human.setPose('sit');
    this.dwell = 1.2;      // 문 닫고 출발
    this.si = 0;
    this.c.audio?.play?.('close', 0.5);
    toast(`🚌 ${this.to.name} 방면 · 끝까지 확대하면 창밖이 보여요 · 🔔 하차벨은 다음 정류장에서`, 'good', 4200);
  }
  // 버스 안 내 자리
  seatWorld(out) {
    const b = this.bus, h = b.heading, s = Math.sin(h), c = Math.cos(h);
    return out.set(b.pos.x + SEAT[0] * c + SEAT[2] * s, SEAT[1], b.pos.z - SEAT[0] * s + SEAT[2] * c);
  }
  updatePlayer(dt) {
    const pl = this.c.player, hu = this.c.human;
    this.seatWorld(pl.pos);
    pl.speed = 0; pl.heading = this.bus.heading;
    this.c.passTime(this.bus.speed * dt / 210 + dt * 0.03);   // 시내버스 속도만큼 시간이 흘러요
    hu.root.position.copy(pl.pos); hu.root.rotation.y = pl.heading;
    for (const r of this.riders || []) r.act(dt, r.kind);
  }
  ring() {
    if (!this.riding) return;
    this.bell = !this.bell;
    this.c.audio?.play?.(this.bell ? 'ding' : 'toggle', 0.6);
    if (this.bell) toast('🔔 삐- 다음 정류장에서 내려요', 'good', 2000);
    this.signT = 0;
  }
  // 정류장에서 내리기
  alight(stop) {
    const p = this.c.player, b = this.bus;
    this.state = 'off';
    this.c.audio?.play?.('open', 0.5);
    this.finishRide();
    // 뒷문으로 내려서 정류장 옆 인도에 서요
    p.pos.set(stop.x + stop.nx * 1.2, 0.18, stop.z + stop.nz * 1.2); p.heading = Math.atan2(-stop.nx, -stop.nz);
    // 사람들 내리고 버스는 떠나요
    this.dwell = 1.6; this.state = 'gone';
    this.c.arrive?.(stop.name, this.dest);
  }
  finishRide() {
    if (this.inside) { this.bus.mesh.root.remove(this.inside); this.inside.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); this.inside = null; }
    this.riders = [];
    this.c.human.setPose('stand');
    this.c.human.root.visible = true;
    this.c.traffic.ignorePlayer = false;
    this.bell = false;
  }
  // 빨리 가기: 남은 길은 건너뛰고 목적지 정류장으로
  skip() {
    if (!this.riding) return;
    const left = this.remaining();
    const to = this.to, dest = this.dest;
    this.finishRide();
    this.cancel();
    this.c.passTime(Math.max(1, left / 300));
    this.c.teleport(to.x + to.nx * 1.5, to.z + to.nz * 1.5, Math.atan2(-to.nx, -to.nz));
    this.c.arrive?.(to.name, dest);
  }
  remaining() {
    const b = this.bus.pos;
    return Math.abs(this.to.x - b.x) + Math.abs(this.to.z - b.z);
  }
  cancel() {
    if (this.riding || this.inside) this.finishRide();
    if (this.bus) {
      const tr = this.c.traffic, i = tr.cars.indexOf(this.bus);
      if (i >= 0) tr.cars.splice(i, 1);
      tr.group.remove(this.bus.mesh.root);
    }
    this.bus = null; this.state = null;
  }
  // 카메라: 버스 뒤에서 따라가기 · 창가 자리 (창밖 보기)
  toggleView() { this.view = this.view === 'chase' ? 'window' : 'chase'; return this.view; }
}

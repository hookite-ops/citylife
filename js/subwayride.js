// ───────── ④ 진짜 지하철: 승강장에서 열차가 들어오고, 타면 터널을 달려 역마다 서요 ─────────
import * as THREE from 'three';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';
import { toast, fade, wait } from './ui.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LINE = 0x1f9a4a;          // 한빛선 (초록)
const CAR_W = 3.1, CAR_L = 19, CAR_H = 2.4;
const PLAT_L = 60;              // 승강장 길이
const GAP = 140;                // 역 사이 (연출용 거리)
const TRAIN_Z = CAR_L + 0.6;    // 승강장에 섰을 때 맨 앞 칸 중심 (두 번째 칸이 승강장 가운데)
// 섰을 때 열차 문 위치 (4칸 × 4문)
const DOOR_Z = []; for (let k = 0; k < 4; k++) for (let d = -1.5; d <= 1.5; d++) DOOR_Z.push(TRAIN_Z - k * (CAR_L + 0.6) + d * 4.75);
DOOR_Z.sort((a, b) => a - b);

function canvasSign(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const set = (...a) => { draw(cv.getContext('2d'), w, h, ...a); tex.needsUpdate = true; };
  return { tex, set };
}
function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }); }
function box(g, w, h, d, x, y, z, m) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; }
function randPed(o = {}) {
  const female = Math.random() < 0.5;
  return createPed({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick(SHOES), hairStyle: female ? pick(['long', 'bun']) : 'short', ...o });
}

export class SubwayRide {
  // ctx: { camera, renderer, audio, passTime(min), teleport(x,z,h), arrive(name,dest), setAct(label,fn,green), setCarBtn(label,fn), night() }
  constructor(ctx) { this.c = ctx; this.active = false; this.yaw = 0; this.pitch = 0; }

  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x0b0d10);
    sc.fog = new THREE.Fog(0x0b0d10, 30, 120);
    sc.add(new THREE.HemisphereLight(0xf4f6ff, 0x30302a, 1.25));
    const dl = new THREE.DirectionalLight(0xffffff, 0.5); dl.position.set(2, 6, 3); sc.add(dl);

    // 움직이는 세계 (열차는 가만히 있고 터널·승강장이 지나가요)
    const world = this.world = new THREE.Group(); sc.add(world);
    // 터널 벽 (끝없이 이어지게 반복)
    const tun = this.tunnel = new THREE.Group(); sc.add(tun);
    const wallM = std(0x2a2d31, { roughness: 0.95 });
    for (let k = -1; k <= 1; k++) {
      const seg = new THREE.Group(); seg.position.z = k * 120;
      box(seg, 0.4, 6, 120, -3.2, 2.4, 0, wallM); box(seg, 0.4, 6, 120, 3.2, 2.4, 0, wallM);
      box(seg, 7, 0.4, 120, 0, 5.2, 0, wallM); box(seg, 7, 0.2, 120, 0, -0.65, 0, std(0x1c1e20));
      tun.add(seg);
    }
    // 터널 등 (지나갈 때 휙휙)
    const lg = new THREE.BoxGeometry(0.12, 0.08, 1.4);
    this.tLights = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xffe9b0 }), 40);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) { m4.makeTranslation(i % 2 ? 2.95 : -2.95, 3.2, (Math.floor(i / 2) - 10) * 12); this.tLights.setMatrixAt(i, m4); }
    tun.add(this.tLights);

    // 승강장 (역마다 같은 모양 · 이름판만 바뀜)
    const pl = this.platform = new THREE.Group(); world.add(pl);
    this.pdoors = [];
    const tile = std(0xd9d4c8, { roughness: 0.5 }), wall = std(0xe8e6df, { roughness: 0.7 }), stripe = std(LINE, { roughness: 0.5 });
    for (const s of [-1, 1]) {
      box(pl, 5, 1.1, PLAT_L, s * 4.3, -0.15, 0, tile);                     // 승강장 바닥 (열차 문 높이)
      box(pl, 0.3, 4.6, PLAT_L, s * 6.9, 2.5, 0, wall);                     // 벽
      box(pl, 0.31, 0.3, PLAT_L, s * 6.89, 2.0, 0, stripe);
      box(pl, 0.2, 0.06, PLAT_L, s * 1.9, 0.41, 0, std(0xf2c230));          // 노란 안전선
      // 스크린도어: 열차 문 자리마다 미닫이 문, 사이는 고정 유리
      const glassM = new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false });
      const dz = DOOR_Z.filter(z => Math.abs(z) < PLAT_L / 2 - 1);
      for (let i = 0; i + 1 < dz.length; i++) box(pl, 0.06, 2.1, dz[i + 1] - dz[i] - 1.5, s * 1.72, 1.45, (dz[i] + dz[i + 1]) / 2, glassM);
      for (const z of dz) {
        for (const e of [-0.75, 0.75]) box(pl, 0.12, 2.3, 0.12, s * 1.72, 1.55, z + e, std(0x9aa3aa, { metalness: 0.5 }));
        for (const h of [-1, 1]) { const o = box(pl, 0.05, 2.0, 0.72, s * 1.72, 1.42, z + h * 0.36, glassM); this.pdoors.push({ o, h, z, s }); }
      }
      box(pl, 0.2, 0.5, PLAT_L, s * 1.72, 2.85, 0, std(0x30363c));
      for (let z = -PLAT_L / 2 + 6; z < PLAT_L / 2; z += 10) box(pl, 0.5, 4.2, 0.5, s * 4.6, 2.3, z, std(0xcfc9bc));
      // 천장 조명
      for (let z = -PLAT_L / 2 + 3; z < PLAT_L / 2; z += 6) box(pl, 0.3, 0.06, 2.2, s * 4.0, 4.35, z, new THREE.MeshBasicMaterial({ color: 0xfffaf0 }));
    }
    box(pl, 14, 0.2, PLAT_L, 0, 4.6, 0, std(0xb8b4aa));
    // 역 이름판
    this.nameSign = canvasSign(1024, 256, (x, w, h, name, prev, next) => {
      x.fillStyle = '#f5f5f0'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1f9a4a'; x.fillRect(0, h - 46, w, 46);
      x.fillStyle = '#111'; x.font = 'bold 96px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, w / 2, 92);
      x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif';
      x.textAlign = 'left'; x.fillText(prev ? `◀ ${prev}` : '', 24, h - 23);
      x.textAlign = 'right'; x.fillText(next ? `${next} ▶` : '', w - 24, h - 23);
    });
    for (const s of [-1, 1]) for (const z of [-18, 0, 18]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: this.nameSign.tex }));
      m.position.set(s * 6.72, 3.0, z); m.rotation.y = -s * Math.PI / 2; pl.add(m);
    }
    // 승강장 사람들
    this.platPeds = [];
    for (let i = 0; i < 9; i++) {
      const p = randPed(); const s = i % 2 ? 1 : -1;
      p.root.position.set(s * (2.6 + Math.random() * 2.6), 0.4, -PLAT_L / 2 + 4 + Math.random() * (PLAT_L - 8));
      p.root.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      p.kind = Math.random() < 0.6 ? 'phone' : 'idle';
      pl.add(p.root); this.platPeds.push(p);
    }

    // 열차 겉모습 (승강장에서 들어오는 모습)
    const tr = this.trainOut = new THREE.Group(); sc.add(tr);
    const body = std(0xd8dde2, { metalness: 0.4, roughness: 0.35 }), glass = std(0x1a2430, { roughness: 0.1, metalness: 0.5 });
    for (let k = 0; k < 4; k++) {
      const z = -k * (CAR_L + 0.6);
      box(tr, CAR_W, CAR_H + 0.6, CAR_L, 0, 1.55, z, body);
      for (const s of [-1, 1]) {
        box(tr, 0.02, 0.9, CAR_L - 1, s * (CAR_W / 2 + 0.01), 2.0, z, glass);
        box(tr, 0.02, 0.18, CAR_L, s * (CAR_W / 2 + 0.02), 1.3, z, stripe);
        for (let d = -1.5; d <= 1.5; d++) box(tr, 0.03, 2.0, 1.3, s * (CAR_W / 2 + 0.02), 1.4, z + d * 4.75, std(0xb9c0c6, { metalness: 0.5 }));
      }
    }
    box(tr, CAR_W - 0.2, 1.1, 0.05, 0, 2.0, CAR_L / 2 + 0.01, glass);
    box(tr, 0.5, 0.25, 0.06, -0.9, 0.9, CAR_L / 2 + 0.02, new THREE.MeshBasicMaterial({ color: 0xfff4dc }));
    box(tr, 0.5, 0.25, 0.06, 0.9, 0.9, CAR_L / 2 + 0.02, new THREE.MeshBasicMaterial({ color: 0xfff4dc }));

    // 열차 안 (탔을 때 · 롱시트 · 손잡이 · 문 · 안내 화면)
    const cin = this.carIn = new THREE.Group(); sc.add(cin);
    const inner = std(0xeef0ee, { side: THREE.BackSide, roughness: 0.6 });
    const wallBand = (y0, y1) => { const o = new THREE.Mesh(new THREE.BoxGeometry(CAR_W, y1 - y0, CAR_L), inner); o.position.y = (y0 + y1) / 2 + 0.4; cin.add(o); };
    wallBand(0, 1.0); wallBand(1.95, CAR_H);
    box(cin, CAR_W, 0.05, CAR_L, 0, 0.42, 0, std(0x8a8f86, { roughness: 0.9 }));
    box(cin, CAR_W, 0.04, CAR_L, 0, CAR_H + 0.38, 0, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffbea, emissiveIntensity: 0.55 }));
    const seatM = std(0x3a7bd5, { roughness: 0.8 }), poleM = std(0xc9ced3, { metalness: 0.8, roughness: 0.25 });
    this.seats = [];
    // 문 사이마다 긴 의자 (롱시트)
    for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) {
      const z0 = k * 4.75 - 1.6, z1 = k * 4.75 + 1.6;
      box(cin, 0.55, 0.12, z1 - z0, s * (CAR_W / 2 - 0.3), 0.85, (z0 + z1) / 2, seatM);
      box(cin, 0.1, 0.5, z1 - z0, s * (CAR_W / 2 - 0.06), 1.15, (z0 + z1) / 2, seatM);
      for (let q = 0; q < 6; q++) this.seats.push([s * (CAR_W / 2 - 0.42), z0 + 0.3 + q * 0.53, s]);
      box(cin, 0.05, 1.9, 0.05, s * (CAR_W / 2 - 0.75), 1.4, z1 + 0.1, poleM);
    }
    for (const e of [-1, 1]) box(cin, CAR_W, CAR_H, 0.1, 0, CAR_H / 2 + 0.4, e * (CAR_L / 2), std(0xdfe2de));
    // 문 (양쪽 · 열리고 닫혀요)
    this.doors = [];
    const doorM = std(0xc2c8cc, { metalness: 0.5 });
    const glassDoor = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false });
    for (const s of [-1, 1]) for (let d = -1.5; d <= 1.5; d++) {
      const z = d * 4.75;
      for (const h of [-1, 1]) {
        // 문짝: 창이 뚫린 틀 + 유리
        const o = new THREE.Group(); o.position.set(s * (CAR_W / 2 - 0.02), 1.4, z + h * 0.32); cin.add(o);
        const dm = doorM;
        box(o, 0.06, 0.775, 0.64, 0, -0.5875, 0, dm); box(o, 0.06, 0.275, 0.64, 0, 0.8375, 0, dm);
        box(o, 0.06, 0.9, 0.1, 0, 0.25, 0.27, dm); box(o, 0.06, 0.9, 0.1, 0, 0.25, -0.27, dm);
        box(o, 0.02, 0.9, 0.44, 0, 0.25, 0, glassDoor);
        this.doors.push({ o, s, h, z });
      }
    }
    // 손잡이 (가로 봉 + 고리)
    for (const s of [-1, 1]) {
      box(cin, 0.04, 0.04, CAR_L - 1, s * 0.75, 2.3, 0, poleM);
      for (let z = -CAR_L / 2 + 1; z < CAR_L / 2 - 1; z += 0.6) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), std(0xf6f6f6)); r.position.set(s * 0.75, 2.02, z); cin.add(r);
        box(cin, 0.02, 0.22, 0.02, s * 0.75, 2.18, z, std(0xf6f6f6));
      }
    }
    // 노선도 · 안내 화면
    this.led = canvasSign(1024, 128, (x, w, h, text, sub) => {
      x.fillStyle = '#0b0f14'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffb02e'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, sub ? 46 : h / 2);
      if (sub) { x.fillStyle = '#7fd8a0'; x.font = '30px sans-serif'; x.fillText(sub, w / 2, 100); }
    });
    for (const s of [-1, 1]) for (let d = -1.5; d <= 1.5; d++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), new THREE.MeshBasicMaterial({ map: this.led.tex }));
      m.position.set(s * (CAR_W / 2 - 0.05), 2.5, d * 4.75); m.rotation.y = -s * Math.PI / 2; cin.add(m);
    }
    this.ridePeds = [];
    this.carIn.visible = false;
  }

  // 승강장에서 시작
  async start({ from, to, names, minutes, dest, toSta }) {
    this.build();
    this.names = [from, ...names];       // 지나가는 역들 (마지막이 도착역)
    this.idx = 0; this.minutes = minutes; this.dest = dest; this.toSta = toSta;
    this.minLeft = minutes;
    await fade(true);
    this.active = true; this.phase = 'platform'; this.t = 0;
    this.yaw = -Math.PI / 4; this.pitch = 0.05;   // 열차 들어오는 쪽을 바라봐요
    this.eye = new THREE.Vector3(-3.1, 2.05, 4.75 * 0.5);
    this.setPlatform(from, null, this.names[1]);
    this.platform.position.z = 0;
    this.carIn.visible = false; this.trainOut.visible = true; this.trainOut.position.set(0, 0, -260);
    this.trainV = 22; this.doorK = 0;
    this.c.setAct(null); this.c.setCarBtn(null);
    toast(`🚇 ${from}역 승강장 · ${to} 방면 열차가 곧 들어와요`, '', 3000);
    await fade(false);
  }
  setPlatform(name, prev, next) { this.nameSign.set(name, prev, next); }

  update(dt, look) {
    if (!this.active) return;
    this.t += dt;
    if (look) { this.yaw -= look.dx * 0.0065; this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy * 0.0045, -1.1, 1.1); }
    // 승강장 사람들 · 승객들 움직임
    for (const p of this.platPeds) p.act(dt, p.kind);
    for (const p of this.ridePeds) p.act(dt, p.kind);
    if (this.phase === 'platform') {
      // 열차가 들어와서 문이 승강장 문 앞에 서요
      const tz = this.trainOut.position.z, target = TRAIN_Z;
      const dist = target - tz;
      const v = Math.min(this.trainV, Math.sqrt(Math.max(0, dist) * 2 * 1.6) + 0.3);
      this.trainOut.position.z = Math.min(target, tz + v * dt);
      if (dist < 0.02) {
        if (!this.arrivedAt) { this.arrivedAt = this.t; this.c.audio?.play?.('open', 0.5); toast('🚇 스크린도어가 열렸어요 · 타요', 'good'); }
        this.c.setAct('🚇 열차 타기', () => this.board(), true);
      }
    } else if (this.phase === 'ride') {
      this.ride(dt);
    }
    this.syncDoors(dt);
    this.camera();
  }
  async board() {
    if (this.phase !== 'platform') return;
    this.c.setAct(null);
    await fade(true);
    this.phase = 'ride'; this.trainOut.visible = false; this.carIn.visible = true;
    this.eye.set(0.75, 2.0, 0.6);
    this.yaw = Math.PI / 2 - 0.35; this.pitch = 0.12;   // 맞은편 의자와 창 (승강장 쪽)
    // 승객들
    for (const p of this.ridePeds) this.carIn.remove(p.root);
    this.ridePeds = [];
    const seats = this.seats.slice().sort(() => Math.random() - 0.5);
    const n = 6 + Math.floor(Math.random() * 7);
    for (let i = 0; i < n; i++) {
      const [x, z, s] = seats[i];
      const p = randPed(); p.sit(); p.root.position.set(x, 0.42, z); p.root.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      p.kind = pick(['phone', 'phone', 'idle', 'idle', 'talk']);
      this.carIn.add(p.root); this.ridePeds.push(p);
    }
    for (let i = 0; i < 4; i++) {   // 서서 가는 사람 (손잡이)
      const p = randPed(); const s = i % 2 ? 1 : -1;
      p.root.position.set(s * 0.6, 0.42, -6 + i * 3.4); p.root.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      p.kind = 'phone'; this.carIn.add(p.root); this.ridePeds.push(p);
    }
    this.state = 'dwell'; this.dwell = 1.6; this.s = 0; this.v = 0; this.doorOpen = true;
    this.led.set(`이번 역은 ${this.names[0]}`, `${this.names[this.names.length - 1]} 방면`);
    await fade(false);
    toast('🚇 문이 닫힙니다 · ⏩ 빨리 가기로 건너뛸 수 있어요', '', 2600);
    this.c.setCarBtn('⏩ 빨리 가기', () => this.finish(true));
  }
  // 역 사이 달리기: 가속 → 터널 → 감속 → 다음 역 승강장
  ride(dt) {
    const last = this.names.length - 1;
    if (this.state === 'dwell') {
      this.dwell -= dt;
      if (this.dwell <= 0) {
        if (this.idx >= last) { this.finish(false); return; }
        this.state = 'run'; this.doorOpen = false; this.s = 0; this.c.audio?.play?.('close', 0.5);
        this.led.set(`다음 역은 ${this.names[this.idx + 1]}`, this.idx + 1 === last ? '내리실 문은 오른쪽입니다' : `${this.names[last]} 방면`);
      }
      return;
    }
    // 이동 (열차 기준으로 세상이 뒤로)
    const remain = GAP - this.s;
    const vmax = 24;
    this.v = Math.min(vmax, this.v + 4 * dt, Math.sqrt(Math.max(0, remain) * 2 * 2.2) + 0.2);
    this.s = Math.min(GAP, this.s + this.v * dt);
    // 시간도 조금씩 흘러요
    const per = this.minutes / Math.max(1, last);
    const m = per * (this.v * dt) / GAP;
    this.c.passTime(m); this.minLeft -= m;
    // 승강장: 떠난 역은 뒤로 사라지고, 다음 역이 앞에서 다가와요
    this.platform.position.z = this.s < GAP / 2 ? -this.s : GAP - this.s;
    if (this.s >= GAP / 2 && !this.signed) { this.signed = true; this.setPlatform(this.names[this.idx + 1], this.names[this.idx], this.names[this.idx + 2]); }
    if (remain < 0.05) {
      this.idx++; this.signed = false; this.v = 0;
      this.state = 'dwell'; this.dwell = this.idx >= last ? 1.4 : 2.4; this.doorOpen = true;
      this.c.audio?.play?.('open', 0.5);
      this.led.set(`이번 역은 ${this.names[this.idx]}입니다`, this.idx >= last ? '내리실 문은 오른쪽입니다' : '');
      if (this.idx >= last) toast(`🚇 ${this.names[this.idx]}역 도착`, 'good');
    }
    // 터널 · 터널 등이 휙휙 (반복)
    this.tunnel.position.z = -(this.s % 12);
    this.tunnel.children[0].visible = this.tunnel.children[1].visible = this.tunnel.children[2].visible = Math.abs(this.platform.position.z) > PLAT_L / 2 + 4;
    this.tLights.visible = this.tunnel.children[0].visible;
  }
  syncDoors(dt) {
    const want = this.phase === 'platform' ? (this.arrivedAt ? 1 : 0) : this.doorOpen ? 1 : 0;
    this.doorK += (want - this.doorK) * Math.min(1, dt * 4);
    for (const d of this.doors) d.o.position.z = d.z + d.h * (0.32 + this.doorK * 0.62 * (d.s < 0 ? 1 : 0));
    for (const d of this.pdoors) d.o.position.z = d.z + d.h * (0.36 + this.doorK * 0.7 * (d.s < 0 ? 1 : 0));
  }
  camera() {
    const cam = this.c.camera;
    cam.position.copy(this.eye);
    // 달릴 때 살짝 흔들림
    if (this.phase === 'ride' && this.state === 'run') cam.position.y += Math.sin(this.t * 13) * 0.006 * (this.v / 24);
    const cp = Math.cos(this.pitch);
    cam.lookAt(this.eye.x - Math.sin(this.yaw) * cp, this.eye.y - Math.sin(this.pitch), this.eye.z - Math.cos(this.yaw) * cp);
  }
  // 내리기 (또는 빨리 가기): 도착역 출구로 올라가요
  async finish(skip) {
    if (!this.active || this.leaving) return;
    this.leaving = true;
    this.c.setAct(null); this.c.setCarBtn(null);
    await fade(true);
    if (this.minLeft > 0.5) this.c.passTime(this.minLeft);
    this.active = false; this.leaving = false; this.arrivedAt = null; this.phase = null;
    const s = this.toSta;
    this.c.teleport(s.x, s.z - 1.4, Math.PI);
    await fade(false);
    this.c.arrive(s.name, this.dest);
    void skip;
  }
  cancel() { this.active = false; this.phase = null; this.arrivedAt = null; }
}

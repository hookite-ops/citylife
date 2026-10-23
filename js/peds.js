import * as THREE from 'three';
import { N, blockRect, blockIndex } from './config.js';
import { pedName, pedItem } from './missions.js';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Peds {
  constructor(scene, count, skip) {
    this.scene = scene;
    this.skip = skip || (() => false);
    this.focus = null;
    this.group = new THREE.Group(); scene.add(this.group);
    this.list = [];
    this.setCount(count);
  }
  setCount(n) {
    while (this.list.length > n) this.group.remove(this.list.pop().p.root);
    while (this.list.length < n) this.add();
  }
  pickBlock() {
    for (let t = 0; t < 40; t++) {
      let i = Math.floor(Math.random() * N), j = Math.floor(Math.random() * N);
      if (this.focus) {
        i = Math.max(0, Math.min(N - 1, blockIndex(this.focus.x) + Math.floor(Math.random() * 5) - 2));
        j = Math.max(0, Math.min(N - 1, blockIndex(this.focus.z) + Math.floor(Math.random() * 5) - 2));
      }
      if (!this.skip(i, j)) return [i, j];
    }
    return [0, 0];
  }
  add(o) {
    const [i, j] = this.pickBlock();
    const r = blockRect(i, j);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const inset = dir > 0 ? 1.4 : 2.8;
    const x0 = r.x0 + inset, z0 = r.z0 + inset, x1 = r.x1 - inset, z1 = r.z1 - inset;
    const per = 2 * (x1 - x0) + 2 * (z1 - z0);
    const female = Math.random() < 0.5;
    // 나이·직업: 아이 · 학생 · 직장인 · 어르신
    const r0 = Math.random(), age = r0 < 0.1 ? 'kid' : r0 < 0.25 ? 'student' : r0 < 0.85 ? 'adult' : 'elder';
    const worker = age === 'adult' && Math.random() < 0.4;
    const p = createPed({
      skin: pick(SKINS), hair: age === 'elder' ? pick([0xd8d8d8, 0xbdbdbd, 0x8a8a8a]) : pick(HAIRS),
      shirt: worker ? pick([0xf2f2f2, 0x1f3a6a, 0x2a2a2a, 0x30343a]) : pick(SHIRTS), pants: worker ? pick([0x23262b, 0x1a1a1a, 0x2a3f6a]) : pick(PANTS), shoes: pick(SHOES),
      hairStyle: female ? (Math.random() < 0.6 ? 'long' : 'bun') : (Math.random() < 0.25 && age !== 'elder' ? 'spiky' : 'short'), hat: Math.random() < (age === 'elder' ? 0.35 : 0.12) ? pick([0x1a1a1a, 0xd63a3a, 0x2f6fd6, 0x8a6a4a]) : null,
      bag: age === 'student' || age === 'kid' ? pick([0xd63a3a, 0x2f6fd6, 0xf2c230, 0x2f9a4a]) : Math.random() < 0.3 ? pick([0x222222, 0x6a4a2a, 0x2a3a5a]) : null,
    });
    const s = (age === 'kid' ? 0.68 : age === 'student' ? 0.88 : 0.92) + Math.random() * 0.12;
    p.root.scale.setScalar(female ? s * 0.95 : s);
    this.group.add(p.root);
    this.list.push({ p, rect: [x0, z0, x1, z1], per, s: Math.random() * per, dir, speed: (age === 'elder' ? 0.8 : age === 'kid' ? 1.4 : 1.1) + Math.random() * 0.5, cur: 0, wait: 0, pos: new THREE.Vector3(), name: pedName(), req: Math.random() < 0.35, reqItem: pedItem(), age, phone: age !== 'kid' && Math.random() < (age === 'elder' ? 0.15 : 0.55) });
  }
  pointAt(o, s) {
    const [x0, z0, x1, z1] = o.rect, w = x1 - x0, d = z1 - z0;
    s = ((s % o.per) + o.per) % o.per;
    if (s < w) return [x0 + s, z0, 1, 0];
    s -= w; if (s < d) return [x1, z0 + s, 0, 1];
    s -= d; if (s < w) return [x1 - s, z1, -1, 0];
    s -= w; return [x0, z1 - s, 0, -1];
  }
  relocate(o) {
    const [i, j] = this.pickBlock();
    const r = blockRect(i, j);
    const inset = o.dir > 0 ? 1.4 : 2.8;
    o.rect = [r.x0 + inset, r.z0 + inset, r.x1 - inset, r.z1 - inset];
    o.per = 2 * (o.rect[2] - o.rect[0]) + 2 * (o.rect[3] - o.rect[1]);
    o.s = Math.random() * o.per;
    o.name = pedName(); o.req = Math.random() < 0.35; o.reqItem = pedItem(); o.greeted = false; o.reqDone = false; o.talk = 0;
  }
  reseed(p) { this.focus = p.clone(); for (const o of this.list) this.relocate(o); }
  update(dt, playerPos, camPos) {
    this.focus = playerPos;
    this.relocT = (this.relocT || 0) + dt;
    if (this.relocT > 0.5) {
      this.relocT = 0;
      let n = 0;
      for (const o of this.list) if (o.pos.distanceTo(playerPos) > 280) { this.relocate(o); if (++n >= 3) break; }
    }
    for (const o of this.list) {
      const [x, z, tx, tz] = this.pointAt(o, o.s);
      const fx = tx * o.dir, fz = tz * o.dir;
      // 플레이어 앞이면 잠시 멈춤
      const rx = playerPos.x - x, rz = playerPos.z - z;
      const ahead = rx * fx + rz * fz, lat = Math.abs(rx * fz - rz * fx);
      let target = o.speed;
      if (ahead > 0 && ahead < 1.6 && lat < 0.8) target = 0;
      if (o.talk > 0) { o.talk -= dt; target = 0; }
      else if (o.wait > 0) { o.wait -= dt; target = 0; }
      else if (Math.random() < dt * 0.01) o.wait = 2 + Math.random() * 5;
      o.cur += (target - o.cur) * Math.min(1, dt * 4);
      o.s += o.cur * dt * o.dir;
      o.pos.set(x, 0.18, z);
      const root = o.p.root;
      const dist = o.pos.distanceTo(camPos);
      root.visible = dist < 110;
      if (!root.visible) continue;
      root.position.copy(o.pos);
      const want = o.talk > 0 ? Math.atan2(playerPos.x - o.pos.x, playerPos.z - o.pos.z) : Math.atan2(fx, fz);
      let dh = want - root.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      root.rotation.y += dh * Math.min(1, dt * 8);
      // 멈춰 있을 때: 휴대폰 보거나 두리번
      if (o.cur < 0.15 && o.talk <= 0) o.p.act?.(dt, o.phone ? 'phone' : 'idle');
      else if (o.talk > 0) o.p.act?.(dt, 'talk');
      else o.p.animate(dt, o.cur);
    }
  }
  // 말 걸 수 있는 가장 가까운 사람
  nearest(pos, r = 2.2) {
    let best = null, bd = r;
    for (const o of this.list) { if (!o.p.root.visible) continue; const d = Math.hypot(pos.x - o.pos.x, pos.z - o.pos.z); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  // 플레이어가 보행자를 밀지 않도록 원 충돌
  collide(pos) {
    for (const o of this.list) {
      const dx = pos.x - o.pos.x, dz = pos.z - o.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.55 && d > 1e-4) { pos.x = o.pos.x + dx / d * 0.55; pos.z = o.pos.z + dz / d * 0.55; }
    }
  }
}

import * as THREE from 'three';
import { N, blockRect } from './config.js';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Peds {
  constructor(scene, count) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.list = [];
    this.setCount(count);
  }
  setCount(n) {
    while (this.list.length > n) this.group.remove(this.list.pop().p.root);
    while (this.list.length < n) this.add();
  }
  add() {
    const i = Math.floor(Math.random() * N), j = Math.floor(Math.random() * N);
    const r = blockRect(i, j);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const inset = dir > 0 ? 1.4 : 2.8;
    const x0 = r.x0 + inset, z0 = r.z0 + inset, x1 = r.x1 - inset, z1 = r.z1 - inset;
    const per = 2 * (x1 - x0) + 2 * (z1 - z0);
    const female = Math.random() < 0.5;
    const p = createPed({
      skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick(SHOES),
      longHair: female && Math.random() < 0.7, bag: Math.random() < 0.3 ? pick([0x222222, 0x6a4a2a, 0x2a3a5a]) : null,
    });
    const s = 0.92 + Math.random() * 0.16;
    p.root.scale.setScalar(female ? s * 0.94 : s);
    this.group.add(p.root);
    this.list.push({ p, rect: [x0, z0, x1, z1], per, s: Math.random() * per, dir, speed: 1.1 + Math.random() * 0.5, cur: 0, wait: 0, pos: new THREE.Vector3() });
  }
  pointAt(o, s) {
    const [x0, z0, x1, z1] = o.rect, w = x1 - x0, d = z1 - z0;
    s = ((s % o.per) + o.per) % o.per;
    if (s < w) return [x0 + s, z0, 1, 0];
    s -= w; if (s < d) return [x1, z0 + s, 0, 1];
    s -= d; if (s < w) return [x1 - s, z1, -1, 0];
    s -= w; return [x0, z1 - s, 0, -1];
  }
  update(dt, playerPos, camPos) {
    for (const o of this.list) {
      const [x, z, tx, tz] = this.pointAt(o, o.s);
      const fx = tx * o.dir, fz = tz * o.dir;
      // 플레이어 앞이면 잠시 멈춤
      const rx = playerPos.x - x, rz = playerPos.z - z;
      const ahead = rx * fx + rz * fz, lat = Math.abs(rx * fz - rz * fx);
      let target = o.speed;
      if (ahead > 0 && ahead < 1.6 && lat < 0.8) target = 0;
      if (o.wait > 0) { o.wait -= dt; target = 0; }
      else if (Math.random() < dt * 0.01) o.wait = 2 + Math.random() * 5;
      o.cur += (target - o.cur) * Math.min(1, dt * 4);
      o.s += o.cur * dt * o.dir;
      o.pos.set(x, 0.18, z);
      const root = o.p.root;
      const dist = o.pos.distanceTo(camPos);
      root.visible = dist < 110;
      if (!root.visible) continue;
      root.position.copy(o.pos);
      const want = Math.atan2(fx, fz);
      let dh = want - root.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      root.rotation.y += dh * Math.min(1, dt * 8);
      o.p.animate(dt, o.cur);
    }
  }
  // 플레이어가 보행자를 밀지 않도록 원 충돌
  collide(pos) {
    for (const o of this.list) {
      const dx = pos.x - o.pos.x, dz = pos.z - o.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.55 && d > 1e-4) { pos.x = o.pos.x + dx / d * 0.55; pos.z = o.pos.z + dz / d * 0.55; }
    }
  }
}

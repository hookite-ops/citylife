import * as THREE from 'three';
import { seeded } from './geo.js';

// ───────── 날씨: 가끔 비가 와요 (4시간 단위로 정해짐) ─────────
const GREY_TOP = new THREE.Color(0x5a6470), GREY_HOR = new THREE.Color(0x8a939c), GREY_FOG = new THREE.Color(0x7a838c);
export class Weather {
  constructor(scene, sky, city) {
    this.scene = scene; this.sky = sky; this.city = city;
    this.amt = 0; this.raining = false;
    const n = 1400;
    const pos = new Float32Array(n * 6);
    this.drops = [];
    for (let k = 0; k < n; k++) this.drops.push([(Math.random() - 0.5) * 70, Math.random() * 30, (Math.random() - 0.5) * 70, 18 + Math.random() * 6]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc8d8e8, transparent: true, opacity: 0, depthWrite: false }));
    this.lines.frustumCulled = false; this.lines.visible = false;
    scene.add(this.lines);
    this.asphalt = city.mat.asphalt;
    this.baseRough = this.asphalt.roughness;
  }
  // 그 시간대에 비가 오는지
  isRainy(minutes) {
    const block = Math.floor(minutes / 240);
    const R = seeded(block * 977 + 31);
    return R() < 0.2;
  }
  update(dt, minutes, camPos, inside) {
    const want = this.isRainy(minutes) ? 1 : 0;
    if (want && !this.raining) { this.raining = true; this.onChange?.(true); }
    if (!want && this.raining) { this.raining = false; this.onChange?.(false); }
    this.amt += (want - this.amt) * Math.min(1, dt * 0.25);
    const a = this.amt;
    // 하늘 · 빛 · 안개
    const sky = this.sky;
    if (a > 0.01) {
      sky.uniforms.top.value.lerp(GREY_TOP, a * 0.75);
      sky.uniforms.horizon.value.lerp(GREY_HOR, a * 0.7);
      sky.sun.intensity *= 1 - 0.65 * a;
      sky.hemi.intensity *= 1 - 0.2 * a;
      this.scene.fog.color.lerp(GREY_FOG, a * 0.7);
      this.scene.fog.far = THREE.MathUtils.lerp(this.scene.fog.far, 650, a);
      this.scene.fog.near = THREE.MathUtils.lerp(160, 40, a);
    } else this.scene.fog.near = 160;
    // 젖은 도로: 반짝이게
    this.asphalt.roughness = this.baseRough - 0.55 * a;
    this.asphalt.metalness = 0.25 * a;
    // 빗줄기
    const show = a > 0.05 && !inside;
    this.lines.visible = show;
    if (!show) return;
    this.lines.material.opacity = 0.45 * a;
    const p = this.lines.geometry.attributes.position.array;
    const n = Math.floor(this.drops.length * Math.min(1, a * 1.2));
    for (let k = 0; k < this.drops.length; k++) {
      const d = this.drops[k];
      d[1] -= d[3] * dt;
      if (d[1] < 0) { d[1] += 30; d[0] = (Math.random() - 0.5) * 70; d[2] = (Math.random() - 0.5) * 70; }
      const x = camPos.x + d[0], y = Math.max(0, camPos.y - 8) + d[1], z = camPos.z + d[2];
      const i = k * 6;
      if (k >= n) { p[i] = p[i + 3] = 0; p[i + 1] = p[i + 4] = -100; p[i + 2] = p[i + 5] = 0; continue; }
      p[i] = x; p[i + 1] = y; p[i + 2] = z; p[i + 3] = x + 0.04; p[i + 4] = y - 0.55; p[i + 5] = z + 0.02;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

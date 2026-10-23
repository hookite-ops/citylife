import * as THREE from 'three';
import { seeded } from './geo.js';

// ───────── 사계절 · 기온 · 비/눈 ─────────
// 1년 = 게임 28일 (계절마다 7일). 1일차는 봄.
export const SEASONS = [
  { id: 'spring', name: '봄', icon: '🌸', lo: 7, hi: 19, wet: 0.14 },
  { id: 'summer', name: '여름', icon: '☀️', lo: 23, hi: 32, wet: 0.3 },
  { id: 'autumn', name: '가을', icon: '🍁', lo: 9, hi: 21, wet: 0.12 },
  { id: 'winter', name: '겨울', icon: '⛄', lo: -7, hi: 3, wet: 0.24 },
];
export const YEAR_DAYS = 28;
export function seasonIdx(day) { return Math.floor(((day - 1) % YEAR_DAYS) / 7); }
export function seasonOf(day) { return SEASONS[seasonIdx(day)]; }
export function yearOf(day) { return Math.floor((day - 1) / YEAR_DAYS) + 1; }
export function dayInSeason(day) { return ((day - 1) % 7) + 1; }
// 그날의 최저·최고 기온 (계절 사이는 부드럽게 이어짐)
export function dayTemps(day) {
  const R = seeded(day * 613 + 7);
  const f = (((day - 1) % YEAR_DAYS) + 0.5) / 7 - 0.5;         // 계절 중심 기준 위치
  const i0 = Math.floor(f), t = f - i0;
  const A = SEASONS[((i0 % 4) + 4) % 4], B = SEASONS[(((i0 + 1) % 4) + 4) % 4];
  const sm = t * t * (3 - 2 * t);
  const noise = (R() - 0.5) * 5;
  return { lo: Math.round(A.lo + (B.lo - A.lo) * sm + noise), hi: Math.round(A.hi + (B.hi - A.hi) * sm + noise) };
}
export function tempAt(minutes) {
  const day = Math.floor(minutes / 1440) + 1, h = (minutes % 1440) / 60;
  const { lo, hi } = dayTemps(day);
  const k = (Math.cos((h - 15) / 24 * Math.PI * 2) + 1) / 2;   // 15시 최고, 3시 최저
  return lo + (hi - lo) * k;
}
// 4시간 단위로 비/눈이 오는지
export function precipAt(minutes) {
  const block = Math.floor(minutes / 240);
  const day = Math.floor(minutes / 1440) + 1;
  const R = seeded(block * 977 + 31);
  const s = seasonOf(day);
  if (R() >= s.wet) return null;
  return tempAt(block * 240 + 120) < 1.5 ? 'snow' : 'rain';
}
// 하루 예보 (뉴스·날씨 앱)
export function forecast(day) {
  const t = dayTemps(day), kinds = [];
  for (let b = 0; b < 6; b++) { const k = precipAt((day - 1) * 1440 + b * 240); if (k) kinds.push([b * 4, k]); }
  const s = seasonOf(day);
  const icon = kinds.some(k => k[1] === 'snow') ? '🌨️' : kinds.length ? '🌧️' : t.hi >= 30 ? '🥵' : t.hi <= 0 ? '🥶' : s.id === 'summer' ? '☀️' : '⛅';
  const when = kinds.length ? kinds.map(([h, k]) => `${h}~${h + 4}시 ${k === 'snow' ? '눈' : '비'}`).join(', ') : '비 소식 없음';
  return { ...t, icon, kinds, when, season: s };
}

const GREY_TOP = new THREE.Color(0x5a6470), GREY_HOR = new THREE.Color(0x8a939c), GREY_FOG = new THREE.Color(0x7a838c);
const SNOW_TOP = new THREE.Color(0x8c96a2), SNOW_HOR = new THREE.Color(0xc4ccd4), SNOW_FOG = new THREE.Color(0xb4bcc6);
export class Weather {
  constructor(scene, sky, city) {
    this.scene = scene; this.sky = sky; this.city = city;
    this.amt = 0; this.raining = false; this.kind = null; this.snowAmt = 0;
    const n = 1400;
    const pos = new Float32Array(n * 6);
    this.drops = [];
    for (let k = 0; k < n; k++) this.drops.push([(Math.random() - 0.5) * 70, Math.random() * 30, (Math.random() - 0.5) * 70, 18 + Math.random() * 6, Math.random() * 6.28]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc8d8e8, transparent: true, opacity: 0, depthWrite: false }));
    this.lines.frustumCulled = false; this.lines.visible = false;
    scene.add(this.lines);
    // 눈송이 (점)
    const sp = new Float32Array(900 * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.flakes = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0, depthWrite: false }));
    this.flakes.frustumCulled = false; this.flakes.visible = false;
    scene.add(this.flakes);
    this.asphalt = city.mat.asphalt;
    this.baseRough = this.asphalt.roughness;
  }
  isRainy(minutes) { return !!precipAt(minutes); }
  update(dt, minutes, camPos, inside) {
    const k = precipAt(minutes);
    if (k !== this.kind) { const was = this.kind; this.kind = k; this.raining = !!k; this.onChange?.(k, was); }
    const want = k ? 1 : 0;
    this.amt += (want - this.amt) * Math.min(1, dt * 0.25);
    this.snowAmt += ((k === 'snow' ? 1 : k === 'rain' ? 0 : this.snowAmt) - this.snowAmt) * Math.min(1, dt * 0.3);
    const a = this.amt, snow = k === 'snow' || (!k && this.snowAmt > 0.5);
    // 하늘 · 빛 · 안개
    const sky = this.sky;
    if (a > 0.01) {
      sky.uniforms.top.value.lerp(snow ? SNOW_TOP : GREY_TOP, a * 0.75);
      sky.uniforms.horizon.value.lerp(snow ? SNOW_HOR : GREY_HOR, a * 0.7);
      sky.sun.intensity *= 1 - (snow ? 0.5 : 0.65) * a;
      sky.hemi.intensity *= 1 - 0.2 * a;
      this.scene.fog.color.lerp(snow ? SNOW_FOG : GREY_FOG, a * 0.7);
      this.scene.fog.far = THREE.MathUtils.lerp(this.scene.fog.far, snow ? 500 : 650, a);
      this.scene.fog.near = THREE.MathUtils.lerp(160, 40, a);
    } else this.scene.fog.near = 160;
    // 젖은 도로: 반짝이게 (눈 올 때는 덜)
    const wet = snow ? a * 0.3 : a;
    this.asphalt.roughness = this.baseRough - 0.55 * wet;
    this.asphalt.metalness = 0.25 * wet;
    const show = a > 0.05 && !inside;
    this.lines.visible = show && !snow;
    this.flakes.visible = show && snow;
    if (!show) return;
    if (snow) {
      this.flakes.material.opacity = 0.9 * a;
      const p = this.flakes.geometry.attributes.position.array;
      const n = Math.floor(900 * Math.min(1, a * 1.2)), t = performance.now() / 1000;
      for (let i = 0; i < 900; i++) {
        const d = this.drops[i];
        d[1] -= 1.6 * dt * (0.6 + d[3] / 40);
        if (d[1] < 0) { d[1] += 26; d[0] = (Math.random() - 0.5) * 60; d[2] = (Math.random() - 0.5) * 60; }
        if (i >= n) { p[i * 3 + 1] = -100; continue; }
        p[i * 3] = camPos.x + d[0] + Math.sin(t * 0.7 + d[4]) * 0.8;
        p[i * 3 + 1] = Math.max(0, camPos.y - 8) + d[1];
        p[i * 3 + 2] = camPos.z + d[2] + Math.cos(t * 0.5 + d[4]) * 0.8;
      }
      this.flakes.geometry.attributes.position.needsUpdate = true;
      return;
    }
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

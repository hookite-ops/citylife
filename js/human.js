import * as THREE from 'three';
import { GB } from './geo.js';

// ───────── 로블록스 R6 스타일 아바타 (키 1.75m) ─────────
// 1 스터드 ≈ 0.336m · 몸통 2×2×1, 팔·다리 1×2×1, 머리 둥근 원기둥
const U = 0.336;
const TW = 2 * U, TH = 2 * U, TD = U;         // 몸통
const LW = U, LH = 2 * U;                      // 팔·다리
const HIP = LH;                                // 엉덩이 높이 0.672
const NECK = HIP + TH;                         // 목 높이 1.344

const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
let faceMats = null;
function faceMat(kind) {
  if (!faceMats) {
    faceMats = {};
    const mk = (draw) => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); draw(x);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    };
    const eyes = (x, h = 22) => { x.fillStyle = '#111'; x.beginPath(); x.ellipse(42, 54, 8, h / 2, 0, 0, 7); x.ellipse(86, 54, 8, h / 2, 0, 0, 7); x.fill(); };
    faceMats.smile = mk((x) => { eyes(x); x.strokeStyle = '#111'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.arc(64, 70, 26, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke(); });
    faceMats.grin = mk((x) => { eyes(x, 18); x.fillStyle = '#111'; x.beginPath(); x.arc(64, 78, 24, 0, Math.PI); x.fill(); x.fillStyle = '#fff'; x.fillRect(46, 78, 36, 7); });
    faceMats.calm = mk((x) => { x.strokeStyle = '#111'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(34, 56); x.lineTo(50, 56); x.moveTo(78, 56); x.lineTo(94, 56); x.stroke(); x.beginPath(); x.arc(64, 72, 16, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke(); });
    faceMats.wink = mk((x) => { x.fillStyle = '#111'; x.beginPath(); x.ellipse(42, 54, 8, 11, 0, 0, 7); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(78, 56); x.lineTo(94, 52); x.stroke(); x.beginPath(); x.arc(64, 70, 24, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke(); });
  }
  return faceMats[kind] || faceMats.smile;
}
const FACES = ['smile', 'grin', 'calm', 'wink'];

function rbox(gb, w, h, d, x, y, z, r = 0.03) {
  // 모서리를 살짝 깎은 블록 (로블록스 느낌)
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  g.translate(x, y, z);
  gb.addGeo(g);
}

function partsGeo(o) {
  const skin = o.skin, shirt = o.shirt, pants = o.pants, shoes = o.shoes ?? pants;
  // 몸통
  const torso = new GB();
  torso.setColor(shirt); rbox(torso, TW, TH, TD, 0, HIP + TH / 2, 0);
  if (o.jacket) { torso.setColor(o.jacket); rbox(torso, TW * 0.36, TH * 0.98, TD * 1.04, -TW * 0.32, HIP + TH / 2, 0); rbox(torso, TW * 0.36, TH * 0.98, TD * 1.04, TW * 0.32, HIP + TH / 2, 0); }
  if (o.tie) { torso.setColor(o.tie); rbox(torso, 0.07, TH * 0.6, 0.02, 0, HIP + TH * 0.62, TD / 2 + 0.01); }
  if (o.logo) { torso.setColor(o.logo); rbox(torso, 0.22, 0.12, 0.02, 0.1, HIP + TH * 0.72, TD / 2 + 0.01); }
  if (o.bag) { torso.setColor(o.bag); rbox(torso, TW * 0.7, TH * 0.75, 0.16, 0, HIP + TH * 0.5, -TD / 2 - 0.08); }
  // 머리 (둥근 원기둥) + 머리카락
  const head = new GB();
  head.setColor(skin);
  const hr = 0.2, hh = 0.36;
  head.addGeo(new THREE.CylinderGeometry(hr, hr, hh * 0.72, 18).translate(0, hh / 2, 0));
  head.addGeo(new THREE.SphereGeometry(hr, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.38, 1).translate(0, hh * 0.86, 0));
  head.addGeo(new THREE.SphereGeometry(hr, 18, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.38, 1).translate(0, hh * 0.14, 0));
  head.addGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10).translate(0, -0.02, 0));
  if (o.hair != null) {
    head.setColor(o.hair);
    const style = o.hairStyle || 'short';
    head.addGeo(new THREE.SphereGeometry(hr * 1.08, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 0.75, 1.02).translate(0, hh * 0.72, -0.01));
    if (style === 'long') rbox(head, hr * 2.05, hh * 1.1, 0.12, 0, hh * 0.35, -hr * 0.62);
    if (style === 'bun') head.addGeo(new THREE.SphereGeometry(0.09, 10, 8).translate(0, hh * 1.08, -0.1));
    if (style === 'spiky') for (let k = 0; k < 6; k++) head.addGeo(new THREE.ConeGeometry(0.06, 0.12, 5).rotateZ((k - 2.5) * 0.25).translate((k - 2.5) * 0.06, hh * 1.02, -0.02));
  }
  if (o.hat) {
    head.setColor(o.hat);
    head.addGeo(new THREE.CylinderGeometry(hr * 1.1, hr * 1.12, 0.12, 18).translate(0, hh * 0.95, 0));
    rbox(head, hr * 1.6, 0.03, 0.16, 0, hh * 0.9, hr + 0.06);
  }
  // 팔 (위쪽 어깨가 회전축)
  const arm = new GB(); arm.setColor(o.sleeve ?? shirt); rbox(arm, LW, LH * 0.62, LW, 0, -LH * 0.31, 0);
  arm.setColor(skin); rbox(arm, LW * 0.98, LH * 0.38, LW * 0.98, 0, -LH * 0.81, 0);
  // 다리 (엉덩이가 회전축)
  const leg = new GB(); leg.setColor(pants); rbox(leg, LW, LH * 0.84, LW, 0, -LH * 0.42, 0);
  leg.setColor(shoes); rbox(leg, LW * 1.02, LH * 0.16, LW * 1.06, 0, -LH * 0.92, 0.01);
  return { torso: torso.build(), head: head.build(), arm: arm.build(), leg: leg.build() };
}

const geoCache = new Map();
function getParts(o) {
  const key = JSON.stringify(o);
  if (!geoCache.has(key)) geoCache.set(key, partsGeo(o));
  return geoCache.get(key);
}

// 공통 리그
function rig(o, shadow) {
  const g = getParts(o);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const mk = (geo) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = shadow; return m; };
  body.add(mk(g.torso));
  const headPivot = new THREE.Group(); headPivot.position.set(0, NECK, 0); body.add(headPivot);
  headPivot.add(mk(g.head));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), faceMat(o.face || 'smile'));
  face.position.set(0, 0.17, 0.201); headPivot.add(face);
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * (TW / 2 + LW / 2), NECK - 0.02, 0); body.add(shoulder);
    shoulder.add(mk(g.arm));
    const elbow = new THREE.Group(); shoulder.add(elbow);       // R6는 팔꿈치가 없음 (API 호환용)
    arms.push({ shoulder, elbow });
    const hip = new THREE.Group(); hip.position.set(s * LW / 2, HIP, 0); body.add(hip);
    hip.add(mk(g.leg));
    const knee = new THREE.Group(); hip.add(knee);
    legs.push({ hip, knee });
  }
  return { root, body, headPivot, arms, legs, face };
}

// 플레이어용
export function createHuman(o = {}) {
  const norm = (o) => ({ skin: o.skin ?? 0xf2c49b, hair: o.hair ?? 0x2a1d14, hairStyle: o.hairStyle || 'short', shirt: o.shirt ?? 0x2f6fd6, pants: o.pants ?? 0x2a2f38, shoes: o.shoes ?? 0x1c1c1c, jacket: o.jacket ?? null, face: o.face || 'smile', logo: o.logo ?? null, hat: o.hat ?? null, tie: o.tie ?? null, sleeve: o.sleeve ?? null });
  const opts = norm(o);
  const r = rig(opts, true);
  const { root, body, arms, legs } = r;
  let phase = 0;
  const api = {
    ...r, pose: 'stand', carry: false, work: false,
    animate(dt, speed, run, air) {
      if (api.pose === 'bike') { phase += dt * speed * 1.6; legs[0].hip.rotation.x = -1.05 + Math.sin(phase) * 0.45; legs[1].hip.rotation.x = -1.05 - Math.sin(phase) * 0.45; return; }
      if (api.pose !== 'stand') return;
      const moving = speed > 0.2 && !air;
      phase += dt * (run ? 11 : 7.5) * Math.min(1.3, speed / (run ? 5 : 1.9));
      const amp = moving ? (run ? 1.0 : 0.75) * Math.min(1, speed / 1.2) : 0;
      const sw = Math.sin(phase) * amp;
      const k = Math.min(1, dt * 14);
      const to = (a, b) => a + (b - a) * k;
      legs[0].hip.rotation.x = to(legs[0].hip.rotation.x, sw);
      legs[1].hip.rotation.x = to(legs[1].hip.rotation.x, -sw);
      let a0 = -sw, a1 = sw;
      // 로블록스 점프 · 낙하 자세: 팔을 위로
      if (air) { a0 = a1 = -2.9; legs[0].hip.rotation.x = to(legs[0].hip.rotation.x, 0.25); legs[1].hip.rotation.x = to(legs[1].hip.rotation.x, -0.15); }
      if (api.carry) { a0 = a1 = -1.4; }
      if (api.work) { a1 = -1.2 + Math.sin(performance.now() / 110) * 0.35; a0 = -0.9; }
      arms[0].shoulder.rotation.x = to(arms[0].shoulder.rotation.x, a0);
      arms[1].shoulder.rotation.x = to(arms[1].shoulder.rotation.x, a1);
      // 로블록스 기본 대기 동작: 살짝 숨쉬기
      body.position.y = moving ? Math.abs(Math.cos(phase)) * 0.03 : Math.sin(performance.now() / 600) * 0.006;
      body.rotation.x = 0;
    },
    // 옷 갈아입기: 같은 뼈대에 모양만 바꿔 끼움
    restyle(o2) {
      const g = getParts(norm(o2));
      r.body.children[0].geometry = g.torso;
      r.headPivot.children[0].geometry = g.head;
      r.face.material = faceMat(o2.face || 'smile');
      for (const a of r.arms) a.shoulder.children[0].geometry = g.arm;
      for (const l of r.legs) l.hip.children[0].geometry = g.leg;
    },
    setPose(p) {
      api.pose = p;
      body.rotation.set(0, 0, 0); body.position.set(0, 0, 0);
      for (const l of legs) l.hip.rotation.set(0, 0, 0);
      for (const a of arms) a.shoulder.rotation.set(0, 0, 0);
      if (p === 'sit') { for (const l of legs) l.hip.rotation.x = -Math.PI / 2; body.position.y = -HIP + 0.46; for (const a of arms) a.shoulder.rotation.x = -0.35; }
      if (p === 'bike') { body.position.y = -HIP + 0.95; for (const a of arms) a.shoulder.rotation.x = -1.25; body.rotation.x = 0.18; }
      if (p === 'scoot') { body.position.y = 0.17; arms[0].shoulder.rotation.x = -1.1; arms[1].shoulder.rotation.x = -1.1; }
      if (p === 'lie') { body.rotation.x = -Math.PI / 2; body.position.set(0, 0.17, NECK * 0.62); }
    },
  };
  return api;
}

// 행인·손님·학생 (그림자 없음, 가벼움)
export function createPed(o) {
  const opts = { ...o };
  if (opts.longHair && !opts.hairStyle) opts.hairStyle = 'long';
  delete opts.longHair;
  if (!opts.face) opts.face = FACES[Math.floor(Math.random() * FACES.length)];
  const r = rig(opts, false);
  r.body.children[0].castShadow = true;
  let phase = Math.random() * 6;
  return {
    root: r.root,
    animate(dt, speed) {
      phase += dt * speed * 4.4;
      const amp = speed > 0.1 ? 0.7 : 0;
      const sw = Math.sin(phase) * amp;
      r.legs[0].hip.rotation.x = sw; r.legs[1].hip.rotation.x = -sw;
      r.arms[0].shoulder.rotation.x = -sw; r.arms[1].shoulder.rotation.x = sw;
    },
    sit() {
      for (const l of r.legs) l.hip.rotation.x = -Math.PI / 2;
      r.body.position.y = -HIP + 0.46;
    },
  };
}

// 로블록스 느낌의 쨍한 색들
export const SKINS = [0xf2c49b, 0xe8b48a, 0xd9a07a, 0xc68863, 0x9a6648, 0xf6d9b8, 0xffd25a];
export const HAIRS = [0x1a1410, 0x2a1d14, 0x4a2e1a, 0x111111, 0x6a4024, 0xc89a5a, 0xd8d8d8, 0x7a2a1a];
export const SHIRTS = [0xf2f2f2, 0x1f3a6a, 0xd63a3a, 0x2f9a4a, 0xf2c230, 0x2a2a2a, 0x2f6fd6, 0xff7a3a, 0x8a4ad6, 0xf27ab0, 0x1fb8c8, 0x6a2a2a];
export const PANTS = [0x23262b, 0x2a3f6a, 0x5a5048, 0x1a1a1a, 0x3a6aa0, 0x7a6a58, 0x30343a, 0xe8e2d0];
export const SHOES = [0xf2f2f2, 0x1c1c1c, 0x5a3a22, 0x8a8a8a, 0xd02020];
export const HAIR_STYLES = ['short', 'short', 'long', 'bun', 'spiky'];

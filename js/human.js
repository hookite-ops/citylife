import * as THREE from 'three';
import { GB } from './geo.js';

const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const skinMat = () => vcMat;

function cap(r, len, seg = 8) {
  const g = new THREE.CapsuleGeometry(r, len, 4, seg);
  return g;
}

// 플레이어용 상세 인체 (관절 분리)
export function createHuman(o = {}) {
  const skin = o.skin ?? 0xe8c4a0, hair = o.hair ?? 0x1e1712, shirt = o.shirt ?? 0x2c4a6e, pants = o.pants ?? 0x23262b, shoes = o.shoes ?? 0xf0f0f0, jacket = o.jacket;
  const mk = (geo, color) => { const b = new GB(); b.setColor(color); b.addGeo(geo); return b.build(); };
  const mat = vcMat;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const mesh = (g) => { const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; };

  // 골반 + 몸통
  const hipsG = new GB(); hipsG.setColor(pants);
  hipsG.addGeo(new THREE.CylinderGeometry(0.15, 0.16, 0.2, 10).translate(0, 0.98, 0).scale(1, 1, 0.75));
  const torso = new GB(); torso.setColor(jacket ?? shirt);
  const tg = new THREE.CylinderGeometry(0.2, 0.155, 0.5, 12); tg.scale(1, 1, 0.62); tg.translate(0, 1.32, 0);
  torso.addGeo(tg);
  const sh = new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); sh.scale(1, 0.35, 0.62); sh.translate(0, 1.565, 0);
  torso.addGeo(sh);
  if (jacket) { torso.setColor(shirt); const v = new THREE.BoxGeometry(0.1, 0.42, 0.02); v.translate(0, 1.34, 0.125); torso.addGeo(v); }
  torso.setColor(skin);
  torso.addGeo(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8).translate(0, 1.63, 0));
  const torsoMesh = mesh(torso.build());
  const hipsMesh = mesh(hipsG.build());
  body.add(torsoMesh, hipsMesh);

  // 머리
  const headPivot = new THREE.Group(); headPivot.position.set(0, 1.66, 0); body.add(headPivot);
  const head = new GB(); head.setColor(skin);
  const hg = new THREE.SphereGeometry(0.105, 16, 12); hg.scale(0.92, 1.12, 1); hg.translate(0, 0.1, 0.005); head.addGeo(hg);
  head.addGeo(new THREE.SphereGeometry(0.022, 6, 4).translate(0.1, 0.1, 0)); head.addGeo(new THREE.SphereGeometry(0.022, 6, 4).translate(-0.1, 0.1, 0));
  head.addGeo(new THREE.ConeGeometry(0.018, 0.04, 6).rotateX(Math.PI / 2).translate(0, 0.085, 0.112));
  head.setColor(0x111111);
  head.addGeo(new THREE.SphereGeometry(0.012, 6, 4).translate(0.035, 0.115, 0.095));
  head.addGeo(new THREE.SphereGeometry(0.012, 6, 4).translate(-0.035, 0.115, 0.095));
  head.setColor(hair);
  const hairG = new THREE.SphereGeometry(0.112, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); hairG.scale(0.95, 1.1, 1.04); hairG.translate(0, 0.115, -0.006);
  head.addGeo(hairG);
  if (o.longHair) { const lh = new THREE.CylinderGeometry(0.1, 0.11, 0.24, 12, 1, true, Math.PI * 0.6, Math.PI * 1.8); lh.translate(0, 0.02, -0.01); head.addGeo(lh); }
  head.setColor(0x7a3a30);
  head.addGeo(new THREE.BoxGeometry(0.04, 0.008, 0.01).translate(0, 0.045, 0.104));
  headPivot.add(mesh(head.build()));

  // 팔
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 0.215, 1.52, 0); body.add(shoulder);
    const ug = new GB(); ug.setColor(jacket ?? shirt);
    ug.addGeo(cap(0.05, 0.22).translate(0, -0.14, 0));
    const upper = mesh(ug.build()); shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.set(0, -0.29, 0); shoulder.add(elbow);
    const lg = new GB(); lg.setColor(o.shortSleeve ? skin : (jacket ?? shirt));
    lg.addGeo(cap(0.042, 0.2).translate(0, -0.12, 0));
    lg.setColor(skin); lg.addGeo(new THREE.SphereGeometry(0.045, 8, 6).scale(0.8, 1.1, 0.5).translate(0, -0.28, 0));
    elbow.add(mesh(lg.build()));
    shoulder.rotation.z = s * 0.08;
    arms.push({ shoulder, elbow });
  }
  // 다리
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.09, 0.95, 0); body.add(hip);
    const tg2 = new GB(); tg2.setColor(pants); tg2.addGeo(cap(0.072, 0.32).translate(0, -0.22, 0));
    hip.add(mesh(tg2.build()));
    const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
    const sg = new GB(); sg.setColor(pants); sg.addGeo(cap(0.058, 0.33).translate(0, -0.21, 0));
    sg.setColor(shoes); sg.addGeo(new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(0, -0.45, 0.045));
    sg.setColor(0x2a2a2a); sg.addGeo(new THREE.BoxGeometry(0.105, 0.02, 0.25).translate(0, -0.48, 0.045));
    knee.add(mesh(sg.build()));
    legs.push({ hip, knee });
  }
  // 그림자 받기
  root.traverse(m => { if (m.isMesh) m.receiveShadow = true; });

  let phase = 0;
  const api = {
    root, body, headPivot, arms, legs,
    pose: 'stand',
    animate(dt, speed, run) {
      if (api.pose !== 'stand') return;
      const moving = speed > 0.2;
      const freq = run ? 11 : 7.6;
      if (moving) phase += dt * freq * Math.min(1.2, speed / (run ? 5.5 : 1.9));
      const amp = moving ? (run ? 0.85 : 0.5) * Math.min(1, speed / 1.2) : 0;
      const target = (a, b) => a + (b - a) * Math.min(1, dt * 12);
      const sw = Math.sin(phase) * amp;
      legs[0].hip.rotation.x = target(legs[0].hip.rotation.x, sw);
      legs[1].hip.rotation.x = target(legs[1].hip.rotation.x, -sw);
      legs[0].knee.rotation.x = target(legs[0].knee.rotation.x, Math.max(0, Math.sin(phase + 1.6)) * amp * 1.5 + (moving ? 0.05 : 0));
      legs[1].knee.rotation.x = target(legs[1].knee.rotation.x, Math.max(0, Math.sin(phase + 1.6 + Math.PI)) * amp * 1.5 + (moving ? 0.05 : 0));
      arms[0].shoulder.rotation.x = target(arms[0].shoulder.rotation.x, -sw * 0.8);
      arms[1].shoulder.rotation.x = target(arms[1].shoulder.rotation.x, sw * 0.8);
      arms[0].elbow.rotation.x = target(arms[0].elbow.rotation.x, -(run ? 1.4 : 0.25) * (moving ? 1 : 0.4));
      arms[1].elbow.rotation.x = target(arms[1].elbow.rotation.x, -(run ? 1.4 : 0.25) * (moving ? 1 : 0.4));
      const t = performance.now() / 1000;
      body.position.y = moving ? Math.abs(Math.cos(phase)) * (run ? 0.07 : 0.035) - (run ? 0.04 : 0.01) : Math.sin(t * 2) * 0.004;
      body.rotation.x = target(body.rotation.x, run && moving ? 0.18 : 0.02);
      body.rotation.y = moving ? Math.sin(phase) * 0.06 : 0;
    },
    setPose(p) {
      api.pose = p;
      if (p === 'stand') { body.rotation.set(0, 0, 0); root.rotation.x = 0; body.position.set(0, 0, 0); return; }
      if (p === 'sit') {
        for (const l of legs) { l.hip.rotation.x = -1.5; l.knee.rotation.x = 1.5; }
        for (const a of arms) { a.shoulder.rotation.x = -0.4; a.elbow.rotation.x = -0.6; }
        body.position.y = -0.45;
      }
      if (p === 'lie') {
        for (const l of legs) { l.hip.rotation.x = 0; l.knee.rotation.x = 0.05; }
        for (const a of arms) { a.shoulder.rotation.x = 0; a.elbow.rotation.x = 0; }
        body.rotation.x = -Math.PI / 2; body.position.set(0, 0.12, 0.88);
      }
    },
  };
  return api;
}

// 보행자용 가벼운 인체 (5 드로우콜)
const pedGeoCache = new Map();
export function pedVariant(o) {
  const key = JSON.stringify(o);
  if (pedGeoCache.has(key)) return pedGeoCache.get(key);
  const b = new GB();
  b.setColor(o.pants); b.addGeo(new THREE.CylinderGeometry(0.15, 0.16, 0.2, 8).translate(0, 0.98, 0).scale(1, 1, 0.75));
  b.setColor(o.shirt);
  const tg = new THREE.CylinderGeometry(0.2, 0.155, 0.52, 10); tg.scale(1, 1, 0.62); tg.translate(0, 1.33, 0); b.addGeo(tg);
  b.setColor(o.skin);
  const hg = new THREE.SphereGeometry(0.105, 10, 8); hg.scale(0.92, 1.12, 1); hg.translate(0, 1.76, 0); b.addGeo(hg);
  b.addGeo(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6).translate(0, 1.63, 0));
  b.setColor(o.hair);
  const hair = new THREE.SphereGeometry(0.112, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); hair.scale(0.95, 1.1, 1.04); hair.translate(0, 1.775, -0.006); b.addGeo(hair);
  if (o.longHair) b.addGeo(new THREE.CylinderGeometry(0.1, 0.11, 0.26, 10, 1, true).translate(0, 1.66, -0.02));
  if (o.bag) { b.setColor(o.bag); b.addGeo(new THREE.BoxGeometry(0.28, 0.34, 0.12).translate(0, 1.32, -0.18)); }
  const torso = b.build();
  const leg = new GB(); leg.setColor(o.pants); leg.addGeo(cap(0.066, 0.75).translate(0, -0.45, 0));
  leg.setColor(o.shoes); leg.addGeo(new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(0, -0.9, 0.045));
  const arm = new GB(); arm.setColor(o.shirt); arm.addGeo(cap(0.048, 0.48).translate(0, -0.28, 0));
  arm.setColor(o.skin); arm.addGeo(new THREE.SphereGeometry(0.045, 6, 4).translate(0, -0.56, 0));
  const v = { torso, leg: leg.build(), arm: arm.build() };
  pedGeoCache.set(key, v);
  return v;
}

export function createPed(o) {
  const v = pedVariant(o);
  const root = new THREE.Group();
  const t = new THREE.Mesh(v.torso, vcMat); root.add(t);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(v.leg, vcMat); l.position.set(s * 0.09, 0.95, 0); root.add(l); legs.push(l);
    const a = new THREE.Mesh(v.arm, vcMat); a.position.set(s * 0.215, 1.52, 0); a.rotation.z = s * 0.08; root.add(a); arms.push(a);
  }
  t.castShadow = true;
  let phase = Math.random() * 6;
  return {
    root,
    animate(dt, speed) {
      phase += dt * speed * 4.2;
      const amp = speed > 0.1 ? 0.45 : 0;
      const sw = Math.sin(phase) * amp;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      arms[0].rotation.x = -sw * 0.7; arms[1].rotation.x = sw * 0.7;
    },
  };
}

export const SKINS = [0xf1d0b0, 0xe8c4a0, 0xd9ad85, 0xc8966c, 0x9a6a48, 0xf5dcc4];
export const HAIRS = [0x1a1410, 0x2a1d14, 0x3d2a1a, 0x111111, 0x5a3a22, 0x8a6a4a, 0xb0b0b0];
export const SHIRTS = [0xf2f2f2, 0x1d2a3a, 0x6a2a2a, 0x2a5a3a, 0xc8a87a, 0x3a3a3a, 0x8aa0c0, 0xd47a5a, 0x5a4a7a, 0xe0d0b0, 0x222222, 0x9a2a40];
export const PANTS = [0x23262b, 0x2a3550, 0x5a5048, 0x1a1a1a, 0x3a4a5a, 0x7a6a58, 0x30343a];
export const SHOES = [0xf0f0f0, 0x222222, 0x5a3a22, 0x8a8a8a, 0xb02020];

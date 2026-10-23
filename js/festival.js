// ───────── ④ 계절 축제: 벚꽃축제 · 불꽃축제 · 가을 장터 · 크리스마스 마켓 ─────────
import * as THREE from 'three';
import { seasonOf, dayInSeason } from './weather.js';
import { lakeR } from './city.js';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';
import { bigMsg } from './ui.js';
import { won } from './config.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// 계절마다 열리는 날 (계절 안의 날짜) · 노점 메뉴
export const FESTS = {
  spring: { id: 'cherry', name: '호수공원 벚꽃축제', icon: '🌸', days: [2, 5], color: 0xf7a8c8,
    stalls: [{ icon: '🍭', name: '솜사탕', price: 3000, hunger: 4, mood: 10 }, { icon: '🌭', name: '핫도그', price: 3500, hunger: 14, mood: 5 }, { icon: '🍢', name: '어묵 꼬치', price: 1500, hunger: 8, mood: 4 }, { icon: '🥤', name: '레모네이드', price: 3500, hunger: 3, mood: 7 }, { icon: '🍡', name: '딸기 탕후루', price: 4000, hunger: 5, mood: 9 }] },
  summer: { id: 'fire', name: '호수 불꽃축제', icon: '🎆', days: [4, 6], color: 0x46a8ff, night: [20, 22],
    stalls: [{ icon: '🍧', name: '팥빙수', price: 6000, hunger: 8, mood: 12 }, { icon: '🍗', name: '닭강정 컵', price: 5000, hunger: 16, mood: 7 }, { icon: '🌽', name: '구운 옥수수', price: 3000, hunger: 10, mood: 4 }, { icon: '🥤', name: '아이스 음료', price: 3000, hunger: 2, mood: 6 }, { icon: '🎈', name: '풍선', price: 5000, hunger: 0, mood: 12 }] },
  autumn: { id: 'harvest', name: '가을 먹거리 장터', icon: '🍁', days: [3, 5], color: 0xf08a2a,
    stalls: [{ icon: '🌰', name: '군밤', price: 4000, hunger: 9, mood: 6 }, { icon: '🥞', name: '호떡', price: 2000, hunger: 10, mood: 7 }, { icon: '🍠', name: '군고구마', price: 3000, hunger: 12, mood: 5 }, { icon: '🍎', name: '사과 주스', price: 3000, hunger: 3, mood: 5 }, { icon: '🥟', name: '찐만두', price: 4000, hunger: 15, mood: 5 }] },
  winter: { id: 'xmas', name: '크리스마스 마켓', icon: '🎄', days: [4, 7], color: 0xd83a3a,
    stalls: [{ icon: '🐟', name: '붕어빵 (3개)', price: 2000, hunger: 12, mood: 8 }, { icon: '☕', name: '따뜻한 핫초코', price: 3500, hunger: 4, mood: 10 }, { icon: '🍢', name: '어묵 국물', price: 1500, hunger: 8, mood: 6 }, { icon: '🧣', name: '목도리', price: 15000, hunger: 0, mood: 14 }, { icon: '🎁', name: '선물 상자', price: 12000, hunger: 0, mood: 16 }] },
};
export function festivalOn(day) {
  const s = seasonOf(day), f = FESTS[s.id], d = dayInSeason(day);
  return f && d >= f.days[0] && d <= f.days[1] ? f : null;
}
export function nextFestival(day) {
  for (let k = 0; k < 28; k++) { const f = festivalOn(day + k); if (f) return { f, inDays: k }; }
  return null;
}

function textTex(text, bg, fg = '#fff') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 256, 64);
  x.fillStyle = fg; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Festival {
  // ctx: { scene, city, S, day(), hour(), night(), player, checkout(total, opts, onPaid), eat(item), audio, news(icon,title,body) }
  constructor(ctx) { this.c = ctx; this.cur = null; this.group = null; this.stalls = []; this.crowd = []; this.bursts = []; this.t = 0; }

  update(dt, focus) {
    this.t += dt;
    this.checkT = (this.checkT || 0) - dt;
    if (this.checkT <= 0) {
      this.checkT = 3;
      const f = festivalOn(this.c.day());
      if (f !== this.cur) { this.clear(); this.cur = f; if (f) this.build(f); }
      // 공원 근처에 있을 때만 사람들 · 꽃잎
      const near = f && Math.hypot(focus.x - this.cx, focus.z - this.cz) < 220;
      if (this.group) this.group.visible = !!f;
      if (this.crowdG) this.crowdG.visible = !!near;
    }
    if (!this.cur) return;
    const near = this.crowdG?.visible;
    if (near) for (const p of this.crowd) {
      if (p.walk) {
        p.s += dt * 1.0;
        const k = (Math.sin(p.s * 0.08 + p.ph) + 1) / 2;
        p.root.position.x = p.x0 + (p.x1 - p.x0) * k; p.root.position.z = p.z0 + (p.z1 - p.z0) * k;
        p.root.rotation.y = Math.cos(p.s * 0.08 + p.ph) > 0 ? p.dir : p.dir + Math.PI;
        p.animate(dt, 1.0);
      } else p.act(dt, p.kind);
    }
    if (this.petals) this.updatePetals(dt, focus, near);
    if (this.cur.id === 'fire') this.fireworks(dt);
    if (this.lights) this.lights.material.opacity = Math.min(1, (this.c.night() - 0.15) * 2);
  }

  // 축제장: 호수 남쪽 산책로 양옆 노점 · 무대 앞 장식
  build(f) {
    const city = this.c.city, g = this.group = new THREE.Group(); this.c.scene.add(g);
    this.crowdG = new THREE.Group(); g.add(this.crowdG);
    const zA = lakeR(Math.PI / 2) + 14;
    this.cx = 0; this.cz = zA + 30;
    const tentM = new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.7 }), whiteM = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.7 });
    const woodM = new THREE.MeshStandardMaterial({ color: 0x9a6a42, roughness: 0.8 });
    const box = (w, h, d, x, y, z, m, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
    this.stalls = [];
    let k = 0;
    for (let z = zA + 6; z < zA + 70 && k < 10; z += 6.5) for (const side of [-1, 1]) {
      const x = side * 6.2;
      if (city.nearPole?.(x, z, 2.2) || city.nearPole?.(x + side * 1.2, z, 2.2)) continue;
      const item = f.stalls[k % f.stalls.length];
      const st = new THREE.Group(); st.position.set(x, 0.18, z); st.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(st);
      // 천막 노점: 지붕 · 기둥 · 판매대 · 간판
      box(3.0, 0.12, 2.4, 0, 2.5, 0, k % 2 ? tentM : whiteM, st);
      for (const [px, pz] of [[-1.4, -1.1], [1.4, -1.1], [-1.4, 1.1], [1.4, 1.1]]) box(0.08, 2.5, 0.08, px, 1.25, pz, whiteM, st);
      box(2.8, 0.9, 0.7, 0, 0.45, 0.7, woodM, st);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: textTex(`${item.icon} ${item.name}`, '#' + f.color.toString(16).padStart(6, '0')) }));
      sign.position.set(0, 2.2, 1.21); st.add(sign);
      // 노점 주인
      const own = createPed({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick(SHOES), hat: Math.random() < 0.5 ? 0xf6f6f6 : null });
      own.root.position.set(0, 0, -0.2); st.add(own.root); own.kind = 'work'; this.crowd.push(own);
      const wx = x - side * 1.6, wz = z;
      this.stalls.push({ x: wx, z: wz, item });
      city.colliders.push(this.col = { x0: x - 1.5, x1: x + 1.5, z0: z - 1.5, z1: z + 1.5, h: 2.6, fest: true });
      k++;
    }
    // 축제 사람들 (공원 근처에 있을 때만 보여요)
    for (let i = 0; i < 18; i++) {
      const p = createPed({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick(SHOES), hairStyle: Math.random() < 0.5 ? pick(['long', 'bun']) : 'short' });
      const z = zA + 4 + Math.random() * 64;
      if (i < 10) { Object.assign(p, { walk: true, x0: (Math.random() - 0.5) * 4, x1: (Math.random() - 0.5) * 4, z0: z, z1: z + 10 + Math.random() * 20, s: Math.random() * 50, ph: Math.random() * 6, dir: 0 }); }
      else { p.root.position.set((Math.random() < 0.5 ? -1 : 1) * (3.2 + Math.random() * 0.6), 0.18, z); p.root.rotation.y = p.root.position.x > 0 ? Math.PI / 2 : -Math.PI / 2; p.kind = pick(['eat', 'talk', 'phone']); }
      p.root.position.y = 0.18;
      this.crowdG.add(p.root); this.crowd.push(p);
    }
    // 등불 줄 (밤에 반짝)
    const bulbs = [];
    for (let z = zA; z < zA + 72; z += 1.6) for (const side of [-1, 1]) bulbs.push([side * 4.4, 3.1 + Math.sin(z * 0.6) * 0.15, z]);
    const lg = new THREE.SphereGeometry(0.09, 6, 4);
    const lm = new THREE.MeshBasicMaterial({ color: f.id === 'xmas' ? 0xffd27a : f.id === 'cherry' ? 0xffc4dc : 0xffe2a0, transparent: true, opacity: 0 });
    const inst = new THREE.InstancedMesh(lg, lm, bulbs.length);
    const m4 = new THREE.Matrix4();
    bulbs.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); inst.setMatrixAt(i, m4); });
    g.add(inst); this.lights = inst;
    for (let z = zA; z < zA + 72; z += 12) for (const side of [-1, 1]) box(0.1, 3.3, 0.1, side * 4.4, 1.75, z, woodM);
    // 입구 아치
    const arch = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.2), new THREE.MeshBasicMaterial({ map: textTex(`${f.icon} ${f.name}`, '#' + f.color.toString(16).padStart(6, '0')), side: THREE.DoubleSide }));
    arch.position.set(0, 4.4, zA + 72); g.add(arch);
    for (const side of [-1, 1]) box(0.3, 4.6, 0.3, side * 4.1, 2.4, zA + 72, tentM);
    // 크리스마스 트리 (무대 앞)
    if (f.id === 'xmas') {
      let tx = 13, tz = zA + 24;
      for (const [cx, cz] of [[13, zA + 24], [-13, zA + 24], [13, zA + 44], [-13, zA + 44], [14, zA + 10], [-14, zA + 10]]) if (!city.nearPole?.(cx, cz, 4.6)) { tx = cx; tz = cz; break; }
      const tree = new THREE.Group(); tree.position.set(tx, 0.18, tz);
      const gm = new THREE.MeshStandardMaterial({ color: 0x1f6a34, roughness: 0.8 });
      for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(4.2 - i * 0.9, 3.6, 12), gm); c.position.y = 2.4 + i * 2.2; c.castShadow = true; tree.add(c); }
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshBasicMaterial({ color: 0xffd23a })); star.position.y = 11.6; tree.add(star);
      const orn = [];
      for (let i = 0; i < 70; i++) { const h = Math.random(); const r = (1 - h) * 3.8 + 0.3, a = Math.random() * 6.28; orn.push([Math.cos(a) * r, 1.0 + h * 9.4, Math.sin(a) * r]); }
      const om = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), orn.length);
      const cols = [0xff3b3b, 0xffd23a, 0x4aa8ff, 0xffffff];
      orn.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); om.setMatrixAt(i, m4); om.setColorAt(i, new THREE.Color(cols[i % 4])); });
      tree.add(om); g.add(tree);
      city.colliders.push({ x0: tx - 1, x1: tx + 1, z0: tz - 1, z1: tz + 1, h: 12, fest: true });
    }
    // 벚꽃잎 · 단풍잎 · 눈송이 대신 반짝이 (축제장 근처)
    if (f.id === 'cherry' || f.id === 'harvest') {
      const n = 260, pos = new Float32Array(n * 3);
      this.petalD = Array.from({ length: n }, () => [(Math.random() - 0.5) * 50, Math.random() * 10, (Math.random() - 0.5) * 50, Math.random() * 6]);
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.petals = new THREE.Points(pg, new THREE.PointsMaterial({ color: f.id === 'cherry' ? 0xffb6d2 : 0xe8742a, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false }));
      this.petals.frustumCulled = false; g.add(this.petals);
    }
    if (f.id === 'fire') this.initFireworks();
    this.c.news?.(f.icon, `${f.name} 개막!`, `호수공원 남쪽 산책로에서 ${f.days[1] - f.days[0] + 1}일 동안 열려요.${f.night ? ` 밤 ${f.night[0]}시부터 불꽃놀이!` : ''} 노점 먹거리도 있어요.`);
    if (!this.c.S.festSeen || this.c.S.festSeen !== `${f.id}:${this.c.day() - dayInSeason(this.c.day())}`) {
      this.c.S.festSeen = `${f.id}:${this.c.day() - dayInSeason(this.c.day())}`;
      bigMsg(`${f.icon} ${f.name}`, `호수공원 남쪽 산책로 · 노점 먹거리${f.night ? ' · 밤 8시 불꽃놀이' : ''}`, 3600);
    }
  }
  clear() {
    if (!this.group) return;
    this.c.scene.remove(this.group);
    this.group.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); } });
    const cols = this.c.city.colliders;
    for (let i = cols.length - 1; i >= 0; i--) if (cols[i].fest) cols.splice(i, 1);
    this.group = null; this.crowdG = null; this.stalls = []; this.crowd = []; this.petals = null; this.lights = null; this.fw = null; this.bursts = [];
  }
  updatePetals(dt, focus, near) {
    this.petals.visible = !!near;
    if (!near) return;
    const p = this.petals.geometry.attributes.position.array, t = this.t;
    for (let i = 0; i < this.petalD.length; i++) {
      const d = this.petalD[i];
      d[1] -= dt * 0.9;
      if (d[1] < 0) { d[1] += 10; d[0] = (Math.random() - 0.5) * 50; d[2] = (Math.random() - 0.5) * 50; }
      p[i * 3] = focus.x + d[0] + Math.sin(t * 0.9 + d[3]) * 1.2;
      p[i * 3 + 1] = 0.3 + d[1];
      p[i * 3 + 2] = focus.z + d[2] + Math.cos(t * 0.7 + d[3]) * 1.2;
    }
    this.petals.geometry.attributes.position.needsUpdate = true;
  }
  // ─ 불꽃놀이 (호수 위 하늘) ─
  initFireworks() {
    const n = 1600;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.fw = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.fw.frustumCulled = false; this.group.add(this.fw);
    this.fwN = n; this.bursts = []; this.fwT = 0;
  }
  fireworks(dt) {
    if (!this.fw) return;
    const h = this.c.hour(), on = h >= this.cur.night[0] && h < this.cur.night[1];
    this.fwT -= dt;
    if (on && this.fwT <= 0 && this.bursts.length < 8) {
      this.fwT = 0.5 + Math.random() * 1.1;
      const col = new THREE.Color().setHSL(Math.random(), 0.9, 0.62);
      const per = 200, cx = (Math.random() - 0.5) * 160, cz = -40 + (Math.random() - 0.5) * 120, cy = 70 + Math.random() * 40;
      const parts = [];
      for (let i = 0; i < per; i++) {
        const u = Math.random() * 2 - 1, a = Math.random() * 6.28, r = Math.sqrt(1 - u * u), sp = 16 + Math.random() * 6;
        parts.push([cx, cy, cz, Math.cos(a) * r * sp, u * sp, Math.sin(a) * r * sp]);
      }
      this.bursts.push({ parts, col, t: 0 });
      if (Math.random() < 0.3) this.c.audio?.play?.('land', 0.25, 0.5);
    }
    const pos = this.fw.geometry.attributes.position.array, colA = this.fw.geometry.attributes.color.array;
    let i = 0;
    for (const b of this.bursts) {
      b.t += dt;
      const fade = Math.max(0, 1 - b.t / 2.6);
      for (const p of b.parts) {
        p[3] *= 1 - dt * 1.1; p[4] = p[4] * (1 - dt * 1.1) - 9.8 * dt * 0.6; p[5] *= 1 - dt * 1.1;
        p[0] += p[3] * dt; p[1] += p[4] * dt; p[2] += p[5] * dt;
        if (i >= this.fwN) break;
        pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
        colA[i * 3] = b.col.r * fade; colA[i * 3 + 1] = b.col.g * fade; colA[i * 3 + 2] = b.col.b * fade;
        i++;
      }
    }
    this.bursts = this.bursts.filter(b => b.t < 2.6);
    for (let k = i; k < this.fwN; k++) pos[k * 3 + 1] = -500;
    this.fw.geometry.attributes.position.needsUpdate = true; this.fw.geometry.attributes.color.needsUpdate = true;
  }
  // 노점 앞이면 사 먹기 버튼
  action(p) {
    if (!this.cur) return null;
    for (const s of this.stalls) {
      if (Math.hypot(p.x - s.x, p.z - s.z) > 1.8) continue;
      const it = s.item;
      return { label: `${it.icon} ${it.name} · ${won(it.price)}`, green: true, fn: () => this.c.checkout(it.price, { icon: it.icon, title: `${this.cur.name} 노점`, sub: it.name }, () => this.c.eat(it)) };
    }
    return null;
  }
}

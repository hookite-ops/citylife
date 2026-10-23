// ───────── 9단계: 반려동물 (입양 · 밥 · 놀이 · 산책 · 동물병원) ─────────
import * as THREE from 'three';
import { GB } from './geo.js';
import { won, HOMES } from './config.js';
import { toast, openSheet, closeSheet, bindActs, row, bigMsg } from './ui.js';
import * as ST from './state.js';

export const BREEDS = [
  { id: 'maltese', kind: 'dog', name: '말티즈', icon: '🐶', price: 600000, c: [0xf6f4ee, 0xe8e2d6], size: 0.75 },
  { id: 'poodle', kind: 'dog', name: '토이푸들', icon: '🐩', price: 900000, c: [0xb07a4a, 0x8a5a34], size: 0.78 },
  { id: 'shiba', kind: 'dog', name: '시바견', icon: '🐕', price: 1500000, c: [0xd88a3c, 0xf4ead8], size: 0.95 },
  { id: 'retriever', kind: 'dog', name: '골든리트리버', icon: '🦮', price: 1300000, c: [0xe0b060, 0xc89048], size: 1.25 },
  { id: 'korshort', kind: 'cat', name: '코리안숏헤어', icon: '🐱', price: 300000, c: [0x9a8a78, 0x6a5a4a], size: 0.8 },
  { id: 'russian', kind: 'cat', name: '러시안블루', icon: '🐈', price: 1000000, c: [0x8a96a4, 0x6a7684], size: 0.82 },
  { id: 'cheese', kind: 'cat', name: '치즈냥이', icon: '😺', price: 400000, c: [0xf0a848, 0xfff2dc], size: 0.8 },
];
const NAMES = { dog: ['초코', '콩이', '보리', '두부', '몽이', '해피', '구름', 'coco'], cat: ['나비', '치즈', '모모', '루루', '까미', '호두', '라떼', '솜이'] };

export function petMesh(b) {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const s = b.size, dog = b.kind === 'dog';
  const body = new GB();
  body.setColor(b.c[0]);
  body.cbox(0, 0.32 * s, 0, 0.26 * s, 0.22 * s, (dog ? 0.5 : 0.46) * s);
  body.setColor(b.c[1]); body.cbox(0, 0.25 * s, 0.02 * s, 0.2 * s, 0.08 * s, 0.38 * s);
  const bm = new THREE.Mesh(body.build(), mat); bm.castShadow = true; root.add(bm);
  // 머리
  const head = new THREE.Group(); head.position.set(0, 0.46 * s, 0.27 * s); root.add(head);
  const hg = new GB();
  hg.setColor(b.c[0]); hg.cbox(0, 0, 0, 0.22 * s, 0.2 * s, 0.2 * s);
  hg.setColor(b.c[1]); hg.cbox(0, -0.04 * s, 0.12 * s, (dog ? 0.12 : 0.09) * s, 0.08 * s, (dog ? 0.1 : 0.05) * s);
  hg.setColor(0x111111); hg.cbox(0, -0.02 * s, (dog ? 0.17 : 0.15) * s, 0.04 * s, 0.03 * s, 0.02 * s);
  hg.cbox(0.055 * s, 0.03 * s, 0.101 * s, 0.03 * s, 0.035 * s, 0.01); hg.cbox(-0.055 * s, 0.03 * s, 0.101 * s, 0.03 * s, 0.035 * s, 0.01);
  hg.setColor(b.c[dog && b.id !== 'shiba' ? 1 : 0]);
  if (dog && b.id !== 'shiba') { hg.cbox(0.12 * s, -0.02 * s, 0, 0.04 * s, 0.14 * s, 0.1 * s); hg.cbox(-0.12 * s, -0.02 * s, 0, 0.04 * s, 0.14 * s, 0.1 * s); }
  else { hg.cbox(0.07 * s, 0.13 * s, -0.02 * s, 0.06 * s, 0.08 * s, 0.03 * s); hg.cbox(-0.07 * s, 0.13 * s, -0.02 * s, 0.06 * s, 0.08 * s, 0.03 * s); }
  head.add(new THREE.Mesh(hg.build(), mat));
  // 꼬리
  const tail = new THREE.Group(); tail.position.set(0, 0.38 * s, -0.25 * s); root.add(tail);
  const tg = new GB(); tg.setColor(b.c[0]); tg.cbox(0, (dog ? 0.06 : 0.12) * s, -0.04 * s, 0.05 * s, (dog ? 0.12 : 0.26) * s, 0.05 * s);
  tail.add(new THREE.Mesh(tg.build(), mat)); tail.rotation.x = dog ? -0.6 : -0.3;
  // 다리
  const legs = [];
  const lg = new GB(); lg.setColor(b.c[1]); lg.cbox(0, -0.1 * s, 0, 0.06 * s, 0.2 * s, 0.06 * s); const lgeo = lg.build();
  for (const [x, z] of [[0.08, 0.17], [-0.08, 0.17], [0.08, -0.17], [-0.08, -0.17]]) {
    const p = new THREE.Group(); p.position.set(x * s, 0.21 * s, z * s); p.add(new THREE.Mesh(lgeo, mat)); root.add(p); legs.push(p);
  }
  return { root, head, tail, legs };
}

export class Pets {
  constructor(ctx) { this.c = ctx; this.m = null; this.ph = 0; this.target = null; this.wait = 0; }   // { S, scene, human, player, audio, persist, mode(), passTime }
  get S() { return this.c.S; }
  get pet() { return this.S.pet || null; }
  breed() { return BREEDS.find(b => b.id === this.pet?.breed); }

  // ─ 펫숍 ─
  shopSheet() {
    const S = this.S;
    if (S.pet) { toast(`🐾 ${S.pet.name}(이)가 집에서 기다려요 · 한 마리만 키울 수 있어요`); return; }
    openSheet({
      icon: '🐾', title: '펫숍 · 분양 상담', sub: '"평생 책임질 수 있을 때 데려가 주세요"',
      html: `<p class="note">🏠 하루 한 번 밥 · 놀아주기 · 강아지는 산책이 필요해요. 사료·간식은 펫숍에서 사요.</p>` +
        row({ icon: '💚', title: '유기동물 입양', desc: '동물보호센터 연계 · 책임비 10만 원 · 접종 완료', price: won(100000), btn: '입양', btnClass: 'green', action: 'adopt' }) +
        BREEDS.map(b => row({ icon: b.icon, title: `${b.name} (${b.kind === 'dog' ? '강아지' : '고양이'})`, desc: b.kind === 'dog' ? '산책을 좋아해요' : '혼자서도 잘 놀아요', price: won(b.price), btn: '분양', action: 'b:' + b.id })).join(''),
      bind: (b) => bindActs(b, {
        b: (id) => this.buy(BREEDS.find(q => q.id === id), BREEDS.find(q => q.id === id).price),
        adopt: () => { const bb = BREEDS[Math.floor(Math.random() * BREEDS.length)]; this.buy(bb, 100000, true); },
      }),
    });
  }
  buy(b, price, rescue) {
    closeSheet();
    this.c.checkout(price, { icon: b.icon, title: rescue ? `유기동물 입양 · ${b.name}` : `${b.name} 분양`, sub: '분양 계약서 · 동물등록 포함' }, () => this.nameSheet(b, rescue));
  }
  nameSheet(b, rescue) {
    const sug = NAMES[b.kind];
    openSheet({
      icon: b.icon, title: '이름을 지어 주세요', sub: `${rescue ? '보호소에서 온 ' : ''}${b.name}`,
      html: `<input id="petName" maxlength="8" placeholder="이름" style="width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid #555;background:#1b2128;color:#fff;font-size:17px;margin-bottom:10px">
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${sug.map(n => `<button class="btn gray" data-act="n:${n}">${n}</button>`).join('')}</div>
        <button class="btn wide green" data-act="ok">이 이름으로!</button>`,
      bind: (el) => bindActs(el, { n: (n) => { el.querySelector('#petName').value = n; }, ok: () => { const v = (el.querySelector('#petName').value || '').trim() || sug[0]; closeSheet(); this.adopt(b, v.slice(0, 8), rescue); } }),
    });
  }
  adopt(b, name, rescue) {
    const S = this.S;
    S.pet = { breed: b.id, kind: b.kind, name, hunger: 80, mood: 80, health: 90, since: ST.day(S), lastFed: -1, lastPlay: -1, lastWalk: -1, vaccine: !!rescue, walking: false };
    S.petItems = S.petItems || {}; S.petItems.food = (S.petItems.food || 0) + 3;
    bigMsg(`${b.icon} ${name}(이)가 가족이 됐어요!`, '집에 가면 기다리고 있어요 · 사료 3번분을 받았어요', 4000);
    this.c.missions?.event?.('pet');
    this.c.persist();
  }

  // ─ 돌보기 ─
  careSheet() {
    const S = this.S, p = this.pet; if (!p) return;
    const b = this.breed(), it = S.petItems || {};
    const bar = (v) => `${'❤️'.repeat(Math.round(v / 20))}${'🤍'.repeat(5 - Math.round(v / 20))}`;
    const out = this.c.mode() !== 'home';
    openSheet({
      icon: b.icon, title: `${p.name} · ${b.name}`, sub: `함께한 지 ${ST.day(S) - p.since + 1}일 · 배부름 ${bar(p.hunger)} · 기분 ${bar(p.mood)}`,
      html: (out ? '' : row({ icon: '🦴', title: '밥 주기', desc: `사료 ${it.food || 0}번분`, btn: '주기', action: 'feed', disabled: !(it.food > 0) }) +
        row({ icon: '🍖', title: '간식 주기', desc: `간식 ${it.snack || 0}개 · 기분 UP`, btn: '주기', action: 'snack', disabled: !(it.snack > 0) }) +
        row({ icon: it.toy ? '🎾' : '🧶', title: '놀아주기', desc: it.toy ? '장난감 공으로 신나게 (효과 2배)' : '손으로 놀아주기 · 펫숍 장난감이 있으면 2배', btn: '놀기', action: 'play' })) +
        row({ icon: '🤲', title: '쓰다듬기', desc: '서로 기분이 좋아져요', btn: '쓰담', action: 'pet' }) +
        (p.kind === 'dog' ? row({ icon: '🦮', title: p.walking ? '산책 끝내기' : '산책 나가기', desc: p.walking ? '집으로 돌아가요' : '밖에 나가면 따라와요 · 기분 크게 UP', btn: p.walking ? '끝' : '가자', btnClass: 'green', action: 'walk', disabled: out && !p.walking }) : ''),
      bind: (el) => bindActs(el, {
        feed: () => { it.food--; p.hunger = Math.min(100, p.hunger + 60); p.lastFed = ST.day(S); closeSheet(); toast(`🦴 ${p.name}: 냠냠냠! (꼬리 흔들흔들)`, 'good'); this.c.passTime(5); this.c.persist(); },
        snack: () => { it.snack--; p.mood = Math.min(100, p.mood + 20); p.hunger = Math.min(100, p.hunger + 10); closeSheet(); toast(`🍖 ${p.name}가 간식을 좋아해요!`, 'good'); this.c.persist(); },
        play: () => { const k = it.toy ? 2 : 1; p.mood = Math.min(100, p.mood + 20 * k); p.lastPlay = ST.day(S); S.mood = ST.clamp(S.mood + 4 * k); closeSheet(); this.hop = 2.5; toast(`${it.toy ? '🎾' : '🧶'} ${p.name}와 신나게 놀았어요!`, 'good'); this.c.passTime(20, 'fun'); this.c.persist(); },
        pet: () => { p.mood = Math.min(100, p.mood + 6); S.mood = ST.clamp(S.mood + 3); closeSheet(); toast(p.kind === 'dog' ? `🐶 ${p.name}가 배를 보여줘요` : `🐱 ${p.name}가 골골송을 불러요`, 'good'); this.c.persist(); },
        walk: () => { p.walking = !p.walking; closeSheet(); if (p.walking) { p.walkStart = S.minutes; toast(`🦮 ${p.name}와 산책 준비 완료! 밖으로 나가요`, 'good'); } else this.endWalk(); this.c.persist(); },
      }),
    });
  }
  endWalk() {
    const S = this.S, p = this.pet; if (!p) return;
    const min = Math.max(0, S.minutes - (p.walkStart || S.minutes));
    p.walking = false;
    if (min >= 10) { p.mood = Math.min(100, p.mood + Math.min(40, min)); p.lastWalk = ST.day(S); S.mood = ST.clamp(S.mood + Math.min(10, min / 4)); toast(`🦮 ${Math.round(min)}분 산책 끝! ${p.name}가 아주 행복해해요`, 'good', 3200); }
    else toast('🦮 산책 끝 · 다음엔 조금 더 오래 걸어요');
  }
  // 동물병원
  vet(v) {
    const p = this.pet; if (!p) return;
    if (v.id === 'vaccine') { p.vaccine = true; p.health = Math.min(100, p.health + 15); toast(`💉 ${p.name} 예방 접종 완료 · 씩씩하게 잘 참았어요`, 'good', 3200); }
    else { p.health = Math.min(100, p.health + 30); toast(`🩺 ${p.name} 건강 검진 · ${p.health > 70 ? '아주 건강해요!' : '밥을 잘 챙겨 주세요'}`, 'good', 3200); }
    this.c.persist();
  }
  dailyCheck() {
    const S = this.S, p = this.pet; if (!p) return;
    const day = ST.day(S);
    if (p.day === day) return;
    const prev = p.day ?? day; p.day = day;
    for (let d = prev + 1; d <= day; d++) {
      p.hunger = Math.max(0, p.hunger - 35);
      p.mood = Math.max(0, p.mood - (p.kind === 'dog' && p.lastWalk < d - 1 ? 25 : 15));
      if (p.hunger <= 0) p.health = Math.max(10, p.health - 10);
      else if (p.hunger > 50) p.health = Math.min(100, p.health + 2);
      if (!p.vaccine && Math.random() < 0.04) p.health = Math.max(10, p.health - 15);
    }
    if (p.mood > 60 && p.hunger > 30) { S.mood = ST.clamp(S.mood + 4); toast(`🐾 ${p.name} 덕분에 오늘도 행복해요`, 'good', 2600); }
    if (p.hunger < 30) toast(`🦴 ${p.name}가 배고파해요! 집에 가서 밥을 주세요`, 'bad', 3600);
    else if (p.kind === 'dog' && p.mood < 35) toast(`🦮 ${p.name}가 산책 가고 싶어해요`, '', 3200);
    if (p.health < 40) toast(`🏥 ${p.name}가 기운이 없어요 · 동물병원에 데려가 보세요`, 'bad', 3600);
  }

  // ─ 3D 모델 · 따라다니기 ─
  visible() {
    const p = this.pet; if (!p) return false;
    const mode = this.c.mode();
    if (mode === 'home') return true;
    return p.walking && (mode === 'city' || mode === 'bldg') && !this.c.inCar();
  }
  update(dt) {
    const p = this.pet;
    if (!p) { if (this.m) { this.m.root.parent?.remove(this.m.root); this.m = null; } return; }
    if (!this.m || this.m.breed !== p.breed) { if (this.m) this.m.root.parent?.remove(this.m.root); this.m = petMesh(this.breed()); this.m.breed = p.breed; }
    const show = this.visible();
    const parent = this.c.human.root.parent;
    const r = this.m.root;
    if (!show || !parent) { r.visible = false; return; }
    if (r.parent !== parent) { parent.add(r); this.place(); }
    r.visible = true;
    const pl = this.c.player.pos, mode = this.c.mode();
    let tx, tz, speed = 0;
    if (p.walking && mode !== 'home') {
      const h = this.c.player.heading;
      tx = pl.x - Math.sin(h) * 1.1 + Math.cos(h) * 0.5; tz = pl.z - Math.cos(h) * 1.1 - Math.sin(h) * 0.5;
      if (Math.hypot(tx - r.position.x, tz - r.position.z) > 25) this.place();
    } else {
      // 집 안에서 어슬렁
      const H = HOMES.find(q => q.id === this.S.home) || HOMES[0];
      this.wait -= dt;
      if (!this.target || (this.wait <= 0 && Math.random() < dt * 0.5)) {
        const near = Math.random() < 0.35;
        this.target = near ? { x: pl.x + (Math.random() - 0.5) * 1.5, z: pl.z + (Math.random() - 0.5) * 1.5 } : { x: (Math.random() - 0.5) * (H.w - 1.4), z: (Math.random() - 0.5) * (H.d - 1.4) };
        this.wait = 3 + Math.random() * 5;
      }
      tx = this.target.x; tz = this.target.z;
    }
    const dx = tx - r.position.x, dz = tz - r.position.z, d = Math.hypot(dx, dz);
    if (d > 0.15) {
      speed = Math.min(p.walking && mode !== 'home' ? Math.max(1.5, this.c.player.speed * 1.05 + d * 0.6) : 0.9, d * 3);
      r.position.x += dx / d * speed * dt; r.position.z += dz / d * speed * dt;
      const want = Math.atan2(dx, dz); let dh = want - r.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); r.rotation.y += dh * Math.min(1, dt * 8);
    }
    r.position.y = (mode === 'city' ? this.c.groundY(r.position.x, r.position.z) : 0) + (this.hop > 0 ? Math.abs(Math.sin(this.hop * 8)) * 0.25 : 0);
    if (this.hop > 0) this.hop -= dt;
    this.ph += dt * (speed > 0.1 ? 4 + speed * 4 : 0);
    const sw = speed > 0.1 ? Math.sin(this.ph) * 0.6 : 0;
    this.m.legs[0].rotation.x = sw; this.m.legs[3].rotation.x = sw; this.m.legs[1].rotation.x = -sw; this.m.legs[2].rotation.x = -sw;
    this.m.tail.rotation.z = Math.sin(performance.now() / (p.mood > 50 ? 90 : 400)) * (p.kind === 'dog' ? 0.6 : 0.25);
    // 산책 중이면 기분 · 나도 기분 UP
    if (p.walking && mode === 'city' && this.c.player.speed > 0.5) { p.mood = Math.min(100, p.mood + dt * 0.08); }
  }
  place() {
    const r = this.m.root, pl = this.c.player.pos, h = this.c.player.heading;
    r.position.set(pl.x - Math.sin(h) * 1.0, 0, pl.z - Math.cos(h) * 1.0); r.rotation.y = h;
  }
  near(maxD = 1.4) {
    if (!this.m?.root.visible) return false;
    const r = this.m.root, pl = this.c.player.pos;
    return Math.hypot(r.position.x - pl.x, r.position.z - pl.z) < maxD;
  }
  action() {
    const p = this.pet; if (!p || !this.near()) return null;
    return { label: `${this.breed().icon} ${p.name} 돌보기`, fn: () => this.careSheet() };
  }
}

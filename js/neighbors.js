// ───────── ④ 이름 있는 동네 사람들: 이웃 · 단골 가게 · 동네 부탁 · 동네 사건 ─────────
import * as THREE from 'three';
import { createPed } from './human.js';
import { petMesh, BREEDS } from './pets.js';
import { seeded } from './geo.js';
import { won } from './config.js';
import { toast, openSheet, closeSheet, bindActs, row, bigMsg } from './ui.js';
import * as ST from './state.js';

// ─ 이웃 (우리 건물 앞에서 자주 만나요) ─
const NB = [
  { id: 'guard', name: '최씨 아저씨', role: '경비실', icon: '👮', at: [[6, 23]], spot: [2.6, 1.2], kind: 'idle',
    look: { skin: 0xe2b48c, hair: 0x8a8a8a, shirt: 0x2a3a5a, pants: 0x1a1a1a, shoes: 0x222222, hat: 0x2a3a5a },
    lines: ['"오늘도 수고 많아요~"', '"택배 오면 경비실에 맡겨 둘게요."', '"밤에는 공동현관 꼭 닫혀 있는지 봐요."', '"요즘 분리수거를 다들 잘 해서 좋아요."', '"우리 아파트 앞 벚꽃이 참 예뻐요."'] },
  { id: 'grandma', name: '박순자 할머니', role: '옆집', icon: '👵', at: [[8, 12], [15, 19]], spot: [-3.2, 2.4], kind: 'talk', sit: true,
    look: { skin: 0xf0c8a0, hair: 0xd8d8d8, shirt: 0x9a4a6a, pants: 0x4a4a5a, shoes: 0x5a3a2a, hairStyle: 'bun' },
    lines: ['"아이고, 밥은 먹고 다니우?"', '"우리 손주가 너만 할 때가 있었는데…"', '"김치 담갔는데 좀 줄까?"', '"요즘 젊은 사람들 참 바빠."', '"감기 조심해. 따뜻하게 입고 다녀."'],
    gifts: [{ id: 'kimchi', name: '할머니 김치', icon: '🥬' }, { id: 'g:fruit:apple', name: '사과', icon: '🍎', food: true }] },
  { id: 'student', name: '이준호', role: '윗집 대학생', icon: '🧑‍🎓', at: [[8, 10], [18, 23]], spot: [4.2, -1.6], kind: 'phone',
    look: { skin: 0xe8b890, hair: 0x2a1a10, shirt: 0x3a6ad8, pants: 0x2a3f6a, shoes: 0xf2f2f2, hairStyle: 'spiky', bag: 0x2a2a2a },
    lines: ['"시험 기간이라 잠을 못 잤어요…"', '"한빛대 앞 국밥집 진짜 맛있어요."', '"PC방 같이 갈래요? ㅋㅋ"', '"알바 끝나고 오는 길이에요."', '"윗집이라 혹시 시끄러우면 말해 주세요!"'] },
  { id: 'kid', name: '서윤이', role: '아랫집 꼬마', icon: '🧒', at: [[14, 18]], spot: [-1.5, 3.6], kind: 'idle', scale: 0.7,
    look: { skin: 0xf3cfa8, hair: 0x2a1a10, shirt: 0xf2c230, pants: 0xe07aa0, shoes: 0xf2f2f2, hairStyle: 'long', bag: 0xd63a3a },
    lines: ['"언니(형)! 나 오늘 받아쓰기 100점 맞았어!"', '"문구랜드 뽑기에서 토끼 키링 나왔어!"', '"우리 엄마가 모르는 사람 따라가면 안 된댔어."', '"놀이터 가고 싶다~"'] },
];
const ERRANDS = {
  grandma: [{ kind: 'buy', item: 'milk', text: '바나나우유 하나만 사다 줄 수 있어? 손주 주려고', reward: 5000, f: 2 },
    { kind: 'parcel', text: '경비실에 내 택배가 와 있다는데… 다리가 아파서. 좀 가져다줄래?', reward: 4000, f: 2 }],
  student: [{ kind: 'buy', item: 'coffee', text: '혹시 캔커피 하나만 사다 줄 수 있어요? 과제하다 죽겠어요…', reward: 3000, f: 1 }],
  kid: [{ kind: 'buy', item: 'icecone', text: '초코콘 사 주면 안 돼…? 엄마한테 돈 받아서 갚을게!', reward: 2000, f: 2 }],
  guard: [{ kind: 'parcel2', text: '택배가 너무 많이 왔네요. 할머니 택배 좀 전해 줄래요?', reward: 3000, f: 1 }],
};

// ─ 단골 가게 (같은 가게 같은 직원 · 자주 가면 할인) ─
const CLERKS = ['지은', '민수', '수빈', '현우', '다은', '준영', '소희', '태민', '하린', '도현', '유나', '성민'];
export function clerkOf(key, type) {
  const R = seeded([...key].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7));
  const boss = ['bunsik', 'restaurant', 'korean', 'bakery', 'flower', 'grocer', 'butcher', 'deli', 'laundry', 'salon', 'optician'].some(k => (type || '').includes(k));
  const n = CLERKS[Math.floor(R() * CLERKS.length)];
  return boss ? `사장님 (${n[0]}${['씨', '사장'][Math.floor(R() * 2)]})` : `직원 ${n}`;
}
export function regularInfo(S, key) {
  const r = S.regs?.[key];
  const n = r?.n || 0;
  const lv = n >= 10 ? 2 : n >= 4 ? 1 : 0;
  return { n, lv, off: [0, 5, 10][lv], label: ['', '⭐ 단골', '🌟 VIP 단골'][lv] };
}
export function addVisit(S, key) {
  S.regs = S.regs || {};
  const day = ST.day(S), r = S.regs[key] || (S.regs[key] = { n: 0, d: 0 });
  if (r.d === day) return false;
  const before = regularInfo(S, key).lv;
  r.n++; r.d = day;
  const after = regularInfo(S, key);
  if (after.lv > before) toast(after.lv === 2 ? '🌟 VIP 단골이 됐어요! 이제 10% 할인해 줘요' : '⭐ 이 가게 단골이 됐어요! 다음부터 5% 할인', 'good', 3600);
  return true;
}

export class Neighbors {
  // ctx: { scene, city, S, player, home() (현관 {x,z,nx,nz}), hour(), day(), audio, persist, flash(g), missions, near(p) }
  constructor(ctx) { this.c = ctx; this.peds = new Map(); this.t = 0; }
  get S() { return this.c.S; }
  rel(id) { const S = this.S; S.nb = S.nb || {}; return S.nb[id] || (S.nb[id] = { f: 0, met: false, d: 0, gift: 0 }); }
  hearts(f) { const n = Math.min(5, Math.floor(f / 3)); return '❤️'.repeat(n) + '🤍'.repeat(5 - n); }

  update(dt, focus, mode) {
    this.t += dt;
    this.chkT = (this.chkT || 0) - dt;
    if (this.chkT <= 0) { this.chkT = 1; this.refresh(focus, mode); this.lostCatDaily(); }
    for (const [, o] of this.peds) {
      if (!o.root.visible) continue;
      const p = this.c.player.pos;
      if (o.talk > 0) { o.talk -= dt; o.root.rotation.y = Math.atan2(p.x - o.root.position.x, p.z - o.root.position.z); o.act(dt, 'talk'); }
      else o.act(dt, o.def.kind);
    }
    if (this.cat) this.updateCat(dt, focus);
  }
  // 시간표대로 집 앞에 나와 있어요 (집 근처에 있을 때만)
  refresh(focus, mode) {
    const h = this.c.hour(), e = this.c.home();
    const near = e && mode === 'city' && Math.hypot(focus.x - e.x, focus.z - e.z) < 70;
    for (const def of NB) {
      const want = near && def.at.some(([a, b]) => h >= a && h < b) && this.seededPresent(def);
      let o = this.peds.get(def.id);
      if (want && !o) {
        o = createPed({ ...def.look, face: 'smile' });
        o.def = def; o.talk = 0;
        if (def.scale) o.root.scale.setScalar(def.scale);
        if (def.sit) { o.sit(); const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.45), new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.8 })); bench.position.set(0, 0.42, 0.05); o.root.add(bench); }
        // 현관 앞 (현관 바깥 방향 기준 좌우·앞)
        const sx = -e.nz, sz = e.nx, [a, f] = def.spot;
        o.root.position.set(e.x + sx * a + e.nx * f, 0.18, e.z + sz * a + e.nz * f);
        o.root.rotation.y = Math.atan2(-e.nx, -e.nz) + (def.sit ? Math.PI : 0) + (Math.random() - 0.5) * 0.8;
        this.c.scene.add(o.root); this.peds.set(def.id, o);
      } else if (!want && o) { this.c.scene.remove(o.root); this.peds.delete(def.id); }
    }
  }
  // 매일 나오는지 (하루 단위로 정해져요 · 경비 아저씨는 항상)
  seededPresent(def) {
    if (def.id === 'guard') return true;
    const R = seeded(this.c.day() * 97 + def.id.length * 13);
    return R() < 0.75;
  }
  // 가까운 이웃에게 말 걸기 버튼
  action(p) {
    for (const [, o] of this.peds) {
      const d = Math.hypot(p.x - o.root.position.x, p.z - o.root.position.z);
      if (d < 2.0) {
        const r = this.rel(o.def.id), task = this.S.nbTask;
        if (task && task.kind === 'parcel' && task.stage === 'pickup' && o.def.id === 'guard') return { label: '📦 할머니 택배 받기', fn: () => { task.stage = 'deliver'; toast('📦 택배를 받았어요 · 박순자 할머니께 전해 드려요', 'good'); this.c.persist(); }, green: true };
        if (task && task.kind === 'parcel' && task.stage === 'deliver' && o.def.id === task.to) return { label: '📦 택배 전해 드리기', fn: () => this.complete(o), green: true };
        if (this.cat?.follow && o.def.id === this.cat.owner) return { label: `🐱 ${this.cat.name} 돌려주기`, fn: () => this.returnCat(o), green: true };
        return { label: `💬 ${o.def.icon} ${o.def.name}${r.met ? '' : ` (${o.def.role})`}`, fn: () => this.talkSheet(o) };
      }
    }
    if (this.cat && !this.cat.follow) {
      const c = this.cat.mesh.root.position;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 1.8) return { label: `🐱 ${this.cat.name} 데려가기 (전단지 고양이!)`, fn: () => { this.cat.follow = true; this.c.audio?.play?.('pick'); toast(`🐱 ${this.cat.name}가 따라와요 · ${this.ownerName()}께 데려다줘요`, 'good', 3600); }, green: true };
    }
    return null;
  }
  talkSheet(o) {
    const S = this.S, def = o.def, r = this.rel(def.id), day = this.c.day();
    o.talk = 999;
    const first = !r.met;
    if (first) { r.met = true; r.f += 1; toast(`🤝 ${def.role} ${def.name}을(를) 처음 만났어요`, 'good'); }
    const task = S.nbTask;
    const myTask = task && task.from === def.id;
    const offer = !task && r.f >= 2 && r.ask !== day && ERRANDS[def.id] ? ERRANDS[def.id][day % ERRANDS[def.id].length] : null;
    const R = seeded(day * 31 + def.id.length + (r.talks || 0));
    const line = def.lines[Math.floor(R() * def.lines.length)];
    const render = () => openSheet({
      icon: def.icon, title: def.name, sub: `${def.role} · ${this.hearts(r.f)}`,
      html: `<p class="note">${def.name}: ${line}</p>` +
        row({ icon: '👋', title: '인사하기', desc: r.d === day ? '오늘은 인사했어요' : '친해져요 · 기분 +2', btn: '인사', action: 'hi', disabled: r.d === day }) +
        row({ icon: '🗨️', title: '이야기 나누기', desc: '동네 이야기 · 10분', btn: '듣기', action: 'chat' }) +
        (myTask ? row({ icon: '🙏', title: '부탁', desc: task.kind === 'buy' ? `${task.label} 가져오기 · ${this.has(task.item) ? '가방에 있어요!' : '아직 없어요'}` : task.stage === 'pickup' ? '경비실에서 택배 받아 오기' : '택배 전해 드리기', btn: task.kind === 'buy' && this.has(task.item) ? '드리기' : '진행 중', action: 'give', disabled: !(task.kind === 'buy' && this.has(task.item)), btnClass: 'green' }) : '') +
        (offer ? row({ icon: '🙏', title: '부탁 들어주기', desc: `"${offer.text}"`, btn: '좋아요', action: 'take', btnClass: 'green' }) : '') +
        (r.f >= 6 && this.c.hasHome?.() && !S.nbVisit ? row({ icon: '🏠', title: '우리 집에 초대하기', desc: '저녁 7시쯤 놀러 와요 · 집에 있어야 해요', btn: '초대', action: 'invite', btnClass: 'green' }) : '') +
        (def.gifts && r.f >= 6 && r.gift !== day && (day % 3 === 0) ? row({ icon: '🎁', title: '선물 받기', desc: '"이거 가져가서 먹어~"', btn: '받기', action: 'gift', btnClass: 'green' }) : '') +
        `<button class="btn wide gray" data-act="bye">안녕히 계세요</button>`,
      bind: (b) => bindActs(b, {
        hi: () => { r.d = day; r.f += 1; S.mood = ST.clamp(S.mood + 2); this.c.missions?.event?.('talk'); toast(`👋 ${def.name}: "${r.f > 6 ? '왔구나~ 반가워!' : '안녕하세요~'}"`); this.c.persist(); render(); },
        chat: () => { r.talks = (r.talks || 0) + 1; ST.passTime(S, 10, 'idle'); S.mood = ST.clamp(S.mood + 3); if ((r.talks % 3) === 0) r.f += 1; toast(`🗨️ ${def.name}: ${def.lines[Math.floor(Math.random() * def.lines.length)]}`, '', 4200); this.c.persist(); },
        take: () => {
          r.ask = day;
          const it = offer.item ? this.c.productName?.(offer.item) : null;
          S.nbTask = { from: def.id, kind: offer.kind === 'parcel2' ? 'parcel' : offer.kind, item: offer.item, label: it || offer.item, reward: offer.reward, f: offer.f, stage: offer.kind === 'buy' ? null : offer.kind === 'parcel2' ? 'deliver' : 'pickup', to: offer.kind === 'parcel2' ? 'grandma' : def.id };
          toast(offer.kind === 'buy' ? `🙏 ${it} 사 오기 · 24 마트나 편의점에서 살 수 있어요` : offer.kind === 'parcel2' ? '📦 택배를 받았어요 · 박순자 할머니께 전해 드려요' : '📦 경비실(현관 앞 경비 아저씨)에서 택배를 받아 와요', 'good', 3600);
          this.c.persist(); closeSheet();
        },
        give: () => { this.complete(o); closeSheet(); },
        gift: () => {
          r.gift = day;
          const g = def.gifts[Math.floor(Math.random() * def.gifts.length)];
          const inv = S.inventory;
          if (g.food) inv.food[g.id] = (inv.food[g.id] || 0) + 2;
          else { inv.ing = inv.ing || {}; inv.ing[g.id] = (inv.ing[g.id] || 0) + 4; }
          toast(`🎁 ${g.icon} ${g.name}을(를) 받았어요 · 가방에 넣었어요`, 'good', 3200);
          this.c.persist(); closeSheet();
        },
        invite: () => {
          const h = this.c.hour();
          S.nbVisit = { id: def.id, day: h >= 21 ? day + 1 : day, at: h >= 18 && h < 21 ? Math.ceil(h + 0.5) : 19 };
          toast(`🏠 ${def.name}: "${def.id === 'kid' ? '와! 꼭 갈게!' : '어머, 고마워요. 이따 들를게요~'}" · ${S.nbVisit.day === day ? '오늘' : '내일'} ${S.nbVisit.at}시`, 'good', 3600);
          this.c.persist(); closeSheet();
        },
        bye: () => { o.talk = 1.2; closeSheet(); },
      }),
    });
    render();
  }
  has(id) { return (this.S.inventory?.food?.[id] || 0) > 0; }
  complete(o) {
    const S = this.S, t = S.nbTask;
    if (!t) return;
    if (t.kind === 'buy') { if (!this.has(t.item)) return; S.inventory.food[t.item]--; if (S.inventory.food[t.item] <= 0) delete S.inventory.food[t.item]; }
    const giver = NB.find(n => n.id === t.from), r = this.rel(t.from);
    r.f += t.f + 1;
    S.money += t.reward; this.c.flash?.(true); this.c.audio?.coin?.();
    S.mood = ST.clamp(S.mood + 6);
    this.c.missions?.event?.('errand'); this.c.missions?.addXp?.(25);
    S.nbTask = null;
    o.talk = 2;
    toast(`🙏 ${giver.name}: "고마워요! 정말 큰 도움이 됐어요" · ${won(t.reward)} · 친해졌어요 ❤️`, 'good', 4200);
    this.c.persist();
  }
  taskLine() {
    const t = this.S.nbTask; if (!t) return '';
    const n = NB.find(q => q.id === t.from);
    return t.kind === 'buy' ? `🙏 ${n.name}: ${t.label} 사다 드리기${this.has(t.item) ? ' (가방에 있어요 · 집 앞으로)' : ''}` : t.stage === 'pickup' ? '📦 경비실에서 할머니 택배 받기' : '📦 박순자 할머니께 택배 전해 드리기';
  }

  // ─ 집들이: 초대한 이웃이 우리 집에 놀러 와요 ─
  homeUpdate(dt, inHome, root, pos, door) {
    const S = this.S, v = S.nbVisit;
    if (!v) { this.dropGuest(); return; }
    const day = this.c.day(), h = this.c.hour();
    if (day > v.day || (day === v.day && h >= v.at + 2.5)) {   // 시간이 지나면 다음에
      if (!this.guest) toast(`🏠 ${NB.find(n => n.id === v.id).name}이(가) 다녀갔는데 집에 없었대요…`, 'bad', 3200);
      S.nbVisit = null; this.dropGuest(); return;
    }
    if (!inHome) { if (this.guest) { this.dropGuest(); } return; }
    if (!this.guest && day === v.day && h >= v.at) {
      const def = NB.find(n => n.id === v.id);
      const g = createPed({ ...def.look, face: 'smile' }); g.def = def;
      if (def.scale) g.root.scale.setScalar(def.scale);
      g.root.position.set(door.x, 0, door.z - 0.6); root.add(g.root);
      this.guest = { p: g, root, t: 0, target: { x: 0.4, z: 0.3 }, served: false, talked: 0 };
      this.c.audio?.play?.('door');
      bigMsg('🔔 띵동~', `${def.role} ${def.name}이(가) 놀러 왔어요!`, 2800);
    }
    const G = this.guest; if (!G) return;
    G.t += dt;
    const r = G.p.root, dx = G.target.x - r.position.x, dz = G.target.z - r.position.z, d = Math.hypot(dx, dz);
    if (d > 0.1) { const sp = Math.min(d, 1.2 * dt); r.position.x += dx / d * sp; r.position.z += dz / d * sp; r.rotation.y = Math.atan2(dx, dz); G.p.animate(dt, 1.1); }
    else { r.rotation.y = Math.atan2(pos.x - r.position.x, pos.z - r.position.z); G.p.act(dt, G.talking > 0 ? 'talk' : G.served ? 'eat' : 'idle'); }
    if (G.talking > 0) G.talking -= dt;
  }
  dropGuest() { if (this.guest) { this.guest.root.remove(this.guest.p.root); this.guest = null; } }
  guestAction(pos) {
    const G = this.guest; if (!G) return null;
    const r = G.p.root;
    if (Math.hypot(pos.x - r.position.x, pos.z - r.position.z) > 1.8) return null;
    return { label: `💬 ${G.p.def.name}와(과) 시간 보내기`, fn: () => this.guestSheet(), green: true };
  }
  guestSheet() {
    const S = this.S, G = this.guest, def = G.p.def, r = this.rel(def.id);
    const food = Object.entries(S.inventory?.food || {}).filter(([, n]) => n > 0).slice(0, 1)[0];
    openSheet({
      icon: def.icon, title: `${def.name} · 우리 집 방문`, sub: this.hearts(r.f),
      html: `<p class="note">${def.name}: "${['집이 참 아늑하네요~', '와, 집 예쁘게 꾸몄네!', '초대해 줘서 고마워요.'][Math.floor(Math.random() * 3)]}"</p>` +
        row({ icon: '🍵', title: '차 대접하기', desc: G.served ? '이미 대접했어요' : '30분 · 기분 +8 · 친해져요', btn: '대접', action: 'tea', disabled: G.served }) +
        (food ? row({ icon: '🍽️', title: '먹을 것 나눠 먹기', desc: '가방에 있는 음식 하나', btn: '나눠요', action: 'share' }) : '') +
        row({ icon: '🗨️', title: '수다 떨기', desc: '1시간 · 기분 +10', btn: '수다', action: 'chat' }) +
        `<button class="btn wide gray" data-act="bye">배웅하기 (집들이 끝)</button>`,
      bind: (b) => bindActs(b, {
        tea: () => { G.served = true; ST.passTime(S, 30, 'idle'); S.mood = ST.clamp(S.mood + 8); r.f += 1; toast('🍵 따뜻한 차를 함께 마셨어요', 'good'); closeSheet(); },
        share: () => { const [id] = food; S.inventory.food[id]--; if (S.inventory.food[id] <= 0) delete S.inventory.food[id]; r.f += 2; S.mood = ST.clamp(S.mood + 5); toast('🍽️ 맛있게 나눠 먹었어요 · 더 친해졌어요 ❤️', 'good'); closeSheet(); },
        chat: () => { G.talking = 6; ST.passTime(S, 60, 'idle'); S.mood = ST.clamp(S.mood + 10); r.f += 1; toast(`🗨️ ${def.name}: ${def.lines[Math.floor(Math.random() * def.lines.length)]}`, '', 4200); closeSheet(); },
        bye: () => {
          closeSheet(); r.f += 2;
          const gift = def.gifts?.[0];
          if (gift && !gift.food) { S.inventory.ing = S.inventory.ing || {}; S.inventory.ing[gift.id] = (S.inventory.ing[gift.id] || 0) + 4; }
          bigMsg('🏠 집들이 끝!', `${def.name}: "다음에 우리 집에도 놀러 와요~"${gift && !gift.food ? ` · ${gift.icon} ${gift.name} 선물` : ''}`, 3200);
          S.nbVisit = null; this.dropGuest(); this.c.missions?.addXp?.(30); this.c.persist();
        },
      }),
    });
  }

  // ─ 동네 사건: 잃어버린 고양이 찾기 (전단지) ─
  ownerName() { return NB.find(n => n.id === this.cat?.owner)?.name || '주인'; }
  lostCatDaily() {
    const S = this.S, day = this.c.day(), e = this.c.home();
    if (!e) return;
    if (S.lostCat && S.lostCat.day !== day && !this.cat?.follow) S.lostCat = null;   // 하루 지나면 다른 사람이 찾았대요
    if (!S.lostCat && S.catCheck !== day) {
      S.catCheck = day;
      const R = seeded(day * 53 + 11);
      if (R() < 0.34) {
        const b = BREEDS.filter(q => q.kind === 'cat')[Math.floor(R() * 3)];
        const name = ['나비', '치즈', '모모', '루루', '까미', '호두'][Math.floor(R() * 6)];
        // 집에서 150~350m 떨어진 보도 어딘가
        const a = R() * Math.PI * 2, d = 150 + R() * 200;
        let x = e.x + Math.cos(a) * d, z = e.z + Math.sin(a) * d;
        const pt = this.c.sidewalkNear?.(x, z); if (pt) { x = pt.x; z = pt.z; }
        S.lostCat = { day, breed: b.id, name, x, z, owner: R() < 0.6 ? 'grandma' : 'kid', reward: 20000 };
        this.c.news?.('🐱', `고양이를 찾습니다 · ${b.name} "${name}"`, `${NB.find(n => n.id === S.lostCat.owner).name}네 고양이가 집을 나갔어요. 찾아 주시면 사례금 ${won(20000)}! (지도에 대략 위치 표시)`);
        toast(`🐱 동네 소식: ${b.name} "${name}"를 찾고 있대요 · 📱 뉴스`, '', 3600);
      }
    }
    // 고양이 모델 (근처에 갔을 때만)
    const lc = S.lostCat;
    if (lc && !this.cat) {
      const b = BREEDS.find(q => q.id === lc.breed);
      const m = petMesh(b); m.root.position.set(lc.x, 0.18, lc.z);
      this.c.scene.add(m.root);
      this.cat = { mesh: m, name: lc.name, owner: lc.owner, follow: false, t: 0 };
    } else if (!lc && this.cat) { this.c.scene.remove(this.cat.mesh.root); this.cat = null; }
  }
  updateCat(dt, focus) {
    const c = this.cat, r = c.mesh.root; c.t += dt;
    if (c.follow) {
      const p = this.c.player.pos, dx = p.x - r.position.x, dz = p.z - r.position.z, d = Math.hypot(dx, dz);
      if (d > 1.4) { const sp = Math.min(d - 1.2, 6 * dt * Math.max(1, d / 3)); r.position.x += dx / d * sp; r.position.z += dz / d * sp; r.rotation.y = Math.atan2(dx, dz); c.mesh.legs.forEach((l, i) => l.rotation.x = Math.sin(c.t * 12 + i * 1.6) * 0.5); }
      if (d > 40) { r.position.set(p.x - 1, 0.18, p.z - 1); }
      this.S.lostCat.x = r.position.x; this.S.lostCat.z = r.position.z;
    } else {
      // 가만히 앉아 꼬리 살랑
      c.mesh.tail.rotation.z = Math.sin(c.t * 3) * 0.4;
      c.mesh.head.rotation.y = Math.sin(c.t * 0.7) * 0.5;
    }
    r.visible = Math.hypot(focus.x - r.position.x, focus.z - r.position.z) < 160;
  }
  returnCat(o) {
    const S = this.S, lc = S.lostCat;
    S.money += lc.reward; this.c.flash?.(true); this.c.audio?.coin?.();
    const r = this.rel(o.def.id); r.f += 4;
    S.mood = ST.clamp(S.mood + 10);
    this.c.missions?.addXp?.(50);
    bigMsg(`🐱 ${lc.name}를 찾아 줬어요!`, `${o.def.name}: "정말 고마워요!" · 사례금 ${won(lc.reward)}`, 3200);
    this.c.scene.remove(this.cat.mesh.root); this.cat = null; S.lostCat = null;
    o.talk = 3;
    this.c.persist();
  }
  // 지도 표시용 (대략 위치)
  catHint() { const lc = this.S.lostCat; if (!lc || this.cat?.follow) return null; const R = seeded(lc.day); return { x: lc.x + (R() - 0.5) * 60, z: lc.z + (R() - 0.5) * 60, r: 45 }; }
  clear() { for (const [, o] of this.peds) this.c.scene.remove(o.root); this.peds.clear(); }
}

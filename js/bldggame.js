import * as THREE from 'three';
import { FloorView, homeVacant } from './floorview.js';
import { Lifts } from './elevator.js';
import { toWorldPt, toLocalPt, floorLabel, floorShort, tenantMap } from './bplan.js';
import { TYPES } from './tenants.js';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';
import { emojiSprite } from './mart.js';
import { $, toast, openSheet, closeSheet, sheetOpen, bindActs, row, fade, wait } from './ui.js';
import * as ST from './state.js';

// ───────── 건물 안 (2단계): 들어가기 · 층 · 엘리베이터 · 계단 · 보안 ─────────
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export function typeHours(type) { return TYPES[type]?.hours || [9, 21]; }
export function isOpenType(type, h, wd) {
  const T = TYPES[type]; if (!T) return true;
  if (T.off?.includes(wd)) return false;
  let [o, c] = T.hours;
  let hh = h; if (c > 24 && hh < c - 24) hh += 24;
  if (o === 0 && c === 24) return true;
  if (hh < o || hh >= c) return false;
  if (T.br && hh >= T.br[0] && hh < T.br[1]) return false;
  return true;
}
export function hoursLabel(type) {
  const T = TYPES[type]; if (!T) return '';
  const [o, c] = T.hours;
  const f = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  if (o === 0 && c === 24) return '24시간';
  return `${f(o)}~${f(c)}${T.br ? ` (브레이크 ${f(T.br[0])}~${f(T.br[1])})` : ''}${T.off ? ' · ' + T.off.map(d => '월화수목금토일'[d]).join('') + ' 휴무' : ''}`;
}
function randomLook(o = {}) { return { skin: pick(SKINS.slice(0, 6)), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick(SHOES), hairStyle: pick(['short', 'short', 'long', 'bun']), ...o }; }

export class BldgGame {
  constructor(ctx) {
    this.c = ctx;   // { S, city, scene, player, human, audio, enterSite, leaveSite, setRoom, setBusy, persist, passTime, shop(): ShopGame }
    this.B = null; this.view = null; this.lifts = null; this.n = 1;
    this.riding = null; this.npcs = []; this.gateOpen = 0; this.npcT = 5;
    this.anchor = new THREE.Group();
  }
  get S() { return this.c.S; }
  get active() { return !!this.B; }
  hour() { return ST.hour(this.S) % 24; }
  wd() { return (ST.day(this.S) - 1) % 7; }

  // ─ 도시: 문 앞 안내 ─
  doorLabel(d) {
    if (d.tenant) {
      const open = isOpenType(d.tenant.type, this.hour(), this.wd());
      return `${d.icon} ${open ? '들어가기' : '🔒 영업 준비 중'} · ${d.name}`;
    }
    if (d.vacant) return `🏷️ 빈 가게 둘러보기`;
    const B = this.c.city.bldgOf(d.spec);
    return `${d.icon} 들어가기 · ${d.name}${B.top > 1 ? ` (${B.top}층)` : ''}`;
  }
  // ─ 들어가기 (보안 확인) ─
  tryEnter(d) {
    const B = this.c.city.bldgOf(d.spec);
    if (d.tenant && !isOpenType(d.tenant.type, this.hour(), this.wd())) {
      openSheet({ icon: '🔒', title: `${d.name} · 영업 준비 중`, sub: TYPES[d.tenant.type]?.label || '', html: `<div class="row"><div class="ic">🕘</div><div class="info"><b>영업시간</b><span>${hoursLabel(d.tenant.type)}</span></div></div><p class="note">문 앞에 안내문이 붙어 있어요. 영업시간에 다시 와 주세요.</p>` });
      return;
    }
    // 상가 건물 로비: 새벽엔 닫혀요
    if (d.lobby && B.kind === 'shop' && (this.hour() >= 1 && this.hour() < 6)) { toast('🔒 건물 출입문이 잠겨 있어요 (01:00~06:00)', 'bad', 3200); return; }
    if (d.door?.secure && !this.hasCode(B)) return this.securitySheet(d, B);
    this.enter(d);
  }
  hasCode(B) { return !!(this.S.codes && this.S.codes[B.id]) || this.S.homeBldg === B.id; }
  securitySheet(d, B) {
    const S = this.S;
    openSheet({
      icon: '🔐', title: `${B.name} · 공동현관`, sub: '주민만 들어갈 수 있어요',
      html: `<p class="note">문이 잠겨 있어요. 주민이 아니면 호출하거나, 들어가는 사람을 따라가야 해요.</p>` +
        row({ icon: '🔢', title: '비밀번호 누르기', desc: '번호를 알면 바로 열려요', btn: '누르기', action: 'code' }) +
        row({ icon: '📞', title: '세대 호출', desc: '호수를 눌러서 인터폰으로 부탁해요', btn: '호출', action: 'call' }) +
        (B.kind !== 'villa' ? row({ icon: '👮', title: '경비실 호출', desc: '용건을 말하면 열어 줄 수도 있어요', btn: '호출', action: 'guard' }) : '') +
        row({ icon: '🚶', title: '주민 따라 들어가기', desc: '들어가는 사람을 기다렸다가 같이 (들킬 수도 있어요)', btn: '기다리기', action: 'tail' }),
      bind: (b) => bindActs(b, {
        code: () => this.keypad(d, B),
        call: () => {
          closeSheet();
          const r = Math.random();
          if (S.delivery && S.delivery.stage === 'drop' && Math.hypot(S.delivery.drop.x - d.x, S.delivery.drop.z - d.z) < 60) { toast('📞 "아 배달이요? 열어 드릴게요~" 띠리릭', 'good'); this.c.audio.play?.('door'); return this.enter(d); }
          if (r < 0.35) toast('📞 ...(대답이 없어요)', '', 2600);
          else if (r < 0.75) toast('📞 "누구세요? ...잘못 누르셨어요" 뚝', 'bad', 3000);
          else { toast('📞 "택배요? 네~ 열어 드릴게요" 띠리릭', 'good', 3000); this.c.audio.play?.('door'); this.enter(d); }
        },
        guard: () => {
          openSheet({
            icon: '👮', title: '경비실', sub: '"무슨 일로 오셨어요?"',
            html: row({ icon: '🏠', title: '집 보러 왔어요', desc: '부동산 예약이 있어야 해요', btn: '말하기', action: 'view' }) + row({ icon: '📦', title: '배달 왔어요', desc: '배달 중일 때만', btn: '말하기', action: 'deliv' }) + row({ icon: '🙋', title: '그냥 둘러보고 싶어요', desc: '', btn: '말하기', action: 'just' }),
            bind: (b2) => bindActs(b2, {
              view: () => { closeSheet(); if (S.viewing?.bid === B.id) { toast('👮 "아 부동산에서 연락 왔어요. 들어가세요~"', 'good'); this.enter(d); } else toast('👮 "부동산 예약 없으면 못 들어가요~"', 'bad', 3000); },
              deliv: () => { closeSheet(); if (S.delivery) { toast('👮 "배달이요? 들어가세요~"', 'good'); this.enter(d); } else toast('👮 "배달 물건이 안 보이는데요?"', 'bad'); },
              just: () => { closeSheet(); toast('👮 "주민 아니시면 곤란해요~"', 'bad'); },
            }),
          });
        },
        tail: async () => {
          closeSheet();
          this.c.setBusy(true);
          await fade(true);
          this.c.passTime(3 + Math.random() * 8, 'idle');
          await wait(500);
          const ok = Math.random() < 0.72;
          await fade(false);
          this.c.setBusy(false);
          if (ok) { toast('🚶 주민이 문을 열 때 같이 들어갔어요', 'good', 2800); this.enter(d); }
          else toast('🙅 주민: "여기 사세요? 처음 보는 분인데…" 문이 닫혔어요', 'bad', 3600);
        },
      }),
    });
  }
  keypad(d, B) {
    let code = '';
    const real = String(1000 + (B.id * 37) % 9000);
    const render = () => `<div style="text-align:center;font-size:28px;letter-spacing:8px;margin:6px 0 12px;font-variant-numeric:tabular-nums">${code.padEnd(4, '·')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(k => `<button class="btn gray" style="font-size:20px;padding:14px" data-act="k:${k}">${k}</button>`).join('')}</div>`;
    const open = () => openSheet({
      icon: '🔢', title: '공동현관 비밀번호', sub: '4자리 + #', html: render(),
      bind: (b) => bindActs(b, {
        k: (k) => {
          if (k === '*') { code = ''; return open(); }
          if (k === '#') {
            if (code === real) { closeSheet(); this.c.audio.play?.('door'); toast('🔓 띠리릭~ 문이 열렸어요', 'good'); this.enter(d); }
            else { this.c.audio.bad?.(); code = ''; toast('🔒 삐삐- 비밀번호가 틀렸어요', 'bad'); open(); }
            return;
          }
          if (code.length < 4) code += k; open();
        },
      }),
    });
    open();
  }

  // ─ 들어가기: 문 안쪽에 서요 ─
  enter(d) {
    const B = this.c.city.bldgOf(d.spec);
    if (this.B !== B) { this.lifts = new Lifts(B); }
    this.B = B; this.entryDoor = d;
    const door = d.door;
    // 문 바로 안쪽 (로컬)
    const nx = door.ax === 'x' ? 0 : -Math.sign(door.x), nz = door.ax === 'x' ? -Math.sign(door.z) : 0;
    let lx = door.x + nx * 0.9, lz = door.z + nz * 0.9;
    if (d.villa) { // 빌라: 계단실 안
      const v0 = new FloorView(B, 1, this.lifts);
      const st = v0.plan.rooms.find(r => r.kind === 'stairs');
      if (st) { lx = (st.x0 + st.x1) / 2; lz = (st.z0 + st.z1) / 2; }
      v0.dispose();
    }
    this.setupFloor(d.n || 1, { x: lx, z: lz, heading: Math.atan2(nx, nz) }, true);
    this.c.audio.play?.('door');
    if (!this.S.bldgTip) { this.S.bldgTip = true; setTimeout(() => toast('🏢 엘리베이터 앞에서 부르고, 안에서 층을 골라요 · 계단은 초록 비상구 표시'), 800); }
  }
  // 층 만들기 (place: 로컬 위치)
  setupFloor(n, place, first = false) {
    const B = this.B;
    if (this.view) { this.clearNpcs(); this.view.dispose(); this.c.shop?.()?.onExitBuilding?.(); }
    this.n = n; this.curUnit = null;
    const f = B.floorOf(n);
    const view = new FloorView(B, n, this.lifts, { myHome: this.S.homeUnit, company: this.c.company });
    this.view = view;
    // 아래층 덩어리 (창밖으로 내려다볼 때)
    const base = B.kind === 'tower' && n >= 4 ? B.spec.y0 : B.spec.y0;
    const hBelow = f.y - base;
    if (hBelow > 1.5 && !f.parking) {
      const col = B.spec.color || [0.75, 0.75, 0.74];
      const stub = new THREE.Mesh(new THREE.BoxGeometry(B.L - 0.6, hBelow - 0.35, B.D - 0.6), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(col[0], col[1], col[2], THREE.SRGBColorSpace), roughness: 0.8 }));
      stub.position.set(0, -(hBelow - 0.35) / 2 - 0.35, 0); view.root.add(stub);
    }
    // 바닥 슬래브 (아래가 비어 보이지 않게)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(B.L + 0.4, 0.3, B.D + 0.4), new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.9 }));
    slab.position.set(0, -0.16, 0); view.root.add(slab);
    this.anchor.position.set(B.cx, f.y + 0.03, B.cz);
    this.anchor.rotation.y = B.rot;
    this.anchor.add(view.root);
    if (!this.anchor.parent) this.c.scene.add(this.anchor);
    // 건물 겉모습 숨기기
    const hide = B.kind === 'tower' ? (n === 1 || f.parking ? [B.spec.podium] : [B.spec]) : [B.spec];
    if (B.kind === 'mall' && B.spec.towers && (n < 0)) hide.push(...B.spec.towers.filter(t => !t.site));
    this.c.city.setHidden(hide.filter(Boolean));
    const site = this.site || (this.site = { kind: 'bldg', anchor: this.anchor, inside: true });
    Object.assign(site, { rot: B.rot, x: B.cx, z: B.cz, W: B.L, D: B.D, toLocal: (wx, wz) => toLocalPt(B, wx, wz), toWorld: (lx, lz) => toWorldPt(B, lx, lz) });
    if (first) this.c.enterSite(site, view, place.x, place.z, place.heading);
    else { this.c.setRoom(view); if (place) { this.c.player.pos.set(place.x, 0, place.z); if (place.heading !== undefined) this.c.setHeading(place.heading); } }
    this.spawnNpcs();
    this.c.updateHUD?.(true);
  }
  // ─ 나가기 ─
  exit(door) {
    const p = this.c.player;
    if (door) {
      const nx = door.ax === 'x' ? 0 : Math.sign(door.x), nz = door.ax === 'x' ? Math.sign(door.z) : 0;
      p.pos.set(door.x + nx * 1.6, 0, door.z + nz * 1.6);
      this.c.setHeading(Math.atan2(nx, nz));
    }
    this.clearNpcs();
    this.riding = null;
    this.c.shop?.()?.onExitBuilding?.();
    if (this.c.shop?.()?.c.jobs?.onShift) this.c.shop().c.jobs.clockOut(true);
    const cr = this.c.career?.(); if (cr?.working && this.S.career && ST.hour(this.S) % 24 < this.S.career.end) { toast('🏃 일하다 말고 나왔어요… (조퇴 처리)', 'bad'); this.S.career.perf -= 1; cr.clockOut(); } else if (cr?.working) cr.clockOut();
    this.c.leaveSite();
    this.c.city.setHidden([]);
    if (this.view) { this.view.dispose(); this.view = null; }
    this.anchor.parent?.remove(this.anchor);
    this.B = null;
    this.c.audio.play?.('door');
  }

  // ─ 매 프레임 ─
  frame(dt, paused) {
    if (!this.B) return;
    const v = this.view, P = this.c.player.pos;
    v.buildPending?.(P.x, P.z, v.pending?.length > 6 ? 2 : 1);
    this.lifts.update(dt);
    v.updateLifts(dt, this.riding);
    // 엘리베이터 문 = 움직이는 콜라이더
    for (const e of v.elevVis) {
      const c = this.lifts.car(e.e.bank, e.e.car);
      const here = c && Math.abs(c.y - this.B.floorOf(this.n).y) < 0.05;
      if (e.col) e.col.open = here && c.door > 0.75;
      // 문 사이에 서 있으면 안 닫혀요
      if (c && here) { const dx = P.x - e.e.x, dz = P.z - e.e.z; c.blocked = Math.abs(e.along === 'x' ? dx : dz) < 0.6 && Math.abs(e.along === 'x' ? dz : dx) < 0.45; }
    }
    // 타고 있는 카가 다른 층에 도착 → 그 층으로
    if (this.riding) {
      const c = this.riding;
      if (c.state === 'opening' && c.n !== this.n && Math.abs(c.y - this.lifts.yOf(c.n)) < 0.02) {
        const lp = this.c.player.pos.clone();
        this.setupFloor(c.n, { x: lp.x, z: lp.z });
        this.c.audio.play?.('ding');
        toast(`🛗 ${floorLabel(c.n, this.B)}입니다`, '', 1800);
      }
      // 카 밖으로 나가면 내린 걸로
      const ev = v.elevVis.find(q => q.e.bank === c.bank && q.e.car === c.i);
      if (ev) { const b = ev.inside; if (P.x < b.x0 - 0.5 || P.x > b.x1 + 0.5 || P.z < b.z0 - 0.5 || P.z > b.z1 + 0.5) { c.player = false; this.riding = null; } }
    }
    // 게이트 (출입증 찍으면 잠깐 열림)
    if (this.gateOpen > 0) { this.gateOpen -= dt; if (this.gateOpen <= 0) for (const g of v.colliders) if (g.gate) g.open = false; }
    // 나가는 문으로 걸어가면 밖으로
    const z = v.zoneAt(P);
    if (z?.kind === 'exit' && !paused) {
      const d = z.door;
      const out = d.ax === 'x' ? Math.sign(d.z) * (P.z - d.z) : Math.sign(d.x) * (P.x - d.x);
      if (out > -0.25 && this.c.player.speed > 0.3) { this.exit(d); return; }
    }
    // 필로티 (빌라 1층): 건물 밖으로 걸어 나가면 도시로
    if (v.plan.exitOpen && (Math.abs(P.x) > this.B.L / 2 + 0.3 || Math.abs(P.z) > this.B.D / 2 + 0.3)) { this.exit(null); return; }
    // 가게를 떠나는지 (계산 안 하고 나가기 방지)
    const room = v.roomAt(P.x, P.z);
    const unit = room?.kind === 'unit' && !room.home ? room : null;
    if (unit !== this.curUnit) {
      const prev = this.curUnit;
      if (prev && this.c.shop?.()?.onLeaveUnit(prev) && this.lastIn) { P.copy(this.lastIn); }
      else this.curUnit = unit;
    }
    if (this.curUnit && unit === this.curUnit) this.lastIn = (this.lastIn || P.clone()).copy(P);
    this.updateNpcs(paused ? 0 : dt);
  }

  // ─ 상호작용 ─
  action() {
    if (!this.B) return null;
    const v = this.view, P = this.c.player.pos;
    const z = v.zoneAt(P);
    if (!z) return null;
    const ca = this.c.career?.()?.action(z, this); if (ca) return ca;
    const shop = this.c.shop?.();
    if (z.unit && shop) { const a = shop.action(z, this); if (a) return a; }
    const S = this.S, B = this.B;
    switch (z.kind) {
      case 'exit': return { label: '🚪 밖으로 나가기', fn: () => this.exit(z.door) };
      case 'elevcall': {
        const bk = B.banks.find(b => b.id === z.bank);
        if (!bk.serves.includes(this.n)) return { label: '🛗 이 층에는 서지 않아요', fn: () => toast(`${bk.name} 엘리베이터는 이 층에 서지 않아요`) };
        const cars = this.lifts.bank(z.bank).cars;
        const coming = cars.find(c => c.stops.has(this.n) || (c.n === this.n && c.door > 0));
        if (coming) return { label: `🛗 ${coming.door > 0.5 && coming.n === this.n ? '문이 열려 있어요 · 타세요' : `오는 중 · 지금 ${this.lifts.label(coming.n)}층`}`, fn: () => {} };
        return { label: `🛗 엘리베이터 부르기${bk.express ? ' (고층 직행)' : ''}`, fn: () => { const c = this.lifts.call(z.bank, this.n); this.c.audio.click?.(); if (c) toast(`🛗 ${this.lifts.label(c.n)}층에서 내려오는 중…`, '', 1800); }, green: true };
      }
      case 'car': {
        const c = this.lifts.car(z.e.bank, z.e.car);
        if (!c) return null;
        if (c.state === 'moving') return { label: `🛗 ${this.lifts.label(c.n)}층 ${c.dir > 0 ? '▲' : '▼'} 이동 중…`, fn: () => {} };
        return { label: '🔢 층 버튼 누르기', fn: () => this.panel(c), green: true };
      }
      case 'stairsUp': {
        if (z.roofLocked) return { label: '🔒 옥상 문이 잠겨 있어요', fn: () => toast('🔒 옥상 출입문은 잠겨 있어요 (화재 시 자동으로 열려요)', 'bad', 3000) };
        return { label: `🔼 계단으로 ${floorLabel(z.to, B)}`, fn: () => this.stairs(z.to, 1), green: true };
      }
      case 'stairsDown': return { label: `🔽 계단으로 ${floorLabel(z.to, B)}`, fn: () => this.stairs(z.to, -1), green: true };
      case 'homedoor': {
        const h = S.homeUnit;
        if (h && h.bid === B.id && h.n === this.n && h.k === z.unit.k) return { label: `🔑 우리 집 ${z.unit.num || ''} 들어가기`, fn: () => this.c.enterHome?.(), green: true };
        return { label: `🔔 ${z.unit.num || ''} 초인종 누르기`, fn: () => this.doorbell(z.unit) };
      }
      case 'homeview': return { label: '🏠 빈 집 둘러보기 · 매물 정보', fn: () => this.homeInfo(z.home) };
      case 'private': return { label: '🔒 주민 전용 (잠김)', fn: () => toast('🔒 주민 카드가 있어야 들어갈 수 있어요', 'bad') };
      case 'directory': return { label: '🗂️ 층별 안내 보기', fn: () => this.directory() };
      case 'mailbox': return { label: '📬 우편함', fn: () => this.mailbox() };
      case 'parcel': return { label: '📦 무인 택배함', fn: () => this.parcel() };
      case 'guard': return { label: '👮 경비 아저씨와 이야기', fn: () => this.talkGuard() };
      case 'concierge': return { label: '🛎️ 컨시어지', fn: () => toast(pick(['🛎️ "입주민 전용 라운지는 3층에 있어요"', '🛎️ "택배는 무인 택배함에 넣어 드렸어요"', '🛎️ "좋은 하루 보내세요~"'])) };
      case 'reception': if (!z.unit) return { label: '🛎️ 안내 데스크 · 방문 등록', fn: () => this.visitorDesk() }; break;
      case 'gates': return this.gateAction(z);
      case 'ticket': return { label: '🎫 번호표 뽑기', fn: () => toast(`🎫 대기번호 ${100 + Math.floor(Math.random() * 60)}번 · 앞에 ${2 + Math.floor(Math.random() * 6)}명`) };
      case 'civcounter': return { label: `🪪 ${z.num}번 창구`, fn: () => this.c.civic?.(z) || toast('🪪 "번호표 먼저 뽑아 주세요~"') };
      case 'wait': return null;
      case 'seat': if (z.food) return { label: '🍽 푸드코트 자리', fn: () => toast('🍽 근처 가게에서 음식을 사 와서 먹어요') }; break;
    }
    return null;
  }
  panel(c) {
    const B = this.B, bk = this.lifts.bank(c.bank);
    const access = (n) => this.c.floorAccess ? this.c.floorAccess(B, n) : true;
    const floors = [...bk.serves].sort((a, b) => b - a);
    const html = `<p class="note">${bk.name} · 지금 ${floorLabel(this.n, B)}</p><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${floors.map(n => {
      const ok = access(n), cur = n === this.n;
      return `<button class="btn ${cur ? 'green' : ok ? 'gray' : 'gray'}" style="padding:12px 4px;font-size:16px;${ok ? '' : 'opacity:.55'}" data-act="f:${n}">${ok ? '' : '🔒'}${floorShort(n, B)}</button>`;
    }).join('')}</div><button class="btn wide gray" style="margin-top:10px" data-act="open">◀▶ 열림</button>`;
    openSheet({
      icon: '🛗', title: '층 선택', sub: B.name, html,
      bind: (b) => bindActs(b, {
        f: (n) => {
          n = +n;
          if (!access(n)) { toast('🔒 출입증을 대야 갈 수 있는 층이에요', 'bad', 2600); return; }
          closeSheet();
          if (n === this.n) { this.lifts.openAt(c); return; }
          c.player = true; this.riding = c;
          this.lifts.press(c, n);
          c.hold = Math.min(c.hold, 1.0);
          this.c.audio.click?.();
          // 같이 탄 사람
          if (Math.random() < 0.4) this.rider(c);
        },
        open: () => { closeSheet(); this.lifts.openAt(c); },
      }),
    });
  }
  async stairs(to, dir) {
    if (this.busy) return;
    this.busy = true;
    this.c.setBusy(true);
    await fade(true);
    const floors = Math.abs(to - this.n) || 1;
    this.c.passTime(0.5 * floors, 'walk');
    if (dir > 0) this.S.energy = ST.clamp(this.S.energy - 0.5 * floors);
    this.c.audio.play?.('step');
    this.setupFloor(to, null);
    const sp = this.view.stairsSpot;
    if (sp) { this.c.player.pos.set(sp.x, 0, sp.z); this.c.setHeading(Math.atan2(sp.face[0], sp.face[1]) + Math.PI); }
    await wait(250);
    await fade(false);
    this.c.setBusy(false);
    this.busy = false;
    toast(`🚶 ${floorLabel(to, this.B)}${dir > 0 && floors > 0 ? ' · 헥헥' : ''}`, '', 1500);
  }
  doorbell(unit) {
    this.c.audio.play?.('ding');
    const r = Math.random();
    const lines = r < 0.4 ? ['...(아무도 없나 봐요)', '🐶 멍멍! (강아지만 짖어요)'] : r < 0.8 ? ['🗣 "누구세요? 우리 집에 올 사람 없는데요"', '🗣 "택배는 문 앞에 두고 가세요~"', '🗣 "지금 바빠서요, 다음에 오세요"'] : ['🗣 "아, 옆집 분이세요? 반가워요~"', '🗣 "혹시 저희 집 택배 잘못 가져가셨어요?"'];
    toast(pick(lines), '', 3200);
  }
  homeInfo(r) {
    const B = this.B;
    const py = Math.max(5, Math.round((r.x1 - r.x0) * (r.z1 - r.z0) * 0.85 / 3.3));
    const pr = this.c.homePrices(B.kind, py, B.grade), w2 = this.c.won2;
    openSheet({
      icon: '🏠', title: `${B.name} ${r.num || ''}`, sub: `약 ${py}평 · 지은 지 ${B.age}년 (${B.grade}등급) · 빈 집`,
      html: `<div class="grid2"><div class="stat"><span>월세</span><b>${w2(pr.deposit)} / ${w2(pr.rent)}</b></div><div class="stat"><span>전세</span><b>${w2(pr.jeonse)}</b></div><div class="stat"><span>매매</span><b>${w2(pr.buy)}</b></div><div class="stat"><span>관리비</span><b>월 ${w2(pr.fee)}</b></div></div><p class="note">계약은 동네 부동산에서 해요 (부동산 매물에 나오면 계약할 수 있어요).</p>`,
    });
  }
  // 우리 집(임대한 호실) 문 앞으로
  enterUnit(h) {
    const spec = this.c.city.bldgs.find(q => q.seed === h.bid);
    if (!spec) return;
    const B = this.c.city.bldgOf(spec);
    if (this.B !== B) this.lifts = new Lifts(B);
    this.B = B;
    this.entryDoor = this.c.city.bdoors.find(q => q.spec === spec && (q.door?.secure || q.lobby)) || this.c.city.bdoors.find(q => q.spec === spec);
    const p = new FloorView(B, h.n, this.lifts, { myHome: h }).plan; // 문 위치만
    const d = p.doors.find(q => q.unit && q.unit.k === h.k);
    let x = 0, z = 0, hd = 0;
    if (d) { const u = d.unit; const c = d.ax === 'x' ? Math.sign((u.z0 + u.z1) / 2 - d.z) : Math.sign((u.x0 + u.x1) / 2 - d.x); const nx = d.ax === 'x' ? 0 : -c, nz = d.ax === 'x' ? -c : 0; x = d.x + nx * 0.9; z = d.z + nz * 0.9; hd = Math.atan2(nx, nz); }
    this.setupFloor(h.n, { x, z, heading: hd }, true);
  }
  directory() {
    const rows = [];
    const tm = tenantMap(this.B);
    for (const f of [...this.B.floors].reverse()) {
      if (f.roof) continue;
      const names = []; for (const [k, t] of tm) { const [n] = k.split(':'); if (+n === f.n) names.push(t.vacant ? '🏷️ 임대 문의' : `${TYPES[t.type]?.icon || ''} ${t.name}`); }
      rows.push(`<div class="row"><div class="ic" style="font-weight:800">${floorShort(f.n, this.B)}</div><div class="info"><b>${f.parking ? '🅿️ 주차장' : names.join(' · ') || (this.B.residential ? '주거' : '-')}</b></div></div>`);
    }
    openSheet({ icon: '🗂️', title: `${this.B.name} 층별 안내`, sub: `지은 지 ${this.B.age}년`, html: rows.join('') });
  }
  mailbox() {
    if (this.S.homeBldg === this.B.id && this.c.mail) return this.c.mail();
    toast('📬 내 우편함이 아니에요', '', 2000);
  }
  parcel() {
    if (this.S.homeBldg === this.B.id && this.c.parcel) return this.c.parcel();
    toast('📦 주민만 쓸 수 있는 택배함이에요', '', 2200);
  }
  talkGuard() {
    toast(pick(['👮 "요즘 택배가 너무 많아서 정신이 없어요~"', '👮 "분리수거는 목요일이에요!"', '👮 "밤늦게 시끄러우면 민원 들어와요~"', '👮 "주차는 지하 2층이 더 넓어요"', '👮 "엘리베이터 점검은 매달 첫째 주 화요일이에요"']), '', 3400);
  }
  visitorDesk() {
    const S = this.S, B = this.B;
    const appt = S.appointments?.find(a => a.bid === B.id && Math.abs(a.at - S.minutes) < 120);
    openSheet({
      icon: '🛎️', title: '안내 데스크', sub: '"어떻게 오셨어요?"',
      html: (appt ? row({ icon: '📋', title: `${appt.label} (약속 있음)`, desc: '신분 확인 후 방문증을 드려요', btn: '방문증 받기', action: 'pass' }) : '') +
        row({ icon: '🙋', title: '그냥 구경하러 왔어요', desc: '', btn: '말하기', action: 'just' }) +
        row({ icon: '☕', title: '1층 카페는 누구나 이용 가능', desc: '로비 오른쪽', btn: '알겠어요', action: 'ok' }),
      bind: (b) => bindActs(b, {
        pass: () => { closeSheet(); S.visitPass = { bid: B.id, floor: appt.floor, until: S.minutes + 180 }; toast(`🪪 방문증을 받았어요 · ${appt.floor}층`, 'good'); },
        just: () => { closeSheet(); toast('🛎️ "죄송하지만 약속이 없으면 위층은 못 올라가세요"', 'bad', 3000); },
        ok: () => closeSheet(),
      }),
    });
  }
  gateAction(z) {
    const S = this.S, B = this.B;
    const emp = this.c.employedAt?.(B);
    const pass = S.visitPass && S.visitPass.bid === B.id && S.minutes < S.visitPass.until;
    if (z.inside) return { label: '🚪 게이트 지나가기 (나갈 때는 그냥)', fn: () => this.openGate(z.gate) };
    if (emp || pass) return { label: emp ? '🪪 사원증 찍기' : '🪪 방문증 찍기', fn: () => this.openGate(z.gate), green: true };
    return { label: '🪪 출입증이 필요해요', fn: () => toast('🚧 출입증이 없어요 · 안내 데스크에서 방문 등록을 하거나, 들어가는 사람 뒤에 붙어서…', '', 3600) };
  }
  openGate(g) {
    g.open = true; this.gateOpen = 3;
    for (const c of this.view.colliders) if (c.gate) c.open = true;
    this.c.audio.play?.('beep') || this.c.audio.click?.();
  }

  // ─ NPC ─
  clearNpcs() { for (const n of this.npcs) { n.p.root.parent?.remove(n.p.root); if (n.icon) n.icon.parent?.remove(n.icon); } this.npcs = []; }
  spawnNpcs() {
    const v = this.view, root = v.root;
    const h = this.hour(), wd = this.wd();
    const add = (look, x, z, rot, data = {}) => {
      if (this.npcs.length >= 11) return null;
      const p = createPed(randomLook(look));
      p.root.position.set(x, 0, z); p.root.rotation.y = rot;
      root.add(p.root);
      const n = { p, pos: p.root.position, ...data };
      if (data.sit) p.sit?.();
      this.npcs.push(n); return n;
    };
    for (const s of v.npcSpots) {
      const t = s.room?.tenant;
      if (s.kind === 'guard') { add({ shirt: 0x34495e, pants: 0x2c3e50, hair: 0x888888 }, s.x, s.z, s.rot, { role: 'guard' }); continue; }
      if (t && !t.vacant) {
        const open = isOpenType(t.type, h, wd);
        if (!open) continue;
        if (['staff', 'barista', 'cook', 'stylist', 'doctor', 'teacher'].includes(s.kind)) {
          if (s.kind !== 'staff' && s.kind !== 'barista' && Math.random() < 0.3) continue;
          add({ shirt: s.kind === 'doctor' ? 0xf4f4f4 : parseInt((t.color || '#444444').slice(1), 16) }, s.x, s.z, s.rot, { role: s.kind, unit: s.room });
        } else if (s.kind === 'seat' && Math.random() < 0.14 && this.npcs.filter(q => q.role === 'customer').length < 5) add({}, s.x, s.z, s.rot, { role: 'customer', sit: true, unit: s.room });
        else if (s.kind === 'worker' && Math.random() < 0.7) add({ shirt: pick([0xf2f2f2, 0x2a3f6a, 0x7a8a9a]) }, s.x, s.z, s.rot, { role: 'worker', sit: true });
      } else if (s.kind === 'staff' && !t) add({ shirt: 0x2a3a52 }, s.x, s.z, s.rot, { role: 'staff' });
    }
  }
  rider(c) {
    const ev = this.view.elevVis.find(q => q.e.bank === c.bank && q.e.car === c.i);
    if (!ev) return;
    const b = ev.inside;
    const n = createPed(randomLook());
    const x = b.x0 + 0.3 + Math.random() * (b.x1 - b.x0 - 0.6), z = b.z0 + 0.3 + Math.random() * (b.z1 - b.z0 - 0.6);
    n.root.position.set(x, 0, z); n.root.rotation.y = Math.atan2(ev.e.face[0], ev.e.face[1]);
    this.view.root.add(n.root);
    this.npcs.push({ p: n, pos: n.root.position, role: 'rider', car: c, until: 6 + Math.random() * 20 });
  }
  updateNpcs(dt) {
    for (const n of this.npcs) {
      if (n.role === 'walker' && n.path?.length) {
        const [tx, tz] = n.path[0];
        const dx = tx - n.pos.x, dz = tz - n.pos.z, d = Math.hypot(dx, dz);
        const sp = 1.2 * dt;
        if (d < sp) { n.pos.x = tx; n.pos.z = tz; n.path.shift(); if (n.onPoint) n.onPoint(n); }
        else { n.pos.x += dx / d * sp; n.pos.z += dz / d * sp; n.p.root.rotation.y = Math.atan2(dx, dz); }
        n.p.animate(dt, 1.2);
        if (!n.path.length) n.dead = true;
      } else if (!n.sit) n.p.animate(dt, 0);
      if (n.role === 'rider') { n.until -= dt; if (n.until <= 0 && n.car?.door > 0.9) n.dead = true; }
    }
    for (const n of this.npcs.filter(q => q.dead)) { n.p.root.parent?.remove(n.p.root); this.npcs.splice(this.npcs.indexOf(n), 1); }
    // 오피스 1층: 출근하는 사람 (게이트 통과 → 따라 들어가기 기회)
    this.npcT -= dt;
    if (this.npcT <= 0 && this.B.kind === 'office' && this.n === 1) {
      this.npcT = 14 + Math.random() * 16;
      const ex = this.view.plan.doors.find(d => d.exit);
      const gate = this.view.plan.feats.find(f => f.kind === 'gates');
      if (ex && gate) {
        const n = createPed(randomLook({ shirt: pick([0xf2f2f2, 0x1f3a6a, 0x2a2a2a]) }));
        n.root.position.set(ex.x, 0, ex.z - Math.sign(ex.z) * 0.8); this.view.root.add(n.root);
        const gx = gate.x, gz = gate.z;
        const w = { p: n, pos: n.root.position, role: 'walker', path: [[gx + Math.sign(gx) * 1.4, gz + 0.5], [gx - Math.sign(gx) * 1.2, gz + 0.5], [0, 0]] };
        w.onPoint = (q) => { if (q.path.length === 1) { this.openGate({}); toast('🚶 직원이 사원증을 찍고 게이트를 지나가요', '', 1600); } };
        this.npcs.push(w);
      }
    }
  }

  // ─ HUD ─
  hudText() {
    if (!this.B) return '';
    const B = this.B, P = this.c.player.pos;
    const r = this.view.roomAt(P.x, P.z);
    const t = r?.tenant;
    if (t && !t.vacant) {
      const open = isOpenType(t.type, this.hour(), this.wd());
      const extra = this.c.shop?.()?.hud?.(r, t) || '';
      return `${TYPES[t.type]?.icon || '🏪'} <b>${t.name}</b> · ${floorLabel(this.n, B)}<small>${extra || (open ? `영업 중 · ${hoursLabel(t.type)}` : '🔒 영업 준비 중 · ' + hoursLabel(t.type))}</small>`;
    }
    if (r?.kind === 'unit' && r.home) return `🏠 <b>${r.num || ''}</b> · 빈 집<small>${B.name}</small>`;
    return `🏢 <b>${B.name}</b> · ${floorLabel(this.n, B)}<small>${this.riding ? '🛗 엘리베이터 안' : r?.kind === 'stairs' ? '🚶 비상계단' : r?.kind === 'parking' ? '🅿️ 지하 주차장' : this.view.plan.roof ? '🌇 옥상' : B.residential ? '주거 건물' : '상가 건물'}</small>`;
  }
}

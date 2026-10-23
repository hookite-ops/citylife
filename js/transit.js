// ───────── 7단계: 대중교통 (버스 · 지하철 · 공공자전거 · 전동킥보드) + 탈것 연출 ─────────
import * as THREE from 'three';
import { GB, seeded } from './geo.js';
import { ROADS, ROAD, N, won, nearestRoad, nodeExists } from './config.js';
import { toast, openSheet, closeSheet, bindActs, row, wait } from './ui.js';
import * as ST from './state.js';

const Y0 = 0.18;
const STATIONS = [
  [3, 3, '한빛중앙역'], [6, 2, '시청역'], [9, 3, '테크밸리역'], [10, 7, '푸른숲역'],
  [8, 10, '호수공원역'], [4, 10, '한빛대역'], [2, 7, '새솔역'], [6, 8, '레이크몰역'],
];
export const FARE = { bus: 1500, subway: 1450, bike: 1000, scooterUnlock: 1000, scooterMin: 150 };

// 탈것 연출 화면 (버스·지하철·택시)
let rideStyle = false;
function ensureStyle() {
  if (rideStyle) return; rideStyle = true;
  const st = document.createElement('style');
  st.textContent = `
  #ride{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0d1218;color:#fff;font-family:inherit;opacity:0;transition:opacity .35s}
  #ride.on{opacity:1}
  #ride .rd-win{position:relative;width:min(92vw,560px);height:min(34vh,220px);border-radius:22px;overflow:hidden;border:6px solid #2b333c;background:linear-gradient(#8ec5ff,#cfe8ff 60%,#7d8a94 60%)}
  #ride.night .rd-win{background:linear-gradient(#0b1430,#1a2a55 60%,#2a2f36 60%)}
  #ride.subway .rd-win{background:linear-gradient(#1a1f26,#2c333b 45%,#151a20 46%)}
  #ride .rd-strip{position:absolute;left:0;bottom:40%;height:46%;width:400%;display:flex;align-items:flex-end;gap:18px;animation:rideScroll 3.2s linear infinite}
  #ride .rd-strip i{display:block;flex:0 0 auto;background:#5d6b78;border-radius:3px 3px 0 0;opacity:.85}
  #ride.night .rd-strip i{background:#2c3646;box-shadow:inset 0 0 0 2px #e8c35a22}
  #ride.subway .rd-strip i{background:#ffd34d;height:4px!important;width:60px!important;border-radius:2px;margin-bottom:30%;opacity:.6}
  @keyframes rideScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  #ride .rd-bar{width:min(92vw,560px);background:#1b232c;border-radius:16px;padding:12px 16px;box-sizing:border-box}
  #ride .rd-bar b{font-size:18px} #ride .rd-bar small{display:block;color:#9fb0c0;margin-top:4px;font-size:13px}
  #ride .rd-stops{display:flex;gap:6px;align-items:center;margin-top:10px;overflow:hidden}
  #ride .rd-stops span{flex:1;min-width:0;text-align:center;font-size:12px;color:#8a99a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;padding-top:14px}
  #ride .rd-stops span:before{content:'';position:absolute;top:2px;left:50%;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#3a4652}
  #ride .rd-stops span.on{color:#fff;font-weight:700} #ride .rd-stops span.on:before{background:var(--lc,#46d1ff);box-shadow:0 0 0 4px #46d1ff33}
  #ride .rd-stops span.done:before{background:var(--lc,#46d1ff)}
  #ride .rd-ann{font-size:16px;color:#ffd34d;min-height:22px;text-align:center}`;
  document.head.appendChild(st);
}
export async function playRide({ kind = 'bus', title = '', sub = '', stops = [], color = '#2f6fd6', night = false, sec = 4, mid = null }) {
  ensureStyle();
  const el = document.createElement('div'); el.id = 'ride';
  el.className = (kind === 'subway' ? 'subway ' : '') + (night ? 'night' : '');
  const blds = Array.from({ length: 40 }, (_, i) => `<i style="width:${20 + (i * 37) % 40}px;height:${30 + (i * 53) % 70}%"></i>`).join('');
  const icon = kind === 'subway' ? '🚇' : kind === 'taxi' ? '🚕' : '🚌';
  const list = stops.slice(0, 6);
  el.innerHTML = `<div class="rd-win"><div class="rd-strip">${blds}${blds}</div></div>
    <div class="rd-bar" style="--lc:${color}"><b>${icon} ${title}</b><small>${sub}</small><div class="rd-stops">${list.map(s => `<span>${s}</span>`).join('')}</div></div>
    <div class="rd-ann"></div>`;
  document.body.appendChild(el);
  await wait(30); el.classList.add('on');
  const spans = el.querySelectorAll('.rd-stops span'), ann = el.querySelector('.rd-ann');
  const per = (sec * 1000) / Math.max(1, list.length);
  for (let i = 0; i < list.length; i++) {
    spans.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); });
    ann.textContent = kind === 'taxi' ? (i === list.length - 1 ? '🚕 "다 왔습니다~"' : `🚕 ${list[i]} 지나는 중…`) : i === list.length - 1 ? `🔔 이번 ${kind === 'subway' ? '역' : '정류장'}은 ${list[i]}입니다. 내리실 문은 오른쪽입니다` : `다음 ${kind === 'subway' ? '역' : '정류장'}은 ${list[i + 1] || ''}입니다`;
    await wait(per);
    if (i === 0 && mid) { try { await mid(); } catch (e) { console.error(e); } }
  }
  if (!list.length && mid) await mid();
  el.classList.remove('on'); await wait(350); el.remove();
}

function bikeMesh(scooter) {
  const g = new GB();
  if (scooter) {
    g.setColor(0x1aa39a); g.cbox(0, 0.14, 0, 0.18, 0.06, 0.95);
    g.setColor(0x2a2e33); g.cbox(0, 0.62, 0.42, 0.05, 1.0, 0.05); g.cbox(0, 1.1, 0.42, 0.55, 0.04, 0.04);
    g.setColor(0x151515);
    for (const z of [-0.45, 0.48]) { const w = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12); w.rotateZ(Math.PI / 2); g.addGeo(w, new THREE.Matrix4().makeTranslation(0, 0.11, z)); }
  } else {
    g.setColor(0x151515);
    for (const z of [-0.52, 0.52]) { const w = new THREE.TorusGeometry(0.32, 0.035, 6, 18); w.rotateY(Math.PI / 2); g.addGeo(w, new THREE.Matrix4().makeTranslation(0, 0.34, z)); }
    g.setColor(0x2fae5a);
    g.rbox(0, 0.55, 0, 0.06, 0.06, 0.95, 0); g.cbox(0, 0.5, -0.18, 0.06, 0.4, 0.06); g.cbox(0, 0.7, 0.42, 0.06, 0.6, 0.06);
    g.setColor(0xf2f2ee); g.cbox(0, 0.36, -0.3, 0.05, 0.05, 0.5); g.cbox(0, 0.36, 0.3, 0.05, 0.05, 0.5);
    g.setColor(0x222222); g.cbox(0, 0.78, -0.2, 0.18, 0.06, 0.26); g.cbox(0, 1.0, 0.42, 0.58, 0.04, 0.04);
    g.setColor(0x2fae5a); g.cbox(0, 0.92, 0.62, 0.32, 0.2, 0.24);
  }
  const m = new THREE.Mesh(g.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }));
  m.castShadow = true;
  return m;
}

export class Transit {
  constructor(ctx) { this.c = ctx; this.riding = null; this.stops = []; this.stations = []; this.docks = []; this.scooters = []; }
  get S() { return this.c.S; }
  setup() {
    const city = this.c.city;
    this.group = new THREE.Group(); this.c.scene.add(this.group);
    // 버스 정류장 이름 · 노선
    const named = new Map();
    for (const st of city.busStops || []) {
      let best = null, bd = 90;
      for (const s of city.bldgs) { if (!s.bname) continue; const d = Math.hypot((s.x0 + s.x1) / 2 - st.x, (s.z0 + s.z1) / 2 - st.z); if (d < bd) { bd = d; best = s; } }
      let nm = best ? best.bname.replace(/ \d+차$/, '') : '한빛신도시';
      const n = named.get(nm) || 0; named.set(nm, n + 1);
      st.name = n ? `${nm}${n === 1 ? ' 건너편' : ` ${n + 1}`}` : nm;
      const k = nearestRoad(st.c);
      st.line = String((st.axis === 'z' ? 100 : 500) + k * 10 + (k % 3) + 1);
      st.color = st.axis === 'z' ? '#2f6fd6' : '#3aa655';
      this.stops.push(st);
    }
    // 지하철역 입구 (교차로 모퉁이 보도)
    const eg = new GB(), sg = new GB();
    for (const [a, b, name] of STATIONS) {
      if (!nodeExists(a, b)) continue;
      const x = ROADS[a] + ROAD / 2 + 2.3, z = ROADS[b] + ROAD / 2 + 7.5;
      this.stations.push({ a, b, name, x, z: z - 3.4, cx: x, cz: z });
      eg.setColor(0x2a2e33); eg.cbox(x, Y0 + 1.25, z + 2.4, 2.4, 2.5, 0.12); eg.cbox(x - 1.2, Y0 + 1.25, z, 0.1, 2.5, 4.8); eg.cbox(x + 1.2, Y0 + 1.25, z, 0.1, 2.5, 4.8);
      eg.setColor(0x9ac4d9); eg.cbox(x, Y0 + 2.55, z, 2.6, 0.1, 5.0);
      eg.setColor(0x6d737a); for (let k = 0; k < 6; k++) eg.cbox(x, Y0 - 0.1 - k * 0.18 + 0.12, z - 1.6 + k * 0.6, 2.2, 0.06, 0.6);
      eg.setColor(0x2a2e33); eg.cbox(x - 1.6, Y0 + 1.4, z - 2.6, 0.12, 2.8, 0.12);
      sg.setColor(0xf2f2ee); sg.cbox(x - 1.6, Y0 + 3.0, z - 2.6, 0.9, 0.9, 0.08);
      sg.setColor(0x1f7a3f); sg.cbox(x - 1.6, Y0 + 3.0, z - 2.55, 0.7, 0.7, 0.08);
      city.colliders.push({ x0: x - 1.3, x1: x + 1.3, z0: z - 1.8, z1: z + 2.5, h: 2.6 });
    }
    const em = new THREE.Mesh(eg.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 }));
    const sm = new THREE.Mesh(sg.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    em.castShadow = true; this.group.add(em, sm);
    // 공공자전거 대여소 (정류장 세 곳 중 한 곳)
    const dg = new GB();
    this.stops.forEach((st, i) => {
      if (i % 3) return;
      const along = 8;
      const x = st.axis === 'z' ? st.x : st.x + along, z = st.axis === 'z' ? st.z + along : st.z;
      this.docks.push({ x, z, axis: st.axis, name: st.name, bikes: 4 + (i % 4) });
      dg.setColor(0x2fae5a);
      if (st.axis === 'z') { dg.cbox(x, Y0 + 0.4, z, 0.12, 0.8, 4.2); dg.cbox(x, Y0 + 1.1, z - 2.2, 0.5, 1.4, 0.2); }
      else { dg.cbox(x, Y0 + 0.4, z, 4.2, 0.8, 0.12); dg.cbox(x - 2.2, Y0 + 1.1, z, 0.2, 1.4, 0.5); }
    });
    this.group.add(new THREE.Mesh(dg.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })));
    // 자전거들 (인스턴스)
    const bm = bikeMesh(false);
    const total = this.docks.reduce((a, d) => a + d.bikes, 0);
    this.bikeInst = new THREE.InstancedMesh(bm.geometry, bm.material, total + 4);
    this.bikeInst.castShadow = true;
    this.group.add(this.bikeInst);
    this.layoutBikes();
    // 킥보드 (매일 위치가 바뀜)
    const km = bikeMesh(true);
    this.scootInst = new THREE.InstancedMesh(km.geometry, km.material, 60);
    this.group.add(this.scootInst);
    this.scootDay = -1;
    this.rideMesh = { bike: bikeMesh(false), scooter: bikeMesh(true) };
  }
  layoutBikes() {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const d of this.docks) for (let k = 0; k < d.bikes; k++) {
      const off = -1.6 + k * 0.75;
      if (d.axis === 'z') { v.set(d.x - 0.5, Y0, d.z + off); e.set(0, Math.PI / 2, 0); } else { v.set(d.x + off, Y0, d.z - 0.5); e.set(0, 0, 0); }
      q.setFromEuler(e); m4.compose(v, q, one); this.bikeInst.setMatrixAt(i++, m4);
    }
    this.bikeInst.count = i; this.bikeInst.instanceMatrix.needsUpdate = true;
  }
  layoutScooters() {
    const day = ST.day(this.S); if (day === this.scootDay) return; this.scootDay = day;
    const R = seeded(day * 37 + 11);
    this.scooters = [];
    for (const st of this.stops) {
      if (R() > 0.35 || this.scooters.length >= 60) continue;
      const a = (R() - 0.5) * 14;
      const x = st.axis === 'z' ? st.x + st.nx * -0.6 : st.x + a, z = st.axis === 'z' ? st.z + a : st.z + st.nz * -0.6;
      this.scooters.push({ x, z, rot: R() * 6.28 });
    }
    this.drawScooters();
  }
  drawScooters() {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    this.scooters.forEach((s, i) => { e.set(0, s.rot, 0.0); q.setFromEuler(e); m4.compose(v.set(s.x, Y0, s.z), q, one); this.scootInst.setMatrixAt(i, m4); });
    this.scootInst.count = this.scooters.length; this.scootInst.instanceMatrix.needsUpdate = true;
  }
  near(list, p, r) { let best = null, bd = r; for (const o of list) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; best = o; } } return best; }
  nearestStop(x, z) { return this.near(this.stops, { x, z }, 1e9); }
  nearestStation(x, z) { return this.near(this.stations, { x, z }, 1e9); }
  fare(kind) { return Math.max(0, FARE[kind] - (this.S.mayor?.pledge === 'fare' ? 300 : 0)); }

  // ─ 버튼 ─
  action(p) {
    if (this.riding) {
      const r = this.riding;
      if (r.kind === 'bike') { const d = this.near(this.docks, p, 4); if (d) return { label: '🚲 자전거 반납하기', fn: () => this.endRide(d), green: true }; return null; }
      return { label: `🛴 킥보드 반납 (${won(this.scootCost())})`, fn: () => this.endRide(null), green: false };
    }
    const sc = this.near(this.scooters, p, 1.8);
    if (sc) return { label: `🛴 전동킥보드 타기 · 잠금해제 ${won(FARE.scooterUnlock)}`, fn: () => this.startRide('scooter', sc) };
    const d = this.near(this.docks, p, 2.8);
    if (d) return { label: `🚲 공공자전거 빌리기 · 1시간 ${won(this.S.mayor?.pledge === 'bike' ? 0 : FARE.bike)}`, fn: () => this.startRide('bike', d) };
    const s = this.near(this.stations, p, 3.6);
    if (s) return { label: `🚇 ${s.name} · 지하철 타기`, fn: () => this.subwaySheet(s) };
    const b = this.near(this.stops, p, 3.2);
    if (b) return { label: `🚏 ${b.name} 정류장 · 버스 타기`, fn: () => this.busSheet(b) };
    return null;
  }
  // ─ 교통카드 (환승 할인) ─
  tap(kind) {
    const S = this.S;
    const transfer = S.lastTap && S.minutes - S.lastTap.t < 40 && S.lastTap.kind !== kind;
    const fare = transfer ? 0 : this.fare(kind);
    if (fare > 0) {
      if (S.money >= fare) S.money -= fare;
      else if ((S.cash || 0) >= fare + 100) S.cash -= fare + 100;
      else { this.c.audio.bad(); toast(`💳 잔액이 부족해요 (${won(fare)})`, 'bad'); return false; }
    }
    S.lastTap = { t: S.minutes, kind };
    this.c.audio.play?.('pay');
    toast(transfer ? '💳 삑! 환승입니다 (무료)' : `💳 삑! ${won(fare)}`, '', 2000);
    this.c.flash?.(false);
    return true;
  }
  destList(from) {
    const out = [], seen = new Set();
    for (const e of this.c.places()) { const k = e.name; if (seen.has(k)) continue; seen.add(k); out.push({ ...e, d: Math.hypot(e.x - from.x, e.z - from.z) }); }
    return out.filter(e => e.d > 120).sort((a, b) => a.d - b.d);
  }
  pickDest(title, sub, icon, from, onPick, extra = '', acts = {}) {
    const list = this.destList(from).slice(0, 24);
    openSheet({
      icon, title, sub,
      html: extra + list.map((e, k) => row({ icon: e.icon, title: e.name, desc: `${(e.d / 1000).toFixed(1)}km`, btn: '가기', action: 'go:' + k })).join(''),
      bind: (b) => bindActs(b, { go: (k) => { closeSheet(); onPick(list[+k]); }, ...acts }),
    });
  }
  busSheet(st) {
    const wait = 2 + Math.floor(seeded(Math.floor(this.S.minutes / 10) + st.u)() * 9);
    this.pickDest(`🚏 ${st.name}`, `${st.line}번 · 다음 버스 ${wait}분 후 · 요금 ${won(this.fare('bus'))}`, '🚌', st, (dest) => this.rideBus(st, dest, wait),
      '<p class="note">어디로 갈까요? 목적지와 가장 가까운 정류장에서 내려요.</p>');
  }
  subwaySheet(sta) {
    this.pickDest(`🚇 ${sta.name}`, `한빛선 · 2~4분 간격 · 요금 ${won(this.fare('subway'))}`, '🚇', sta, (dest) => this.rideSubway(sta, dest),
      `<p class="note">빠르지만 역에서 조금 걸어야 해요.</p>` + this.stations.map((s, i) => s === sta ? '' : row({ icon: '🚇', title: s.name, desc: `${(Math.hypot(s.x - sta.x, s.z - sta.z) / 1000).toFixed(1)}km`, btn: '가기', action: 'st:' + i })).join(''),
      { st: (i) => { const s = this.stations[+i]; closeSheet(); this.rideSubway(sta, { name: s.name, x: s.x, z: s.z, icon: '🚇', station: true }); } });
  }
  between(list, a, b, n) {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const c = list.map(s => ({ s, t: ((s.x - a.x) * dx + (s.z - a.z) * dz) / L2, off: Math.abs((s.x - a.x) * dz - (s.z - a.z) * dx) / Math.sqrt(L2) })).filter(o => o.t > 0.05 && o.t < 0.95 && o.off < 260).sort((p, q) => p.t - q.t);
    const step = Math.max(1, Math.floor(c.length / n));
    return c.filter((_, i) => i % step === 0).slice(0, n).map(o => o.s.name);
  }
  async rideBus(st, dest, waitMin) {
    const to = this.nearestStop(dest.x, dest.z);
    if (to === st) { toast('🚶 걸어가는 게 더 빨라요'); return; }
    if (!this.tap('bus')) return;
    const d = Math.hypot(to.x - st.x, to.z - st.z) * 1.25;
    const minutes = waitMin + d / 250;
    this.c.setBusy(true);
    const names = [...this.between(this.stops, st, to, 4), to.name];
    await playRide({ kind: 'bus', title: `${st.line}번 버스`, sub: `${st.name} → ${to.name} · 약 ${Math.round(minutes)}분`, stops: names, color: st.color, night: this.c.night() > 0.5, sec: 3.6 + Math.min(2, d / 2000),
      mid: () => { this.c.passTime(minutes, 'idle'); this.c.teleport(to.x + to.nx * 1.5, to.z + to.nz * 1.5, Math.atan2(-to.nx, -to.nz)); } });
    this.c.setBusy(false);
    this.arrive(to.name, dest);
  }
  async rideSubway(sta, dest) {
    const to = this.nearestStation(dest.x, dest.z);
    if (to === sta) { toast('🚶 같은 역 근처예요. 걸어가요'); return; }
    if (!this.tap('subway')) return;
    const d = Math.hypot(to.x - sta.x, to.z - sta.z) * 1.15;
    const minutes = 5 + d / 650;
    this.c.setBusy(true);
    const names = [...this.between(this.stations, sta, to, 3), to.name];
    await playRide({ kind: 'subway', title: '한빛선', sub: `${sta.name} → ${to.name} · 약 ${Math.round(minutes)}분`, stops: names, color: '#1f7a3f', sec: 3.2,
      mid: () => { this.c.passTime(minutes, 'idle'); this.c.teleport(to.x, to.z - 1.4, Math.PI); } });
    this.c.setBusy(false);
    this.arrive(to.name, dest);
  }
  arrive(where, dest) {
    const S = this.S, p = this.c.player.pos;
    const left = Math.round(Math.hypot(dest.x - p.x, dest.z - p.z));
    if (!dest.station && left > 15) { S.waypoint = { x: dest.x, z: dest.z, name: dest.name }; toast(`🚏 ${where}에서 내렸어요 · ${dest.name}까지 걸어서 ${left}m (길안내 켰어요)`, 'good', 3600); }
    else toast(`🚏 ${where}에 도착했어요`, 'good');
    this.c.missions?.event?.('transit');
    this.c.persist();
  }

  // ─ 자전거 · 킥보드 ─
  startRide(kind, from) {
    const S = this.S;
    if (kind === 'bike') {
      if (from.bikes <= 0) { toast('🚲 남은 자전거가 없어요'); return; }
      const fee = S.mayor?.pledge === 'bike' ? 0 : FARE.bike;
      if (fee && !this.payCard(fee, '🚲 공공자전거 1시간')) return;
      from.bikes--; this.layoutBikes();
    } else {
      if (!this.payCard(FARE.scooterUnlock, '🛴 킥보드 잠금해제')) return;
      this.scooters.splice(this.scooters.indexOf(from), 1); this.drawScooters();
    }
    this.riding = { kind, start: S.minutes, speed: kind === 'bike' ? 6.6 : 7.4 };
    const m = this.rideMesh[kind]; this.c.human.root.add(m);
    this.c.human.setPose(kind === 'bike' ? 'bike' : 'scoot');
    toast(kind === 'bike' ? '🚲 출발! 1시간 안에 아무 대여소에 반납해요 (차도 조심)' : `🛴 출발! 분당 ${won(FARE.scooterMin)} · 아무 데서나 반납해요`, 'good', 3200);
  }
  payCard(fee, what) {
    const S = this.S;
    if (S.money >= fee) { S.money -= fee; this.c.flash?.(false); toast(`💳 ${what} ${won(fee)}`, '', 2000); return true; }
    this.c.audio.bad(); toast(`💳 카드 잔액이 부족해요 (${won(fee)})`, 'bad'); return false;
  }
  scootCost() { return Math.ceil(Math.max(1, this.S.minutes - this.riding.start)) * FARE.scooterMin; }
  endRide(dock, auto = false) {
    const r = this.riding; if (!r) return;
    const S = this.S, p = this.c.player.pos;
    this.c.human.root.remove(this.rideMesh[r.kind]);
    this.c.human.setPose('stand');
    this.riding = null;
    if (r.kind === 'bike') {
      const over = Math.max(0, S.minutes - r.start - 60), fee = Math.ceil(over / 30) * 1000;
      if (fee) { S.money -= fee; toast(`🚲 초과 요금 ${won(fee)}`, 'bad'); }
      const d = dock || this.near(this.docks, p, 1e9); d.bikes++; this.layoutBikes();
      toast(auto ? `🚲 자전거는 ${d.name} 대여소에 반납됐어요` : '🚲 반납 완료!', 'good');
    } else {
      const fee = Math.ceil(Math.max(1, S.minutes - r.start)) * FARE.scooterMin;
      S.money -= fee; this.c.flash?.(false);
      if (!auto && this.c.city.onRoad(p.x, p.z)) toast('🛴 차도에 세우면 안 돼요! 보도에 세웠어요', 'bad');
      this.scooters.push({ x: p.x, z: p.z, rot: this.c.player.heading }); this.drawScooters();
      toast(`🛴 반납 완료 · ${won(fee)}`, 'good');
    }
    this.c.persist();
  }
  update(dt) {
    this.layoutScooters();
    if (this.riding && this.c.mode() !== 'city') this.endRide(null, true);
  }
  speed() { return this.riding?.speed || 0; }
}

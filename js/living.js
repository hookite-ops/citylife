// ───────── 7단계: 살아있는 도시 (계절 · 감기 · 사람들의 하루 · 사고와 화재 · 가게 개업·폐업 · 뉴스 · 선거) ─────────
import * as THREE from 'three';
import { GB, seeded } from './geo.js';
import { ROADS, ROAD, N, LANE2, STOP, won, nearestRoad, hasEdge } from './config.js';
import { toast, openSheet, closeSheet, bindActs, row, bigMsg } from './ui.js';
import { seasonOf, tempAt, forecast, dayTemps, yearOf, dayInSeason, seasonIdx, YEAR_DAYS } from './weather.js';
import { buildCarMesh } from './vehicles.js';
import { tenantMap, clearTenants } from './bplan.js';
import { OVERRIDES, unitKey, TYPES, SHOP_NAMES, NAMES_BY_TYPE } from './tenants.js';
import * as ST from './state.js';

const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
const Y0 = 0.18;

// 계절별 나뭇잎 · 잔디 색 (곱하기)
const LEAF = { spring: [1.15, 1.0, 1.08], summer: [0.82, 1.02, 0.78], autumn: [4.5, 1.1, 0.2], winter: [1.6, 0.95, 0.55] };
const LEAF_EM = { spring: [0, 0, 0], summer: [0, 0, 0], autumn: [0.12, 0.035, 0], winter: [0.02, 0.015, 0.005] };
const GRASS = { spring: 0xd2f8a0, summer: 0xb4ec8a, autumn: 0xe6d48e, winter: 0xc8c8a8 };
// 사람이 많은 시간 (시간대별 비율)
const CROWD = [0.25, 0.2, 0.15, 0.15, 0.2, 0.3, 0.55, 0.9, 1.15, 0.9, 0.75, 0.85, 1.1, 1.0, 0.8, 0.8, 0.85, 0.95, 1.15, 1.05, 0.9, 0.7, 0.5, 0.35];
const CARS = [0.3, 0.2, 0.15, 0.15, 0.2, 0.35, 0.6, 1.0, 1.15, 0.9, 0.75, 0.8, 0.85, 0.8, 0.8, 0.85, 0.95, 1.1, 1.15, 0.95, 0.8, 0.65, 0.5, 0.4];

// 선거 후보 (가상의 인물 · 공약은 게임 효과)
const CAND_NAMES = ['김하늘', '이도윤', '박서연', '최민준', '정다은', '강지호', '윤서아', '임건우', '한유진', '오세빈'];
const CAND_PARTY = [['초록미래당', '#2e7d32'], ['파랑시민당', '#1565c0'], ['노랑희망당', '#f9a825'], ['보라연합', '#6a1b9a'], ['무소속', '#546e7a']];
export const PLEDGES = {
  fare: { icon: '🚌', text: '버스·지하철 요금 300원 인하' },
  bike: { icon: '🚲', text: '공공자전거 1시간 무료' },
  rent: { icon: '🏠', text: '월세 10% 지원' },
  sale: { icon: '🏷️', text: '골목상권 세일 축제 (세일 가게 2배)' },
  park: { icon: '🎡', text: '주말 호수공원 축제 (주말마다 기분 UP)' },
};

function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function umbrellaGeo() {
  const g = new GB();
  const can = new THREE.ConeGeometry(0.62, 0.3, 8, 1, true); can.translate(0, 2.2, 0);
  g.addGeo(can);
  const pole = new THREE.CylinderGeometry(0.015, 0.015, 1.0, 5); pole.translate(0, 1.7, 0);
  g.addGeo(pole);
  const geo = g.build(); geo.translate(0.18, 0, 0.08);
  return geo;
}

export class LivingCity {
  constructor(ctx) { this.c = ctx; this.events = []; this.t = 0; this.densT = 0; this.seasonT = 0; this.lastHour = -1; }
  get S() { return this.c.S; }
  hour() { return ST.hour(this.S) % 24; }
  day() { return ST.day(this.S); }

  start() {
    const S = this.S;
    S.news = S.news || [];
    S.churn = S.churn || {};
    S.lifeDay = S.lifeDay ?? this.day();
    this.restoreChurn();
    this.applySeason(true);
  }
  init() {
    this.umbGeo = umbrellaGeo();
    this.umbMats = [0x1f1f1f, 0xd8343a, 0x2f6fd6, 0xf2c230, 0xffffff, 0x3aa655, 0xe07aa0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide, transparent: c === 0xffffff, opacity: c === 0xffffff ? 0.55 : 1 }));
    this.playerUmb = new THREE.Mesh(this.umbGeo, this.umbMats[2]); this.playerUmb.visible = false; this.playerUmb.castShadow = true;
    this.c.human.root.add(this.playerUmb);
    this.smokeTex = softTex();
    this.group = new THREE.Group(); this.c.scene.add(this.group);
  }

  // ─ 계절 ─
  season() { return seasonOf(this.day()); }
  temp() { return tempAt(this.S.minutes); }
  dateText() {
    const d = this.day(), s = this.season();
    return `${yearOf(d)}년차 ${s.icon}${s.name} ${dayInSeason(d)}일 · ${Math.round(this.temp())}°`;
  }
  applySeason(force) {
    const city = this.c.city, s = this.season(), snow = Math.min(1, (this.S.snowCover || 0) * 1.2);
    const leaf = LEAF[s.id], em = LEAF_EM[s.id];
    const lm = city.treeMats.leaf;
    lm.color.setRGB(leaf[0] * (1 - snow * 0.6), leaf[1] * (1 - snow * 0.6), leaf[2] * (1 - snow * 0.6));
    lm.emissive.setRGB(em[0] + snow * 0.62, em[1] + snow * 0.64, em[2] + snow * 0.7);
    city.mat.grass.color.set(GRASS[s.id]);
    city.mat.grass.emissive.setRGB(snow * 0.62, snow * 0.64, snow * 0.7);
    city.mat.hedge.emissive.setRGB(snow * 0.5, snow * 0.52, snow * 0.56);
    city.mat.sidewalk.emissive.setRGB(snow * 0.3, snow * 0.31, snow * 0.34);
    city.mat.pave.emissive.setRGB(snow * 0.3, snow * 0.31, snow * 0.34);
  }
  // ─ 매 프레임 ─
  update(dt, paused, inside) {
    const S = this.S, w = this.c.weather;
    this.t += dt;
    const gm = paused ? 0 : dt * this.c.minPerSec();      // 이번 프레임의 게임 분
    // 눈 쌓임 · 녹음
    const T = this.temp();
    if (w.kind === 'snow') S.snowCover = Math.min(1, (S.snowCover || 0) + gm * 0.01);
    else if (S.snowCover) S.snowCover = Math.max(0, S.snowCover - gm * 0.0015 * Math.max(0.5, T + 1));
    this.seasonT -= dt; if (this.seasonT <= 0) { this.seasonT = 2; this.applySeason(); }
    // 비 맞기 · 감기
    if (!paused) this.exposure(gm, inside);
    // 우산
    const out = !inside && !this.c.inCar() && w.amt > 0.35;
    this.playerUmb.visible = out && (S.items?.umbrella > 0) && !this.c.riding();
    this.pedUmbrellas(w.amt > 0.4);
    // 사람 · 차 수 (시간대)
    this.densT -= dt; if (this.densT <= 0) { this.densT = 0.6; this.density(w.amt); }
    // 사고 · 화재
    const h = Math.floor(S.minutes / 60);
    if (h !== this.lastHour) { const first = this.lastHour < 0; this.lastHour = h; if (!first && !paused) this.hourTick(); }
    for (const ev of [...this.events]) this.updateEvent(ev, dt);
  }
  exposure(gm, inside) {
    const S = this.S, w = this.c.weather, p = this.c.player.pos;
    const sheltered = inside || this.c.inCar() || this.c.underRoof?.(p);
    const wetNow = !sheltered && w.amt > 0.5 && !(S.items?.umbrella > 0);
    if (wetNow) {
      S.wet = (S.wet || 0) + gm * (w.kind === 'snow' ? 0.6 : 1);
      if (S.wet > 8 && !this.wetWarned) { this.wetWarned = true; toast(w.kind === 'snow' ? '🌨️ 눈을 맞고 있어요 · 편의점에서 우산을 사거나 실내로 들어가요' : '☔ 비를 쫄딱 맞고 있어요 · 편의점에서 우산을 사요 (감기 조심!)', 'bad', 4200); }
    } else if (S.wet) { S.wet = Math.max(0, S.wet - gm * (inside ? 2 : 0.6)); if (S.wet < 2) this.wetWarned = false; }
    // 한겨울 밤 오래 밖에 있으면
    const T = this.temp();
    if (!sheltered && T < -3) S.chill = (S.chill || 0) + gm; else if (S.chill) S.chill = Math.max(0, S.chill - gm * 2);
    if (!S.sick && ((S.wet || 0) > 45 || (S.chill || 0) > 150)) {
      const flu = S.buffs?.flu > S.minutes, mask = (S.items?.mask || 0) > 0;
      const chance = flu ? 0.15 : mask ? 0.35 : 0.6;
      S.wet = 20; S.chill = 0;
      if (Math.random() < chance) this.catchCold();
      else toast('🤧 으슬으슬… 따뜻하게 하고 쉬어요', '', 3000);
    }
  }
  catchCold() {
    const S = this.S;
    S.sick = { kind: 'cold', days: 3, since: this.day() };
    this.c.audio.bad?.();
    bigMsg('🤧 에취! 감기에 걸렸어요', '에너지가 빨리 줄어요 · 병원 진료 → 약국 감기약, 푹 자면 나아요', 4200);
    this.c.persist();
  }
  pedUmbrellas(on) {
    for (const o of this.c.peds.list) {
      if (!o.umb && on) {
        if (o.noUmb === undefined) o.noUmb = Math.random() < 0.2;
        if (o.noUmb) continue;
        o.umb = new THREE.Mesh(this.umbGeo, this.umbMats[Math.floor(Math.random() * this.umbMats.length)]);
        o.p.root.add(o.umb);
      }
      if (o.umb) o.umb.visible = on;
    }
  }
  density(rain) {
    const h = Math.floor(this.hour()), base = this.c.base();
    const cold = this.temp() < -2 ? 0.75 : 1;
    const wantP = Math.max(4, Math.round(base.peds * CROWD[h] * (1 - rain * 0.3) * cold));
    const peds = this.c.peds;
    if (peds.list.length < wantP) peds.setCount(peds.list.length + 1);
    else if (peds.list.length > wantP) peds.setCount(peds.list.length - 1);
    const wantT = Math.max(6, Math.round(base.traffic * CARS[h]));
    const tr = this.c.traffic;
    if (tr.cars.length < wantT) tr.setCount(tr.cars.length + 1);
    else if (tr.cars.length > wantT + 1) tr.setCount(tr.cars.length - 1);
  }

  // ─ 하루 · 주 단위 ─
  dailyCheck() {
    const S = this.S, day = this.day();
    if (S.lifeDay === day) return;
    const prev = S.lifeDay ?? day - 1; S.lifeDay = day;
    if (prev === day - 1 || prev < day) {
      // 감기 회복
      if (S.sick) {
        const med = (S.meds || 0) > 0; if (med) S.meds--;
        S.sick.days -= med ? 2 : 1;
        if (S.sick.days <= 0) { S.sick = null; toast('😊 감기가 다 나았어요!', 'good', 3200); }
        else toast(med ? `💊 감기약을 먹었어요 · 조금 나아졌어요` : '🤧 아직 감기 기운이 있어요 · 약국에서 약을 사 먹어요', med ? 'good' : 'bad', 3200);
      }
      // 계절이 바뀌면
      if (dayInSeason(day) === 1) { const s = this.season(); bigMsg(`${s.icon} ${s.name}이 왔어요`, { spring: '벚꽃이 피고 따뜻해져요', summer: '덥고 비가 자주 와요 · 장마철', autumn: '단풍이 들고 선선해져요', winter: '추워요! 눈이 오면 길이 하얘져요' }[s.id], 3600); this.applySeason(true); }
      // 오늘 날씨 뉴스
      const f = forecast(day);
      this.news('🌤️', `오늘의 날씨: ${f.icon} 최저 ${f.lo}° · 최고 ${f.hi}°`, f.kinds.length ? `${f.when} 소식이 있어요. 우산 챙기세요!` : '맑거나 구름 조금. 나들이하기 좋아요.', 'weather');
      // 주말 축제 (시장 공약)
      if (S.mayor?.pledge === 'park' && (day - 1) % 7 >= 5) { S.mood = ST.clamp(S.mood + 6); toast('🎡 주말 호수공원 축제! 기분이 좋아져요', 'good', 3200); }
      // 매주 월요일: 가게 개업 · 폐업 · 세일
      if ((day - 1) % 7 === 0 && S.churnWeek !== Math.floor((day - 1) / 7)) this.weeklyChurn();
      this.election(day);
    }
  }
  news(icon, title, body = '', tag = 'city') {
    const S = this.S;
    S.news = S.news || [];
    S.news.push({ day: this.day(), t: Math.floor(S.minutes % 1440), icon, title, body, tag });
    if (S.news.length > 60) S.news.splice(0, S.news.length - 60);
    this.c.onNews?.({ icon, title, tag });
  }

  // ─ 가게 개업 · 폐업 · 세일 ─
  restoreChurn() {
    const S = this.S;
    const mine = new Set((S.contracts || []).filter(c => c.shop).map(c => unitKey(c.bid, c.n, c.k)));
    const bids = new Set();
    for (const [key, o] of Object.entries(S.churn || {})) {
      if (mine.has(key)) { delete S.churn[key]; continue; }
      if (!OVERRIDES.has(key) || OVERRIDES.get(key).churn) { OVERRIDES.set(key, o); bids.add(+key.split(':')[0]); }
    }
    for (const bid of bids) { clearTenants(bid); const sp = this.c.city.bldgs.find(s => s.seed === bid); if (sp) this.c.refreshSpec?.(sp); }
  }
  weeklyChurn() {
    const S = this.S, week = Math.floor((this.day() - 1) / 7);
    S.churnWeek = week;
    const city = this.c.city, R = seeded(week * 7919 + 3);
    // 지난주 세일은 끝
    for (const [key, o] of Object.entries(S.churn)) if (o.sale && o.week < week) { delete o.sale; delete o.grand; if (!o.vacant && o.keep) { delete S.churn[key]; OVERRIDES.delete(key); } }
    const shops = city.bldgs.filter(s => s.bkind === 'shop' || s.bkind === 'mall');
    const touched = new Set(), changes = [];
    const nSale = S.mayor?.pledge === 'sale' ? 6 : 3;
    for (let i = 0; i < 6 + nSale && shops.length; i++) {
      const s = shops[Math.floor(R() * shops.length)], B = city.bldgOf(s);
      const units = [...tenantMap(B)].filter(([key, t]) => { const [n] = key.split(':').map(Number); return n <= 3; });
      if (!units.length) continue;
      const [key0, t] = units[Math.floor(R() * units.length)];
      const [n, k] = key0.split(':').map(Number), key = unitKey(B.id, n, k);
      const cur = OVERRIDES.get(key);
      if (cur && !cur.churn) continue;        // 내 가게 · 지구대 등은 건드리지 않음
      if (touched.has(key)) continue; touched.add(key);
      const kind = i < 3 ? 'close' : i < 6 ? 'open' : 'sale';
      if (kind === 'close' && !t.vacant) {
        const o = { vacant: true, churn: true, week, was: t.name };
        S.churn[key] = o; OVERRIDES.set(key, o);
        changes.push(['😢', `${B.name} ${n}층 '${t.name}' 폐업`, `"그동안 감사했습니다" · 빈 가게는 부동산에서 임대할 수 있어요`]);
      } else if (kind === 'open' || (kind === 'close' && t.vacant)) {
        const types = Object.keys(NAMES_BY_TYPE).filter(ty => TYPES[ty] && NAMES_BY_TYPE[ty].length && !['police', 'fire', 'office', 'bank'].includes(ty) && (n === 1 ? TYPES[ty].loc !== 'U' : true));
        const ty = types[Math.floor(R() * types.length)], list = NAMES_BY_TYPE[ty], slot = list[Math.floor(R() * list.length)];
        const [name, color] = SHOP_NAMES[slot];
        const o = { slot, type: ty, name, color, churn: true, week, grand: week, sale: 10 };
        S.churn[key] = o; OVERRIDES.set(key, o);
        changes.push(['🎉', `${B.name} ${n}층 '${name}' 신장개업!`, `이번 주 개업 기념 10% 할인`]);
      } else if (!t.vacant) {
        const pct = [10, 20, 30][Math.floor(R() * 3)];
        const o = { ...(cur || { slot: t.slot, type: t.type, name: t.name, color: t.color, keep: true }), churn: true, week, sale: pct };
        S.churn[key] = o; OVERRIDES.set(key, o);
        changes.push(['🏷️', `${B.name} ${n}층 '${t.name}' ${pct}% 세일`, '이번 주 일요일까지']);
      }
      clearTenants(B.id);
      this.c.refreshSpec?.(s);
    }
    // 너무 많이 쌓이면 오래된 것부터 원래대로 (새 가게가 들어온 것처럼)
    const keys = Object.keys(S.churn);
    if (keys.length > 50) for (const k of keys.slice(0, keys.length - 50)) { OVERRIDES.delete(k); delete S.churn[k]; }
    for (const [ic, ti, bo] of changes) this.news(ic, ti, bo, 'shop');
    if (changes.length) toast(`📰 이번 주 동네 가게 소식 ${changes.length}건 · 한빛뉴스 앱`, '', 3200);
    this.c.persist();
  }

  // ─ 사고 · 화재 ─
  hourTick() {
    const S = this.S, w = this.c.weather, s = this.season();
    if (!this.events.some(e => e.kind === 'accident') && Math.random() < 0.14 * (w.amt > 0.4 ? 1.8 : 1)) this.spawnAccident();
    if (!this.events.some(e => e.kind === 'fire') && Math.random() < 0.05 * (s.id === 'winter' ? 1.6 : 1)) this.spawnFire();
  }
  roadSpotNear(x, z, rMin, rMax) {
    for (let t = 0; t < 40; t++) {
      const a = Math.random() * 6.28, r = rMin + Math.random() * (rMax - rMin);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const kx = nearestRoad(px), kz = nearestRoad(pz);
      const vx = Math.abs(ROADS[kx] - px) < Math.abs(ROADS[kz] - pz);
      if (vx) {
        let seg = -1; for (let j = 0; j < N; j++) if (pz > ROADS[j] && pz < ROADS[j + 1]) seg = j;
        if (seg < 0 || !hasEdge(kx, seg, [0, 1])) continue;
        if (pz - ROADS[seg] < STOP + 8 || ROADS[seg + 1] - pz < STOP + 8) continue;
        const dir = Math.random() < 0.5 ? 1 : -1;     // +z 방향이면 오른쪽(-x)이 바깥 차로
        return { x: ROADS[kx] - dir * LANE2, z: pz, heading: dir > 0 ? 0 : Math.PI, axis: 'z', fx: 0, fz: dir, road: kx, seg };
      } else {
        let seg = -1; for (let i = 0; i < N; i++) if (px > ROADS[i] && px < ROADS[i + 1]) seg = i;
        if (seg < 0 || !hasEdge(seg, kz, [1, 0])) continue;
        if (px - ROADS[seg] < STOP + 8 || ROADS[seg + 1] - px < STOP + 8) continue;
        const dir = Math.random() < 0.5 ? 1 : -1;
        return { x: px, z: ROADS[kz] + dir * LANE2, heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2, axis: 'x', fx: dir, fz: 0, road: kz, seg };
      }
    }
    return null;
  }
  placeName(x, z) {
    let best = null, bd = 1e9;
    for (const s of this.c.city.bldgs) { if (!s.bname) continue; const d = Math.hypot((s.x0 + s.x1) / 2 - x, (s.z0 + s.z1) / 2 - z); if (d < bd) { bd = d; best = s; } }
    return best ? best.bname.replace(/ \d+차$/, '') : '한빛신도시';
  }
  addCar(type, color, x, z, h, ev, obstacle = true, own = false) {
    const m = buildCarMesh(type, color, { player: own });
    m.root.position.set(x, 0, z); m.root.rotation.y = h;
    this.group.add(m.root); ev.meshes.push(m.root);
    if (obstacle) { const o = { x, z, len: m.L }; this.c.traffic.obstacles.push(o); ev.obs.push(o); }
    return m;
  }
  spawnAccident(at) {
    const p = this.c.focus();
    const sp = at || this.roadSpotNear(p.x, p.z, 90, 380); if (!sp) return;
    const ev = { kind: 'accident', t0: this.S.minutes, x: sp.x, z: sp.z, sp, meshes: [], obs: [], stage: 0, where: `${this.placeName(sp.x, sp.z)} 앞 도로` };
    const a = this.addCar('sedan', 0x8c9096, sp.x, sp.z, sp.heading + 0.35, ev, true, true);
    this.addCar('suv', 0x1a1c20, sp.x + sp.fx * 4.6, sp.z + sp.fz * 4.6, sp.heading - 0.5, ev);
    // 비상등 깜빡임
    ev.blink = a.lightMat;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 8).translate(0, 0.28, 0), new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.6 }));
    for (let k = 1; k <= 3; k++) { const c = cone.clone(); c.position.set(sp.x - sp.fx * (4 + k * 3), 0, sp.z - sp.fz * (4 + k * 3)); this.group.add(c); ev.meshes.push(c); }
    this.events.push(ev);
    this.news('🚗', `${ev.where} 교통사고`, '차 두 대가 부딪혔어요. 다친 사람은 없지만 길이 막혀요. 빗길·눈길 운전 조심!', 'event');
    if (this.dist(ev) < 450) toast(`🚨 근처 ${ev.where}에서 교통사고가 났어요`, 'bad', 3600);
    return ev;
  }
  spawnFire(spec) {
    const p = this.c.focus(), city = this.c.city;
    const cands = city.bldgs.filter(s => { const d = Math.hypot((s.x0 + s.x1) / 2 - p.x, (s.z0 + s.z1) / 2 - p.z); return d > 100 && d < 480 && s.bkind && !s.hq; });
    const s = spec || cands[Math.floor(Math.random() * cands.length)]; if (!s) return;
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    const top = (s.groundH || s.fh || 3) + (s.floors - 1) * (s.fh || 3);
    const fl = 1 + Math.floor(Math.random() * Math.min(s.floors, 6));
    const fy = (s.groundH && fl > 1 ? s.groundH + (fl - 2) * s.fh : 0) + 1.6;
    // 불이 보일 벽면: 도로 쪽
    const faces = [['S', cx, s.z1 + 0.1], ['N', cx, s.z0 - 0.1], ['E', s.x1 + 0.1, cz], ['W', s.x0 - 0.1, cz]];
    const f = faces.reduce((a, b) => Math.hypot(b[1] - p.x, b[2] - p.z) < Math.hypot(a[1] - p.x, a[2] - p.z) ? b : a);
    const ev = { kind: 'fire', t0: this.S.minutes, x: f[1], z: f[2], spec: s, meshes: [], obs: [], stage: 0, top, fy, where: s.bname || this.placeName(cx, cz), floor: fl };
    // 불꽃
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffc84a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    const fg = new THREE.Group(); fg.position.set(f[1], fy + Y0, f[2]); if (f[0] === 'E' || f[0] === 'W') fg.rotation.y = Math.PI / 2;
    for (let k = 0; k < 7; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.4), k % 2 ? flameMat : flameMat2); m.position.set((k - 3) * 0.8, Math.random() * 0.8, 0); fg.add(m); }
    const burnt = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.3), new THREE.MeshBasicMaterial({ color: 0x15100c })); burnt.position.set(f[1], fy + Y0 + 0.4, f[2]); burnt.rotation.y = (f[0] === 'E' || f[0] === 'W') ? Math.PI / 2 : 0; this.group.add(burnt); ev.meshes.push(burnt);
    this.group.add(fg); ev.meshes.push(fg); ev.flames = fg; ev.flameMat = flameMat;
    const light = new THREE.PointLight(0xff6a20, 40, 45, 1.6); light.position.set(f[1], fy + 2, f[2]); this.group.add(light); ev.meshes.push(light); ev.light = light;
    // 연기
    const n = 90, pos = new Float32Array(n * 3);
    ev.parts = Array.from({ length: n }, () => [Math.random() * 1, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ map: this.smokeTex, color: 0x333333, size: 14, transparent: true, opacity: 0.8, depthWrite: false });
    ev.smoke = new THREE.Points(g, pm); ev.smoke.frustumCulled = false; this.group.add(ev.smoke); ev.meshes.push(ev.smoke);
    this.events.push(ev);
    this.news('🔥', `${ev.where} ${fl}층 화재`, '연기가 많이 나요. 근처 시민은 낮은 자세로 대피하고 119에 신고해 주세요.', 'event');
    if (this.dist(ev) < 500) toast(`🔥 근처 ${ev.where}에서 불이 났어요!`, 'bad', 3800);
    return ev;
  }
  dist(ev) { const p = this.c.focus(); return Math.hypot(ev.x - p.x, ev.z - p.z); }
  responders(ev) {
    if (ev.responded) return; ev.responded = true;
    const sp = ev.kind === 'accident' ? ev.sp : this.roadSpotNear(ev.x, ev.z, 6, 40);
    if (!sp) return;
    if (ev.kind === 'accident') {
      this.addCar('police', 0, sp.x - sp.fx * 10, sp.z - sp.fz * 10, sp.heading, ev);
      this.addCar('ambulance', 0, sp.x - sp.fx * 17, sp.z - sp.fz * 17, sp.heading, ev);
    } else {
      this.addCar('firetruck', 0, sp.x, sp.z, sp.heading, ev);
      this.addCar('firetruck', 0, sp.x - sp.fx * 9, sp.z - sp.fz * 9, sp.heading, ev);
      this.addCar('ambulance', 0, sp.x - sp.fx * 16, sp.z - sp.fz * 16, sp.heading, ev);
    }
    ev.tResp = this.S.minutes;
  }
  updateEvent(ev, dt) {
    const S = this.S, age = S.minutes - ev.t0, tm = performance.now() / 1000;
    const me = this.c.career()?.job, onDuty = this.c.career()?.working && me && ((ev.kind === 'fire' && me.kind === 'fire') || (ev.kind === 'accident' && me.kind === 'police'));
    if (!ev.responded && !onDuty && !ev.dispatched && age > (ev.reported ? 6 : 14)) this.responders(ev);
    if (ev.kind === 'accident') {
      if (ev.blink) ev.blink.color.setScalar(Math.sin(tm * 8) > 0 ? 2.2 : 0.5);
      if (age > (ev.tResp ? Math.max(70, ev.tResp - ev.t0 + 40) : 120)) this.endEvent(ev);
      return;
    }
    // 불꽃 · 연기
    const fade = ev.tResp ? Math.max(0, 1 - (S.minutes - ev.tResp) / 40) : 1;
    ev.flames.visible = fade > 0.02;
    ev.flames.children.forEach((m, k) => { const s = (0.7 + Math.sin(tm * 9 + k * 1.7) * 0.25) * fade; m.scale.set(s, s * (1 + Math.sin(tm * 13 + k) * 0.3), s); });
    ev.light.intensity = (30 + Math.sin(tm * 17) * 12) * fade;
    const pos = ev.smoke.geometry.attributes.position.array, base = ev.fy + Y0 + 1;
    ev.parts.forEach((q, i) => {
      q[0] += dt * (0.08 + (i % 7) * 0.01);
      if (q[0] > 1) { q[0] = 0; q[1] = (Math.random() - 0.5) * 3; q[2] = (Math.random() - 0.5) * 3; }
      const y = base + q[0] * (ev.top - ev.fy + 30);
      pos[i * 3] = ev.x + q[1] * (1 + q[0] * 3); pos[i * 3 + 1] = y; pos[i * 3 + 2] = ev.z + q[2] * (1 + q[0] * 3);
    });
    ev.smoke.geometry.attributes.position.needsUpdate = true;
    ev.smoke.material.opacity = 0.8 * Math.max(0.2, fade);
    ev.smoke.material.color.setScalar(fade > 0.3 ? 0.2 : 0.55);
    if (age > (ev.tResp ? ev.tResp - ev.t0 + 75 : 160)) this.endEvent(ev);
  }
  endEvent(ev) {
    for (const m of ev.meshes) this.group.remove(m);
    const obs = this.c.traffic.obstacles;
    for (const o of ev.obs) { const i = obs.indexOf(o); if (i >= 0) obs.splice(i, 1); }
    this.events.splice(this.events.indexOf(ev), 1);
    if (!ev.resolvedNews) this.news(ev.kind === 'fire' ? '🚒' : '🚓', `${ev.where} ${ev.kind === 'fire' ? '화재 진압 완료' : '사고 수습 완료'}`, ev.kind === 'fire' ? '소방관들의 빠른 대처로 큰 피해는 없었어요.' : '도로 통행이 다시 원활해졌어요.', 'event');
  }
  // 직업: 경찰 · 소방 출동
  pendingFor(kind) { return this.events.find(e => !e.dispatched && !e.responded && ((kind === 'fire' && e.kind === 'fire') || (kind === 'police' && e.kind === 'accident'))); }
  dispatchSpawn(kind) {
    // 근무 중인데 사건이 없으면 가끔 새로 생김
    if (Math.random() < 0.5) return kind === 'fire' ? this.spawnFire() : this.spawnAccident();
    return null;
  }
  resolve(ev, good) {
    if (!ev) return;
    ev.dispatched = true;
    this.responders(ev);
    ev.resolvedNews = true;
    const job = this.c.career()?.job;
    this.news(ev.kind === 'fire' ? '🧑‍🚒' : '👮', `${ev.where} ${ev.kind === 'fire' ? '화재' : '교통사고'} · ${job?.place || ''} 신속 출동`, good ? '현장 대응이 아주 침착하고 빨랐다는 칭찬이 이어졌어요.' : '현장은 정리됐지만 조금 늦었다는 지적도 있었어요.', 'event');
  }
  // 시민 신고
  action(p) {
    for (const ev of this.events) {
      const d = Math.hypot(ev.x - p.x, ev.z - p.z);
      if (d > (ev.kind === 'fire' ? 40 : 25)) continue;
      if (!ev.reported && !ev.responded) return { label: ev.kind === 'fire' ? '📞 119에 화재 신고하기' : '📞 112에 사고 신고하기', fn: () => this.report(ev), green: true };
    }
    return null;
  }
  report(ev) {
    ev.reported = true;
    this.S.reports = (this.S.reports || 0) + 1;
    this.S.mood = ST.clamp(this.S.mood + 4);
    this.c.missions?.addXp?.(15);
    toast(ev.kind === 'fire' ? '📞 "119입니다. 바로 출동하겠습니다! 안전한 곳으로 대피하세요"' : '📞 "112입니다. 경찰과 구급차 보내드릴게요"', 'good', 3800);
    this.news('📞', `시민 신고로 ${ev.where} ${ev.kind === 'fire' ? '화재' : '사고'} 빠르게 대응`, '지나가던 시민의 침착한 신고 덕분에 출동이 빨랐어요.', 'event');
    this.c.persist();
  }

  // ─ 선거 (28일마다 · 겨울 마지막 날 투표) ─
  candidates(year) {
    const R = seeded(year * 4111 + 9);
    const names = [...CAND_NAMES].sort(() => R() - 0.5).slice(0, 3);
    const pl = Object.keys(PLEDGES).sort(() => R() - 0.5);
    const parties = [...CAND_PARTY].sort(() => R() - 0.5);
    return names.map((n, i) => ({ id: i, name: n, party: parties[i][0], color: parties[i][1], pledge: pl[i], base: 28 + Math.floor(R() * 14) }));
  }
  electionDay(year) { return year * YEAR_DAYS; }
  campaign() {
    const day = this.day(), year = yearOf(day), eday = this.electionDay(year);
    if (eday - day <= 6 && eday - day >= 0) return { year, eday, left: eday - day, cands: this.candidates(year) };
    return null;
  }
  election(day) {
    const S = this.S, year = yearOf(day), eday = this.electionDay(year);
    if (day === eday - 6) this.news('🗳️', `제${year}회 한빛시장 선거 ${6}일 앞으로`, this.candidates(year).map(c => `${c.name}(${c.party}) — ${PLEDGES[c.pledge].text}`).join(' / '), 'election');
    if (day === eday) { this.news('🗳️', '오늘은 한빛시장 선거일!', '시청 민원실에서 투표할 수 있어요 (오전 6시~오후 6시).', 'election'); toast('🗳️ 오늘은 시장 선거일! 시청에서 투표해요', '', 4000); }
    // 개표 (다음 날)
    const lastYear = yearOf(day - 1);
    if (day - 1 === this.electionDay(lastYear) && S.electedYear !== lastYear) {
      S.electedYear = lastYear;
      const cands = this.candidates(lastYear), R = seeded(lastYear * 77 + 1);
      const votes = cands.map(c => c.base + R() * 20 + (S.vote?.year === lastYear && S.vote.id === c.id ? 6 : 0));
      const tot = votes.reduce((a, b) => a + b, 0);
      const wi = votes.indexOf(Math.max(...votes)), w = cands[wi];
      S.mayor = { name: w.name, party: w.party, pledge: w.pledge, year: lastYear };
      this.news('🎉', `한빛시장에 ${w.name} 당선 (${Math.round(votes[wi] / tot * 100)}%)`, `공약: ${PLEDGES[w.pledge].icon} ${PLEDGES[w.pledge].text} · 오늘부터 시행돼요.`, 'election');
      bigMsg(`🗳️ ${w.name} 시장 당선`, `${PLEDGES[w.pledge].icon} ${PLEDGES[w.pledge].text}`, 4200);
      if (S.vote?.year === lastYear) { S.mood = ST.clamp(S.mood + (S.vote.id === wi ? 5 : 1)); }
    }
  }
  voteRow() {
    const S = this.S, day = this.day(), year = yearOf(day), eday = this.electionDay(year), h = this.hour();
    const can = (day === eday && h >= 6 && h < 18) || (day >= eday - 2 && day < eday && h >= 6 && h < 18);
    if (!can) return '';
    if (S.vote?.year === year) return row({ icon: '🗳️', title: '시장 선거 투표', desc: '✅ 투표 완료! 결과는 선거 다음 날 뉴스로', btn: '완료', action: 'vote', disabled: true });
    return row({ icon: '🗳️', title: day === eday ? '시장 선거 투표' : '시장 선거 사전투표', desc: '신분증 확인 → 기표소 → 투표함', btn: '투표', btnClass: 'green', action: 'vote' });
  }
  voteSheet() {
    const S = this.S, year = yearOf(this.day()), cands = this.candidates(year);
    openSheet({
      icon: '🗳️', title: `제${year}회 한빛시장 선거`, sub: '한 명에게 도장을 찍어요 · 비밀투표',
      html: cands.map(c => row({ icon: `<span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${c.color}"></span>`, title: `${c.id + 1}. ${c.name} (${c.party})`, desc: `${PLEDGES[c.pledge].icon} ${PLEDGES[c.pledge].text}`, btn: '기표', action: 'v:' + c.id })).join(''),
      bind: (b) => bindActs(b, { v: (i) => { S.vote = { year, id: +i }; closeSheet(); this.c.passTime?.(15); S.mood = ST.clamp(S.mood + 3); bigMsg('🗳️ 투표 완료!', '소중한 한 표 · 투표 인증 스티커를 받았어요', 3000); this.c.persist(); } }),
    });
  }

  // ─ 한빛뉴스 앱 ─
  appHtml() {
    const S = this.S, day = this.day(), f = forecast(day), f2 = forecast(day + 1), s = this.season();
    const camp = this.campaign();
    const hm = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    const items = [...(S.news || [])].reverse().filter(n => n.tag !== 'weather' || n.day === day).slice(0, 25);
    return `<div class="ph-title">📰 한빛뉴스</div>
      <div class="row" style="background:rgba(70,209,255,.1)"><div class="ic">${f.icon}</div><div class="info"><b>오늘 ${Math.round(this.temp())}° · ${s.icon}${s.name}</b><span>최저 ${f.lo}° / 최고 ${f.hi}° · ${f.when}</span></div></div>
      <div class="row"><div class="ic">${f2.icon}</div><div class="info"><b>내일</b><span>최저 ${f2.lo}° / 최고 ${f2.hi}° · ${f2.when}</span></div></div>
      ${S.sick ? `<div class="row" style="background:rgba(255,90,90,.12)"><div class="ic">🤧</div><div class="info"><b>감기 중</b><span>병원 → 약국 감기약 · 남은 날 약 ${S.sick.days}일 · 가진 약 ${S.meds || 0}회분</span></div></div>` : ''}
      ${camp ? `<div class="ph-sub" style="margin:12px 0 6px;font-weight:700">🗳️ 시장 선거 D-${camp.left}</div>` + camp.cands.map(c => `<div class="row"><div class="ic"><span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${c.color}"></span></div><div class="info"><b>${c.name} · ${c.party}</b><span>${PLEDGES[c.pledge].icon} ${PLEDGES[c.pledge].text} · 여론조사 ${c.base + Math.round(seeded(day * 13 + c.id)() * 8)}%</span></div></div>`).join('') : ''}
      ${S.mayor ? `<p class="note" style="color:#ccc">🏛️ 한빛시장 ${S.mayor.name} · 시행 중: ${PLEDGES[S.mayor.pledge].icon} ${PLEDGES[S.mayor.pledge].text}</p>` : ''}
      <div class="ph-sub" style="margin:12px 0 6px;font-weight:700">🗞️ 도시 소식</div>
      ${items.length ? items.map(n => `<div class="row"><div class="ic">${n.icon}</div><div class="info"><b>${n.title}</b><span>${n.day}일차 ${hm(n.t)}${n.body ? ' · ' + n.body : ''}</span></div></div>`).join('') : '<p class="note">아직 소식이 없어요.</p>'}`;
  }
}

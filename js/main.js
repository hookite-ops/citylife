import * as THREE from 'three';
import { HALF, ROAD, ROADS, STOP, LANE2, N, nearestRoad, blockIndex, CARS, HOMES, FOODS, FURNITURE, OFFICE_RANKS, WAGE_MART, MIN_PER_SEC, won, blockRect } from './config.js';
import { City, SPECIALS, ZONES, ZONE_COLOR, lakeR } from './city.js';
import { Sky } from './sky.js';
import { Traffic, PlayerCar, DIRS, dirKey, right, buildCarMesh } from './vehicles.js';
import { Peds } from './peds.js';
import { createHuman } from './human.js';
import { Controls } from './controls.js';
import { Audio } from './audio.js';
import { Interior, INTERACT } from './interior.js';
import * as ST from './state.js';
import { $, toast, openSheet, closeSheet, sheetOpen, fade, bigMsg, wait, row, bindActs, setAudio } from './ui.js';
import { setAniso } from './textures.js';
import { MartRoom } from './mart.js';
import { MartGame, stars } from './martgame.js';
import { Cooking } from './cooking.js';
import { SchoolRoom } from './school.js';
import { SchoolGame } from './schoolgame.js';
import { P as PRODUCT, DISHES, INGREDIENTS, SHIFTS } from './products.js';

// ───────── 품질 ─────────
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const DPR = window.devicePixelRatio || 1;
const QUAL = {
  low: { pr: Math.min(DPR, 1) * 0.85, shadow: 1024, range: 40, traffic: 22, peds: 22, shadows: false, near: 170 },
  mid: { pr: Math.min(DPR, 1.35), shadow: 2048, range: 55, traffic: 36, peds: 36, shadows: true, near: 240 },
  high: { pr: Math.min(DPR, 2), shadow: 2048, range: 80, traffic: 52, peds: 54, shadows: true, near: 330 },
};

let S = ST.load();
const hasSave = !!S;
if (!S) S = ST.newState();
let quality = new URLSearchParams(location.search).get('q') || S.settings.quality || (isTouch ? 'mid' : 'high');
window.__frames = 0;
const TEST = new URLSearchParams(location.search).has('test');

// ───────── 렌더러 ─────────
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(QUAL[quality].pr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.25, 5000);
const audio = new Audio(); setAudio(audio);
audio.setEnabled(S.settings.sound);

let city, sky, traffic, peds, interior, human, controls, mart, martGame, cooking;
let room = null;          // 지금 들어가 있는 실내 (interior | mart | school)
let school, schoolGame, schoolEntrance = null;
let martEntrance = null;  // 들어온 편의점 입구
let site = null, homeSite = null, martSite = null, schoolSite = null;   // 실내가 붙어 있는 건물
const camLocal = new THREE.Vector3(), localCam = { position: camLocal }, pwTmp = new THREE.Vector3();
const roomAmb = new THREE.AmbientLight(0xfff6ea, 0);
S.inventory.ing = S.inventory.ing || {};
// 신도시로 지도가 바뀌면 예전 위치 정보는 버림
if (S.mapVer !== 3) { S.player = null; S.carPos = null; S.waypoint = null; S.delivery = null; S.mapVer = 3; }
if (S.inventory.food.ramen) { S.inventory.food.cupramen = (S.inventory.food.cupramen || 0) + S.inventory.food.ramen; delete S.inventory.food.ramen; }
let pcar = null;        // 플레이어 소유 차량 (현재 선택된 차)
let inCar = false;
let mode = 'title';     // title | city | home | mart
let editing = false;
let busy = false;       // 연출 중 (입력 막기)
let elapsed = 0;

const player = { pos: new THREE.Vector3(), heading: 0, speed: 0, run: false };
const cam = { yaw: 0.6, pitch: 0.32, dist: 5, tdist: 5, carDist: 9 };
const input = { gas: false, brake: false };
let beacon, beaconRing;

// ───────── 초기화 ─────────
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
async function boot() {
  const lt = $('loadTxt');
  lt.textContent = '하늘과 빛을 준비하는 중…'; await nextFrame();
  sky = new Sky(scene, renderer);
  applyShadowQuality();
  lt.textContent = '도로와 건물을 짓는 중…'; await nextFrame();
  city = new City(scene, quality);
  lt.textContent = '차와 사람들을 불러오는 중…'; await nextFrame();
  traffic = new Traffic(scene, city, QUAL[quality].traffic);
  city.setNearRadius(QUAL[quality].near);
  peds = new Peds(scene, QUAL[quality].peds, (i, j) => ZONES[j][i] === 'L');
  // 주차된 차들
  const pc = [0xf2f2ee, 0x1a1c20, 0x8c9096, 0x2b3a55, 0x6b1a1a, 0xc8c2b0, 0x24303c];
  const types = ['sedan', 'hatch', 'suv', 'sedan', 'suv'];
  city.parkedSpots.forEach((p, k) => {
    const m = buildCarMesh(p.showroom ? ['sport', 'suv', 'sedan'][k % 3] : types[k % types.length], p.showroom ? [0xc0201a, 0x6b7b6a, 0x1d2b3a][k % 3] : pc[k % pc.length]);
    m.root.position.set(p.x, city.groundY(p.x, p.z) + 0.01, p.z); m.root.rotation.y = p.rot;
    scene.add(m.root);
    if (p.noCollide) return;
    const sx = Math.abs(Math.sin(p.rot)) > 0.5;
    const hw = (sx ? m.L : m.W) / 2, hd = (sx ? m.W : m.L) / 2;
    city.colliders.push({ x0: p.x - hw, x1: p.x + hw, z0: p.z - hd, z1: p.z + hd, h: 1.4, soft: true });
  });
  interior = new Interior(renderer);
  human = createHuman({ skin: 0xe9c6a2, hair: 0x1c1410, shirt: 0xf2f2f0, jacket: 0x2e3f57, pants: 0x2a2f38, shoes: 0xf4f4f4 });
  scene.add(human.root);
  // 알바 조끼
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.37).translate(0, 1.0, 0), new THREE.MeshStandardMaterial({ color: 0x1f8a4c, roughness: 0.5 }));
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.01), new THREE.MeshStandardMaterial({ color: 0xffffff })); tag.position.set(0.15, 1.18, 0.19);
  vest.add(tag); vest.visible = false; vest.castShadow = true; human.body.add(vest);
  human.applyUniform = (on) => { vest.visible = on; };
  mart = new MartRoom();
  martGame = new MartGame({
    get S() { return S; }, room: mart, player, human, audio, earn, pay, persist, foodInfo,
    eatFood: (id, o) => eatFood(id, o), setBusy: (v) => { busy = v; }, exit: () => exitMart(),
  });
  cooking = new Cooking({
    get S() { return S; }, interior, human, player, audio, persist, foodInfo,
    setBusy: (v) => { busy = v; }, eatAtHome: (k) => eatAtHome(k), focusKitchen: (v) => { cam.kitchen = v; },
  });
  school = new SchoolRoom();
  schoolGame = new SchoolGame({
    get S() { return S; }, room: school, player, human, audio, earn, pay, persist,
    setBusy: (v) => { busy = v; }, exit: () => exitSchool(), refreshPeriod: () => schoolGame.refresh(schoolEntrance.school, true),
  });
  controls = new Controls(canvas, $('joy'), $('knob'));
  makeBeacon();
  // 타이틀 배경용 카메라 위치
  scene.add(roomAmb);
  setupHome();
  const home = homeEntrance();
  player.pos.set(home.x, 0.18, home.z + 2);
  human.root.position.copy(player.pos);
  S.minutes = hasSave ? S.minutes : S.minutes;
  sky.update(ST.hour(S), player.pos, 0);
  sky.refreshEnv();
  lt.textContent = '';
  $('tBtns').classList.remove('hidden');
  if (hasSave) { $('bContinue').classList.remove('hidden'); $('bNew').classList.add('secondary'); $('bNew').textContent = '처음부터 다시'; }
  setQualityButtons();
  requestAnimationFrame(loop);
}

function applyShadowQuality() {
  const q = QUAL[quality];
  sky.setShadowQuality(q.shadow, q.range);
  sky.sun.castShadow = q.shadows;
}
function setQuality(q) {
  quality = q; S.settings.quality = q;
  renderer.setPixelRatio(QUAL[q].pr);
  applyShadowQuality();
  traffic?.setCount(QUAL[q].traffic);
  city?.setNearRadius(QUAL[q].near);
  peds?.setCount(QUAL[q].peds);
  setQualityButtons();
}
function setQualityButtons() {
  document.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === quality));
}
document.querySelectorAll('.q-row [data-q]').forEach(b => b.addEventListener('click', () => setQuality(b.dataset.q)));

$('bContinue').addEventListener('click', () => startGame(false));
$('bNew').addEventListener('click', () => {
  if (hasSave && !confirm('저장된 진행 상황이 사라집니다. 처음부터 시작할까요?')) return;
  S = ST.newState(); S.settings.quality = quality; startGame(true);
});

async function startGame(fresh) {
  audio.init();
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  mode = 'city';
  const home = homeEntrance();
  if (!fresh && S.player) {
    player.pos.set(S.player.x, 0, S.player.z);
    player.heading = S.player.h || 0;
  } else {
    player.pos.set(home.x + home.nx * 2.5, 0, home.z + home.nz * 2.5);
    player.heading = home.face + Math.PI;
  }
  cam.yaw = player.heading + Math.PI;
  city.collide(player.pos, 0.35, { walker: true });
  city.warmup(player.pos);
  traffic.reseed(player.pos); peds.reseed(player.pos);
  attachRooms(true);
  spawnPlayerCar();
  if (!fresh && S.player?.inCar && pcar) enterCar(true);
  if (!fresh && S.player?.inside) await enterHome(true);
  if (S.mart?.shift) S.mart.shift = null; // 근무 중에 꺼졌으면 근무는 취소
  updateHUD(true);
  if (fresh || S.tutorial) {
    bigMsg('도시생활에 오신 걸 환영해요', '1일차 아침. 지갑엔 8만 원, 원룸 한 칸이 전부예요.', 3600);
    setTimeout(() => toast('왼쪽 화면을 누른 채 움직이면 걸어요 · 오른쪽 화면을 밀면 시점이 돌아가요'), 3800);
    setTimeout(() => toast('📱 휴대폰으로 지도·택시·목표를 볼 수 있어요'), 7500);
    S.tutorial = false;
  }
  ST.save(S);
}

// ───────── 플레이어 차량 ─────────
function spawnPlayerCar() {
  if (pcar) { pcar.dispose(); pcar = null; }
  if (!S.car) return;
  const spec = CARS.find(c => c.id === S.car);
  pcar = new PlayerCar(scene, spec);
  if (S.carPos) pcar.place(S.carPos.x, S.carPos.z, S.carPos.h);
  else { const p = city.parking.cars; pcar.place(p.x, p.z, p.rot); }
}
function enterCar(silent) {
  if (!pcar) return;
  inCar = true;
  human.root.visible = false;
  cam.yaw = pcar.heading + Math.PI;
  $('pedals').classList.remove('hidden');
  $('speedo').classList.remove('hidden');
  $('hud').classList.add('driving');
  $('btnRun').classList.add('hidden');
  $('btnHorn').classList.remove('hidden');
  if (!silent) audio.tone(160, 0.25, 'sawtooth', 0.06, 0, 90);
}
function exitCar() {
  if (!pcar) return;
  if (Math.abs(pcar.speed) > 3) { toast('차를 멈춘 뒤 내리세요', 'bad'); return; }
  inCar = false;
  pcar.speed = 0;
  const fx = Math.sin(pcar.heading), fz = Math.cos(pcar.heading);
  // 운전석(왼쪽)으로 내림: 왼쪽 = -right
  const r = [-fz, fx];
  player.pos.set(pcar.pos.x - r[0] * 1.7, 0, pcar.pos.z - r[1] * 1.7);
  city.collide(player.pos, 0.35);
  player.heading = pcar.heading;
  human.root.visible = true;
  $('pedals').classList.add('hidden');
  $('speedo').classList.add('hidden');
  $('hud').classList.remove('driving');
  $('btnRun').classList.remove('hidden');
  $('btnHorn').classList.add('hidden');
  S.carPos = { x: pcar.pos.x, z: pcar.pos.z, h: pcar.heading };
  ST.save(S);
}

// ───────── 목적지 표시(빛기둥) ─────────
function makeBeacon() {
  const g = new THREE.CylinderGeometry(1.1, 1.1, 90, 20, 1, true); g.translate(0, 45, 0);
  const m = new THREE.MeshBasicMaterial({ color: 0x46d1ff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  beacon = new THREE.Mesh(g, m); beacon.visible = false; scene.add(beacon);
  const rg = new THREE.RingGeometry(1.6, 2.1, 40); rg.rotateX(-Math.PI / 2);
  beaconRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x46d1ff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  beaconRing.visible = false; scene.add(beaconRing);
}
function currentTarget() {
  if (S.delivery) return S.delivery.stage === 'pickup' ? S.delivery.pickup : S.delivery.drop;
  if (S.waypoint) return S.waypoint;
  return null;
}

// ───────── 메인 루프 ─────────
let last = performance.now(), hudT = 0, miniT = 0, saveT = 0, checkT = 0, attachT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  window.__frames++;
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  elapsed += dt;
  if (mode === 'title') {
    // 타이틀: 도시 위를 천천히 도는 카메라
    sky.update(ST.hour(S), new THREE.Vector3(0, 0, 0), dt);
    city.update(dt, sky.night, elapsed, camera.position);
    traffic.update(dt, player.pos, null, sky.night, camera.position);
    peds.update(dt, player.pos, camera.position);
    const a = elapsed * 0.04;
    camera.position.set(Math.cos(a) * 560, 190, Math.sin(a) * 560);
    camera.lookAt(0, 30, 0);
    renderer.render(scene, camera);
    return;
  }
  const phoneOpen = !$('phone').classList.contains('hidden');
  const mgOpen = !$('mg').classList.contains('hidden');
  const paused = sheetOpen() || phoneOpen || mgOpen || busy;
  const shift = (mode === 'mart' && martGame.onShift) || (mode === 'school' && !!schoolGame.duty);
  const timeFrozen = sheetOpen() || phoneOpen || (!shift && (mgOpen || busy));
  if (!timeFrozen) {
    const actMode = shift ? 'work' : inCar ? 'drive' : player.speed > 3 ? 'run' : player.speed > 0.3 ? 'walk' : 'idle';
    const before = S.energy;
    ST.passTime(S, dt * MIN_PER_SEC * (shift ? 2 : 1), actMode);
    needWarnings(before);
  }
  checkT -= dt; if (checkT <= 0) { checkT = 2; martGame.dailyCheck(); schoolGame.dailyCheck(); if (mode === 'school') schoolGame.refresh(schoolEntrance.school); }
  const hours = ST.hour(S);
  if (mode === 'city') {
    const focus = inCar && pcar ? pcar.pos : player.pos;
    sky.update(hours, focus, dt);
    renderer.toneMappingExposure = 1 + sky.night * 0.45;
    city.update(dt, sky.night, elapsed, camera.position);
    if (!paused) {
      if (inCar) updateDriving(dt); else updateWalking(dt);
    }
    traffic.update(paused ? 0 : dt, player.pos, pcar, sky.night, camera.position);
    if (!paused) peds.update(dt, player.pos, camera.position);
    updateCityCamera(dt);
    updateTargets(dt);
    if (!paused) updateCityInteract();
    attachT -= dt; if (attachT <= 0) { attachT = 0.5; attachRooms(); }
    if (!paused && !inCar) checkWalkIn();
    // 바깥에서도 가까운 실내 문은 열리고 닫힘
    if (homeSite && homeSite.kind !== 'tower') { const [lx, lz] = homeSite.toLocal(player.pos.x, player.pos.z); if (Math.abs(lx) < 12 && Math.abs(lz) < 12) interior.updateDoor?.(dt, { x: lx, z: lz }); }
    if (martSite) { const [lx, lz] = martSite.toLocal(player.pos.x, player.pos.z); if (Math.abs(lx) < 12 && Math.abs(lz) < 9) mart.updateDoor(dt, { x: lx, z: lz }); }
    roomAmb.intensity = 0;
    audio.ambient(sky.night > 0.5, false);
    audio.engine(inCar && !paused, pcar ? pcar.speed : 0, inCar ? lastThrottle : 0, pcar ? pcar.spec.maxSpeed : 30);
    miniT -= dt; if (miniT <= 0) { miniT = 0.1; drawMinimap(); }
    renderer.render(scene, camera);
  } else {
    // 실내 (실제 건물 안) — 바깥 도시도 계속 돌아감
    const pwv = playerWorld();
    sky.update(hours, pwv, dt);
    renderer.toneMappingExposure = 1 + sky.night * 0.25;
    city.update(dt, sky.night, elapsed, camera.position);
    traffic.update(paused ? 0 : dt, pwv, null, sky.night, camera.position);
    if (!paused) peds.update(dt, pwv, camera.position);
    const lightOn = mode !== 'home' || interior.lightOn !== false;
    roomAmb.intensity = lightOn ? 0.55 + sky.night * 0.9 : 0.12;
    if (mode === 'home') {
      if (!paused && !editing) updateRoomWalking(dt);
      updateRoomCamera(dt);
      interior.update(sky.night, sky.uniforms.top.value, sky.uniforms.horizon.value, localCam);
      interior.updateDoor?.(dt, player.pos);
      if (!cooking.active) interior.steamTick(dt, 0);
      if (!paused && !editing) updateHomeInteract();
      audio.ambient(sky.night > 0.5, true);
    } else if (mode === 'mart') {
      if (!paused) updateRoomWalking(dt);
      const npcDt = sheetOpen() || phoneOpen ? 0 : dt;
      mart.updateNpcs(npcDt, player.pos, { atCounter: (c, d) => martGame.atCounter(c, d) });
      if (!timeFrozen) martGame.update(dt);
      mart.updateDoor(dt, player.pos);
      mart.updateWarn(martGame.onShift, elapsed);
      mart.updateFx(dt);
      updateRoomCamera(dt);
      mart.updateWalls(localCam);
      if (!paused) updateMartInteract();
      audio.ambient(false, true);
    } else if (mode === 'school') {
      if (!paused) updateRoomWalking(dt);
      school.update(paused ? 0 : dt, player.pos);
      updateRoomCamera(dt);
      school.updateWalls(localCam, sky.night);
      if (!paused) { const a = schoolGame.action(school.zoneAt(player.pos), schoolEntrance.school); if (a) setAct(a.label, a.fn, a.green); else setAct(null); }
      audio.ambient(false, true);
    }
    audio.engine(false, 0, 0, 30);
    if (!paused && !editing) checkWalkOut();
    renderer.render(scene, camera);
  }
  hudT -= dt; if (hudT <= 0) { hudT = 0.25; updateHUD(); }
  saveT += dt; if (saveT > 20) { saveT = 0; persist(); }
  if (!paused && S.energy <= 0 && !busy) faint();
}

function persist() {
  if (mode === 'home') {
    const h = homeEntrance();
    S.player = { x: h.x + h.nx * 1.4, z: h.z + h.nz * 1.4, h: h.face, inside: true };
  }
  else if (mode === 'school' && schoolEntrance) S.player = { x: schoolEntrance.x + schoolEntrance.nx * 1.4, z: schoolEntrance.z + schoolEntrance.nz * 1.4, h: schoolEntrance.face, inside: false };
  else if (mode === 'mart' && martEntrance) S.player = { x: martEntrance.x + martEntrance.nx * 1.4, z: martEntrance.z + martEntrance.nz * 1.4, h: martEntrance.face, inside: false };
  else S.player = { x: (inCar && pcar ? pcar.pos.x : player.pos.x), z: (inCar && pcar ? pcar.pos.z : player.pos.z), h: player.heading, inCar };
  if (pcar) S.carPos = { x: pcar.pos.x, z: pcar.pos.z, h: pcar.heading };
  ST.save(S);
}

// ───────── 걷기 ─────────
function readInput() {
  const i = controls.read();
  if (i.run) player.run = true;
  return i;
}
function moveVector(i) {
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let mx = fx * i.y + rx * i.x, mz = fz * i.y + rz * i.x;
  const m = Math.min(1, Math.hypot(i.x, i.y));
  return { mx, mz, m };
}
function updateWalking(dt) {
  const i = readInput();
  applyLook(i);
  const { mx, mz, m } = moveVector(i);
  const run = player.run || i.run;
  const top = (run ? 5.4 + Math.min(1.2, S.fitness * 0.04) : 1.9) * (S.hunger <= 0 ? 0.7 : 1);
  const target = m > 0.12 ? top * Math.min(1, m * 1.15) : 0;
  player.speed += (target - player.speed) * Math.min(1, dt * 8);
  if (m > 0.12) {
    const want = Math.atan2(mx, mz);
    let dh = want - player.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    player.heading += dh * Math.min(1, dt * 12);
  }
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  player.pos.x += fx * player.speed * dt;
  player.pos.z += fz * player.speed * dt;
  city.collide(player.pos, 0.35, { walker: true });
  traffic.collideWalker(player.pos);
  peds.collide(player.pos);
  if (pcar) collideWithParkedCar(player.pos);
  const gy = city.groundY(player.pos.x, player.pos.z);
  player.pos.y += (gy - player.pos.y) * Math.min(1, dt * 14);
  human.root.position.copy(player.pos);
  human.root.rotation.y = player.heading;
  human.animate(dt, player.speed, run);
}
function collideWithParkedCar(pos) {
  const c = pcar;
  const dx = pos.x - c.pos.x, dz = pos.z - c.pos.z;
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  const along = dx * fx + dz * fz, lat = dx * fz - dz * fx;
  const hl = c.L / 2 + 0.3, hw = c.mesh.W / 2 + 0.3;
  if (Math.abs(along) < hl && Math.abs(lat) < hw) {
    const pa = hl - Math.abs(along), pl = hw - Math.abs(lat);
    if (pa < pl) { pos.x += fx * Math.sign(along) * pa; pos.z += fz * Math.sign(along) * pa; }
    else { pos.x += fz * Math.sign(lat) * pl; pos.z -= fx * Math.sign(lat) * pl; }
  }
}
function applyLook(i) {
  cam.yaw -= i.dx * 0.0065;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + i.dy * 0.0045, -0.05, 1.25);
  if (i.zoom) {
    if (inCar) cam.carDist = THREE.MathUtils.clamp(cam.carDist + i.zoom * 0.8, 5, 18);
    else cam.tdist = THREE.MathUtils.clamp(cam.tdist + i.zoom * 0.6, 2.2, 14);
  }
}

// ───────── 운전 ─────────
let lastThrottle = 0, lastImpactT = 0, prevCarPos = new THREE.Vector3();
function updateDriving(dt) {
  const i = readInput();
  applyLook(i);
  let y = i.y;
  if (input.gas) y = 1; else if (input.brake) y = -1;
  lastThrottle = y;
  prevCarPos.copy(pcar.pos);
  const impact = pcar.update(dt, { x: i.x, y, handbrake: i.handbrake }, city, sky.night);
  const hit = traffic.collidePlayer(pcar);
  if (hit) pcar.speed *= 0.4;
  const imp = Math.max(impact, hit);
  if (imp > 4 && elapsed - lastImpactT > 0.6) {
    lastImpactT = elapsed;
    audio.crash(Math.min(1, imp / 15));
    if (navigator.vibrate) navigator.vibrate(60);
    if (imp > 10) { S.mood = ST.clamp(S.mood - 4); toast('쾅! 조심해서 운전하세요', 'bad'); }
  }
  player.pos.set(pcar.pos.x, pcar.y, pcar.pos.z);
  player.heading = pcar.heading;
  $('kmh').textContent = Math.round(Math.abs(pcar.speed) * 3.6);
  checkRedLight();
}

// 신호위반 단속 카메라
function checkRedLight() {
  const a = nearestRoad(pcar.pos.x), b = nearestRoad(pcar.pos.z);
  if (a < 0 || a > N || b < 0 || b > N) return;
  if (!city.cameras.has(a + ',' + b)) return;
  const J = { x: ROADS[a], z: ROADS[b] };
  const fx = Math.sin(pcar.heading), fz = Math.cos(pcar.heading);
  for (const k of ['+x', '-x', '+z', '-z']) {
    const d = DIRS[k];
    if (fx * d[0] + fz * d[1] < 0.7) continue;
    const along = (pcar.pos.x - J.x) * d[0] + (pcar.pos.z - J.z) * d[1];
    const prev = (prevCarPos.x - J.x) * d[0] + (prevCarPos.z - J.z) * d[1];
    const r = right(d);
    const lat = (pcar.pos.x - J.x) * r[0] + (pcar.pos.z - J.z) * r[1];
    if (prev < -STOP && along >= -STOP && lat > 0 && lat < 8 && pcar.speed > 3) {
      if (city.signal(k) === 'r') {
        const fine = 60000;
        S.money -= fine;
        flashMoney(false);
        audio.bad();
        toast(`📸 신호위반 무인단속! 범칙금 ${won(fine)}`, 'bad', 4000);
      }
    }
  }
}

// ───────── 카메라 ─────────
const tmpV = new THREE.Vector3();
function updateCityCamera(dt) {
  let target, dist;
  if (inCar && pcar) {
    target = tmpV.set(pcar.pos.x, pcar.y + 1.3, pcar.pos.z);
    dist = cam.carDist + Math.abs(pcar.speed) * 0.06;
    if (!controls.looking) {
      const want = pcar.heading + Math.PI;
      let dh = want - cam.yaw; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      cam.yaw += dh * Math.min(1, dt * (Math.abs(pcar.speed) > 1 ? 2.5 : 0.6));
      cam.pitch += (0.2 - cam.pitch) * Math.min(1, dt * 1.5);
    }
  } else {
    target = tmpV.set(player.pos.x, player.pos.y + 1.55, player.pos.z);
    cam.dist += (cam.tdist - cam.dist) * Math.min(1, dt * 6);
    dist = cam.dist;
  }
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const dx = Math.sin(cam.yaw) * cp, dy = sp, dz = Math.cos(cam.yaw) * cp;
  // 건물에 카메라가 박히지 않게
  let d = dist;
  for (let s = 0.5; s <= dist; s += 0.4) {
    const x = target.x + dx * s, y = target.y + dy * s, z = target.z + dz * s;
    if (insideBuilding(x, y, z)) { d = Math.max(1.2, s - 0.5); break; }
  }
  // 가로등·나무 기둥에 카메라가 붙지 않게
  while (d > 1.3 && target.y + dy * d < 9 && city.nearPole(target.x + dx * d, target.z + dz * d, 0.75)) d -= 0.25;
  camera.position.set(target.x + dx * d, Math.max(0.4, target.y + dy * d), target.z + dz * d);
  camera.lookAt(target);
}
function insideBuilding(x, y, z) { return city.insideBuilding(x, y, z); }

// ───────── 목적지/배달 ─────────
function updateTargets(dt) {
  const t = currentTarget();
  if (!t) { beacon.visible = beaconRing.visible = false; return; }
  beacon.visible = beaconRing.visible = true;
  beacon.position.set(t.x, 0, t.z);
  beaconRing.position.set(t.x, 0.25, t.z);
  const col = S.delivery ? (S.delivery.stage === 'pickup' ? 0xffb020 : 0x3ddc84) : 0x46d1ff;
  beacon.material.color.setHex(col); beaconRing.material.color.setHex(col);
  beacon.material.opacity = 0.18 + Math.sin(elapsed * 3) * 0.08;
  beaconRing.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.08);
  if (S.waypoint && !S.delivery && Math.hypot(player.pos.x - t.x, player.pos.z - t.z) < 8) {
    toast(`📍 ${t.name}에 도착했어요`, 'good'); S.waypoint = null;
  }
}

// ───────── 상호작용 (도시) ─────────
let actHandler = null, carHandler = null;
function setAct(label, fn, green) {
  const b = $('btnAct');
  if (!label) { b.classList.add('hidden'); actHandler = null; return; }
  if (b.textContent !== label) { b.textContent = label; b.classList.remove('hidden'); }
  b.classList.toggle('green', !!green);
  actHandler = fn;
}
function setCarBtn(label, fn) {
  const b = $('btnCar');
  if (!label) { b.classList.add('hidden'); carHandler = null; return; }
  b.textContent = label; b.classList.remove('hidden'); carHandler = fn;
}
function updateCityInteract() {
  const p = inCar && pcar ? pcar.pos : player.pos;
  // 차 타기/내리기
  if (inCar) setCarBtn('🚪 내리기', exitCar);
  else if (pcar && p.distanceTo(pcar.pos) < 3.4) setCarBtn('🚗 타기', () => enterCar());
  else setCarBtn(null);
  if (inCar) { setAct(null); return; }
  // 배달 목적지
  const d = S.delivery;
  if (d) {
    const t = d.stage === 'pickup' ? d.pickup : d.drop;
    if (Math.hypot(p.x - t.x, p.z - t.z) < 3.2) {
      setAct(d.stage === 'pickup' ? '📦 음식 픽업하기' : '🔔 배달 완료하기', () => deliveryStep(), true);
      return;
    }
  }
  let best = null, bd = 2.6;
  for (const e of city.entrances) {
    if (e.id === 'home' && e.homeId !== S.home) continue;
    const dd = Math.hypot(p.x - e.x, p.z - e.z);
    if (dd < bd) { bd = dd; best = e; }
  }
  if (best) setAct(`${best.icon} ${best.elevator ? '엘리베이터 타기 · ' : best.walkIn && best.id !== 'school' ? '들어가기 · ' : ''}${best.name}`, () => openPlace(best));
  else setAct(null);
}
$('btnAct').addEventListener('click', () => { if (actHandler && !busy) { audio.click(); actHandler(); } });
$('btnCar').addEventListener('click', () => { if (carHandler && !busy) { audio.click(); carHandler(); } });
$('btnRun').addEventListener('click', () => { player.run = !player.run; $('btnRun').classList.toggle('on', player.run); audio.click(); });
$('btnHorn').addEventListener('pointerdown', () => audio.horn());
for (const [id, key] of [['btnGas', 'gas'], ['btnBrake', 'brake']]) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); input[key] = true; b.classList.add('on'); });
  const up = () => { input[key] = false; b.classList.remove('on'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
}
window.addEventListener('keydown', (e) => {
  if (mode === 'title') return;
  if (e.code === 'KeyE' && actHandler && !sheetOpen() && !busy) actHandler();
  if (e.code === 'KeyF' && carHandler && !sheetOpen() && !busy) carHandler();
  if (e.code === 'KeyH' && inCar) audio.horn();
  if (e.code === 'Escape') { closeSheet(); closePhone(); }
  if (e.code === 'KeyR' && !inCar) { player.run = !player.run; $('btnRun').classList.toggle('on', player.run); }
});

function openPlace(e) {
  switch (e.id) {
    case 'home': return e.walkIn ? walkInto(e.site) : enterHome();
    case 'mart': return walkInto(e.site);
    case 'school': return schoolGame.gate(e, () => walkInto(e.site));
    case 'rest': return restSheet();
    case 'office': return officeSheet();
    case 'delivery': return deliverySheet();
    case 'cars': return carSheet();
    case 'furn': return furnSheet();
    case 'realty': return realtySheet();
    case 'gym': return gymSheet();
  }
}

// ───────── 돈/욕구 ─────────
function pay(amount, reason) {
  if (S.money < amount) { audio.bad(); toast(`돈이 부족해요 (${won(amount)} 필요)`, 'bad'); return false; }
  S.money -= amount; flashMoney(false);
  return true;
}
function earn(amount, reason) {
  amount = Math.round(amount / 10) * 10;
  if (S.loan > 0) {
    const repay = Math.min(S.loan, Math.round(amount * 0.2 / 10) * 10);
    S.loan -= repay; amount -= repay;
    reason += ` (학자금 상환 ${won(repay)}${S.loan <= 0 ? ' · 대출 다 갚았어요!' : ''})`;
  }
  S.money += amount; S.totalEarned += amount; flashMoney(true);
  audio.coin();
  toast(`💰 ${reason} +${won(amount)}`, 'good', 3200);
  checkGoals();
}
function flashMoney(good) {
  const m = document.querySelector('.money');
  m.classList.remove('flash', 'flashbad'); void m.offsetWidth; m.classList.add(good ? 'flash' : 'flashbad');
  updateHUD(true);
}
function eat(f, minutes = 10) {
  S.hunger = ST.clamp(S.hunger + f.hunger);
  if (f.energy) S.energy = ST.clamp(S.energy + f.energy);
  S.mood = ST.clamp(S.mood + (f.price > 8000 ? 8 : 2));
  ST.passTime(S, minutes, 'idle');
  S.ateOnce = true;
  toast(`😋 ${f.name} 냠냠 (배고픔 +${f.hunger}${f.energy ? `, 에너지 +${f.energy}` : ''})`, 'good');
  checkGoals();
  updateHUD(true);
}
let warned = {};
function needWarnings(beforeEnergy) {
  const chk = (k, v, lim, msg) => { if (v < lim && !warned[k + lim]) { warned[k + lim] = true; toast(msg, 'bad', 4000); } if (v > lim + 10) warned[k + lim] = false; };
  chk('h', S.hunger, 20, '🍚 배가 고파요. 편의점이나 식당에 가 보세요');
  chk('h', S.hunger, 5, '🍚 너무 배고파서 힘이 빠져요!');
  chk('e', S.energy, 20, '⚡ 피곤해요. 집에 가서 자야 해요');
  chk('e', S.energy, 8, '⚡ 곧 쓰러질 것 같아요… 커피나 잠이 필요해요');
}

// ───────── HUD ─────────
const DAYNAMES = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
function updateHUD(force) {
  const c = ST.clock(S);
  $('clk').textContent = c.text;
  $('day').textContent = `${ST.day(S)}일차 · ${DAYNAMES[(ST.day(S) - 1) % 7]}`;
  $('money').textContent = Math.round(S.money).toLocaleString('ko-KR');
  for (const [id, v] of [['nHunger', S.hunger], ['nEnergy', S.energy], ['nMood', S.mood]]) {
    const el = $(id);
    el.querySelector('b').style.width = v + '%';
    el.classList.toggle('low', v < 20); el.classList.toggle('mid', v >= 20 && v < 45);
  }
  $('nMood').querySelector('i').textContent = S.mood > 70 ? '😄' : S.mood > 40 ? '🙂' : S.mood > 20 ? '😐' : '😞';
  // 목표 문구
  const t = currentTarget();
  const p = inCar && pcar ? pcar.pos : player.pos;
  let html = '';
  if (S.delivery) {
    const dd = Math.round(Math.hypot(p.x - t.x, p.z - t.z));
    html = S.delivery.stage === 'pickup' ? `📦 <b>${t.name}</b>에서 음식 픽업 <span class="dist">${dd}m</span><small>${won(S.delivery.pay)} 배달 · 빛기둥을 따라가세요</small>` : `🛵 <b>${t.name}</b>로 배달 <span class="dist">${dd}m</span><small>${won(S.delivery.pay)} · 시간 안에 가면 팁!</small>`;
  } else if (S.waypoint) {
    html = `📍 ${S.waypoint.name} <span class="dist">${Math.round(Math.hypot(p.x - t.x, p.z - t.z))}m</span>`;
  } else if (mode === 'mart') {
    html = martGame.hudText();
  } else if (mode === 'school') {
    html = schoolGame.hudText(schoolEntrance.school);
  } else if (mode === 'city') {
    const g = GOALS.find(g => !S.goalsDone?.includes(g.id));
    if (g) html = `🎯 ${g.text}<small>${g.hint}</small>`;
  }
  if ($('objective').innerHTML !== html) $('objective').innerHTML = html;
  $('joyHint').classList.toggle('hidden', elapsed > 40 || mode !== 'city' || inCar || player.speed > 0.5 || editing);
  if (editing) $('joyHint').classList.add('hidden');
}

// ───────── 인생 목표 ─────────
const GOALS = [
  { id: 'eat', text: '편의점에서 밥 사 먹기', hint: '파란 링이 있는 24 마트에 들어가 보세요', done: () => S.ateOnce },
  { id: 'job', text: '첫 돈 벌기', hint: '편의점 알바 · 번개배달 · 한빛그룹 중 하나를 골라요', done: () => S.totalEarned > 0 },
  { id: 'money', text: '100만 원 모으기', hint: '꾸준히 일하면 금방이에요', done: () => S.money >= 1000000 },
  { id: 'car', text: '첫 차 뽑기', hint: '드림모터스 전시장에서 중고 경차부터!', done: () => S.cars.length > 0 },
  { id: 'furn', text: '집에 가구 3개 들이기', hint: '홈데코에서 사고, 집에서 🛠 꾸미기로 배치', done: () => Object.values(S.placed).flat().filter(p => !['bed', 'fridge'].includes(p.id)).length >= 3 },
  { id: 'promo', text: '회사에서 대리로 승진하기', hint: '한빛그룹에 출근하고, 집 책상에서 공부해요', done: () => S.officeRank >= 2 },
  { id: 'apt', text: '아파트로 이사하기', hint: '행복 부동산 · 투룸 아파트 3,000만 원', done: () => S.homes.includes('apt') },
  { id: 'sport', text: '스포츠카 오너 되기', hint: '드림모터스 · 카이엔느 GT', done: () => S.cars.includes('sport') },
  { id: 'pent', text: '펜트하우스 입주', hint: '도시 꼭대기에서 야경 보기', done: () => S.homes.includes('pent') },
];
function checkGoals() {
  S.goalsDone = S.goalsDone || [];
  for (const g of GOALS) {
    if (!S.goalsDone.includes(g.id) && g.done()) {
      S.goalsDone.push(g.id);
      audio.chime();
      setTimeout(() => bigMsg('🏆 목표 달성!', g.text, 2600), 400);
    }
  }
}

// ───────── 미니맵 ─────────
const mini = $('mini'), mctx = mini.getContext('2d');
function drawMinimap() {
  const W = mini.width, R = W / 2, s = 0.7;
  const p = inCar && pcar ? pcar.pos : playerWorld();
  mctx.save();
  mctx.clearRect(0, 0, W, W);
  mctx.beginPath(); mctx.arc(R, R, R, 0, 7); mctx.clip();
  mctx.fillStyle = '#2b3138'; mctx.fillRect(0, 0, W, W);
  mctx.translate(R, R); mctx.rotate(cam.yaw); mctx.scale(s, s); mctx.translate(-p.x, -p.z);
  mctx.fillStyle = '#4a5260';
  drawBlocks(mctx);
  mctx.fillStyle = '#7a8494';
  for (const c of city.query(p.x - 170, p.z - 170, p.x + 170, p.z + 170)) if (!c.soft) mctx.fillRect(c.x0, c.z0, c.x1 - c.x0, c.z1 - c.z0);
  // 장소 아이콘
  mctx.font = '14px sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
  for (const e of city.entrances) {
    mctx.save(); mctx.translate(e.x, e.z); mctx.rotate(-cam.yaw); mctx.scale(1 / s, 1 / s);
    mctx.fillStyle = 'rgba(10,14,20,0.75)'; mctx.beginPath(); mctx.arc(0, 0, 10, 0, 7); mctx.fill();
    mctx.fillText(e.icon, 0, 1); mctx.restore();
  }
  if (pcar && inCar === false) {
    mctx.save(); mctx.translate(pcar.pos.x, pcar.pos.z); mctx.rotate(-cam.yaw); mctx.scale(1 / s, 1 / s);
    mctx.fillText('🚗', 0, 0); mctx.restore();
  }
  mctx.restore();
  // 목적지 (가장자리 화살표)
  const t = currentTarget();
  if (t) {
    let dx = (t.x - p.x) * s, dz = (t.z - p.z) * s;
    const c = Math.cos(cam.yaw), sn = Math.sin(cam.yaw);
    let x = dx * c - dz * sn, y = dx * sn + dz * c;
    const d = Math.hypot(x, y);
    if (d > R - 10) { x = x / d * (R - 10); y = y / d * (R - 10); }
    mctx.fillStyle = S.delivery ? (S.delivery.stage === 'pickup' ? '#ffb020' : '#3ddc84') : '#46d1ff';
    mctx.beginPath(); mctx.arc(R + x, R + y, 7, 0, 7); mctx.fill();
    mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.stroke();
  }
  // 나 (화살표)
  mctx.save(); mctx.translate(R, R);
  const h = (inCar && pcar ? pcar.heading : player.heading);
  mctx.rotate(cam.yaw - h + Math.PI);
  mctx.fillStyle = '#46d1ff'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.moveTo(0, -11); mctx.lineTo(8, 9); mctx.lineTo(0, 4); mctx.lineTo(-8, 9); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
  mctx.fillStyle = 'rgba(255,255,255,0.9)'; mctx.font = 'bold 13px sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
  mctx.fillText('N', R + Math.sin(cam.yaw) * (R - 11), R - Math.cos(cam.yaw) * (R - 11));
}
mini.addEventListener('click', () => openPhone('map'));
function drawBlocks(ctx) {
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const z = ZONES[j][i];
    const r = blockRect(i, j);
    ctx.fillStyle = ZONE_COLOR[z] || '#59616e';
    if (z === 'L') { const R0 = blockRect(5, 5), R1 = blockRect(6, 6); ctx.fillRect(R0.x0, R0.z0, R1.x1 - R0.x0, R1.z1 - R0.z0); continue; }
    ctx.fillRect(r.x0, r.z0, r.w, r.d);
  }
  ctx.fillStyle = '#2f6a8a';
  ctx.beginPath();
  for (let k = 0; k <= 64; k++) { const th = k / 64 * Math.PI * 2, rr = lakeR(th); k ? ctx.lineTo(Math.cos(th) * rr, Math.sin(th) * rr) : ctx.moveTo(Math.cos(th) * rr, Math.sin(th) * rr); }
  ctx.fill();
}

// ───────── 음식 ─────────
function foodRows(where) {
  return FOODS.filter(f => f.where === where).map(f => row({
    icon: foodIcon(f.id), title: f.name, desc: `배고픔 +${f.hunger}${f.energy ? ` · 에너지 +${f.energy}` : ''}`, price: won(f.price),
    btn: '주문', action: 'eat:' + f.id,
  })).join('');
}
function foodIcon(id) { return { kimbap: '🍙', ramen: '🍜', sand: '🥪', dosirak: '🍱', coffee: '☕', energy: '🥫', kimchi: '🍲', bulgogi: '🥘', galbi: '🥩' }[id] || '🍽️'; }
function tabs(b) {
  b.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', () => {
    audio.click();
    b.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === t));
    b.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== t.dataset.tab));
  }));
}
// 음식 정보 (편의점 상품 · 데운 음식(#hot) · 직접 만든 요리(이름@맛@추가재료))
function foodInfo(id) {
  if (id.includes('@')) {
    const [d, q, ex] = id.split('@');
    const b = DISHES[d], qq = (+q) / 100, extras = ex ? ex.split(',').filter(Boolean).length : 0;
    return { name: b.name + (qq > 0.85 ? ' (최고)' : qq < 0.35 ? ' (탐)' : ''), icon: b.icon, hunger: Math.round(b.hunger * (0.6 + 0.4 * qq)) + extras * 8, mood: Math.round(b.mood * (0.3 + 0.9 * qq)) + extras * 2, energy: 0, homemade: true };
  }
  const hot = id.endsWith('#hot'), base = id.replace('#hot', '');
  const p = PRODUCT[base] || DISHES[base] || FOODS.find(f => f.id === base) || { name: base, hunger: 5 };
  const info = { ...p, icon: p.icon || foodIcon(base) };
  if (!hot) return info;
  return { ...info, needWater: false, name: p.needWater ? `${p.name} (다 익음)` : `따뜻한 ${p.name}`, hunger: (p.hunger || 0) + 5, mood: (p.mood || 0) + 4 };
}
function eatFood(id, { minutes = 10, moodBonus = 0 } = {}) {
  const f = foodInfo(id);
  if (!S.inventory.food[id]) return;
  S.inventory.food[id]--; if (S.inventory.food[id] <= 0) delete S.inventory.food[id];
  S.hunger = ST.clamp(S.hunger + (f.hunger || 0));
  if (f.energy) S.energy = ST.clamp(S.energy + f.energy);
  S.mood = ST.clamp(S.mood + (f.mood || 0) + moodBonus);
  ST.passTime(S, minutes, 'idle');
  S.ateOnce = true;
  audio.play('eat');
  toast(`😋 ${f.name} 냠냠 (배고픔 +${f.hunger || 0}${f.energy ? `, 에너지 ${f.energy > 0 ? '+' : ''}${f.energy}` : ''})`, 'good');
  checkGoals();
  updateHUD(true);
  persist();
}

// ───────── 장소: 식당 ─────────
function restSheet() {
  openSheet({
    icon: '🍚', title: '한끼식당', sub: '집밥보다 맛있는 한식 · 30분 소요',
    html: foodRows('rest'),
    bind: (b) => bindActs(b, { eat: (id) => { const f = FOODS.find(x => x.id === id); if (pay(f.price)) { closeSheet(); mealScene(f); } } }),
  });
}
async function mealScene(f) {
  busy = true;
  await fade(true);
  eat(f, 30);
  await wait(300);
  await fade(false);
  busy = false;
}

// ───────── 장소: 회사 ─────────
function officeSheet() {
  const r = ST.rank(S);
  const weekend = ST.isWeekend(S);
  const h = ST.hour(S);
  const open = !weekend && h >= 8 && h < 18;
  const need = 3 + S.officeRank * 2;
  if (!S.officeHired) {
    openSheet({
      icon: '🏢', title: '한빛그룹 본사', sub: '로비 · 인사팀',
      html: `<p class="note">한빛그룹은 지금 <b>신입 인턴</b>을 뽑고 있어요.<br>시급 <b>${won(OFFICE_RANKS[0].wage)}</b>부터 시작해서 승진할수록 크게 올라요 (상무 ${won(OFFICE_RANKS[6].wage)}/시간).<br>근무: 평일 오전 8시 ~ 오후 6시, 한 번에 4시간 (하루 최대 2번)</p>
        <button class="btn wide green" data-act="hire">입사 지원하기 (면접 1시간)</button>`,
      bind: (b) => bindActs(b, { hire: async () => { closeSheet(); busy = true; await fade(true); ST.passTime(S, 60, 'work'); S.officeHired = true; await fade(false); busy = false; audio.chime(); bigMsg('🎉 합격!', '한빛그룹 인턴으로 입사했어요. 평일에 출근하세요.'); persist(); } }),
    });
    return;
  }
  openSheet({
    icon: '🏢', title: '한빛그룹 본사', sub: `${r.name} · 시급 ${won(r.wage)}`,
    html: `<div class="grid2" style="margin-bottom:10px"><div class="stat"><span>직급</span><b>${r.name}</b></div><div class="stat"><span>승진까지</span><b>${Math.min(need, S.officeExp).toFixed(1)} / ${need}</b></div></div>
      <p class="note">${open ? '지금 출근할 수 있어요. 결재 서류를 규칙대로 처리하면 성과급과 승진 점수를 받아요.' : weekend ? '오늘은 주말이라 회사가 쉬어요. 월요일에 만나요!' : '근무 시간이 아니에요 (평일 오전 8시 ~ 오후 6시).'}<br>오늘 근무: <b>${S.shiftsToday}/2회</b></p>
      <button class="btn wide green" data-act="work" ${!open || S.shiftsToday >= 2 ? 'disabled' : ''}>출근하기 (4시간 근무)</button>`,
    bind: (b) => bindActs(b, { work: () => { if (S.energy < 20) return toast('너무 피곤해서 출근할 수 없어요. 먼저 쉬세요', 'bad'); closeSheet(); officeGame(); } }),
  });
}
function officeGame() {
  const mg = $('mg');
  mg.classList.remove('hidden');
  let t = TEST ? 4 : 30, ok = 0, bad = 0, cur = null, running = true;
  const types = ['지출 결의서', '출장비 청구서', '비품 구매 요청', '광고비 집행안', '회식비 정산'];
  const names = ['김민준', '이서연', '박도윤', '최지우', '정하준', '강서윤', '조은우', '윤지아'];
  function newDoc() {
    const limit = [300000, 500000, 1000000, 2000000][Math.floor(Math.random() * 4)];
    const amount = Math.round((limit * (0.4 + Math.random() * 0.9)) / 1000) * 1000;
    const signed = Math.random() < 0.82;
    const ok = amount <= limit && signed;
    cur = { limit, amount, signed, ok };
    $('doc').innerHTML = `<h3>📄 ${types[Math.floor(Math.random() * types.length)]}</h3>
      기안자: ${names[Math.floor(Math.random() * names.length)]}<br>요청 금액: <b>${won(amount)}</b><br>결재 한도: ${won(limit)}<br>팀장 서명: ${signed ? '<b>✔ 있음</b>' : '<b style="color:#c22">✘ 없음</b>'}
      <div class="rule">규칙: 한도 이하 + 서명 있음 → 승인, 아니면 반려</div>`;
  }
  mg.innerHTML = `<div class="mg-box"><div class="mg-top"><span>🗂 결재 서류 처리</span><span class="t" id="mgT">30</span></div>
    <div class="doc" id="doc"></div>
    <div class="mg-btns"><button class="btn red" id="rej">반려</button><button class="btn green" id="acc">승인</button></div>
    <div class="mg-top" style="margin-top:10px;font-size:14px"><span>정확 <b id="mgOk">0</b> · 실수 <b id="mgBad" style="color:var(--bad)">0</b></span></div></div>`;
  newDoc();
  const answer = (v) => {
    if (!running) return;
    if (v === cur.ok) { ok++; audio.beep(); } else { bad++; audio.bad(); }
    $('mgOk').textContent = ok; $('mgBad').textContent = bad;
    newDoc();
  };
  $('acc').addEventListener('click', () => answer(true));
  $('rej').addEventListener('click', () => answer(false));
  const iv = setInterval(async () => {
    t--; $('mgT').textContent = t;
    if (t <= 0) {
      clearInterval(iv); running = false;
      mg.classList.add('hidden'); mg.innerHTML = '';
      busy = true; await fade(true); ST.passTime(S, 240, 'work'); S.shiftsToday++; await fade(false); busy = false;
      const acc = ok / Math.max(1, ok + bad);
      const r = ST.rank(S);
      const perf = 0.65 + 0.35 * acc + Math.min(0.25, ok * 0.012);
      earn(r.wage * 4 * perf, `${r.name} 4시간 근무 (정확도 ${Math.round(acc * 100)}%)`);
      S.officeExp += acc >= 0.75 ? 1 : 0.4;
      tryPromote();
      persist();
    }
  }, 1000);
}
function tryPromote() {
  const need = 3 + S.officeRank * 2;
  if (S.officeExp >= need && S.officeRank < OFFICE_RANKS.length - 1) {
    S.officeExp -= need; S.officeRank++;
    const r = ST.rank(S);
    audio.chime();
    setTimeout(() => bigMsg('📈 승진했어요!', `${r.name} · 시급 ${won(r.wage)}`, 3200), 600);
    S.mood = ST.clamp(S.mood + 20);
    checkGoals();
  }
}

// ───────── 장소: 배달 ─────────
function deliverySheet() {
  const on = !!S.delivery;
  openSheet({
    icon: '🛵', title: '번개배달 센터', sub: '내 차나 두 발로 배달하기',
    html: `<p class="note">음식점에서 픽업해서 손님 건물 앞까지 가져다주면 돼요.<br>거리가 멀수록 배달비가 올라가고, <b>빨리 도착하면 팁</b>이 붙어요. 차가 있으면 훨씬 유리해요!<br>완료한 배달: <b>${S.deliveries}건</b></p>
      ${on ? '<button class="btn wide red" data-act="stop">배달 그만하기</button>' : '<button class="btn wide green" data-act="start">배달 시작하기</button>'}`,
    bind: (b) => bindActs(b, { start: () => { closeSheet(); newDelivery(); }, stop: () => { S.delivery = null; closeSheet(); toast('오늘 배달은 여기까지!'); } }),
  });
}
function newDelivery() {
  const pickups = city.entrances.filter(e => e.id === 'rest' || e.id === 'mart');
  const p = pickups[Math.floor(Math.random() * pickups.length)];
  let d;
  for (let k = 0; k < 30; k++) { d = city.doors[Math.floor(Math.random() * city.doors.length)]; if (Math.hypot(d.x - p.x, d.z - p.z) > 90) break; }
  const dist = Math.hypot(d.x - p.x, d.z - p.z) + Math.hypot(p.x - player.pos.x, p.z - player.pos.z) * 0.3;
  S.delivery = { stage: 'pickup', pickup: { x: p.x, z: p.z, name: p.name }, drop: { x: d.x, z: d.z, name: d.name }, pay: Math.round((3200 + dist * 22) / 100) * 100, dist };
  toast(`📱 새 배달! ${p.name} → ${d.name} (${won(S.delivery.pay)})`, 'good', 3500);
  audio.chime();
}
function deliveryStep() {
  const d = S.delivery;
  if (d.stage === 'pickup') {
    d.stage = 'drop';
    d.t0 = S.minutes;
    audio.beep();
    toast(`📦 픽업 완료! ${d.drop.name}로 가세요`);
  } else {
    const took = S.minutes - d.t0;
    const fast = d.dist / 4.5 / 60 * 1.3;     // 분 (게임 시간)
    const tip = took < fast ? Math.round(d.pay * 0.4 / 100) * 100 : 0;
    S.deliveries++;
    earn(d.pay + tip, tip ? `배달 완료 + 빠른 배달 팁 ${won(tip)}` : '배달 완료');
    S.mood = ST.clamp(S.mood + 1);
    S.delivery = null;
    setTimeout(() => { if (!S.delivery && mode === 'city') newDelivery(); }, 2500);
    persist();
  }
}

// ───────── 장소: 자동차 ─────────
function carSheet() {
  openSheet({
    icon: '🚗', title: '드림모터스', sub: '내 인생의 첫 차부터 드림카까지',
    html: CARS.map(c => {
      const owned = S.cars.includes(c.id);
      const active = S.car === c.id;
      return row({ icon: { mini: '🚙', sedan: '🚘', suv: '🚐', sport: '🏎️' }[c.id], title: c.name, desc: `${c.desc} · 최고 ${Math.round(c.maxSpeed * 3.6)}km/h`, price: owned ? '' : won(c.price), btn: owned ? (active ? '타는 중' : '이 차 타기') : '구매', btnClass: owned ? 'gray' : 'green', disabled: active, action: (owned ? 'use:' : 'buy:') + c.id });
    }).join('') + `<p class="note">구매한 차는 전시장 앞 주차장에 준비돼요. 차 옆에서 <b>🚗 타기</b>를 누르세요.</p>`,
    bind: (b) => bindActs(b, {
      buy: (id) => {
        const c = CARS.find(x => x.id === id);
        if (!pay(c.price)) return;
        S.cars.push(id); S.car = id; S.carPos = null;
        spawnPlayerCar();
        closeSheet();
        audio.chime();
        bigMsg('🔑 출고 완료!', `${c.name} · 앞 주차장에 있어요`, 3000);
        checkGoals(); persist();
      },
      use: (id) => { S.car = id; S.carPos = null; spawnPlayerCar(); closeSheet(); toast('전시장 앞에 차를 준비해 뒀어요'); persist(); },
    }),
  });
}

// ───────── 장소: 가구점 ─────────
const FICON = { bed: '🛏️', bed2: '🛏️', fridge: '🧊', desk: '🪑', chair: '💺', sofa: '🛋️', table: '🍽️', tv: '📺', shelf: '📚', plant: '🪴', lamp: '💡', rug: '🟫', pc: '🖥️', wardrobe: '🚪', piano: '🎹' };
function furnSheet() {
  openSheet({
    icon: '🛋️', title: '홈데코 가구점', sub: '산 가구는 집에서 🛠 꾸미기로 배치해요',
    html: FURNITURE.filter(f => f.price > 0 || f.id === 'bed' || f.id === 'fridge').map(f => row({
      icon: FICON[f.id], title: f.name, desc: (INTERACT[f.id] ? `집에서: ${INTERACT[f.id]}` : '분위기 UP') + ` · 보유 ${countFurn(f.id)}개`, price: won(f.price || (f.id === 'bed' ? 190000 : 390000)), btn: '구매', action: 'buy:' + f.id,
    })).join(''),
    bind: (b) => bindActs(b, {
      buy: (id, btn) => {
        const f = FURNITURE.find(x => x.id === id);
        const price = f.price || (id === 'bed' ? 190000 : 390000);
        if (!pay(price)) return;
        S.inventory.furniture[id] = (S.inventory.furniture[id] || 0) + 1;
        toast(`📦 ${f.name} 배송 완료! 집에서 꾸미기로 놓아 주세요`, 'good');
        btn.closest('.row').querySelector('.info span').textContent = (INTERACT[f.id] ? `집에서: ${INTERACT[f.id]}` : '분위기 UP') + ` · 보유 ${countFurn(f.id)}개`;
        persist();
      },
    }),
  });
}
function countFurn(id) {
  return (S.inventory.furniture[id] || 0) + Object.values(S.placed).flat().filter(p => p.id === id).length;
}

// ───────── 장소: 부동산 ─────────
function realtySheet() {
  openSheet({
    icon: '🏘️', title: '행복 부동산', sub: '좋은 집, 좋은 인생',
    html: HOMES.map(h => {
      const owned = S.homes.includes(h.id), cur = S.home === h.id;
      return row({ icon: { oneroom: '🚪', apt: '🏢', pent: '🌃' }[h.id], title: h.name, desc: `${h.desc} · ${h.w}×${h.d}m`, price: owned ? '' : won(h.price), btn: owned ? (cur ? '사는 중' : '이사하기') : '매매', btnClass: owned ? 'gray' : 'green', disabled: cur, action: (owned ? 'move:' : 'buy:') + h.id });
    }).join('') + `<p class="note">이사해도 이전 집의 가구는 그대로 남아 있어요. 언제든 다시 이사할 수 있어요.</p>`,
    bind: (b) => bindActs(b, {
      buy: (id) => {
        const h = HOMES.find(x => x.id === id);
        if (!pay(h.price)) return;
        S.homes.push(id); S.home = id;
        if (!S.placed[id] || !S.placed[id].length) {
          S.placed[id] = [{ uid: S.nextUid++, id: 'bed', x: -h.w / 2 + 1.0, z: -h.d / 2 + 1.2, rot: 0 }, { uid: S.nextUid++, id: 'fridge', x: -h.w / 2 + 0.45, z: h.d / 2 - 0.5, rot: 1 }];
        }
        closeSheet(); audio.chime();
        setupHome();
        bigMsg('🏡 내 집 마련!', `${h.name}로 이사했어요. 휴대폰 지도에서 🏠를 찾아가세요`, 3400);
        checkGoals(); persist();
      },
      move: (id) => { S.home = id; setupHome(); closeSheet(); toast(`📦 ${HOMES.find(x => x.id === id).name}로 이사했어요`); persist(); },
    }),
  });
}

// ───────── 장소: 헬스장 ─────────
function gymSheet() {
  openSheet({
    icon: '💪', title: '핏라이프 헬스장', sub: `체력 레벨 ${S.fitness} · 달리기 속도가 빨라져요`,
    html: row({ icon: '🏋️', title: '1시간 운동', desc: '기분 +16 · 체력 +1 · 에너지 많이 소모', price: won(12000), btn: '운동', action: 'gym' }) +
      row({ icon: '🚿', title: '샤워', desc: '개운해요 · 기분 +10 · 15분', price: won(3000), btn: '샤워', action: 'shower' }),
    bind: (b) => bindActs(b, {
      gym: async () => { if (S.energy < 20) return toast('너무 피곤해요', 'bad'); if (!pay(12000)) return; closeSheet(); busy = true; await fade(true); ST.passTime(S, 60, 'gym'); S.fitness++; await fade(false); busy = false; toast(`💪 운동 완료! 체력 레벨 ${S.fitness}`, 'good'); persist(); },
      shower: async () => { if (!pay(3000)) return; closeSheet(); busy = true; await fade(true); ST.passTime(S, 15, 'idle'); S.mood = ST.clamp(S.mood + 10); await fade(false); busy = false; toast('🚿 상쾌해요!', 'good'); },
    }),
  });
}

// ───────── 집 (실내) ─────────
// ───────── 실내 공통 ─────────
// 실내 공간은 도시 속 실제 건물(사이트) 안에 붙어 있어요.
// 실내에 있는 동안 player.pos 는 그 건물 기준 좌표예요.
function homeEntrance() { return city.entrances.find(e => e.id === 'home' && e.homeId === S.home) || city.entrances.find(e => e.id === 'home'); }
function playerWorld() {
  if (site && room) { site.anchor.updateWorldMatrix(true, false); return site.anchor.localToWorld(pwTmp.copy(player.pos)); }
  return pwTmp.copy(player.pos);
}
function setupHome() {
  interior.build(S.home, S.placed[S.home]);
  let moved = false;
  for (const it of S.placed[S.home] || []) { const x = it.x, z = it.z; interior.clampItem(it); if (x !== it.x || z !== it.z) moved = true; }
  if (moved) interior.build(S.home, S.placed[S.home]);
  if (interior.lightOn === undefined) interior.lightOn = true;
  homeSite = city.siteFor('home', S.home);
  homeSite.anchor.add(interior.root);
  interior.walkIn = homeSite.kind !== 'tower';
}
// 가까운 편의점 · 학교 건물에 실내를 붙임
function attachRooms(force) {
  const p = playerWorld();
  const near = (kind, r) => { let best = null, bd = r; for (const s of city.sites) if (s.kind === kind) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } } return best; };
  const m = near('mart', 260);
  if (m && m !== martSite && mode !== 'mart') { mart.clearNpcs(); m.anchor.add(mart.root); martSite = m; }
  const sc = near('school', 320);
  if (sc && sc !== schoolSite && mode !== 'school') {
    school.build(sc.school); sc.anchor.add(school.root); schoolSite = sc;
    schoolGame.onEnter(sc.school);
  }
}
function roomOf(s) {
  if (s === martSite) return ['mart', mart];
  if (s === schoolSite) return ['school', school];
  if (s === homeSite) return ['home', interior];
  return null;
}
function checkWalkIn() {
  for (const s of [martSite, schoolSite, homeSite]) {
    if (!s || s.kind === 'tower') continue;
    const [lx, lz] = s.toLocal(player.pos.x, player.pos.z);
    if (Math.abs(lx) < s.W / 2 - 0.2 && lz < s.D / 2 - 0.25 && lz > -s.D / 2) {
      const r = roomOf(s); if (r) enterSite(s, r[0], r[1], lx, lz);
      return;
    }
  }
}
function enterSite(s, kind, r, lx, lz) {
  if (inCar) exitCar();
  s.anchor.updateWorldMatrix(true, false);
  camLocal.copy(camera.position); s.anchor.worldToLocal(camLocal);
  site = s; room = r; mode = kind;
  s.inside = true;
  player.pos.set(lx, 0, lz);
  player.heading -= s.rot; cam.yaw -= s.rot;
  player.speed = Math.min(player.speed, 1.7);
  s.anchor.add(human.root);
  human.root.position.copy(player.pos); human.root.rotation.y = player.heading;
  human.setPose('stand');
  setAct(null); setCarBtn(null);
  $('mini').classList.add('hidden');
  $('btnRun').classList.add('hidden');
  if (kind === 'mart') {
    martEntrance = city.entrances.find(e => e.site === s);
    martGame.onEnter();
    audio.play('door');
    if (!S.martVisited) { S.martVisited = true; setTimeout(() => toast('🛒 매대 앞에 서면 물건을 담을 수 있어요 · 계산은 계산대 앞에서'), 600); }
  } else if (kind === 'school') {
    schoolEntrance = city.entrances.find(e => e.site === s);
    schoolGame.onEnter(s.school);
    if (!S.schoolVisited) { S.schoolVisited = true; setTimeout(() => toast('🏫 왼쪽: 교실 · 가운데: ' + (s.school === 'univ' ? '도서관 (행정실은 복도)' : '교무실') + ' · 오른쪽: 급식실'), 600); }
  } else if (kind === 'home') {
    if (!$('editBtn')) {
      const eb = document.createElement('button'); eb.id = 'editBtn'; eb.className = 'pill'; eb.textContent = '🛠 꾸미기';
      eb.addEventListener('click', () => { audio.click(); startEdit(); });
      $('actions').appendChild(eb);
    }
    $('editBtn').classList.remove('hidden');
    $('btnLight').classList.remove('hidden');
    updateLightBtn();
    S.player = { ...(S.player || {}), inside: true };
  }
  city.updateLOD(camera.position, 0);
}
// 건물 밖으로 (좌표를 도시 기준으로 되돌림)
function leaveSite() {
  const s = site;
  if (!s) { leaveRoom(); return; }
  if (s.kind !== 'tower' && player.pos.z < s.D / 2 + 0.9) player.pos.z = s.D / 2 + 0.9;
  s.anchor.updateWorldMatrix(true, false);
  const w = s.anchor.localToWorld(player.pos.clone());
  player.pos.set(w.x, city.groundY(w.x, w.z), w.z);
  player.heading += s.rot; cam.yaw += s.rot;
  scene.add(human.root);
  human.root.position.copy(player.pos); human.root.rotation.y = player.heading;
  s.inside = false;
  site = null;
  leaveRoom();
  city.updateLOD(camera.position, 0);
}
// 실내 → 도시 (UI 정리)
function leaveRoom() {
  if (editing) endEdit();
  human.setPose('stand'); human.carry = false; human.work = false;
  room = null;
  mode = 'city';
  $('mini').classList.remove('hidden');
  $('btnRun').classList.remove('hidden');
  $('editBtn')?.classList.add('hidden');
  $('btnLight').classList.add('hidden');
  interior.tvOn = false;
  cam.kitchen = false;
  cam.pitch = Math.min(cam.pitch, 0.5);
  if (S.player) S.player.inside = false;
}
// 문으로 걸어서 나가기
let exitCool = 0;
function checkWalkOut() {
  if (!site || site.kind === 'tower' || busy) return;
  if (player.pos.z < site.D / 2 + 0.3) return;
  if (elapsed < exitCool) { player.pos.z = site.D / 2 + 0.25; return; }
  exitCool = elapsed + 1.5;
  if (mode === 'mart') return exitMart(true);
  if (mode === 'school') return exitSchool(true);
  if (mode === 'home') return exitHome(true);
}
function placeAtEntrance(e) {
  player.pos.set(e.x + (e.nx ?? 0) * 1.4, 0.18, e.z + (e.nz ?? 1) * 1.4);
  player.heading = e.face;
  cam.yaw = player.heading + Math.PI; cam.pitch = 0.3;
  city.collide(player.pos, 0.35, { walker: true });
  human.root.position.copy(player.pos);
  updateCityCamera(10);
}
// 입구 버튼을 누르면 문 안쪽으로 들어감
function walkInto(s) {
  if (!s || busy) return;
  if (s.kind === 'mart' && s !== martSite) { mart.clearNpcs(); s.anchor.add(mart.root); martSite = s; }
  if (s.kind === 'school' && s !== schoolSite) { school.build(s.school); s.anchor.add(school.root); schoolSite = s; }
  const r = roomOf(s); if (!r) return;
  const dx = s.kind === 'mart' ? 4.2 : s.kind === 'school' ? 0 : interior.door.x;
  player.heading = Math.PI + s.rot; cam.yaw = 0.3 + s.rot; cam.pitch = 0.9; cam.tdist = 5;
  enterSite(s, r[0], r[1], dx, s.D / 2 - 0.8);
  updateRoomCamera(10);
}

async function enterHome(silent) {
  if (mode === 'home') return;
  busy = true;
  if (!silent) await fade(true);
  if (site) { if (mode === 'mart') mart.clearNpcs(); leaveSite(); }
  if (inCar) exitCar();
  if (!homeSite || homeSite.homeId !== S.home) setupHome();
  enterSite(homeSite, 'home', interior, interior.door.x, interior.door.z - 0.6);
  player.heading = Math.PI;
  cam.yaw = 0.35; cam.pitch = 0.9; cam.tdist = 5;
  human.root.position.copy(player.pos); human.root.rotation.y = player.heading;
  updateRoomCamera(10);
  if (!silent) await fade(false);
  busy = false;
  ST.save(S);
}
async function exitHome(walk) {
  if (walk === true && homeSite.kind !== 'tower') { leaveSite(); persist(); return; }
  busy = true;
  await fade(true);
  leaveSite();
  placeAtEntrance(homeEntrance());
  persist();
  await fade(false);
  busy = false;
}
function updateLightBtn() { $('btnLight').textContent = interior.lightOn ? '💡 불 끄기' : '🌑 불 켜기'; }
$('btnLight').addEventListener('click', () => { interior.lightOn = !interior.lightOn; audio.play('light'); updateLightBtn(); });

// ───────── 편의점 ─────────
function exitMart(walk) {
  martGame.tryExit(async () => {
    mart.clearNpcs();
    if (walk === true) { leaveSite(); audio.play('door'); persist(); return; }
    busy = true;
    await fade(true);
    leaveSite();
    placeAtEntrance(martEntrance);
    audio.play('door');
    persist();
    await fade(false);
    busy = false;
  });
  if (walk === true && mode === 'mart') player.pos.z = mart.D / 2 + 0.1;
}
function exitSchool(walk) {
  const go = async () => {
    if (walk === true) { leaveSite(); persist(); return; }
    busy = true;
    await fade(true);
    leaveSite();
    placeAtEntrance(schoolEntrance);
    persist();
    await fade(false);
    busy = false;
  };
  if (schoolGame.duty && schoolGame.T.level === schoolEntrance.school) {
    if (walk === true) player.pos.z = school.D / 2 + 0.1;
    openSheet({
      icon: '🏃', title: '조퇴할까요?', sub: '아직 근무 중이에요',
      html: `<p class="note">지금 나가면 오늘 근무가 끝나고 평가가 깎여요.</p><button class="btn wide red" data-act="go">조퇴하기</button><button class="btn wide gray" data-act="stay">계속 근무</button>`,
      bind: (b) => bindActs(b, { go: async () => { closeSheet(); await schoolGame.clockOut(true); closeSheet(); go(); }, stay: () => closeSheet() }),
    });
    return;
  }
  go();
}
function updateMartInteract() {
  const extra = martGame.extraAction(player.pos);
  const a = extra || martGame.action(mart.zoneAt(player.pos));
  if (a) setAct(a.label, a.fn, a.green); else setAct(null);
}

function updateRoomWalking(dt) {
  const i = readInput();
  applyLook(i);
  cam.pitch = THREE.MathUtils.clamp(cam.pitch, 0.45, 1.3);
  const { mx, mz, m } = moveVector(i);
  const target = m > 0.12 ? (player.run ? 2.6 : 1.7) * Math.min(1, m * 1.15) : 0;
  player.speed += (target - player.speed) * Math.min(1, dt * 8);
  if (m > 0.12) {
    const want = Math.atan2(mx, mz);
    let dh = want - player.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    player.heading += dh * Math.min(1, dt * 12);
  }
  player.pos.x += Math.sin(player.heading) * player.speed * dt;
  player.pos.z += Math.cos(player.heading) * player.speed * dt;
  if (room === mart) for (const c of mart.npcs) {
    const dx = player.pos.x - c.pos.x, dz = player.pos.z - c.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.5 && d > 1e-4) { player.pos.x = c.pos.x + dx / d * 0.5; player.pos.z = c.pos.z + dz / d * 0.5; }
  }
  room.collide(player.pos, 0.3);
  player.pos.y = 0;
  human.root.position.copy(player.pos);
  human.root.rotation.y = player.heading;
  human.animate(dt, player.speed, false);
  if (player.speed > 0.3 && interior.tvOn) interior.tvOn = false;
}
function updateRoomCamera(dt) {
  const r = room || interior;
  const W = r.W, D = r.D;
  const base = Math.max(W, D);
  let target, dist, pitch, yaw = cam.yaw;
  if (editing) { target = new THREE.Vector3(0, 0, 0); dist = base * 1.25; pitch = 1.15; }
  else if (cam.kitchen && r === interior) { target = new THREE.Vector3(interior.stove.x + 0.3, 1.0, interior.stove.z); dist = 2.6; pitch = 0.6; yaw = Math.PI / 2 - 0.55; }
  else if (r === school) { target = new THREE.Vector3(player.pos.x, 1.0, player.pos.z * 0.7); dist = 10.5 + cam.tdist - 5; pitch = cam.pitch; }
  else { target = new THREE.Vector3(player.pos.x * 0.6, 1.0, player.pos.z * 0.6); dist = THREE.MathUtils.clamp(base * 0.95, 7, 17) + cam.tdist - 5; pitch = cam.pitch; }
  if (camera.aspect < 1 && !cam.kitchen) dist *= 1 + (1 - camera.aspect) * 0.9;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const want = new THREE.Vector3(target.x + Math.sin(yaw) * cp * dist, target.y + sp * dist, target.z + Math.cos(yaw) * cp * dist);
  camLocal.lerp(want, Math.min(1, dt * 6));
  const a = site ? site.anchor : null;
  if (!a) { camera.position.copy(camLocal); camera.lookAt(target); return; }
  a.updateWorldMatrix(true, false);
  camera.position.copy(camLocal); a.localToWorld(camera.position);
  a.localToWorld(target);
  camera.lookAt(target);
}
function updateHomeInteract() {
  const n = interior.nearest(player.pos);
  if (n === 'door') return setAct('🚪 밖으로 나가기', exitHome);
  if (n === 'kitchen') return setAct('🍳 요리하기', () => cooking.menu());
  if (!n) { setAct(null); return; }
  const id = n.userData.item.id;
  const label = INTERACT[id];
  const icon = FICON[id];
  setAct(`${icon} ${label}`, () => useFurniture(n));
}
async function useFurniture(mesh) {
  const it = mesh.userData.item;
  const id = it.id;
  if (id === 'bed' || id === 'bed2') return sleepSheet(mesh);
  if (id === 'fridge') return fridgeSheet();
  const acts = {
    tv: { t: 60, mode: 'fun', msg: '📺 드라마 한 편 봤어요', tv: true },
    piano: { t: 45, mode: 'fun', msg: '🎹 피아노 연습 완료! 기분이 좋아요' },
    pc: { t: 90, mode: 'fun', msg: '🎮 게임 몇 판 했어요' },
    sofa: { t: 60, mode: 'rest', msg: '🛋️ 소파에서 푹 쉬었어요', sit: true },
    shelf: { t: 60, mode: 'fun', msg: '📚 책을 읽었어요' },
    desk: { t: 120, mode: 'work', msg: '📝 자격증 공부 2시간 (승진 점수 +0.5)', study: true },
  };
  const a = acts[id];
  if (!a) return;
  if (a.study && !S.officeHired) toast('공부는 했지만 아직 회사원이 아니에요. 승진 점수는 입사 후에 반영돼요');
  busy = true;
  if (a.tv) interior.tvOn = true;
  await fade(true);
  ST.passTime(S, a.t, a.mode);
  if (id === 'piano') S.mood = ST.clamp(S.mood + 6);
  if (a.study && S.officeHired) { S.officeExp += 0.5; tryPromote(); }
  await fade(false);
  busy = false;
  toast(a.msg, 'good');
  updateHUD(true);
}

// ───────── 잠 ─────────
function nextAt(hour) {
  const now = S.minutes, d = Math.floor(now / 1440);
  let t = d * 1440 + hour * 60;
  if (t <= now + 30) t += 1440;
  return t;
}
function sleepSheet(bed) {
  const h = ST.hour(S);
  const nightTime = h >= 21 || h < 5;
  if (S.energy > 88 && !nightTime) {
    openSheet({
      icon: '🛏️', title: '아직 안 졸려요', sub: `에너지 ${Math.round(S.energy)}`,
      html: `<p class="note">지금은 누워도 잠이 안 올 것 같아요. 침대에서 뒹굴거리며 쉬기만 할 수 있어요.</p><button class="btn wide gray" data-act="rest">30분 누워 있기</button>`,
      bind: (b) => bindActs(b, { rest: async () => { closeSheet(); busy = true; await fade(true); ST.passTime(S, 30, 'rest'); await fade(false); busy = false; toast('😌 좀 쉬었어요'); } }),
    });
    return;
  }
  let lightOff = true;
  const alarms = [6, 7, 8, 9];
  const fmt = (t) => { const m = t % 1440; return `${Math.floor(m / 60) < 12 ? '오전' : '오후'} ${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')}`; };
  const dur = (t) => { const m = t - S.minutes; return `${Math.floor(m / 60)}시간 ${Math.round(m % 60)}분`; };
  const job = S.mart?.hired ? martGame.shiftStatus() : null;
  const render = () => `<p class="note">지금 ${ST.clock(S).text} · 에너지 <b>${Math.round(S.energy)}</b> · 배고픔 <b>${Math.round(S.hunger)}</b>${S.hunger < 25 ? '<br><b style="color:var(--warn)">배가 고프면 자다가 깰 수 있어요</b>' : ''}${job && !job.canClockIn ? `<br>🧑‍💼 ${job.msg}` : ''}</p>
      <div class="row"><div class="ic">${lightOff ? '🌑' : '💡'}</div><div class="info"><b>${lightOff ? '불 끄고 자기' : '불 켜고 자기'}</b><span>${lightOff ? '깊게 잘 수 있어요' : '잠이 얕아져요'}</span></div><button class="btn gray" data-act="light">바꾸기</button></div>` +
    alarms.map(a => { const t = nextAt(a); return row({ icon: '⏰', title: `알람 ${fmt(t)}`, desc: dur(t) + ' 자요', btn: '자기', action: 'alarm:' + t }); }).join('') +
    row({ icon: '😴', title: '알람 없이 푹 자기', desc: '에너지가 다 차면 저절로 깨요 (최대 11시간)', btn: '자기', action: 'free' }) +
    row({ icon: '💤', title: '30분 낮잠', desc: '잠깐 눈 붙이기', btn: '자기', action: 'nap:30' }) +
    row({ icon: '💤', title: '2시간 낮잠', desc: '오후에 충전', btn: '자기', action: 'nap:120' });
  const open = () => openSheet({
    icon: '🛏️', title: '잠자기', sub: '알람을 맞추고 자요',
    html: render(),
    bind: (b) => bindActs(b, {
      light: () => { lightOff = !lightOff; open(); },
      alarm: (t) => { closeSheet(); doSleep(bed, { until: +t, alarm: true, lightOff }); },
      free: () => { closeSheet(); doSleep(bed, { until: S.minutes + 660, alarm: false, lightOff }); },
      nap: (m) => { closeSheet(); doSleep(bed, { until: S.minutes + +m, alarm: true, lightOff, nap: true }); },
    }),
  });
  open();
}
async function doSleep(bed, { until, alarm, lightOff, nap }) {
  busy = true;
  const it = bed.userData.item;
  const bedQ = FURNITURE.find(f => f.id === it.id).sleep || 1;
  await fade(true);
  if (lightOff && interior.lightOn) { interior.lightOn = false; updateLightBtn(); }
  human.setPose('lie');
  human.root.position.set(bed.position.x, 0.42, bed.position.z);
  human.root.rotation.y = bed.rotation.y;
  cam.yaw = bed.rotation.y + 0.6; cam.pitch = 0.75;
  await fade(false);
  audio.play('snore');
  const mg = $('mg');
  mg.classList.remove('hidden'); mg.classList.add('soft');
  mg.innerHTML = `<div class="sleep"><div class="zz">💤</div><div class="sclock" id="sclock"></div><div class="pbar"><i id="sbar"></i></div><button class="btn gray" id="wakeBtn">일어나기</button></div>`;
  let woke = false, reason = '';
  $('wakeBtn').addEventListener('click', () => { woke = true; reason = 'self'; });
  const start = S.minutes, total = until - start;
  const startEnergy = S.energy;
  while (!woke && S.minutes < until) {
    const step = Math.min(10, until - S.minutes);
    const h = ST.hour(S);
    const nightSleep = h >= 22 || h < 7;
    const mult = bedQ * (nightSleep ? 1.12 : 0.85) * (interior.lightOn ? 0.8 : 1) * (S.hunger < 15 ? 0.7 : 1) * (nap ? 0.9 : 1);
    ST.passTime(S, step, 'sleep');
    S.energy = ST.clamp(S.energy + 13 * (mult - 1) * (step / 60));
    $('sclock').textContent = `${ST.day(S)}일차 ${ST.clock(S).text} · 에너지 ${Math.round(S.energy)}`;
    $('sbar').style.width = Math.min(100, (S.minutes - start) / total * 100) + '%';
    updateHUD(true);
    if (!alarm && S.energy >= 100 && S.minutes - start > 180) { woke = true; reason = 'full'; }
    if (S.hunger <= 3) { woke = true; reason = 'hungry'; }
    await wait(TEST ? 5 : 45);
  }
  mg.classList.add('hidden'); mg.classList.remove('soft'); mg.innerHTML = '';
  const slept = (S.minutes - start) / 60;
  if (alarm && reason === '') audio.play('alarm');
  await fade(true);
  human.setPose('stand');
  player.pos.set(bed.position.x + 1.1, 0, bed.position.z + 0.6);
  interior.collide(player.pos, 0.3);
  human.root.position.copy(player.pos);
  cam.yaw = 0.35; cam.pitch = 0.9;
  if (!nap) {
    if (slept >= 6.5 && slept <= 9.5) S.mood = ST.clamp(S.mood + 8);
    else if (slept < 5) S.mood = ST.clamp(S.mood - 6);
  }
  await fade(false);
  busy = false;
  const title = reason === 'hungry' ? '😫 배고파서 깼어요' : reason === 'self' ? '🥱 일어났어요' : alarm ? '⏰ 따르릉! 일어날 시간' : '☀️ 푹 잤다!';
  const sub = `${slept.toFixed(1)}시간 잤어요 · 에너지 ${Math.round(startEnergy)} → ${Math.round(S.energy)}${!nap && slept < 5 ? ' · 잠이 부족해요' : !nap && slept >= 6.5 && slept <= 9.5 ? ' · 개운해요' : ''}`;
  bigMsg(title, sub, 3200);
  warned = {};
  martGame.dailyCheck();
  persist();
}

// ───────── 냉장고 · 가방 ─────────
function fridgeSheet(fromPhone) {
  const items = Object.entries(S.inventory.food).filter(([, n]) => n > 0);
  const ings = Object.entries(S.inventory.ing).filter(([, n]) => n > 0);
  openSheet({
    icon: fromPhone ? '🎒' : '🧊', title: fromPhone ? '가방' : '냉장고', sub: '산 음식 · 만든 요리 · 요리 재료',
    html: `<div class="tabs"><button class="on" data-tab="food">🍽 음식 ${items.length ? items.reduce((a, [, n]) => a + n, 0) : ''}</button><button data-tab="ing">🥚 재료 ${ings.length ? ings.reduce((a, [, n]) => a + n, 0) : ''}</button></div>
      <div data-pane="food">${items.length ? items.map(([id, n]) => {
        const f = foodInfo(id);
        if (f.needWater) return row({ icon: f.icon, title: `${f.name} ×${n}`, desc: '뜨거운 물이 필요해요 (편의점 온수기 · 집 주방)', btn: '물 필요', btnClass: 'gray', disabled: true, action: 'x' });
        return row({ icon: f.icon, title: `${f.name} ×${n}`, desc: `배고픔 +${f.hunger || 0}${f.energy ? ` · 에너지 ${f.energy > 0 ? '+' : ''}${f.energy}` : ''}${f.homemade ? ' · 직접 만든 요리' : ''}`, btn: '먹기', action: 'eat:' + id });
      }).join('') : '<p class="note">비어 있어요. 편의점에서 사 오거나 주방에서 요리해 보세요.</p>'}</div>
      <div data-pane="ing" class="hidden">${ings.length ? ings.map(([k, n]) => row({ icon: INGREDIENTS[k].icon, title: `${INGREDIENTS[k].name} ×${n}`, desc: '주방에서 요리할 때 써요' })).join('') : '<p class="note">재료가 없어요. 편의점 식재료·라면 코너에서 사 오세요.</p>'}</div>`,
    bind: (b) => { tabs(b); bindActs(b, { eat: (id) => { closeSheet(); if (mode === 'home' && !fromPhone) eatAtHome(id); else eatFood(id); } }); },
  });
}
async function eatAtHome(id) {
  busy = true;
  const table = interior.items.find(m => ['table', 'desk'].includes(m.userData.item.id));
  await fade(true);
  if (table) { human.root.position.set(table.position.x, 0.02, table.position.z + 0.75); human.root.rotation.y = Math.PI + table.rotation.y; human.setPose('sit'); }
  await fade(false);
  await wait(TEST ? 200 : 1400);
  eatFood(id, { minutes: 15, moodBonus: table ? 3 : 0 });
  await fade(true);
  human.setPose('stand');
  human.root.position.copy(player.pos); human.root.rotation.y = player.heading;
  await fade(false);
  busy = false;
}

// ───────── 꾸미기 모드 ─────────
let sel = null, selHelper = null, dragging = false;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function startEdit() {
  editing = true;
  controls.enabled = false; controls.reset();
  setAct(null);
  $('editBtn').classList.add('hidden');
  $('editBar').classList.remove('hidden');
  $('needs').classList.add('hidden');
  cam.yaw = 0.0;
  renderEditBar();
  toast('가구를 눌러 선택하고 끌어서 옮기세요');
}
function endEdit() {
  editing = false;
  controls.enabled = true;
  select(null);
  $('editBar').classList.add('hidden');
  $('editBtn').classList.remove('hidden');
  $('needs').classList.remove('hidden');
  cam.yaw = 0.35;
  interior.refreshLamps();
  checkGoals();
  persist();
}
function renderEditBar() {
  const bar = $('editBar');
  const inv = Object.entries(S.inventory.furniture).filter(([, n]) => n > 0);
  bar.innerHTML = `<button class="tool done" data-e="done">✓ 완료</button>
    ${sel ? '<button class="tool" data-e="rot">↻ 회전</button><button class="tool" data-e="store">📦 보관</button>' : ''}
    <div class="sep"></div>
    ${inv.length ? inv.map(([id, n]) => `<button class="chip" data-e="add:${id}">${FICON[id]} ${FURNITURE.find(f => f.id === id).name} <b>×${n}</b></button>`).join('') : '<span class="hint">보관 중인 가구가 없어요 · 홈데코 가구점에서 사 오세요</span>'}`;
  bar.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => {
    audio.click();
    const [a, id] = b.dataset.e.split(':');
    if (a === 'done') endEdit();
    if (a === 'rot' && sel) { sel.userData.item.rot = (sel.userData.item.rot + 1) % 4; sel.rotation.y = sel.userData.item.rot * Math.PI / 2; interior.clampItem(sel.userData.item); syncSel(); }
    if (a === 'store' && sel) {
      const it = sel.userData.item;
      S.placed[S.home] = S.placed[S.home].filter(p => p !== it);
      S.inventory.furniture[it.id] = (S.inventory.furniture[it.id] || 0) + 1;
      interior.removeItem(sel); select(null); renderEditBar();
    }
    if (a === 'add') {
      S.inventory.furniture[id]--;
      const it = { uid: S.nextUid++, id, x: player.pos.x * 0 + 0, z: 0, rot: 0 };
      interior.clampItem(it);
      S.placed[S.home].push(it);
      const m = interior.addItem(it);
      select(m); renderEditBar();
    }
  }));
}
function select(m) {
  if (selHelper) { scene.remove(selHelper); selHelper = null; }
  sel = m;
  if (m) { selHelper = new THREE.BoxHelper(m, 0x46d1ff); scene.add(selHelper); }
  renderEditBar();
}
function syncSel() {
  const it = sel.userData.item;
  sel.position.set(it.x, 0, it.z);
  sel.updateMatrixWorld(true);
  selHelper?.update();
}
function floorPoint(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (!site) return null;
  site.anchor.updateWorldMatrix(true, false);
  floorPlane.constant = -site.anchor.position.y;
  return ray.ray.intersectPlane(floorPlane, p) ? site.anchor.worldToLocal(p) : null;
}
canvas.addEventListener('pointerdown', (e) => {
  if (!editing) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(interior.items, false);
  if (hits.length) { if (hits[0].object !== sel) select(hits[0].object); dragging = true; return; }
  if (sel) { const p = floorPoint(e); if (p) { moveSel(p); dragging = true; } }
});
canvas.addEventListener('pointermove', (e) => { if (editing && dragging && sel) { const p = floorPoint(e); if (p) moveSel(p); } });
window.addEventListener('pointerup', () => { dragging = false; });
function moveSel(p) {
  const it = sel.userData.item;
  it.x = Math.round(p.x * 20) / 20; it.z = Math.round(p.z * 20) / 20;
  interior.clampItem(it);
  syncSel();
}

// ───────── 기절 ─────────
async function faint() {
  busy = true;
  if (martGame.onShift) await martGame.endShift(true);
  if (inCar) { pcar.speed = 0; exitCar(); }
  if (mode === 'mart') { mart.clearNpcs(); leaveSite(); }
  if (mode === 'school') { if (schoolGame.duty) await schoolGame.clockOut(true); leaveSite(); }
  await fade(true);
  bigMsg('😵 기절했어요…', '구급차에 실려 갔어요. 병원비 50,000원', 3000);
  await wait(2600);
  const fee = Math.min(S.money, 50000);
  S.money -= fee;
  ST.passTime(S, 360, 'sleep');
  S.energy = Math.max(S.energy, 45); S.hunger = Math.max(S.hunger, 30); S.mood = ST.clamp(S.mood - 15);
  if (mode !== 'home') { await enterHome(true); }
  await fade(false);
  busy = false;
  toast('무리하지 말고 잘 먹고 잘 자요!', 'bad', 4000);
  warned = {};
  persist();
}

// ───────── 휴대폰 ─────────
const phone = $('phone'), phScreen = phone.querySelector('.ph-screen');
$('phoneBtn').addEventListener('click', () => { audio.click(); openPhone(); });
$('phClose').addEventListener('click', () => { audio.click(); closePhone(); });
$('phHome').addEventListener('click', () => { audio.click(); openPhone(); });
phone.addEventListener('pointerdown', (e) => { if (e.target === phone) closePhone(); });
function closePhone() { phone.classList.add('hidden'); }
function openPhone(app) {
  if (busy || editing) return;
  phone.classList.remove('hidden');
  $('phClock').textContent = ST.clock(S).text.replace('오전 ', '').replace('오후 ', '');
  if (app === 'map') return phoneMap();
  const apps = [
    ['map', '🗺️', '지도·택시', '#2a9d8f'], ['bank', '💳', '은행', '#264653'], ['me', '🧑', '내 정보', '#e76f51'], ['goals', '🏆', '인생 목표', '#f4a261'],
    ['bag', '🎒', '가방', '#8d6e63'], ['car', '🚗', '내 차', '#3d5a80'], ['delivery', '🛵', '배달', '#e9c46a'], ['job', '🧑‍💼', '알바', '#1f8a4c'], ['school', '🎓', '학교', '#5a3a8a'],
    ['settings', '⚙️', '설정', '#6c757d'],
  ];
  phScreen.innerHTML = `<div class="ph-widget"><div style="font-size:13px;opacity:.8">${ST.day(S)}일차 · ${DAYNAMES[(ST.day(S) - 1) % 7]}</div><div class="big">${ST.clock(S).text}</div><div style="font-size:13px;opacity:.8">잔액 ${won(S.money)}</div></div>
    <div class="apps">${apps.map(([id, ic, name, col]) => `<button class="app" data-app="${id}"><i style="background:${col}">${ic}</i>${name}</button>`).join('')}</div>`;
  phScreen.querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', () => { audio.click(); phoneApp(b.dataset.app); }));
}
function phoneApp(id) {
  if (id === 'map') return phoneMap();
  if (id === 'bag') { closePhone(); return fridgeSheet(true); }
  if (id === 'school') {
    const U = S.uni, T = S.teach;
    if (T?.hired) { closePhone(); return schoolGame.teachSheet(); }
    if (U && (U.enrolled || U.major)) { closePhone(); return schoolGame.statusSheet(); }
    phScreen.innerHTML = `<div class="ph-title">🎓 학교</div><p class="note" style="color:#ddd">한빛대학교 행정실에서 입학할 수 있어요. 교육학과를 졸업하면 초·중·고 선생님이 될 수 있어요.</p>`;
    return;
  }
  if (id === 'job') {
    const M = S.mart;
    if (!M || !M.hired) { phScreen.innerHTML = `<div class="ph-title">🧑‍💼 알바</div><p class="note" style="color:#ddd">아직 알바를 안 하고 있어요. 24 마트 계산대에서 "알바 문의하기"를 눌러 보세요.</p>`; return; }
    const st = martGame.shiftStatus(), sh = SHIFTS[M.slot];
    const avg = M.ratings.length ? M.ratings.reduce((a, b) => a + b, 0) / M.ratings.length : 0;
    phScreen.innerHTML = `<div class="ph-title">🧑‍💼 24 마트 알바</div><div class="ph-widget"><b>${sh.name} ${String(sh.start % 24).padStart(2, '0')}:00 ~ ${String(sh.end % 24).padStart(2, '0')}:00</b> · 평일<div style="font-size:13px;opacity:.85;margin-top:6px">${martGame.onShift ? '지금 근무 중이에요' : st.canClockIn ? '지금 출근할 수 있어요! 계산대 안쪽으로 가세요' : st.msg}</div></div>
      <div class="grid2"><div class="stat"><span>시급</span><b>${won(martGame.wage())}</b></div><div class="stat"><span>평균 평점</span><b>${avg ? stars(avg) : '-'}</b></div><div class="stat"><span>이번 주</span><b>${M.weekHours.toFixed(1)}시간</b></div><div class="stat"><span>경고</span><b>${M.warnings}/3</b></div></div>`;
    return;
  }
  if (id === 'bank') {
    phScreen.innerHTML = `<div class="ph-title">💳 한빛은행</div><div class="ph-widget"><div style="font-size:13px;opacity:.8">보통예금 잔액</div><div class="big">${won(S.money)}</div></div>
      <div class="grid2"><div class="stat"><span>지금까지 번 돈</span><b>${won(S.totalEarned)}</b></div><div class="stat"><span>완료한 배달</span><b>${S.deliveries}건</b></div><div class="stat"><span>편의점 알바</span><b>${S.martShifts}회</b></div><div class="stat"><span>보유 차량</span><b>${S.cars.length}대</b></div></div>`;
    return;
  }
  if (id === 'me') {
    const r = S.officeHired ? ST.rank(S).name : '무직';
    phScreen.innerHTML = `<div class="ph-title">🧑 내 정보</div><div class="grid2">
      <div class="stat"><span>직업</span><b>${S.officeHired ? '한빛그룹 ' + r : (S.deliveries ? '배달 기사' : S.martShifts ? '편의점 알바' : '구직 중')}</b></div>
      <div class="stat"><span>사는 곳</span><b>${HOMES.find(h => h.id === S.home).name}</b></div>
      <div class="stat"><span>배고픔</span><b>${Math.round(S.hunger)}</b></div><div class="stat"><span>에너지</span><b>${Math.round(S.energy)}</b></div>
      <div class="stat"><span>기분</span><b>${Math.round(S.mood)}</b></div><div class="stat"><span>체력 레벨</span><b>${S.fitness}</b></div>
      <div class="stat"><span>살아온 날</span><b>${ST.day(S)}일</b></div><div class="stat"><span>목표 달성</span><b>${(S.goalsDone || []).length}/${GOALS.length}</b></div></div>`;
    return;
  }
  if (id === 'goals') {
    phScreen.innerHTML = `<div class="ph-title">🏆 인생 목표</div>` + GOALS.map(g => { const d = S.goalsDone?.includes(g.id); return `<div class="row" style="${d ? 'opacity:.55' : ''}"><div class="ic">${d ? '✅' : '⬜'}</div><div class="info"><b>${g.text}</b><span>${g.hint}</span></div></div>`; }).join('');
    return;
  }
  if (id === 'car') {
    const c = S.car && CARS.find(x => x.id === S.car);
    phScreen.innerHTML = `<div class="ph-title">🚗 내 차</div>` + (c ? `<div class="ph-widget"><b>${c.name}</b><div style="font-size:13px;opacity:.8;margin-top:4px">${pcar ? Math.round(pcar.pos.distanceTo(player.pos)) + 'm 떨어져 있어요' : ''}</div></div>
      <button class="btn wide" id="callCar" ${inCar || mode !== 'city' ? 'disabled' : ''}>📞 대리 기사 호출 · 내 앞으로 가져오기 (${won(15000)})</button>
      <button class="btn wide gray" id="findCar">📍 차 위치 표시</button>` : '<p class="note" style="color:#ddd">아직 차가 없어요. 드림모터스에서 첫 차를 뽑아 보세요!</p>');
    $('callCar')?.addEventListener('click', () => { if (!pay(15000)) return; callCar(); closePhone(); });
    $('findCar')?.addEventListener('click', () => { S.waypoint = { x: pcar.pos.x, z: pcar.pos.z, name: '내 차' }; closePhone(); });
    return;
  }
  if (id === 'delivery') {
    phScreen.innerHTML = `<div class="ph-title">🛵 번개배달 기사앱</div>` + (S.delivery ? `<div class="ph-widget">${S.delivery.stage === 'pickup' ? '📦 픽업 대기' : '🛵 배달 중'}<br><b>${S.delivery.pickup.name} → ${S.delivery.drop.name}</b><br>${won(S.delivery.pay)}</div><button class="btn wide red" id="dStop">배달 그만하기</button>` : `<p class="note" style="color:#ddd">배달을 시작하려면 번개배달 센터에 가거나 아래 버튼을 누르세요.</p><button class="btn wide green" id="dStart" ${mode !== 'city' ? 'disabled' : ''}>콜 받기</button>`);
    $('dStop')?.addEventListener('click', () => { S.delivery = null; closePhone(); });
    $('dStart')?.addEventListener('click', () => { closePhone(); newDelivery(); });
    return;
  }
  if (id === 'settings') {
    phScreen.innerHTML = `<div class="ph-title">⚙️ 설정</div>
      <div class="note" style="color:#ddd">그래픽 품질</div><div class="tabs">${['low', 'mid', 'high'].map(q => `<button data-q="${q}" class="${q === quality ? 'on' : ''}">${{ low: '절약', mid: '보통', high: '고화질' }[q]}</button>`).join('')}</div>
      <div class="note" style="color:#ddd">소리</div><div class="tabs"><button id="sndOn" class="${S.settings.sound ? 'on' : ''}">켜기</button><button id="sndOff" class="${!S.settings.sound ? 'on' : ''}">끄기</button></div>
      <button class="btn wide" id="saveNow">💾 지금 저장</button>
      <button class="btn wide red" id="resetAll" style="margin-top:18px">처음부터 다시 하기</button>`;
    phScreen.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { setQuality(b.dataset.q); phoneApp('settings'); }));
    $('sndOn').addEventListener('click', () => { S.settings.sound = true; audio.setEnabled(true); phoneApp('settings'); });
    $('sndOff').addEventListener('click', () => { S.settings.sound = false; audio.setEnabled(false); phoneApp('settings'); });
    $('saveNow').addEventListener('click', () => { persist(); toast('💾 저장했어요', 'good'); });
    $('resetAll').addEventListener('click', () => { if (confirm('정말 모든 진행을 지울까요?')) { ST.wipe(); location.reload(); } });
  }
}
function phoneMap() {
  phScreen.innerHTML = `<div class="ph-title">🗺️ 지도</div><canvas id="mapCanvas" width="600" height="600"></canvas>
    <div class="note" style="color:#ddd;margin-top:10px">장소를 골라 <b>택시</b>로 바로 가거나 <b>길 안내</b>를 받아요.</div>
    <div id="placeList"></div>`;
  const cv = $('mapCanvas'), x = cv.getContext('2d');
  const s = 600 / (HALF * 2 + 40), o = 300;
  const icoR = 13;
  x.fillStyle = '#2b3138'; x.fillRect(0, 0, 600, 600);
  x.save(); x.translate(o, o); x.scale(s, s); drawBlocks(x); x.restore();
  x.fillStyle = '#7a8494';
  for (const c of city.colliders) if (!c.soft) x.fillRect(o + c.x0 * s, o + c.z0 * s, (c.x1 - c.x0) * s, (c.z1 - c.z0) * s);
  x.font = '18px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const e of city.entrances) { x.fillStyle = 'rgba(10,14,20,.8)'; x.beginPath(); x.arc(o + e.x * s, o + e.z * s, icoR, 0, 7); x.fill(); x.fillText(e.icon, o + e.x * s, o + e.z * s + 1); }
  const p = inCar && pcar ? pcar.pos : playerWorld();
  { x.fillStyle = '#46d1ff'; x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.arc(o + p.x * s, o + p.z * s, 11, 0, 7); x.fill(); x.stroke(); }
  if (pcar && !inCar) x.fillText('🚗', o + pcar.pos.x * s, o + pcar.pos.z * s);
  const seen = new Set();
  const list = city.entrances.filter(e => { const k = e.id + e.name; if (seen.has(k) && e.id !== 'mart') return false; seen.add(k); return true; });
  $('placeList').innerHTML = list.map((e, k) => {
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    const fare = Math.round((4800 + d * 14) / 100) * 100;
    return `<div class="row"><div class="ic">${e.icon}</div><div class="info"><b>${e.name}</b><span>${Math.round(d)}m</span></div><button class="btn gray" data-w="${k}">길안내</button><button class="btn" data-t="${k}" ${mode !== 'city' && e.id !== 'home' ? '' : ''}>택시 ${won(fare)}</button></div>`;
  }).join('');
  $('placeList').querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => { const e = list[+b.dataset.w]; S.waypoint = { x: e.x, z: e.z, name: e.name }; audio.click(); closePhone(); toast(`📍 ${e.name} 길안내 시작`); }));
  $('placeList').querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { const e = list[+b.dataset.t]; audio.click(); taxi(e); }));
}
async function taxi(e) {
  if (inCar) { toast('운전 중에는 택시를 부를 수 없어요', 'bad'); return; }
  if (martGame.onShift || schoolGame.duty) { toast('근무 중이에요! 퇴근하고 가요', 'bad'); return; }
  if (mode === 'mart' && martGame.basketCount()) { toast('계산 안 한 물건이 있어요', 'bad'); return; }
  const p = playerWorld();
  const d = Math.hypot(e.x - p.x, e.z - p.z);
  const fare = Math.round((4800 + d * 14) / 100) * 100;
  if (!pay(fare)) return;
  closePhone();
  busy = true;
  await fade(true);
  if (mode !== 'city') { if (mode === 'mart') mart.clearNpcs(); leaveSite(); }
  ST.passTime(S, 5 + d / 60, 'idle');
  player.pos.set(e.x + e.nx * 1.6, 0.18, e.z + e.nz * 1.6);
  player.heading = e.face + Math.PI;
  cam.yaw = player.heading + Math.PI;
  city.collide(player.pos, 0.35, { walker: true });
  city.warmup(player.pos);
  traffic.reseed(player.pos); peds.reseed(player.pos); attachRooms(true);
  human.root.position.copy(player.pos);
  await wait(500);
  await fade(false);
  busy = false;
  toast(`🚕 ${e.name} 도착 · 요금 ${won(fare)}`);
  if (S.waypoint && S.waypoint.name === e.name) S.waypoint = null;
}
function callCar() {
  // 가장 가까운 도로 갓길에 세움
  const p = player.pos;
  const kx = nearestRoad(p.x), kz = nearestRoad(p.z);
  const rx = ROADS[kx], rz = ROADS[kz];
  let x, z, h;
  const clampSeg = (v) => { const b = blockIndex(v); return THREE.MathUtils.clamp(v, ROADS[b] + 18, ROADS[b + 1] - 18); };
  if (Math.abs(p.x - rx) < Math.abs(p.z - rz) && city.onRoad(rx, clampSeg(p.z))) { const side = p.x > rx ? 1 : -1; x = rx + side * 8.9; z = clampSeg(p.z); h = side > 0 ? Math.PI : 0; }
  else { const side = p.z > rz ? 1 : -1; z = rz + side * 8.9; x = clampSeg(p.x); h = side > 0 ? Math.PI / 2 : -Math.PI / 2; }
  pcar.place(x, z, h);
  S.carPos = { x, z, h };
  toast('🚗 차가 근처 도로에 도착했어요', 'good');
}

// ───────── 창 크기 ─────────
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 72 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden && mode !== 'title') persist(); });
window.addEventListener('pagehide', () => { if (mode !== 'title') persist(); });
resize();

boot().catch(err => { $('loadTxt').textContent = '오류: ' + err.message; console.error(err); });

// 디버그/테스트용
window.__game = { get school() { return school; }, get schoolGame() { return schoolGame; }, enterSchool: (t) => walkInto(city.sites.find(s => s.school === t)), walkInto, playerWorld, get site() { return site; }, get mode() { return mode; },
  renderer, scene, camera, get mart() { return mart; }, get martGame() { return martGame; }, get cooking() { return cooking; }, enterMart: () => walkInto(city.sites.find(s => s.kind === 'mart')), eatFood, foodInfo, sleepSheet, get interior() { return interior; }, doSleep, useFurniture, taxi, openPhone, get traffic() { return traffic; }, controls: () => controls, get S() { return S; }, player, cam, get city() { return city; }, enterHome, exitHome, startEdit, endEdit, enterCar, exitCar, get pcar() { return pcar; }, setQuality, openPlace: (id) => openPlace(city.entrances.find(e => e.id === id)), newDelivery, spawnPlayerCar };

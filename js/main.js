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
import { StatRoom, STAT_DOOR } from './stationery.js';
import { StatGame } from './statgame.js';
import { Missions } from './missions.js';
import { Weather, forecast } from './weather.js';
import { Transit, playRide } from './transit.js';
import { LivingCity } from './living.js';
import { Economy } from './economy.js';
import { Pets } from './pets.js';
import { PhoneCamera } from './camera.js';
import { Achieve } from './achieve.js';
import { cloud } from './cloud.js';
import { OUTFITS, OUTFIT_CATS, SKIN_TONES, ensureLook, wear, swatch } from './outfits.js';
import { P as PRODUCT, DISHES, INGREDIENTS, SHIFTS } from './products.js';
import { runMeal, pickMealSheet } from './meal.js';
import { BldgGame } from './bldggame.js';
import { tenantMap as tenantMapFn } from './bplan.js';
import { ShopGame, menuFood } from './shopgame.js';
import { JobGame } from './jobs.js';
import { Career, companyAt } from './career.js';
import { RealEstate, homePrices, shopPrices, pyeong, won2 } from './realestate.js';
import { setCustomSlot } from './buildings.js';
import { isOpenType } from './bldggame.js';
import { TYPES as BTYPES } from './tenants.js';
import { PRODUCTS } from './products.js';
import { ensureWallet, paySheet, atmSheet, openStatus, closedNotice, hoursText, ClosingWatch, HOURS } from './commerce.js';

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
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
} catch (e) {
  window.__bootFailed = true;
  window.__bootFail?.('이 기기에서 3D 그래픽을 쓸 수 없어요', 'WebGL을 켤 수 없어요. 브라우저를 최신으로 업데이트하거나 크롬·삼성 인터넷으로 열어 주세요.');
  throw e;
}
// 그래픽 드라이버가 멈췄을 때 (탭 전환, 메모리 부족 등)
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  try { if (mode !== 'title') persist(); } catch (_) {}
  const t = $('title'); t.classList.remove('hidden');
  window.__bootFail?.('그래픽이 잠시 멈췄어요', '진행 상황은 저장했어요. 다시 시도를 누르면 이어서 할 수 있어요.');
});
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
let missions, weather, talkingPed = null;
let transit, life, economy, pets, phoneCam, achieve;
// 성능 자동 조절: 프레임이 느리면 렌더링 해상도를 낮춤
let dynScale = 1, perfT = 0, perfFrames = 0, perfWarned = false;
let site = null, homeSite = null, martSite = null, schoolSite = null, statSite = null, stat, statGame, statEntrance = null;   // 실내가 붙어 있는 건물
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

const player = { pos: new THREE.Vector3(), heading: 0, speed: 0, run: false, vy: 0, ground: true };
let jumpHeld = false;
const fpPos = new THREE.Vector3(), fpLook = new THREE.Vector3();
const roomLight = new THREE.PointLight(0xfff2e0, 0, 0, 0);
const cam = { yaw: 0.6, pitch: 0.32, dist: 5, tdist: 5, carDist: 9 };
const input = { gas: false, brake: false };
let beacon, beaconRing;

// ───────── 초기화 ─────────
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
function progress(f, text) {
  $('loadFill').style.width = Math.round(f * 100) + '%';
  if (text) $('loadTxt').textContent = text + '…';
}
async function boot() {
  const lt = $('loadTxt');
  progress(0.03, '하늘과 빛을 준비하는 중'); await nextFrame();
  sky = new Sky(scene, renderer);
  applyShadowQuality();
  city = new City(scene, quality, true);
  for (let k = 0; k < city.steps.length; k++) {
    progress(0.08 + 0.72 * k / city.steps.length, city.steps[k][0]); await nextFrame();
    city.steps[k][1]();
  }
  career = new Career({ get S() { return S; }, get life() { return life; }, city, audio, earn: (a, r) => earn(a, r), persist: () => persist(), passTime: (m, md) => ST.passTime(S, m, md || 'idle'), setBusy: (v) => { busy = v; }, payCash: (a) => payCash(a), get missions() { return missions; }, progress: (l, sec) => shopGame.progress(l, sec) });
  for (const sp of career.setupStations()) city.refreshSpec(sp);
  progress(0.82, '차와 사람들을 불러오는 중'); await nextFrame();
  traffic = new Traffic(scene, city, QUAL[quality].traffic);
  applyView();
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
  ensureWallet(S);
  human = createHuman(ensureLook(S));
  scene.add(human.root);
  // 알바 조끼
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.37).translate(0, 1.0, 0), new THREE.MeshStandardMaterial({ color: 0x1f8a4c, roughness: 0.5 }));
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.01), new THREE.MeshStandardMaterial({ color: 0xffffff })); tag.position.set(0.15, 1.18, 0.19);
  vest.add(tag); vest.visible = false; vest.castShadow = true; human.body.add(vest);
  human.applyUniform = (on) => { vest.visible = on; };
  mart = new MartRoom();
  martGame = new MartGame({
    get S() { return S; }, room: mart, player, human, audio, earn, pay, checkout, payCash, persist, foodInfo, atm: () => atmSheet(walletCtx(), { name: '편의점 ATM', fee: 1300 }), eatMeal: (ids, o) => eatMeal(ids, o),
    eatFood: (id, o) => eatFood(id, o), setBusy: (v) => { busy = v; }, exit: () => exitMart(), onBuy: () => missions.event('buy_mart'),
  });
  cooking = new Cooking({
    get S() { return S; }, interior, human, player, audio, persist, foodInfo,
    setBusy: (v) => { busy = v; }, eatAtHome: (k) => { const ids = readyFood(); if (ids.length > 1) pickMealSheet({ ids, foodInfo, preselect: [k], sub: '반찬이나 음료도 같이 올려요 · 조합이 좋으면 기분 UP' }, eatAtHome); else eatAtHome([k]); }, focusKitchen: (v) => { cam.kitchen = v; },
  });
  school = new SchoolRoom();
  schoolGame = new SchoolGame({
    get S() { return S; }, room: school, player, human, audio, earn, pay, persist,
    setBusy: (v) => { busy = v; }, exit: () => exitSchool(), refreshPeriod: () => schoolGame.refresh(schoolEntrance.school, true),
  });
  weather = new Weather(scene, sky, city);
  weather.onChange = (k, was) => { if (mode === 'title') return; toast(k === 'snow' ? '🌨️ 눈이 내리기 시작했어요 · 길이 미끄러워요' : k === 'rain' ? '🌧️ 비가 내리기 시작했어요 · 우산 없으면 감기 조심' : was === 'snow' ? '🌤️ 눈이 그쳤어요' : '🌤️ 비가 그쳤어요', '', 3200); };
  missions = new Missions({ get S() { return S; }, city, audio, flashMoney, persist });
  missions.init();
  transit = new Transit({ get S() { return S; }, scene, city, player, human, audio, persist: () => persist(), missions, flash: (g) => flashMoney(g), setBusy: (v) => { busy = v; }, passTime: (m, md) => ST.passTime(S, m, md || 'idle'), teleport: (x, z, h) => teleportTo(x, z, h), inCar: () => inCar, places: () => travelPlaces(), night: () => sky.night, mode: () => mode });
  transit.setup();
  life = new LivingCity({ get S() { return S; }, scene, city, traffic, peds, human, player, weather, audio, persist: () => persist(), missions, passTime: (m) => ST.passTime(S, m, 'idle'),
    minPerSec: () => MIN_PER_SEC * (lastShift ? 2 : 1), inCar: () => inCar, riding: () => !!transit.riding, focus: () => (inCar && pcar ? pcar.pos : playerWorld()), base: () => QUAL[quality], career: () => career,
    refreshSpec: (sp) => city.refreshSpec(sp), night: () => sky.night, underRoof: (p) => !!transit.near(transit.stops, p, 2.2) || !!transit.near(transit.stations, p, 2.6), onNews: (n) => { if (n.tag === 'event' && mode !== 'title') updateHUD(true); } });
  life.init();
  stat = new StatRoom();
  statGame = new StatGame({ get S() { return S; }, room: stat, audio, pay, checkout, payCash, persist, setBusy: (v) => { busy = v; }, onBuy: () => missions.event('buy_stat'), onGacha: () => missions.event('gacha') });
  statSite = city.sites.find(s => s.kind === 'stat');
  if (statSite) statSite.anchor.add(stat.root);
  bldg = new BldgGame({
    get S() { return S; }, city, scene, player, human, audio,
    enterSite: (site, view, lx, lz, hd) => { enterSite(site, 'bldg', view, lx, lz); if (hd !== undefined) { player.heading = hd; cam.yaw = hd + Math.PI; } },
    setRoom: (v) => { room = v; }, setHeading: (h) => { player.heading = h; cam.yaw = h + Math.PI; },
    leaveSite: () => leaveSite(), setBusy: (v) => { busy = v; }, persist: () => persist(), updateHUD: (f) => updateHUD(f),
    passTime: (m, md) => ST.passTime(S, m, md || 'idle'),
    shop: () => shopGame, career: () => career, enterHome: () => enterHome(), employedAt: (B) => career.employedAt(B), floorAccess: (B, n) => career.floorAccess(B, n), civic: () => career.civic(), company: (B, n) => companyAt(B, n), homePrices: (...a) => homePrices(...a), won2: (v) => won2(v),
  });
  realEstate = new RealEstate({
    get S() { return S; }, city, audio, persist: () => persist(), setupHome: () => setupHome(), flash: (g) => flashMoney(g), checkGoals: () => checkGoals(), missions,
    refreshSpec: (sp) => city.refreshSpec(sp), setSign: (i, n, c) => setCustomSlot(i, n, c),
  });
  economy = new Economy({ get S() { return S; }, audio, persist: () => persist(), flash: (g) => flashMoney(g), life: () => life, livingContract: () => (S.contracts || []).find(c => c.living), closePhone: () => { if (!$('phone').classList.contains('hidden')) closePhone(); }, credit: (d) => realEstate.addCredit(d) });
  pets = new Pets({ get S() { return S; }, scene, human, player, audio, missions, persist: () => persist(), mode: () => mode, inCar: () => inCar, passTime: (m, md) => ST.passTime(S, m, md || 'idle'), checkout: (t, o, f) => checkout(t, o, f), groundY: (x, z) => city.groundY(x, z) });
  phoneCam = new PhoneCamera({ get S() { return S; }, cam, player, audio, missions, persist: () => persist(), render: () => { renderer.render(scene, camera); return renderer.domElement; }, setHud: (on) => $('hud').classList.toggle('cam', !on), season: () => life.season(), closePhone: () => closePhone(), indoor: () => mode !== 'city', withPet: () => pets.near(6) });
  achieve = new Achieve({ get S() { return S; }, audio, missions, assets: () => totalAssets() });
  jobGame = new JobGame({ get S() { return S; }, audio, myShop: (bid, n, k) => realEstate.myShopOf(bid, n, k), earn: (a, r) => earn(a, r), persist: () => persist(), hoursOf: (t) => BTYPES[t]?.hours || [9, 21] });
  shopGame = new ShopGame({
    jobs: jobGame, get career() { return career; },
    get S() { return S; }, audio, player, human, missions,
    checkout: (t, o, f) => checkout(t, o, f), payCash: (a) => payCash(a), persist: () => persist(),
    passTime: (m, md) => ST.passTime(S, m, md || 'idle'), eatMeal: (ids, o) => eatMeal(ids, o), foodInfo,
    setBusy: (v) => { busy = v; }, restyle: () => human.restyle(S.look),
    atm: (fee) => atmSheet(walletCtx(), { name: '은행 ATM', fee: fee ?? 0 }),
    martGoods: () => PRODUCTS.filter(p => p.price),
    applyGoods: (key, g, n) => applyGoods(key, g, n),
    nearestSeat: (z) => nearestSeat(z), seat: (spot) => seatPlayer(spot),
    realty: (s) => realEstate.office(s.t.name), bank: () => economy.counter(() => atmSheet(walletCtx(), { name: '은행 ATM', fee: 0 })), petShop: () => pets.shopSheet(), petVet: (v) => pets.vet(v), vacantInfo: (unit, b) => vacantInfo(unit, b),
  });
  controls = new Controls(canvas, $('joy'), $('knob'));
  makeBeacon();
  // 타이틀 배경용 카메라 위치
  scene.add(roomAmb, roomLight);
  setupHome();
  const home = homeEntrance();
  player.pos.set(home.x, 0.18, home.z + 2);
  human.root.position.copy(player.pos);
  S.minutes = hasSave ? S.minutes : S.minutes;
  sky.update(ST.hour(S), player.pos, 0);
  sky.refreshEnv();
  progress(0.92, '첫 화면을 그리는 중'); await nextFrame();
  renderer.render(scene, camera);
  await nextFrame();
  progress(1, ''); lt.textContent = '';
  $('loadBar').style.display = 'none';
  $('tFoot').textContent = isTouch ? '왼쪽 화면을 밀어 이동 · 오른쪽 화면을 밀어 시점 · 두 손가락으로 확대' : 'WASD 이동 · 마우스 드래그 시점 · 휠 확대 · E 상호작용 · Space 점프 · Esc 메뉴';
  window.__booted = true;
  $('tBtns').classList.remove('hidden');
  if (hasSave) { $('bContinue').classList.remove('hidden'); $('bNew').classList.add('secondary'); $('bNew').textContent = '처음부터 다시'; }
  setQualityButtons();
  requestAnimationFrame(loop);
}

const VIEW = { near: 0.7, mid: 1, far: 1.35 };
let perfNoShadow = false, perfView = 1;
function applyShadowQuality() {
  const q = QUAL[quality];
  sky.setShadowQuality(q.shadow, q.range);
  sky.sun.castShadow = (S.settings.shadows ?? q.shadows) && !perfNoShadow;
}
function applyView() { city?.setNearRadius(QUAL[quality].near * (VIEW[S.settings.view] || 1) * perfView); }
function setQuality(q) {
  quality = q; S.settings.quality = q;
  dynScale = 1;
  renderer.setPixelRatio(QUAL[q].pr);
  applyShadowQuality();
  traffic?.setCount(QUAL[q].traffic);
  perfNoShadow = false; perfView = 1; applyShadowQuality(); applyView();
  peds?.setCount(QUAL[q].peds);
  setQualityButtons();
}
function autoPerf(dt) {
  if (TEST || busy) return;
  perfT += dt; perfFrames++;
  if (perfT < 3) return;
  const fps = perfFrames / perfT; perfT = 0; perfFrames = 0;
  const prev = dynScale;
  window.__fps = Math.round(fps);
  if ($('fpsMeter')) $('fpsMeter').textContent = `${Math.round(fps)} FPS · ${Math.round(dynScale * 100)}%`;
  if (S.settings.auto === false) return;
  if (fps < 24 && dynScale > 0.55) dynScale = Math.max(0.55, dynScale - 0.1);
  else if (fps > 52 && dynScale < 1) dynScale = Math.min(1, dynScale + 0.05);
  if (dynScale !== prev) renderer.setPixelRatio(QUAL[quality].pr * dynScale);
  // 해상도를 다 낮춰도 느리면: 그림자 끄기 → 시야 줄이기
  if (fps < 20 && dynScale <= 0.55) {
    if (!perfNoShadow && sky.sun.castShadow) { perfNoShadow = true; applyShadowQuality(); toast('⚙️ 부드럽게 하려고 그림자를 껐어요 (설정에서 바꿀 수 있어요)', '', 3600); }
    else if (perfView > 0.75) { perfView = 0.75; applyView(); }
  }
  if (fps < 18 && dynScale <= 0.55 && quality !== 'low' && !perfWarned) { perfWarned = true; toast('🐢 화면이 느려요. ☰ 메뉴 → 설정에서 그래픽을 \'절약\'으로 바꾸면 더 부드러워요', '', 6000); }
  window.__fps = Math.round(fps);
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

let starting = false;
async function startGame(fresh) {
  if (starting) return;
  starting = true;
  audio.init();
  $('tBtns').classList.add('hidden');
  $('loadTxt').textContent = '도시로 나가는 중…';
  await nextFrame();
  mode = 'city';
  missions.init();
  human.restyle(ensureLook(S));
  ensureWallet(S);
  realEstate.restore();
  life.start();
  applyShadowQuality(); applyView(); fpsMeter();
  const home = homeEntrance();
  const sp = S.player;
  const valid = sp && Number.isFinite(sp.x) && Number.isFinite(sp.z) && Math.abs(sp.x) < HALF + 30 && Math.abs(sp.z) < HALF + 30;
  if (!fresh && sp && !valid) S.player = null;   // 저장된 위치가 이상하면 집 앞에서 시작
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
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('loadTxt').textContent = '';
  traffic.reseed(player.pos); peds.reseed(player.pos);
  attachRooms(true);
  spawnPlayerCar();
  if (!fresh && S.player?.inCar && pcar) enterCar(true);
  if (!fresh && S.player?.inside) await enterHome(true);
  if (S.mart?.shift) S.mart.shift = null; // 근무 중에 꺼졌으면 근무는 취소
  updateHUD(true);
  if (ST.saveStatus.recovered) setTimeout(() => toast('🛟 저장 파일이 손상돼서 백업에서 복구했어요', 'bad', 4500), 1200);
  starting = false;
  if (fresh || S.tutorial) {
    bigMsg('도시생활에 오신 걸 환영해요', '1일차 아침. 지갑엔 8만 원, 원룸 한 칸이 전부예요.', 3600);
    setTimeout(() => toast('왼쪽 화면을 누른 채 움직이면 걸어요 · 오른쪽 화면을 밀면 시점이 돌아가요'), 3800);
    setTimeout(() => toast('📱 휴대폰으로 지도·택시·미션을 볼 수 있어요 · ☰ 메뉴에 조작법이 있어요'), 7500);
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
  if (S.errand) return S.errand.to;
  if (S.waypoint) return S.waypoint;
  return missions?.target() || null;
}

// ───────── 메인 루프 ─────────
let last = performance.now(), hudT = 0, miniT = 0, saveT = 0, checkT = 0, attachT = 0, lastShift = false;
// 한 프레임에서 오류가 나도 게임이 멈추지 않게 (같은 오류는 한 번만 알림)
let loopErrors = 0, lastErrMsg = '';
function loop(now) {
  requestAnimationFrame(loop);
  try { frame(now); } catch (e) {
    loopErrors++;
    if (e.message !== lastErrMsg) { lastErrMsg = e.message; console.error(e); if (mode !== 'title') toast('⚠️ 일시적인 오류가 생겼어요. 계속 진행돼요', 'bad'); }
    if (busy && loopErrors > 120) busy = false;
  }
}
function frame(now) {
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
  const shift = (mode === 'mart' && martGame.onShift) || (mode === 'school' && !!schoolGame.duty) || (mode === 'bldg' && (!!jobGame?.onShift || !!career?.working));
  const timeFrozen = sheetOpen() || phoneOpen || (!shift && (mgOpen || busy));
  lastShift = shift;
  if (!timeFrozen) {
    const actMode = shift ? 'work' : inCar ? 'drive' : player.speed > 3 ? 'run' : player.speed > 0.3 ? 'walk' : 'idle';
    const before = S.energy;
    ST.passTime(S, dt * MIN_PER_SEC * (shift ? 2 : 1), actMode);
    economy?.tick(dt * MIN_PER_SEC * (shift ? 2 : 1), { home: mode === 'home', light: interior?.lightOn !== false, cooking: !!cooking?.active, temp: life ? life.temp() : 15 });
    needWarnings(before);
  }
  checkT -= dt; if (checkT <= 0) { checkT = 2; martGame.dailyCheck(); schoolGame.dailyCheck(); jobGame?.dailyCheck(); realEstate?.dailyCheck(); career?.dailyCheck(); life?.dailyCheck(); economy?.dailyCheck(); pets?.dailyCheck(); economy?.updateStocks(); if (mode === 'school') schoolGame.refresh(schoolEntrance.school); }
  pets?.update(paused ? 0 : dt); achieve?.update(dt);
  const hours = ST.hour(S);
  if (mode === 'city') {
    const focus = inCar && pcar ? pcar.pos : player.pos;
    sky.update(hours, focus, dt);
    weather.update(dt, S.minutes, camera.position, false);
    audio.loop?.('rain', weather.kind === 'snow' ? 0 : weather.amt * 0.55);
    life.update(dt, timeFrozen, false); transit.update(dt);
    autoPerf(dt);
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
    if (!paused) missions.update(dt, inCar && pcar ? pcar.pos : player.pos, !inCar);
    if (talkingPed && !sheetOpen()) { talkingPed.talk = 1.5; talkingPed = null; }
    if (!paused && !inCar) checkWalkIn();
    // 바깥에서도 가까운 실내 문은 열리고 닫힘
    if (homeSite && homeSite.kind !== 'tower') { const [lx, lz] = homeSite.toLocal(player.pos.x, player.pos.z); if (Math.abs(lx) < 12 && Math.abs(lz) < 12) interior.updateDoor?.(dt, { x: lx, z: lz }); }
    if (martSite) { const [lx, lz] = martSite.toLocal(player.pos.x, player.pos.z); if (Math.abs(lx) < 12 && Math.abs(lz) < 9) mart.updateDoor(dt, { x: lx, z: lz }); }
    if (statSite) { const [lx, lz] = statSite.toLocal(player.pos.x, player.pos.z); if (Math.abs(lx) < 30 && Math.abs(lz) < 30) stat.update(dt, statGame.isOpen() ? { x: lx, z: lz } : { x: 99, z: 99 }, hours % 24); }
    roomAmb.intensity = 0; roomLight.intensity = 0;
    audio.ambient(sky.night > 0.5, false);
    audio.engine(inCar && !paused, pcar ? pcar.speed : 0, inCar ? lastThrottle : 0, pcar ? pcar.spec.maxSpeed : 30);
    audio.loop('step', !paused && !inCar && !transit?.riding && player.ground && player.speed > 0.6 ? Math.min(0.3, player.speed * 0.06) : 0, 0.75 + player.speed * 0.09);
    miniT -= dt; if (miniT <= 0) { miniT = 0.1; drawMinimap(); }
    renderer.render(scene, camera);
  } else {
    // 실내 (실제 건물 안) — 바깥 도시도 계속 돌아감
    const pwv = playerWorld();
    sky.update(hours, pwv, dt);
    weather.update(dt, S.minutes, camera.position, true);
    audio.loop?.('rain', weather.kind === 'snow' ? 0 : weather.amt * 0.25);
    audio.loop('step', !paused && player.speed > 0.6 ? Math.min(0.2, player.speed * 0.05) : 0, 0.8 + player.speed * 0.1);
    life.update(dt, timeFrozen, true); transit.update(dt);
    autoPerf(dt);
    renderer.toneMappingExposure = 1 + sky.night * 0.25;
    city.update(dt, sky.night, elapsed, camera.position);
    traffic.update(paused ? 0 : dt, pwv, null, sky.night, camera.position);
    if (!paused) peds.update(dt, pwv, camera.position);
    const lightOn = mode !== 'home' || interior.lightOn !== false;
    roomAmb.intensity = lightOn ? 0.45 + sky.night * 0.5 : 0.1;
    roomLight.intensity = lightOn ? 1.1 + sky.night * 0.6 : 0;
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
    } else if (mode === 'stat') {
      if (closing.key !== 'stat') closing.reset('stat');
      const cw = closing.tick(hours % 24, weekday());
      if (cw === 'warn') toast('🔔 사장님: "30분 뒤에 문 닫아요~ 필요한 거 있으면 얼른 골라요"', '', 4500);
      if (cw === 'closed' && !busy) { closeSheet(); statGame.basket = {}; toast('🔒 영업이 끝났어요. 고른 물건은 제자리에 두고 나왔어요', 'bad', 4000); leaveSite(); persist(); return; }
      if (!paused) updateRoomWalking(dt);
      stat.update(sheetOpen() || phoneOpen ? 0 : dt, player.pos, hours % 24);
      updateRoomCamera(dt);
      stat.updateWalls(localCam);
      if (!paused) { const a = statGame.action(stat.zoneAt(player.pos)); if (a) setAct(a.label, a.fn, a.green); else setAct(null); }
      audio.ambient(false, true);
    } else if (mode === 'bldg') {
      if (!paused && !seated) updateRoomWalking(dt);
      else if (seated) { applyLook(readInput()); human.root.position.copy(player.pos); }
      if (!paused) shopGame.update(dt);
      if (!timeFrozen && jobGame.onShift) jobGame.update(dt);
      bldg.frame(dt, paused);
      if (!timeFrozen && career?.working) career.update(dt);
      if (mode === 'bldg') {
        const pl = room.plan;
        roomAmb.intensity = pl.roof || pl.exitOpen ? 0.2 : 0.62 + sky.night * 0.3;
        roomLight.intensity = pl.roof ? 0 : 1.3 + sky.night * 0.4;
        if (!pl.roof && !pl.exitOpen) sky.sun.intensity *= 0.3;
        updateRoomCamera(dt);
        if (!paused) { const a = bldg.action(); if (a) setAct(a.label, a.fn, a.green); else setAct(null); setCarBtn(a?.alt?.label || null, a?.alt?.fn); }
      }
      audio.ambient(sky.night > 0.5, mode === 'bldg' && !room?.plan?.roof);
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
  else if (mode === 'stat' && statEntrance) S.player = { x: statEntrance.x + statEntrance.nx * 1.4, z: statEntrance.z + statEntrance.nz * 1.4, h: statEntrance.face, inside: false };
  else if (mode === 'bldg' && bldg?.entryDoor) { const d = bldg.entryDoor; S.player = { x: d.x, z: d.z, h: Math.atan2(d.nx, d.nz), inside: false }; }
  else if (mode === 'mart' && martEntrance) S.player = { x: martEntrance.x + martEntrance.nx * 1.4, z: martEntrance.z + martEntrance.nz * 1.4, h: martEntrance.face, inside: false };
  else S.player = { x: (inCar && pcar ? pcar.pos.x : player.pos.x), z: (inCar && pcar ? pcar.pos.z : player.pos.z), h: player.heading, inCar };
  if (pcar) S.carPos = { x: pcar.pos.x, z: pcar.pos.z, h: pcar.heading };
  if (!ST.save(S) && !saveWarned) { saveWarned = true; toast('⚠️ 이 브라우저에서는 저장이 안 돼요 (사생활 보호 모드인지 확인해 주세요)', 'bad', 5000); }
  if (cloud.user && Date.now() - cloud.lastUp > 120000 && mode !== 'title') cloud.upload(S).catch(() => {});
}
// ───────── 구글 로그인 클라우드 저장 ─────────
document.addEventListener('visibilitychange', () => { if (document.hidden && cloud.user && mode !== 'title') { persist(); cloud.upload(S).catch(() => {}); } });
let cloudAsked = false;
cloud.onChange(async (u) => {
  if (!u || cloudAsked || mode === 'title') return;
  cloudAsked = true;
  try {
    const cs = await cloud.download();
    if (cs && cs.S.minutes > S.minutes + 60) cloudLoadSheet(cs);
    else { await cloud.upload(S); toast('☁️ 클라우드 저장이 켜졌어요 · 2분마다 자동으로 올라가요', 'good', 3600); }
  } catch (e) { toast('☁️ 클라우드에 연결하지 못했어요', 'bad'); }
});
function cloudLoadSheet(cs) {
  openSheet({
    icon: '☁️', title: '클라우드 저장 불러오기', sub: `${cs.day}일차 · 💳 ${won(cs.money)}${cs.at ? ` · ${cs.at.toLocaleString('ko-KR')}` : ''}`,
    html: `<p class="note">지금 이 기기의 진행: ${ST.day(S)}일차 · 💳 ${won(S.money)}<br>불러오면 이 기기의 진행은 클라우드 내용으로 바뀌어요.</p>
      <button class="btn wide green" data-act="load">⬇️ 클라우드 진행 불러오기</button><button class="btn wide gray" data-act="keep">이 기기 진행 유지 (클라우드에 덮어쓰기)</button>`,
    bind: (b) => bindActs(b, {
      load: () => { ST.save(cs.S); toast('☁️ 불러오는 중…'); setTimeout(() => location.reload(), 400); },
      keep: async () => { closeSheet(); persist(); await cloud.upload(S).catch(() => {}); toast('☁️ 이 기기 진행을 클라우드에 저장했어요', 'good'); },
    }),
  });
}
async function cloudSheet() {
  if (!cloud.available) {
    openSheet({ icon: '☁️', title: '클라우드 저장', sub: '구글 계정으로 여러 기기에서 이어하기', html: `<p class="note">아직 준비 중이에요. 운영자가 구글 로그인(Firebase) 설정을 넣으면 바로 켜져요.<br>지금은 이 기기의 브라우저에 20초마다 자동 저장돼요.</p><button class="btn wide gray" data-act="ok">닫기</button>`, bind: (b) => bindActs(b, { ok: () => closeSheet() }) });
    return;
  }
  const ok = await cloud.init();
  if (!ok) { toast('☁️ 클라우드를 불러오지 못했어요 · 인터넷 연결을 확인해 주세요', 'bad'); return; }
  const u = cloud.user;
  openSheet({
    icon: '☁️', title: '클라우드 저장', sub: u ? `${u.displayName || ''} · ${u.email || ''}` : '구글 계정으로 로그인하면 다른 기기에서도 이어할 수 있어요',
    html: u ? `<p class="note">${cloud.lastUp ? `마지막 업로드: ${Math.round((Date.now() - cloud.lastUp) / 60000)}분 전` : '아직 올리지 않았어요'} · 2분마다 자동 업로드</p>
        <button class="btn wide green" data-act="up">⬆️ 지금 클라우드에 저장</button><button class="btn wide" data-act="down">⬇️ 클라우드에서 불러오기</button><button class="btn wide gray" data-act="out">로그아웃</button>`
      : `<button class="btn wide green" data-act="in">🔐 구글로 로그인</button>`,
    bind: (b) => bindActs(b, {
      in: async () => { closeSheet(); try { await cloud.signIn(); } catch (e) { toast('🔐 로그인하지 못했어요', 'bad'); } },
      up: async () => { persist(); try { await cloud.upload(S); toast('☁️ 클라우드에 저장했어요', 'good'); } catch (e) { toast('☁️ 저장하지 못했어요', 'bad'); } cloudSheet(); },
      down: async () => { try { const cs = await cloud.download(); if (!cs) { toast('☁️ 클라우드에 저장된 진행이 없어요'); return; } cloudLoadSheet(cs); } catch (e) { toast('☁️ 불러오지 못했어요', 'bad'); } },
      out: async () => { closeSheet(); await cloud.signOut(); cloudAsked = false; toast('👋 로그아웃했어요 · 이 기기에는 계속 저장돼요'); },
    }),
  });
}
// 타이틀: 클라우드에서 이어하기
if (cloud.available) {
  const tb = $('tBtns'), btn = document.createElement('button');
  btn.textContent = '☁️ 구글 계정에서 불러오기'; btn.className = 'primary';
  tb.insertBefore(btn, tb.querySelector('.q-row'));
  btn.addEventListener('click', async () => {
    try {
      await cloud.init();
      if (!cloud.user) await cloud.signIn();
      const cs = await cloud.download();
      if (!cs) { $('loadTxt').textContent = '☁️ 클라우드에 저장된 진행이 없어요 · 새로 시작해 보세요'; return; }
      $('loadTxt').textContent = `☁️ ${cs.day}일차 진행을 불러오는 중…`;
      ST.save(cs.S); location.reload();
    } catch (e) { $('loadTxt').textContent = '☁️ 불러오지 못했어요 · 인터넷 연결을 확인해 주세요'; }
  });
  cloud.init();
}
let saveWarned = false;

// ───────── 메뉴 · 도움말 ─────────
function openMenu() {
  if (mode === 'title' || busy) return;
  closePhone();
  const ago = ST.saveStatus.lastSave ? Math.max(0, Math.round((Date.now() - ST.saveStatus.lastSave) / 1000)) : null;
  openSheet({
    icon: '☰', title: '메뉴', sub: '게임이 잠시 멈춰 있어요',
    html: `<button class="btn wide green" data-act="resume">▶ 계속하기</button>
      <button class="btn wide" data-act="help">❓ 조작법 · 도움말</button>
      <button class="btn wide" data-act="missions">🎯 오늘의 미션</button>
      <button class="btn wide gray" data-act="settings">⚙️ 설정 (그래픽 · 소리)</button>
      <button class="btn wide gray" data-act="save">💾 지금 저장</button>
      <button class="btn wide gray" data-act="cloud">☁️ 클라우드 저장 (구글 로그인)</button>
      <p class="note">${ago === null ? '아직 저장 전이에요' : `마지막 저장: ${ago < 60 ? ago + '초' : Math.round(ago / 60) + '분'} 전`} · 20초마다 자동 저장돼요 (이 기기의 브라우저에 저장)</p>`,
    bind: (b) => bindActs(b, {
      resume: () => closeSheet(),
      help: () => helpSheet(),
      missions: () => { closeSheet(); openPhone(); phoneApp('missions'); },
      settings: () => { closeSheet(); openPhone(); phoneApp('settings'); },
      save: () => { persist(); toast('💾 저장했어요', 'good'); openMenu(); },
      cloud: () => { closeSheet(); cloudSheet(); },
    }),
  });
}
function helpSheet() {
  openSheet({
    icon: '❓', title: '조작법 · 도움말', sub: '언제든 ☰ 메뉴에서 다시 볼 수 있어요',
    html: `<div class="help">
      <h4>📱 터치</h4><ul>
        <li>왼쪽 화면을 누른 채 밀기: 이동</li><li>오른쪽 화면 밀기: 시점 돌리기</li>
        <li>두 손가락 벌리기/모으기: 확대·축소 (끝까지 당기면 1인칭)</li>
        <li>오른쪽 아래 ⤒: 점프 · 🏃: 달리기 켜고 끄기</li><li>파란 버튼: 가게 들어가기 · 물건 고르기 같은 상호작용</li></ul>
      <h4>⌨️ 키보드 · 마우스</h4><ul>
        <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 또는 방향키: 이동 · <kbd>Shift</kbd>: 달리기 · <kbd>Space</kbd>: 점프</li>
        <li>마우스 드래그: 시점 · 휠: 확대·축소</li>
        <li><kbd>E</kbd>: 상호작용 · <kbd>F</kbd>: 차 타기/내리기 · <kbd>H</kbd>: 경적 · <kbd>M</kbd>: 지도 · <kbd>Esc</kbd>: 메뉴</li></ul>
      <h4>🌆 도시생활 요령</h4><ul>
        <li>배고픔·에너지·기분이 0이 되면 쓰러져요. 편의점에서 먹고 집에서 자요</li>
        <li>돈은 편의점 알바 · 배달 · 회사 · 학교 선생님으로 벌어요</li>
        <li>📱 휴대폰 → 🎯 미션에서 오늘의 미션을 깨면 돈과 경험치를 받아요</li>
        <li>길에서 사람들에게 말을 걸어 보세요. 부탁을 들어주면 보상을 줘요</li>
        <li>휴대폰 지도에서 장소를 골라 길안내나 택시를 쓸 수 있어요</li></ul></div>
      <button class="btn wide green" data-act="ok">알겠어요</button>`,
    bind: (b) => bindActs(b, { ok: () => closeSheet() }),
  });
}
$('menuBtn').addEventListener('click', () => { audio.click(); openMenu(); });

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
  const ride = transit?.speed() || 0;
  const run = !ride && (player.run || i.run);
  const top = ride ? ride * (S.hunger <= 0 ? 0.8 : 1) : (run ? 5.4 + Math.min(1.2, S.fitness * 0.04) : 1.9) * (S.hunger <= 0 ? 0.7 : 1) * (S.sick ? 0.85 : 1);
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
  verticalMove(dt, city.groundY(player.pos.x, player.pos.z), ride ? null : i);
  if (firstPerson()) player.heading = cam.yaw + Math.PI;
  human.root.position.copy(player.pos);
  human.root.rotation.y = player.heading;
  human.animate(dt, player.speed, run, !player.ground);
}
// 점프 · 중력 (로블록스처럼 누르고 있으면 착지할 때마다 다시 점프)
function verticalMove(dt, gy, i) {
  const want = !!i && (jumpHeld || i.handbrake);
  if (want && player.ground && !busy) { player.vy = 6.4; player.ground = false; audio.play?.('jump'); }
  if (!player.ground || player.pos.y > gy + 0.25) {
    player.ground = false;
    player.vy -= 19.6 * dt;
    player.pos.y += player.vy * dt;
    if (player.pos.y <= gy) { player.pos.y = gy; player.vy = 0; player.ground = true; }
  } else {
    player.pos.y += (gy - player.pos.y) * Math.min(1, dt * 14);
    player.vy = 0;
  }
}
// 1인칭: 실내에서는 항상, 밖에서는 끝까지 확대했을 때
function firstPerson() {
  if (editing || cam.kitchen) return false;
  if (room) return true;
  return !inCar && cam.tdist < 0.9;
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
  const fp = firstPerson();
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + i.dy * 0.0045, fp ? -1.3 : -0.05, fp ? 1.3 : 1.25);
  if (i.zoom) {
    if (inCar) cam.carDist = THREE.MathUtils.clamp(cam.carDist + i.zoom * 0.8, 5, 18);
    else if (!room) {
      // 로블록스처럼 끝까지 당기면 1인칭
      const was = cam.tdist;
      cam.tdist = THREE.MathUtils.clamp(cam.tdist + i.zoom * 0.6, 0.5, 14);
      if (was >= 0.9 && cam.tdist < 2.2 && i.zoom < 0) { cam.tdist = 0.5; cam.pitch = Math.min(cam.pitch, 0.3); }
      else if (was < 0.9 && i.zoom > 0) cam.tdist = 2.4;
    }
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
    if (firstPerson()) { cam.dist = 0.5; fpCamera(); human.root.visible = false; return; }
    human.root.visible = true;
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
  // 나뭇잎 속으로 들어가지 않게
  while (d > 1.3 && city.inCanopy(target.x + dx * d, target.y + dy * d, target.z + dz * d)) d -= 0.3;
  camera.position.set(target.x + dx * d, Math.max(0.4, target.y + dy * d), target.z + dz * d);
  camera.lookAt(target);
}
function insideBuilding(x, y, z) { return city.insideBuilding(x, y, z); }
// 1인칭 카메라: 머리 위치에서 바라보는 방향으로 (실내면 건물 기준 방향을 월드로 돌림)
function fpCamera() {
  human.root.updateMatrixWorld(true);
  human.headPivot.getWorldPosition(fpPos);
  fpPos.y += 0.14;
  const yaw = cam.yaw + (site ? site.rot : 0);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const fx = -Math.sin(yaw) * cp, fz = -Math.cos(yaw) * cp;
  fpPos.x += fx * 0.12; fpPos.z += fz * 0.12;
  camera.position.copy(fpPos);
  fpLook.set(fpPos.x + fx, fpPos.y - sp, fpPos.z + fz);
  camera.lookAt(fpLook);
}

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
  if (b.textContent !== label) b.textContent = label; b.classList.remove('hidden'); carHandler = fn;
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
  if (S.errand && Math.hypot(p.x - S.errand.to.x, p.z - S.errand.to.z) < 3.5) { setAct(`🙏 ${S.errand.item} 전해주기`, () => missions.finishErrand(), true); return; }
  let best = null, bd = 2.6;
  for (const e of city.entrances) {
    if (e.id === 'home' && (e.homeId !== S.home || S.homeUnit)) continue;
    const dd = Math.hypot(p.x - e.x, p.z - e.z);
    if (dd < bd) { bd = dd; best = e; }
  }
  if (best) { setAct(`${best.icon} ${best.elevator ? '엘리베이터 타기 · ' : best.walkIn && best.id !== 'school' ? '들어가기 · ' : ''}${best.name}`, () => openPlace(best)); return; }
  const bdr = city.nearestBDoor(p.x, p.z, 1.7);
  if (bdr) { setAct(bldg.doorLabel(bdr), () => bldg.tryEnter(bdr)); return; }
  const la = life.action(p) || transit.action(p);
  if (la) { setAct(la.label, la.fn, la.green); return; }
  const ped = peds.nearest(p, 2.2);
  const pa = pets.action(); if (pa && !ped) { setAct(pa.label, pa.fn); return; }
  if (ped) { setAct(`💬 ${ped.name}에게 말 걸기`, () => { talkingPed = ped; ped.talk = 999; missions.talkSheet(ped, ST.hour(S) % 24); }); return; }
  setAct(null);
}
$('btnAct').addEventListener('click', () => { if (actHandler && !busy) { audio.click(); actHandler(); } });
$('btnCar').addEventListener('click', () => { if (carHandler && !busy) { audio.click(); carHandler(); } });
{
  const jb = $('btnJump');
  const dn = (e) => { e.preventDefault(); jumpHeld = true; jb.classList.add('on'); };
  const up = () => { jumpHeld = false; jb.classList.remove('on'); };
  jb.addEventListener('pointerdown', dn); jb.addEventListener('pointerup', up); jb.addEventListener('pointercancel', up); jb.addEventListener('pointerleave', up);
}
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
  if (e.code === 'Escape') {
    if (!$('mg').classList.contains('hidden')) return;
    if (sheetOpen()) closeSheet();
    else if (!phone.classList.contains('hidden')) closePhone();
    else if (editing) endEdit();
    else openMenu();
  }
  if (e.code === 'KeyM' && !sheetOpen() && !busy) openPhone('map');
  if (e.code === 'KeyR' && !inCar) { player.run = !player.run; $('btnRun').classList.toggle('on', player.run); }
});

const weekday = () => (ST.day(S) - 1) % 7;
function openPlace(e) {
  if (HOURS[e.id] && !e.walkIn) {
    const st = openStatus(e.id, ST.hour(S) % 24, weekday());
    if (!st.open) return closedNotice(e.id, st);
  }
  switch (e.id) {
    case 'home': return e.walkIn ? walkInto(e.site) : enterHome();
    case 'mart': return walkInto(e.site);
    case 'stat': return walkInto(e.site);
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
// 가게 계산: 카드·간편결제·현금 고르기
function walletCtx() { return { get S() { return S; }, audio, flash: (g) => flashMoney(g), persist }; }
function checkout(total, opts, onPaid) { paySheet(walletCtx(), total, { ...opts, onPaid }); }
// 동전·현금만 (뽑기 기계, 현금 전용 가게)
function payCash(amount) {
  ensureWallet(S);
  if (S.cash < amount) { audio.bad(); toast(`🪙 현금이 없어요 (지갑 ${won(S.cash)}) · 편의점 ATM에서 뽑아 오세요`, 'bad', 3600); return false; }
  S.cash -= amount; flashMoney(false); return true;
}
function earn(amount, reason) {
  amount = Math.round(amount / 10) * 10;
  if (S.loan > 0) {
    const repay = Math.min(S.loan, Math.round(amount * 0.2 / 10) * 10);
    S.loan -= repay; amount -= repay;
    reason += ` (학자금 상환 ${won(repay)}${S.loan <= 0 ? ' · 대출 다 갚았어요!' : ''})`;
  }
  S.money += amount; S.totalEarned += amount; flashMoney(true);
  missions.event('earn');
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
  missions?.event('eat');
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
const closing = new ClosingWatch();
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
  const dtx = `${ST.day(S)}일차 ${DAYNAMES[(ST.day(S) - 1) % 7][0]} · ${life ? `${life.season().icon} ${Math.round(life.temp())}°` : ''}${S.sick ? ' 🤧' : ''}`;
  if ($('day').textContent !== dtx) $('day').textContent = dtx;
  $('money').textContent = Math.round(S.money).toLocaleString('ko-KR');
  $('cash').textContent = Math.round(S.cash || 0).toLocaleString('ko-KR');
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
  } else if (S.errand && mode === 'city') {
    html = `🙏 <b>${S.errand.item}</b> → ${t.name} <span class="dist">${Math.round(Math.hypot(p.x - t.x, p.z - t.z))}m</span><small>${S.errand.from}의 부탁 · 보상 ${won(S.errand.money)}</small>`;
  } else if (S.waypoint) {
    html = `📍 ${S.waypoint.name} <span class="dist">${Math.round(Math.hypot(p.x - t.x, p.z - t.z))}m</span>`;
  } else if (mode === 'bldg') {
    html = jobGame.onShift ? jobGame.hudText() : career.working ? career.hudText() : bldg.hudText();
  } else if (mode === 'stat') {
    html = statGame.hudText();
  } else if (mode === 'mart') {
    html = martGame.hudText();
  } else if (mode === 'school') {
    html = schoolGame.hudText(schoolEntrance.school);
  } else if (mode === 'city') {
    html = missions.hudLine();
    if (!html) { const g = GOALS.find(g => !S.goalsDone?.includes(g.id)); if (g) html = `🏆 ${g.text}<small>${g.hint}</small>`; }
  }
  const L = missions.level();
  $('lvl').textContent = 'Lv.' + L.lv; $('xpFill').style.width = Math.round(L.xp / L.need * 100) + '%';
  if ($('objective').innerHTML !== html) $('objective').innerHTML = html;
  $('joyHint').classList.toggle('hidden', elapsed > 40 || mode !== 'city' || inCar || player.speed > 0.5 || editing);
  if (editing) $('joyHint').classList.add('hidden');
}

// ───────── 인생 목표 ─────────
const GOALS = [
  { id: 'eat', text: '편의점에서 밥 사 먹기', hint: '파란 링이 있는 24 마트에 들어가 보세요', done: () => S.ateOnce },
  { id: 'job', text: '첫 돈 벌기', hint: '편의점 알바 · 번개배달 · 가게 알바 · 📱한빛잡 취업 중 하나를 골라요', done: () => S.totalEarned > 0 },
  { id: 'money', text: '100만 원 모으기', hint: '꾸준히 일하면 금방이에요', done: () => S.money >= 1000000 },
  { id: 'car', text: '첫 차 뽑기', hint: '드림모터스 전시장에서 중고 경차부터!', done: () => S.cars.length > 0 },
  { id: 'furn', text: '집에 가구 3개 들이기', hint: '홈데코에서 사고, 집에서 🛠 꾸미기로 배치', done: () => Object.values(S.placed).flat().filter(p => !['bed', 'fridge'].includes(p.id)).length >= 3 },
  { id: 'promo', text: '회사에서 대리로 승진하기', hint: '📱한빛잡에서 회사에 지원하고 성실하게 출근해요', done: () => S.officeRank >= 2 || (S.bestRank?.office ?? -1) >= 3 },
  { id: 'apt', text: '아파트로 이사하기', hint: '부동산에서 아파트 월세·전세·매매 계약 후 이사', done: () => S.homes.includes('apt') },
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
  if (id.includes(':')) { const m = menuFood(id); if (m) return { ...m, icon: m.icon || '🍽️' }; }
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
  missions.event('eat');
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

// 가게에서 산 물건
function applyGoods(key, g, n) {
  if (!g) return;
  const inv = S.inventory;
  S.items = S.items || {};
  if (g.item) { S.items[g.id] = (S.items[g.id] || 0) + n; return; }
  if (key === 'mart') { if (g.ing) for (const [k, v] of Object.entries(g.ing)) inv.ing[k] = (inv.ing[k] || 0) + v * n; else inv.food[g.id] = (inv.food[g.id] || 0) + n; return; }
  if (g.food) { const id = `g:${key}:${g.id}`; inv.food[id] = (inv.food[id] || 0) + (g.n || 1) * n; return; }
  if (g.ing) { for (const [k, v] of Object.entries(g.ing)) inv.ing[k] = (inv.ing[k] || 0) + v * n; return; }
  if (g.cure === 'cold' || g.id === 'coldmed') { S.meds = (S.meds || 0) + 3 * n; return; }
  if (g.upgrade === 'camera') { S.phonePro = true; toast('📱 새 폰이에요! 카메라 화질이 좋아졌어요', 'good'); }
  if (g.id === 'digest') S.mood = ST.clamp(S.mood + 3);
  if (g.id === 'hangover') S.energy = ST.clamp(S.energy + 8);
  if (g.id === 'case') S.mood = ST.clamp(S.mood + 3);
  if (g.pet) { S.petItems = S.petItems || {}; S.petItems[g.pet] = (S.petItems[g.pet] || 0) + (g.n || 1) * n; return; }
  S.items[g.id] = (S.items[g.id] || 0) + n;
}
// 가게 의자에 앉기
let seated = null;
function nearestSeat(z) {
  const v = room; if (!v?.npcSpots) return null;
  let best = null, bd = 9;
  for (const sp of v.npcSpots) {
    if (sp.kind !== 'seat') continue;
    if (sp.x < z.x0 - 0.6 || sp.x > z.x1 + 0.6 || sp.z < z.z0 - 0.6 || sp.z > z.z1 + 0.6) continue;
    if (bldg.npcs.some(n => Math.hypot(n.pos.x - sp.x, n.pos.z - sp.z) < 0.3)) continue;
    const d = Math.hypot(sp.x - player.pos.x, sp.z - player.pos.z);
    if (d < bd) { bd = d; best = sp; }
  }
  return best;
}
function seatPlayer(spot) {
  if (spot) {
    seated = { back: player.pos.clone() };
    player.pos.set(spot.x, 0, spot.z); player.speed = 0;
    player.heading = spot.rot; cam.yaw = spot.rot + Math.PI; cam.pitch = 0.35;
    human.root.position.set(spot.x, 0.02, spot.z); human.root.rotation.y = player.heading;
    human.setPose('sit');
  } else if (seated) {
    human.setPose('stand');
    player.pos.copy(seated.back);
    seated = null;
  }
}

// 한 입씩 먹기 (상에 올린 음식들)
async function eatMeal(ids, { place = '식사', minutes = 12, moodBonus = 0 } = {}) {
  const r = await runMeal({ S, foodInfo, audio, passTime: (m) => ST.passTime(S, m, 'idle'), hud: () => updateHUD(true) }, ids, { place, minutes, moodBonus });
  if (r.bites) { missions.event('eat'); S.ateOnce = true; checkGoals(); }
  updateHUD(true); persist();
  return r;
}
const readyFood = () => Object.keys(S.inventory.food).filter(id => S.inventory.food[id] > 0 && !foodInfo(id).needWater);

// ───────── 장소: 식당 ─────────
function restSheet() {
  openSheet({
    icon: '🍚', title: '한끼식당', sub: '집밥보다 맛있는 한식 · 30분 소요',
    html: foodRows('rest'),
    bind: (b) => bindActs(b, { eat: (id) => { const f = FOODS.find(x => x.id === id); checkout(f.price, { icon: '🍚', title: '한끼식당 · 선불 계산', sub: `${f.name} 주문할게요`, lines: row({ icon: f.icon || '🍚', title: f.name, price: won(f.price) }) }, () => mealScene(f)); } }),
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
  let t = TEST ? 4 : 30 + (S.inventory.stat?.st_calc ? 3 : 0), ok = 0, bad = 0, cur = null, running = true;
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
        checkout(price, { icon: '🛋️', title: '홈데코 계산', sub: f.name, onCancel: () => setTimeout(furnSheet, 0) }, () => {
          S.inventory.furniture[id] = (S.inventory.furniture[id] || 0) + 1;
          toast(`📦 ${f.name} 배송 완료! 집에서 꾸미기로 놓아 주세요`, 'good');
          persist();
          setTimeout(furnSheet, 0);
        });
      },
    }),
  });
}
function countFurn(id) {
  return (S.inventory.furniture[id] || 0) + Object.values(S.placed).flat().filter(p => p.id === id).length;
}

// ───────── 장소: 부동산 ─────────
function realtySheet() { realEstate.office('행복 부동산', [{ icon: '🏗️', title: '신축 분양 (푸른숲 아파트 · 레이크타워 펜트하우스)', btn: '보기', fn: () => bunyangSheet() }]); }
function bunyangSheet() {
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
      gym: () => { if (S.energy < 20) return toast('너무 피곤해요', 'bad'); checkout(12000, { icon: '💪', title: '일일 이용권' }, async () => { busy = true; await fade(true); ST.passTime(S, 60, 'gym'); S.fitness++; await fade(false); busy = false; toast(`💪 운동 완료! 체력 레벨 ${S.fitness}`, 'good'); persist(); }); },
      shower: () => checkout(3000, { icon: '🚿', title: '샤워실 이용' }, async () => { busy = true; await fade(true); ST.passTime(S, 15, 'idle'); S.mood = ST.clamp(S.mood + 10); await fade(false); busy = false; toast('🚿 상쾌해요!', 'good'); }),
    }),
  });
}

// ───────── 집 (실내) ─────────
// ───────── 실내 공통 ─────────
// 실내 공간은 도시 속 실제 건물(사이트) 안에 붙어 있어요.
// 실내에 있는 동안 player.pos 는 그 건물 기준 좌표예요.
function homeEntrance() {
  if (S.homeUnit) {
    const sp = city.bldgs.find(q => q.seed === S.homeUnit.bid);
    const d = sp && (city.bdoors.find(q => q.spec === sp && q.door?.secure) || city.bdoors.find(q => q.spec === sp && q.lobby) || city.bdoors.find(q => q.spec === sp));
    if (d) return { id: 'home', x: d.x, z: d.z, nx: d.nx, nz: d.nz, face: Math.atan2(d.nx, d.nz), name: '우리집 · ' + S.homeUnit.name, icon: '🏠', bdoor: d };
  }
  return city.entrances.find(e => e.id === 'home' && e.homeId === S.home) || city.entrances.find(e => e.id === 'home');
}
// 빈 가게 안내
function vacantInfo(unit, b) {
  const B = b.B, area = Math.round((unit.x1 - unit.x0) * (unit.z1 - unit.z0));
  const pr = shopPrices(b.n, area, B.grade, B.kind);
  openSheet({ icon: '🏷️', title: '빈 가게 · 임대 문의', sub: `${B.name} ${b.n}층 · ${Math.round(area / 3.3)}평 (${area}㎡)`, html: `<div class="grid2"><div class="stat"><span>보증금</span><b>${won2(pr.deposit)}</b></div><div class="stat"><span>월세</span><b>${won2(pr.rent)}</b></div></div><p class="note">계약은 동네 부동산에서 해요. 이 자리에 내 가게를 열 수 있어요!</p>` });
}
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
  if (s === statSite) return ['stat', stat];
  return null;
}
function checkWalkIn() {
  for (const s of [martSite, schoolSite, homeSite, statSite]) {
    if (!s || s.kind === 'tower') continue;
    const [lx, lz] = s.toLocal(player.pos.x, player.pos.z);
    if (Math.abs(lx) < s.W / 2 - 0.2 && lz < s.D / 2 - 0.25 && lz > -s.D / 2) {
      if (s === statSite && !statGame.isOpen()) {
        // 영업시간이 아니면 문이 잠겨 있음
        const [wx, wz] = s.toWorld(lx, s.D / 2 + 0.5); player.pos.x = wx; player.pos.z = wz;
        if (elapsed > (lockedToast || 0)) { lockedToast = elapsed + 4; toast(`🔒 문 앞 안내문: "영업시간 ${hoursText('stat')}"`, 'bad', 3600); }
        return;
      }
      const r = roomOf(s); if (r) enterSite(s, r[0], r[1], lx, lz);
      return;
    }
  }
}
let lockedToast = 0;
let bldg = null, shopGame = null, jobGame = null, realEstate = null, career = null;
function enterSite(s, kind, r, lx, lz) {
  if (inCar) exitCar();
  s.anchor.updateWorldMatrix(true, false);
  camLocal.copy(camera.position); s.anchor.worldToLocal(camLocal);
  site = s; room = r; mode = kind;
  s.inside = true;
  player.pos.set(lx, 0, lz);
  player.heading -= s.rot; cam.yaw -= s.rot;
  player.speed = Math.min(player.speed, 1.7);
  player.vy = 0; player.ground = true;
  cam.pitch = 0.08;
  camera.near = 0.06; camera.far = 1800; camera.updateProjectionMatrix();
  s.anchor.add(human.root);
  human.root.position.copy(player.pos); human.root.rotation.y = player.heading;
  human.setPose('stand');
  setAct(null); setCarBtn(null);
  $('mini').classList.add('hidden');
  $('btnRun').classList.add('hidden');
  if (kind === 'stat') {
    statEntrance = city.entrances.find(e => e.site === s);
    statGame.onEnter();
  }
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
  if (s.kind !== 'tower' && s.kind !== 'bldg' && player.pos.z < s.D / 2 + 0.9) player.pos.z = s.D / 2 + 0.9;
  s.anchor.updateWorldMatrix(true, false);
  const w = s.anchor.localToWorld(player.pos.clone());
  player.pos.set(w.x, city.groundY(w.x, w.z), w.z);
  player.heading += s.rot; cam.yaw += s.rot;
  scene.add(human.root);
  human.root.position.copy(player.pos); human.root.rotation.y = player.heading;
  s.inside = false;
  site = null;
  camera.near = 0.25; camera.far = 5000; camera.updateProjectionMatrix();
  human.root.visible = true;
  cam.dist = 0.6; cam.pitch = 0.25;
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
  cam.pitch = THREE.MathUtils.clamp(cam.pitch, 0, 0.5);
  if (S.player) S.player.inside = false;
}
// 문으로 걸어서 나가기
let exitCool = 0;
function checkWalkOut() {
  if (!site || site.kind === 'tower' || site.kind === 'bldg' || busy) return;
  if (player.pos.z < site.D / 2 + 0.3) return;
  if (elapsed < exitCool) { player.pos.z = site.D / 2 + 0.25; return; }
  exitCool = elapsed + 1.5;
  if (mode === 'mart') return exitMart(true);
  if (mode === 'stat') {
    statGame.tryExit(() => { leaveSite(); persist(); });
    if (mode === 'stat') player.pos.z = stat.D / 2 + 0.1;
    return;
  }
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
  if (s.kind === 'stat' && !statGame.isOpen()) { closedNotice('stat', openStatus('stat', ST.hour(S) % 24, weekday())); return; }
  const dx = s.kind === 'mart' ? 4.2 : s.kind === 'school' ? 0 : s.kind === 'stat' ? STAT_DOOR.x : interior.door.x;
  player.heading = Math.PI + s.rot; cam.yaw = s.rot;
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
  cam.yaw = 0; cam.pitch = 0.08;
  human.root.position.copy(player.pos); human.root.rotation.y = player.heading;
  updateRoomCamera(10);
  if (!silent) await fade(false);
  busy = false;
  ST.save(S);
}
async function exitHome(walk) {
  if (S.homeUnit) {
    busy = true; await fade(true); leaveSite();
    bldg.enterUnit(S.homeUnit);
    persist(); await fade(false); busy = false; return;
  }
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
  const { mx, mz, m } = moveVector(i);
  const target = m > 0.12 ? (player.run || i.run ? 3.2 : 1.9) * Math.min(1, m * 1.15) : 0;
  player.speed += (target - player.speed) * Math.min(1, dt * 8);
  if (firstPerson()) player.heading = cam.yaw + Math.PI;
  else if (m > 0.12) {
    const want = Math.atan2(mx, mz);
    let dh = want - player.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    player.heading += dh * Math.min(1, dt * 12);
  }
  // 1인칭에서는 바라보는 방향 기준으로 이동
  const mvx = m > 0.12 ? mx / Math.max(1e-4, Math.hypot(mx, mz)) : 0, mvz = m > 0.12 ? mz / Math.max(1e-4, Math.hypot(mx, mz)) : 0;
  player.pos.x += mvx * player.speed * dt;
  player.pos.z += mvz * player.speed * dt;
  if (room === mart) for (const c of mart.npcs) {
    const dx = player.pos.x - c.pos.x, dz = player.pos.z - c.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.5 && d > 1e-4) { player.pos.x = c.pos.x + dx / d * 0.5; player.pos.z = c.pos.z + dz / d * 0.5; }
  }
  room.collide(player.pos, 0.3);
  verticalMove(dt, 0, i);
  human.root.position.copy(player.pos);
  human.root.rotation.y = player.heading;
  human.animate(dt, player.speed, false, !player.ground);
  if (player.speed > 0.3 && interior.tvOn) interior.tvOn = false;
}
function updateRoomCamera(dt) {
  const r = room || interior;
  if (site) {
    // 실내 조명 (천장 가운데)
    site.anchor.updateWorldMatrix(true, false);
    if (mode === 'bldg') roomLight.position.set(player.pos.x, (room?.plan?.ch || 2.7) - 0.25, player.pos.z); else roomLight.position.set(0, 2.45, 0);
    site.anchor.localToWorld(roomLight.position);
  }
  if (firstPerson()) {
    human.root.visible = false;
    fpCamera();
    camLocal.copy(camera.position); if (site) site.anchor.worldToLocal(camLocal);
    return;
  }
  human.root.visible = true;
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
  const pa = pets?.action(); if (pa) return setAct(pa.label, pa.fn, true);
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
  if (id === 'desk' && !mesh.userData.deskChoice) {
    const inv = S.inventory.stat || {};
    const color = ['st_colorp', 'st_crayon', 'st_paint'].some(k => inv[k] > 0);
    const pen = ['st_pencils', 'st_pen3', 'st_mech'].some(k => inv[k] > 0);
    openSheet({
      icon: '🪑', title: '책상', sub: '무엇을 할까요?',
      html: row({ icon: '📝', title: '공부하기 · 2시간', desc: pen && S.notePages > 0 ? `공책 필기 효과 +50% (남은 공책 ${S.notePages}쪽)` : '문구랜드에서 공책 + 필기구를 사 오면 효과가 커져요', btn: '시작', action: 'study' }) +
        row({ icon: '🎨', title: '그림 그리기 · 1시간', desc: color && S.sketchPages > 0 ? `기분 +${inv.st_paint ? 16 : 12} · 스케치북 ${S.sketchPages}장 남음` : '스케치북과 색연필(또는 크레파스·물감)이 필요해요', btn: '그리기', action: 'draw', disabled: !(color && S.sketchPages > 0) }),
      bind: (b) => bindActs(b, {
        study: () => { closeSheet(); mesh.userData.deskChoice = true; useFurniture(mesh).finally(() => { mesh.userData.deskChoice = false; }); },
        draw: async () => {
          closeSheet(); busy = true; await fade(true);
          ST.passTime(S, 60, 'fun'); S.sketchPages--; const m = inv.st_paint ? 16 : 12; S.mood = ST.clamp(S.mood + m);
          S.drawings = (S.drawings || 0) + 1;
          await fade(false); busy = false;
          const art = ['🌅', '🏙️', '🌸', '🐱', '🚗', '🌊', '🏔️', '🌈'][S.drawings % 8];
          toast(`🎨 그림 완성! ${art} (${S.drawings}번째 작품) · 기분 +${m}`, 'good', 3200); updateHUD(true); persist();
        },
      }),
    });
    return;
  }
  const a = acts[id];
  if (!a) return;
  if (a.study && !S.officeHired) toast('공부는 했지만 아직 회사원이 아니에요. 승진 점수는 입사 후에 반영돼요');
  busy = true;
  if (a.tv) interior.tvOn = true;
  await fade(true);
  ST.passTime(S, a.t, a.mode);
  if (id === 'piano') S.mood = ST.clamp(S.mood + 6);
  const noteBonus = a.study && (S.notePages || 0) > 0 && ['st_pencils', 'st_pen3', 'st_mech'].some(k => (S.inventory.stat || {})[k] > 0);
  if (noteBonus) S.notePages--;
  if (a.study && S.officeHired) { S.officeExp += noteBonus ? 0.75 : 0.5; tryPromote(); }
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
  cam.yaw = bed.rotation.y + 0.6; cam.pitch = -0.9;
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
  cam.yaw = 0.35; cam.pitch = 0.08;
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
    bind: (b) => { tabs(b); bindActs(b, { eat: (id) => { closeSheet(); const go = (ids) => (mode === 'home' && !fromPhone) ? eatAtHome(ids) : eatMeal(ids, { place: fromPhone ? '가방에서 꺼내 먹기' : '식사' }); const ids = readyFood(); if (ids.length > 1) pickMealSheet({ ids, foodInfo, preselect: [id] }, go); else go([id]); } }); },
  });
}
async function eatAtHome(ids) {
  if (!Array.isArray(ids)) ids = [ids];
  busy = true;
  const table = interior.items.find(m => ['table', 'desk'].includes(m.userData.item.id));
  await fade(true);
  if (table) { human.root.position.set(table.position.x, 0.02, table.position.z + 0.75); human.root.rotation.y = Math.PI + table.rotation.y; human.setPose('sit'); }
  await fade(false);
  await eatMeal(ids, { place: table ? '우리 집 식탁' : '우리 집', minutes: 15, moodBonus: table ? 3 : 0 });
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
  if (site) site.editing = true;
  controls.enabled = false; controls.reset();
  setAct(null);
  $('editBtn').classList.add('hidden');
  $('editBar').classList.remove('hidden'); $('hud').classList.add('editing');
  $('needs').classList.add('hidden');
  cam.yaw = 0.0;
  renderEditBar();
  toast('가구를 눌러 선택하고 끌어서 옮기세요');
}
function endEdit() {
  editing = false;
  if (site) site.editing = false;
  cam.pitch = 0.08;
  controls.enabled = true;
  select(null);
  $('editBar').classList.add('hidden'); $('hud').classList.remove('editing');
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
  if (mode === 'bldg') bldg.exit(null);
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
    ['missions', '🎯', '미션', '#d62828'], ['fashion', '🛍️', '패션몰', '#c2185b'], ['map', '🗺️', '지도·택시', '#2a9d8f'], ['bank', '💳', '은행', '#264653'], ['me', '🧑', '내 정보', '#e76f51'], ['goals', '🏆', '인생 목표', '#f4a261'],
    ['bag', '🎒', '가방', '#8d6e63'], ['car', '🚗', '내 차', '#3d5a80'], ['delivery', '🛵', '배달', '#e9c46a'], ['job', '🧑‍💼', '알바', '#1f8a4c'], ['school', '🎓', '학교', '#5a3a8a'],
    ['work', '💼', '한빛잡', '#0d47a1'], ['estate', '🏠', '내 부동산', '#6d4c41'], ['news', '📰', '한빛뉴스', '#37474f'], ['stock', '📈', '한빛증권', '#c62828'], ['camera', '📷', '카메라', '#455a64'], ['album', '🖼️', '앨범', '#8e24aa'],
    ['settings', '⚙️', '설정', '#6c757d'],
  ];
  phScreen.innerHTML = `<div class="ph-widget"><div style="font-size:13px;opacity:.8">${ST.day(S)}일차 · ${DAYNAMES[(ST.day(S) - 1) % 7]}</div><div class="big">${ST.clock(S).text}</div><div style="font-size:13px;opacity:.8">잔액 ${won(S.money)}</div></div>
    <div class="apps">${apps.map(([id, ic, name, col]) => `<button class="app" data-app="${id}"><i style="background:${col}">${ic}</i>${name}</button>`).join('')}</div>`;
  phScreen.querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', () => { audio.click(); phoneApp(b.dataset.app); }));
}
function phoneApp(id) {
  if (id === 'map') return phoneMap();
  if (id === 'work') { phScreen.innerHTML = career.appHtml(); career.bindApp(phScreen, () => phoneApp('work')); return; }
  if (id === 'news') { phScreen.innerHTML = life.appHtml(); return; }
  if (id === 'estate') { closePhone(); realEstate.myContracts(); return; }
  if (id === 'fashion') return fashionApp();
  if (id === 'missions') {
    phScreen.innerHTML = missions.phoneHtml();
    phScreen.querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', () => { missions.claim(b.dataset.claim); phoneApp('missions'); }));
    phScreen.querySelectorAll('[data-bonus]').forEach(b => b.addEventListener('click', () => { missions.claimBonus(); phoneApp('missions'); }));
    phScreen.querySelectorAll('[data-way]').forEach(b => b.addEventListener('click', () => { const m = missions.ensureDaily().list.find(x => x.id === b.dataset.way); S.waypoint = { ...m.target }; closePhone(); toast(`📍 ${m.target.name} 길안내 시작`); }));
    return;
  }
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
    const draw = (tab) => { phScreen.innerHTML = `<div class="ph-title">💳 한빛은행</div>` + economy.bankHtml(tab); economy.bindBank(phScreen, draw); };
    draw('home');
    return;
  }
  if (id === 'camera') { closePhone(); phoneCam.open(); return; }
  if (id === 'album') { const draw = () => phoneCam.albumHtml(phScreen, draw); draw(); return; }
  if (id === 'stock') {
    const draw = (sel) => { phScreen.innerHTML = economy.stockHtml(sel); economy.bindStock(phScreen, draw, sel); };
    draw(null);
    return;
  }
  if (id === 'me') {
    const r = S.officeHired ? ST.rank(S).name : '무직';
    const pt = Object.values(S.parttime || {})[0];
    const jobTxt = career?.job ? `${career.job.place} ${career.rankName()}` : S.officeHired ? '한빛그룹 ' + r : pt ? `${pt.name} 알바` : S.mart?.hired ? '편의점 알바' : S.deliveries ? '배달 기사' : '구직 중';
    phScreen.innerHTML = `<div class="ph-title">🧑 내 정보</div><div class="grid2">
      <div class="stat"><span>직업</span><b>${jobTxt}</b></div>
      <div class="stat"><span>사는 곳</span><b>${S.homeUnit ? S.homeUnit.name : (HOMES.find(h => h.id === S.home) || HOMES[0]).name}</b></div>
      <div class="stat"><span>신용점수</span><b>${S.credit ?? 750}점</b></div><div class="stat"><span>건강</span><b>${S.sick ? '🤧 감기' : '😊 튼튼'}</b></div>
      <div class="stat"><span>배고픔</span><b>${Math.round(S.hunger)}</b></div><div class="stat"><span>에너지</span><b>${Math.round(S.energy)}</b></div>
      <div class="stat"><span>기분</span><b>${Math.round(S.mood)}</b></div><div class="stat"><span>체력 레벨</span><b>${S.fitness}</b></div>
      <div class="stat"><span>살아온 날</span><b>${ST.day(S)}일</b></div><div class="stat"><span>목표 달성</span><b>${(S.goalsDone || []).length}/${GOALS.length}</b></div></div>`;
    return;
  }
  if (id === 'goals') {
    phScreen.innerHTML = `<div class="ph-title">🏆 인생 목표</div>` + achieve.html() + `<div class="ph-sub" style="margin:14px 0 6px;font-weight:700">📝 첫걸음 목표</div>` + GOALS.map(g => { const d = S.goalsDone?.includes(g.id); return `<div class="row" style="${d ? 'opacity:.55' : ''}"><div class="ic">${d ? '✅' : '⬜'}</div><div class="info"><b>${g.text}</b><span>${g.hint}</span></div></div>`; }).join('');
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
      <div class="note" style="color:#ddd">자동 성능 조절 (느리면 해상도·그림자를 알아서 낮춰요)</div><div class="tabs"><button id="autoOn" class="${S.settings.auto !== false ? 'on' : ''}">켜기</button><button id="autoOff" class="${S.settings.auto === false ? 'on' : ''}">끄기</button></div>
      <div class="note" style="color:#ddd">그림자</div><div class="tabs"><button id="shOn" class="${(S.settings.shadows ?? QUAL[quality].shadows) ? 'on' : ''}">켜기</button><button id="shOff" class="${!(S.settings.shadows ?? QUAL[quality].shadows) ? 'on' : ''}">끄기</button></div>
      <div class="note" style="color:#ddd">시야 거리</div><div class="tabs">${Object.keys(VIEW).map(v => `<button data-view="${v}" class="${(S.settings.view || 'mid') === v ? 'on' : ''}">${{ near: '가까이', mid: '보통', far: '멀리' }[v]}</button>`).join('')}</div>
      <div class="note" style="color:#ddd">프레임 표시</div><div class="tabs"><button id="fpsOn" class="${S.settings.fps ? 'on' : ''}">켜기</button><button id="fpsOff" class="${!S.settings.fps ? 'on' : ''}">끄기</button></div>
      <button class="btn wide" id="saveNow">💾 지금 저장</button>
      <button class="btn wide gray" id="cloudBtn">☁️ 클라우드 저장 (구글 로그인)</button>
      <button class="btn wide red" id="resetAll" style="margin-top:18px">처음부터 다시 하기</button>`;
    phScreen.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { setQuality(b.dataset.q); phoneApp('settings'); }));
    $('sndOn').addEventListener('click', () => { S.settings.sound = true; audio.setEnabled(true); phoneApp('settings'); });
    $('sndOff').addEventListener('click', () => { S.settings.sound = false; audio.setEnabled(false); phoneApp('settings'); });
    $('saveNow').addEventListener('click', () => { persist(); toast('💾 저장했어요', 'good'); });
    $('cloudBtn').addEventListener('click', () => { closePhone(); cloudSheet(); });
    $('autoOn').addEventListener('click', () => { S.settings.auto = true; phoneApp('settings'); });
    $('autoOff').addEventListener('click', () => { S.settings.auto = false; dynScale = 1; renderer.setPixelRatio(QUAL[quality].pr); perfNoShadow = false; perfView = 1; applyShadowQuality(); applyView(); phoneApp('settings'); });
    $('shOn').addEventListener('click', () => { S.settings.shadows = true; perfNoShadow = false; applyShadowQuality(); phoneApp('settings'); });
    $('shOff').addEventListener('click', () => { S.settings.shadows = false; applyShadowQuality(); phoneApp('settings'); });
    phScreen.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { S.settings.view = b.dataset.view; applyView(); phoneApp('settings'); }));
    $('fpsOn').addEventListener('click', () => { S.settings.fps = true; fpsMeter(); phoneApp('settings'); });
    $('fpsOff').addEventListener('click', () => { S.settings.fps = false; fpsMeter(); phoneApp('settings'); });
    $('resetAll').addEventListener('click', () => { if (confirm('정말 모든 진행을 지울까요?')) { ST.wipe(); location.reload(); } });
  }
}
// ───────── 패션몰 · 옷장 (주문하면 바로 도착, 언제든 갈아입기) ─────────
let fashionTab = 'top';
function fashionApp() {
  ensureLook(S);
  const list = OUTFITS.filter(o => o.cat === fashionTab);
  phScreen.innerHTML = `<div class="ph-title">🛍️ 한빛 패션몰</div>
    <div class="note" style="color:#ddd">사면 바로 옷장에 들어와요 · 산 옷은 언제든 무료로 갈아입어요</div>
    <div class="tabs" style="flex-wrap:wrap">${Object.entries(OUTFIT_CATS).map(([k, n]) => `<button data-tab="${k}" class="${k === fashionTab ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${fashionTab === 'face' ? `<div class="note" style="color:#ddd;margin-top:8px">피부색 (무료)</div><div style="display:flex;gap:8px;margin:4px 0 10px">${SKIN_TONES.map(c => `<button data-skin="${c}" style="width:34px;height:34px;border-radius:50%;background:#${c.toString(16).padStart(6, '0')};border:3px solid ${S.look.skin === c ? '#46d1ff' : 'rgba(255,255,255,.25)'}"></button>`).join('')}</div>` : ''}
    ${list.map(o => {
      const own = S.wardrobe.includes(o.id), on = S.wearing[o.cat] === o.id;
      return `<div class="row"><div class="ic">${swatch(o)}</div><div class="info"><b>${o.name}</b><span>${on ? '입고 있어요' : own ? '내 옷장에 있어요' : won(o.price)}</span></div>
        ${on ? '<button class="btn gray" disabled>착용 중</button>' : own ? `<button class="btn" data-wear="${o.id}">입기</button>` : `<button class="btn green" data-buy="${o.id}">구매</button>`}</div>`;
    }).join('')}`;
  phScreen.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { fashionTab = b.dataset.tab; audio.click(); fashionApp(); }));
  phScreen.querySelectorAll('[data-skin]').forEach(b => b.addEventListener('click', () => { S.look.skin = +b.dataset.skin; human.restyle(S.look); persist(); fashionApp(); }));
  phScreen.querySelectorAll('[data-wear]').forEach(b => b.addEventListener('click', () => { wear(S, b.dataset.wear); human.restyle(S.look); audio.play('pick'); persist(); fashionApp(); }));
  phScreen.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
    const o = OUTFITS.find(x => x.id === b.dataset.buy);
    if (S.wardrobe.includes(o.id)) return;        // 같은 옷은 한 번만
    if (!pay(o.price)) return;
    S.wardrobe.push(o.id); wear(S, o.id); human.restyle(S.look);
    audio.play('pay'); toast(`📦 ${o.name} 도착! 바로 입었어요`, 'good');
    missions.addXp(5); persist(); fashionApp();
  }));
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
  if ((mode === 'mart' && martGame.basketCount()) || (mode === 'stat' && statGame.basketCount())) { toast('계산 안 한 물건이 있어요', 'bad'); return; }
  const p = playerWorld();
  const d = Math.hypot(e.x - p.x, e.z - p.z);
  const night = ST.hour(S) % 24 >= 22 || ST.hour(S) % 24 < 4;
  const fare = Math.round((4800 + d * 14) * (night ? 1.2 : 1) / 100) * 100;
  if (S.money < fare && (S.cash || 0) < fare) { audio.bad(); toast(`🚕 요금이 모자라요 (약 ${won(fare)})`, 'bad'); return; }
  closePhone();
  busy = true;
  const minutes = 4 + d / 420;
  const via = transit ? transit.between(transit.stops, p, e, 3) : [];
  await playRide({ kind: 'taxi', title: `택시 · ${e.name}`, sub: `약 ${Math.round(minutes)}분${night ? ' · 심야 할증 20%' : ''} · 기사님: "어디로 모실까요?"`, stops: [...via, e.name], color: '#f28c1c', night: sky.night > 0.5, sec: 3,
    mid: () => { ST.passTime(S, minutes, 'idle'); teleportTo(e.x + (e.nx || 0) * 1.6, e.z + (e.nz || 0) * 1.6, (e.face ?? 0) + Math.PI); } });
  busy = false;
  // 도착하면 요금 계산 (그냥 닫으면 카드로 자동 결제)
  let paid = false;
  checkout(fare, { icon: '🚕', title: `택시 요금 · ${e.name}`, sub: '기사님: "도착했습니다~ 결제 도와드릴게요"', onCancel: () => {
    if (paid) return;
    if (S.money >= fare) { S.money -= fare; toast(`💳 등록된 카드로 ${won(fare)} 결제됐어요`); }
    else { const c = Math.min(S.cash || 0, fare); S.cash -= c; S.money -= fare - c; toast(`💵 가진 돈으로 ${won(fare)} 냈어요`); }
    flashMoney(false); persist();
  } }, () => { paid = true; });
  if (S.waypoint && S.waypoint.name === e.name) S.waypoint = null;
  S.rides = (S.rides || 0) + 1;
}
function fpsMeter() {
  let el = $('fpsMeter');
  if (S.settings.fps && !el) { el = document.createElement('div'); el.id = 'fpsMeter'; el.style.cssText = 'position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:19;background:rgba(0,0,0,.55);color:#9effa8;font:600 12px monospace;padding:3px 8px;border-radius:8px;pointer-events:none'; el.textContent = '… FPS'; document.body.appendChild(el); }
  if (!S.settings.fps && el) el.remove();
}
// 총 자산 (현금 + 예금 + 주식 + 부동산)
function totalAssets() {
  let a = (S.money || 0) + (S.cash || 0);
  for (const p of S.bank?.products || []) a += p.principal;
  if (S.stocks) for (const [id, h] of Object.entries(S.stocks.hold || {})) a += h.n * (S.stocks.p[id] || 0);
  for (const c of S.contracts || []) a += c.deal === 'buy' ? (c.price || 0) : (c.deposit || 0);
  for (const bid of S.ownedBldgs || []) { const b = (S.bldgPrices || {})[bid]; if (b) a += b; }
  for (const L of S.loans || []) a -= L.principal;
  return a;
}
// 순간이동 (택시·버스·지하철 도착)
function teleportTo(x, z, heading) {
  if (transit?.riding) transit.endRide(null, true);
  if (mode === 'bldg') bldg.exit(null);
  else if (mode !== 'city') { if (mode === 'mart') mart.clearNpcs(); leaveSite(); }
  player.pos.set(x, 0.18, z);
  player.heading = heading; cam.yaw = heading + Math.PI;
  city.collide(player.pos, 0.35, { walker: true });
  city.warmup(player.pos);
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); $('loadTxt').textContent = '';
  traffic.reseed(player.pos); peds.reseed(player.pos); attachRooms(true);
  human.root.position.copy(player.pos);
}
// 갈 수 있는 곳 (버스·지하철 목적지)
function travelPlaces() {
  const out = city.entrances.filter(e => e.id !== 'home' || (e.homeId === S.home && !S.homeUnit)).map(e => ({ name: e.name, icon: e.icon, x: e.x, z: e.z }));
  const h = homeEntrance(); if (h) out.unshift({ name: '우리 집', icon: '🏠', x: h.x, z: h.z });
  const j = career?.job;
  if (j) { const sp = city.bldgs.find(s => s.seed === j.bid); const d = sp && city.bdoors.find(q => q.spec === sp); if (d) out.unshift({ name: `직장 · ${j.place}`, icon: '💼', x: d.x, z: d.z }); }
  return out;
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
document.addEventListener('visibilitychange', () => { if (document.hidden) { controls?.reset(); controls?.keys.clear(); jumpHeld = false; if (mode !== 'title') persist(); } });
window.addEventListener('pagehide', () => { if (mode !== 'title') persist(); });
resize();

boot().catch(err => { console.error(err); window.__bootFailed = true; window.__bootFail?.('게임을 불러오지 못했어요', err && err.message ? err.message : String(err)); });

// 디버그/테스트용
window.__game = { get missions() { return missions; }, get peds() { return peds; }, get stat() { return stat; }, get statGame() { return statGame; }, enterStat: () => walkInto(city.sites.find(s => s.kind === 'stat')), get school() { return school; }, get schoolGame() { return schoolGame; }, enterSchool: (t) => walkInto(city.sites.find(s => s.school === t)), walkInto, playerWorld, get site() { return site; }, get mode() { return mode; },
  renderer, scene, camera, get mart() { return mart; }, get martGame() { return martGame; }, get cooking() { return cooking; }, enterMart: () => walkInto(city.sites.find(s => s.kind === 'mart')), get bldg() { return bldg; }, get career() { return career; }, get transit() { return transit; }, get life() { return life; }, get weather() { return weather; }, get economy() { return economy; }, get pets() { return pets; }, get phoneCam() { return phoneCam; }, get achieve() { return achieve; }, teleportTo, get realEstate() { return realEstate; }, get jobGame() { return jobGame; }, tenantMap: (B) => tenantMapFn(B), get shopGame() { return shopGame; }, get room() { return room; }, eatFood, foodInfo, sleepSheet, get interior() { return interior; }, doSleep, useFurniture, taxi, openPhone, get traffic() { return traffic; }, controls: () => controls, get S() { return S; }, player, cam, get city() { return city; }, enterHome, exitHome, startEdit, endEdit, enterCar, exitCar, get pcar() { return pcar; }, setQuality, openPlace: (id) => openPlace(city.entrances.find(e => e.id === id)), newDelivery, spawnPlayerCar };

// ───────── 9단계: 휴대폰 카메라 · 앨범 ─────────
import { $, toast, bigMsg } from './ui.js';
import * as ST from './state.js';

// 사진은 IndexedDB에 (저장 공간이 넉넉함). 안 되면 이번 세션 메모리에만.
const DB = 'citylife_photos', STORE = 'photos';
let dbP = null;
function db() {
  if (dbP) return dbP;
  dbP = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  return dbP;
}
const mem = [];
async function put(p) { const d = await db(); if (!d) { mem.push(p); return; } await new Promise(r => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(p); t.oncomplete = r; t.onerror = r; }); }
async function all() { const d = await db(); if (!d) return [...mem]; return new Promise(r => { const q = d.transaction(STORE).objectStore(STORE).getAll(); q.onsuccess = () => r(q.result || []); q.onerror = () => r([]); }); }
async function del(id) { const d = await db(); if (!d) { const i = mem.findIndex(p => p.id === id); if (i >= 0) mem.splice(i, 1); return; } await new Promise(r => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(id); t.oncomplete = r; t.onerror = r; }); }

let styled = false;
function style() {
  if (styled) return; styled = true;
  const st = document.createElement('style');
  st.textContent = `
  #camUI{position:fixed;inset:0;z-index:22;pointer-events:none}
  #camUI .frame{position:absolute;inset:8% 6%;border:2px solid rgba(255,255,255,.55);border-radius:18px}
  #camUI .frame:before,#camUI .frame:after{content:'';position:absolute;background:rgba(255,255,255,.25)}
  #camUI .frame:before{left:33.3%;right:33.3%;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.25);border-right:1px solid rgba(255,255,255,.25);background:none}
  #camUI .frame:after{top:33.3%;bottom:33.3%;left:0;right:0;border-top:1px solid rgba(255,255,255,.25);border-bottom:1px solid rgba(255,255,255,.25);background:none}
  #camUI .bar{position:absolute;right:max(16px,env(safe-area-inset-right));top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:14px;align-items:center;pointer-events:auto}
  #camUI .shut{width:76px;height:76px;border-radius:50%;border:5px solid #fff;background:rgba(255,255,255,.35)}
  #camUI .shut:active{background:#fff}
  #camUI .sm{width:54px;height:54px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:22px}
  #camUI .tag{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:rgba(0,0,0,.5);color:#fff;padding:6px 14px;border-radius:14px;font-size:14px}
  #camFlash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:23;transition:opacity .25s}
  .album{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
  .album img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer}
  .photoView img{width:100%;border-radius:12px}
  #hud.cam #tl,#hud.cam #needs,#hud.cam #tr,#hud.cam #objective,#hud.cam #actions,#hud.cam #btnJump,#hud.cam #joyHint{display:none!important}`;
  document.head.appendChild(st);
}

export class PhoneCamera {
  constructor(ctx) { this.c = ctx; this.on = false; this.selfie = false; }   // { S, renderer, render(), cam, player, setHud(on), season(), persist, missions }
  get S() { return this.c.S; }
  open() {
    style();
    if (this.on) return;
    this.on = true; this.selfie = false;
    this.prev = { tdist: this.c.cam.tdist, pitch: this.c.cam.pitch };
    const ui = document.createElement('div'); ui.id = 'camUI';
    ui.innerHTML = `<div class="frame"></div><div class="tag">📷 카메라 · 화면을 밀어 구도를 잡아요</div><div class="bar"><button class="sm" data-c="x">✕</button><button class="shut" data-c="shot" aria-label="촬영"></button><button class="sm" data-c="flip">🤳</button></div>`;
    document.body.appendChild(ui);
    if (!$('camFlash')) { const f = document.createElement('div'); f.id = 'camFlash'; document.body.appendChild(f); }
    ui.querySelector('[data-c="x"]').onclick = () => this.close();
    ui.querySelector('[data-c="shot"]').onclick = () => this.shoot();
    ui.querySelector('[data-c="flip"]').onclick = () => this.flip();
    this.c.setHud(false);
  }
  flip() {
    if (!this.selfie && this.c.indoor()) { toast('🤳 셀카는 밖에서 찍을 수 있어요'); return; }
    this.selfie = !this.selfie;
    const cam = this.c.cam;
    if (this.selfie) { cam.tdist = 2.4; cam.pitch = 0.12; cam.yaw = this.c.player.heading; }
    else { cam.tdist = this.prev.tdist; cam.pitch = this.prev.pitch; cam.yaw = this.c.player.heading + Math.PI; }
    toast(this.selfie ? '🤳 셀카 모드' : '📷 기본 카메라');
  }
  close() {
    if (!this.on) return;
    this.on = false;
    $('camUI')?.remove();
    this.c.cam.tdist = this.prev.tdist; this.c.cam.pitch = this.prev.pitch;
    this.c.setHud(true);
  }
  async shoot() {
    const S = this.S;
    const canvas = this.c.render();
    const W = S.phonePro ? 1280 : 720, H = Math.round(W * canvas.height / canvas.width);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.drawImage(canvas, 0, 0, W, H);
    // 날짜 도장
    const c = ST.clock(S), s = this.c.season();
    x.font = `bold ${Math.round(W / 34)}px sans-serif`; x.textAlign = 'right'; x.textBaseline = 'bottom';
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillText(`${ST.day(S)}일차 ${c.text} ${s.icon}`, W - 14, H - 12);
    x.fillStyle = '#ffd36a'; x.fillText(`${ST.day(S)}일차 ${c.text} ${s.icon}`, W - 16, H - 14);
    const data = cv.toDataURL('image/jpeg', 0.78);
    const f = $('camFlash'); f.style.opacity = '0.85'; setTimeout(() => { f.style.opacity = '0'; }, 120);
    this.c.audio?.play?.('click');
    const p = { id: Date.now() + Math.floor(Math.random() * 1000), t: S.minutes, day: ST.day(S), season: s.id, data };
    await put(p);
    S.photoCount = (S.photoCount || 0) + 1;
    S.photoSeasons = S.photoSeasons || []; if (!S.photoSeasons.includes(s.id)) S.photoSeasons.push(s.id);
    if (this.c.withPet?.()) S.petPhotos = (S.petPhotos || 0) + 1;
    toast(S.photoCount === 1 ? '📸 첫 사진! 앨범 앱에서 볼 수 있어요' : '📸 찰칵! 앨범에 저장했어요', 'good', 1800);
    this.c.missions?.event?.('photo');
    this.c.persist();
  }
  // 앨범 앱
  async albumHtml(el, rerender) {
    style();
    const list = (await all()).sort((a, b) => b.id - a.id);
    el.innerHTML = `<div class="ph-title">🖼️ 앨범</div>
      <button class="btn wide green" data-a="cam" style="margin-bottom:10px">📷 카메라 열기</button>
      ${list.length ? `<div class="album">${list.map(p => `<img src="${p.data}" data-id="${p.id}" alt="${p.day}일차 사진">`).join('')}</div>` : '<p class="note" style="color:#ccc">아직 사진이 없어요. 카메라로 도시를 찍어 보세요!</p>'}
      <p class="note" style="color:#aaa;margin-top:8px">사진 ${list.length}장 · 이 기기에 저장돼요</p>`;
    el.querySelector('[data-a="cam"]').onclick = () => { this.c.closePhone(); this.open(); };
    el.querySelectorAll('img[data-id]').forEach(img => img.onclick = () => {
      const p = list.find(q => q.id === +img.dataset.id);
      el.innerHTML = `<div class="ph-title">🖼️ ${p.day}일차</div><div class="photoView"><img src="${p.data}" alt="사진"></div>
        <div style="display:flex;gap:8px;margin-top:10px"><a class="btn wide" href="${p.data}" download="citylife_${p.day}일차_${p.id}.jpg" style="text-align:center;text-decoration:none">📥 기기에 저장</a><button class="btn wide red" data-a="del">🗑️ 삭제</button></div>
        <button class="btn wide gray" data-a="back" style="margin-top:8px">← 앨범으로</button>`;
      el.querySelector('[data-a="back"]').onclick = () => rerender();
      el.querySelector('[data-a="del"]').onclick = async () => { await del(p.id); toast('🗑️ 사진을 지웠어요'); rerender(); };
    });
  }
}

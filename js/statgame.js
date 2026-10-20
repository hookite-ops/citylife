import { STAT_PRODUCTS, STAT_CATS, GACHA, P } from './products.js';
import { won } from './config.js';
import * as ST from './state.js';
import { $, toast, openSheet, closeSheet, bigMsg, row, bindActs } from './ui.js';

const OPEN = 8, CLOSE = 21;
const RARE = { C: { name: '일반', col: '#9aa4ae', w: 70, mood: 3 }, R: { name: '레어', col: '#3a8aff', w: 25, mood: 8 }, L: { name: '전설', col: '#ffb81a', w: 5, mood: 20 } };

// ───────── 문구랜드: 쇼핑 · 계산 · 뽑기 ─────────
export class StatGame {
  constructor(ctx) { this.c = ctx; this.basket = {}; }
  get S() { return this.c.S; }
  get room() { return this.c.room; }
  inv() { const S = this.S; S.inventory.stat = S.inventory.stat || {}; S.collection = S.collection || {}; S.notePages = S.notePages || 0; S.sketchPages = S.sketchPages || 0; return S.inventory.stat; }
  isOpen() { const h = ST.hour(this.S) % 24; return h >= OPEN && h < CLOSE; }
  basketCount() { return Object.values(this.basket).reduce((a, b) => a + b, 0); }
  basketTotal() { return Object.entries(this.basket).reduce((a, [id, n]) => a + P[id].price * n, 0); }
  hudText() {
    const n = this.basketCount();
    return `✏️ <b>문구랜드</b>${n ? ` · 장바구니 ${n}개 ${won(this.basketTotal())}` : ''}<small>${this.isOpen() ? '영업 중 08:00~21:00 · 고른 물건은 계산대에서 계산해요' : '곧 문 닫을 시간이에요'}</small>`;
  }
  onEnter() {
    this.inv();
    if (!this.S.statVisited) { this.S.statVisited = true; setTimeout(() => toast('✏️ 사장님: "어서 와요~ 구경하고 골라서 계산대로 가져와요!"'), 500); }
  }

  action(zone) {
    if (!zone) return null;
    switch (zone.id) {
      case 'shelf': return { label: `${STAT_CATS[zone.cat].icon} ${zone.label} 둘러보기`, fn: () => this.shopSheet(zone) };
      case 'counter':
        if (this.basketCount()) return { label: `💳 계산하기 · ${won(this.basketTotal())}`, fn: () => this.checkout(), green: true };
        return { label: '🙂 사장님과 이야기하기', fn: () => this.talk() };
      case 'gacha': return { label: '🎰 뽑기 기계', fn: () => this.gachaSheet() };
    }
    return null;
  }

  shopSheet(zone) {
    const list = STAT_PRODUCTS.filter(p => p.cat === zone.cat);
    const inv = this.inv();
    const open = () => openSheet({
      icon: STAT_CATS[zone.cat].icon, title: zone.label, sub: '원하는 만큼 담고 계산대로 가요',
      html: `<p class="note">장바구니 <b>${this.basketCount()}개 · ${won(this.basketTotal())}</b>${zone.cat === 'snote' || zone.cat === 'spen' ? `<br>📓 남은 공책 ${this.S.notePages || 0}쪽 · 필기구 ${this.hasPen() ? '있음' : '없음'}` : ''}${zone.cat === 'sart' ? `<br>🗒️ 스케치북 ${this.S.sketchPages || 0}장 · 채색 도구 ${this.hasColor() ? '있음' : '없음'}` : ''}</p>` +
        list.map(p => row({
          icon: p.icon, title: p.name + (inv[p.id] ? ` <small style="opacity:.6">(보유 ${inv[p.id]})</small>` : ''), desc: p.desc, price: won(p.price),
          extra: this.basket[p.id] ? `<button class="btn gray" data-act="minus:${p.id}">−</button><b style="min-width:22px;text-align:center">${this.basket[p.id]}</b>` : '',
          btn: '담기', action: 'add:' + p.id,
        })).join(''),
      bind: (b) => bindActs(b, {
        add: (id) => { this.basket[id] = (this.basket[id] || 0) + 1; this.c.audio.play('pick'); open(); },
        minus: (id) => { this.basket[id]--; if (this.basket[id] <= 0) delete this.basket[id]; open(); },
      }),
    });
    open();
  }
  hasPen() { const inv = this.inv(); return STAT_PRODUCTS.some(p => p.pen && inv[p.id] > 0); }
  hasColor() { const inv = this.inv(); return STAT_PRODUCTS.some(p => p.color && inv[p.id] > 0); }

  checkout() {
    const items = Object.entries(this.basket);
    let wrap = false;
    const render = () => {
      const total = this.basketTotal() + (wrap ? 1000 : 0);
      return items.map(([id, n]) => row({ icon: P[id].icon, title: `${P[id].name} ×${n}`, desc: won(P[id].price) + ' / 개', price: won(P[id].price * n) })).join('') +
        `<div class="row"><div class="ic">🎁</div><div class="info"><b>선물 포장</b><span>예쁜 포장지 + 리본 1,000원 · 기분 +3</span></div><button class="btn ${wrap ? 'green' : 'gray'}" data-act="wrap">${wrap ? '포장함' : '포장하기'}</button></div>
        <div class="row" style="background:rgba(255,184,74,0.12)"><div class="info"><b>합계</b></div><div class="price" style="font-size:18px">${won(total)}</div></div>
        <button class="btn wide green" data-act="pay">💳 결제하기</button>`;
    };
    const open = () => openSheet({
      icon: '🧾', title: '계산하기', sub: '사장님: "이거 다 가져가는 거죠? 잠깐만요~"', html: render(),
      bind: (b) => bindActs(b, {
        wrap: () => { wrap = !wrap; open(); },
        pay: () => {
          const total = this.basketTotal() + (wrap ? 1000 : 0);
          if (!this.c.pay(total)) return;
          const S = this.S, inv = this.inv();
          let mood = wrap ? 3 : 0;
          const got = [];
          for (const [id, n] of items) {
            const p = P[id];
            if (p.hunger) S.inventory.food[id] = (S.inventory.food[id] || 0) + n;
            else inv[id] = (inv[id] || 0) + n;
            if (p.pages) S.notePages += p.pages * n;
            if (p.sketch) S.sketchPages += p.sketch * n;
            if (p.toy) mood += p.toy * n;
            got.push(p.icon);
          }
          if (mood) S.mood = ST.clamp(S.mood + mood);
          this.basket = {};
          closeSheet();
          this.c.audio.play('pay');
          toast(`🧾 결제 완료 ${won(total)} ${got.slice(0, 6).join('')}${mood ? ` · 기분 +${mood}` : ''}`, 'good', 3200);
          if (this.hasPen() && S.notePages > 0 && !S.statTip) { S.statTip = true; setTimeout(() => toast('📓 공책 + 필기구가 있으면 학교 수업·시험에서 문제 풀 시간이 늘어나요'), 1500); }
          if (this.hasColor() && S.sketchPages > 0 && !S.drawTip) { S.drawTip = true; setTimeout(() => toast('🎨 집 책상에서 그림을 그릴 수 있어요'), 3200); }
          this.c.persist();
        },
      }),
    });
    open();
  }
  talk() {
    const S = this.S, h = ST.hour(S) % 24;
    const lines = [
      '"학교 끝나는 시간엔 애들이 우르르 와서 정신이 없어요~"',
      '"뽑기에 황금 유니콘이 하나 들어 있대요. 아직 아무도 못 뽑았어요!"',
      '"공책은 묶음으로 사면 훨씬 싸요."',
      '"그림 그리는 거 좋아해요? 수채물감 새로 들어왔어요."',
      h >= 20 ? '"이제 곧 문 닫아요. 필요한 거 있으면 얼른 골라요~"' : '"천천히 구경하고 가요~"',
    ];
    toast('🙂 사장님: ' + lines[Math.floor(Math.random() * lines.length)], '', 3600);
  }

  // 손님이 계산 안 하고 나가려고 할 때
  tryExit(leave) {
    if (!this.basketCount()) return leave();
    openSheet({
      icon: '🚨', title: '계산 안 한 물건이 있어요', sub: `장바구니 ${this.basketCount()}개 · ${won(this.basketTotal())}`,
      html: `<p class="note">사장님: "어머, 그거 아직 계산 안 했어요!"</p><button class="btn wide" data-act="put">물건 제자리에 두고 나가기</button><button class="btn wide gray" data-act="stay">계산하러 가기</button>`,
      bind: (b) => bindActs(b, { put: () => { this.basket = {}; closeSheet(); leave(); }, stay: () => closeSheet() }),
    });
  }

  // ───────── 뽑기 ─────────
  gachaSheet() {
    const S = this.S; this.inv();
    const col = S.collection;
    const grid = (k) => GACHA[k].items.map(it => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px;border-radius:10px;background:${col[it.id] ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.25)'};border:1px solid ${RARE[it.r].col}55"><span style="font-size:26px;${col[it.id] ? '' : 'filter:brightness(0);opacity:.35'}">${it.icon}</span><small style="font-size:10px;color:${RARE[it.r].col}">${col[it.id] ? '×' + col[it.id] : RARE[it.r].name}</small></div>`).join('');
    const have = (k) => GACHA[k].items.filter(it => col[it.id]).length;
    openSheet({
      icon: '🎰', title: '뽑기 기계', sub: '동전 넣고 손잡이를 돌려요',
      html: ['toy', 'sticker'].map(k => `
        <div class="row"><div class="ic">${k === 'toy' ? '🧸' : '🌟'}</div><div class="info"><b>${GACHA[k].name}</b><span>모은 것 ${have(k)}/${GACHA[k].items.length} · 레어 25% · 전설 5%</span></div><div class="price">${won(GACHA[k].price)}</div><button class="btn green" data-act="pull:${k}">뽑기</button></div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin:4px 0 12px">${grid(k)}</div>`).join(''),
      bind: (b) => bindActs(b, { pull: (k) => this.pull(k) }),
    });
  }
  pull(k) {
    const g = GACHA[k];
    if (!this.c.pay(g.price)) return;
    closeSheet();
    const roll = Math.random() * 100;
    const r = roll < RARE.L.w ? 'L' : roll < RARE.L.w + RARE.R.w ? 'R' : 'C';
    const pool = g.items.filter(it => it.r === r);
    const it = pool[Math.floor(Math.random() * pool.length)];
    // 연출: 손잡이 3번 돌리기 → 캡슐 떨어짐 → 열기
    const mg = $('mg'); mg.classList.remove('hidden');
    let turns = 0;
    const capCol = ['#ff4a8a', '#3a8aff', '#ffd21a', '#7ad84a', '#b04aff'][Math.floor(Math.random() * 5)];
    const draw = (stage) => {
      mg.innerHTML = `<div class="mg-box" style="text-align:center">
        <div class="mg-top"><span>🎰 ${g.name}</span><span>${won(g.price)}</span></div>
        ${stage === 'turn' ? `<p class="note">손잡이를 돌려요 (${turns}/3)</p>
          <div style="font-size:90px;transition:transform .25s;transform:rotate(${turns * 120}deg)">⚙️</div>
          <button class="btn wide green" id="gTurn">↻ 손잡이 돌리기</button>`
        : stage === 'cap' ? `<p class="note">덜커덕! 캡슐이 나왔어요</p>
          <div style="width:110px;height:110px;margin:16px auto;border-radius:50%;background:linear-gradient(180deg,#fff 50%,${capCol} 50%);box-shadow:0 8px 30px rgba(0,0,0,.4);animation:pop .4s"></div>
          <button class="btn wide" id="gOpen">캡슐 열기</button>`
        : `<p class="note" style="color:${RARE[r].col};font-weight:800">${RARE[r].name}${r === 'L' ? '!!! 대박' : r === 'R' ? '!' : ''}</p>
          <div style="font-size:96px;animation:pop .5s;filter:drop-shadow(0 0 ${r === 'C' ? 0 : 18}px ${RARE[r].col})">${it.icon}</div>
          <h3>${it.name}</h3><p class="note">${this.S.collection[it.id] > 1 ? `벌써 ${this.S.collection[it.id]}개째예요` : '새로 모았어요!'} · 기분 +${RARE[r].mood}</p>
          <button class="btn wide green" id="gDone">좋아요</button>`}
      </div>`;
      mg.querySelector('#gTurn')?.addEventListener('click', () => { turns++; this.c.audio.play('click'); if (turns >= 3) { this.c.audio.play('plop'); draw('cap'); } else draw('turn'); });
      mg.querySelector('#gOpen')?.addEventListener('click', () => {
        const S = this.S; S.collection[it.id] = (S.collection[it.id] || 0) + 1; S.mood = ST.clamp(S.mood + RARE[r].mood);
        this.c.audio.play(r === 'C' ? 'coin' : 'success');
        draw('open');
        if (r === 'L') bigMsg('✨ 전설 등급!', it.name + '을(를) 뽑았어요', 2600);
        this.c.persist();
      });
      mg.querySelector('#gDone')?.addEventListener('click', () => { mg.classList.add('hidden'); mg.innerHTML = ''; this.gachaSheet(); });
    };
    draw('turn');
  }
}

// 학교 수업·시험에서 쓰는 학용품 효과
export function studyBonus(S) {
  const inv = S.inventory.stat || {};
  const pen = STAT_PRODUCTS.some(p => p.pen && inv[p.id] > 0);
  return { ready: pen && (S.notePages || 0) > 0, hili: (inv.st_hili || 0) > 0, postit: (inv.st_postit || 0) > 0 };
}

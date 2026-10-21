// ───────── 공통 틀: 한 입씩 먹기 · 상 차리기 · 조합 보너스 ─────────
import { $, toast, openSheet, closeSheet, bindActs } from './ui.js';

// 음식 종류 (조합 계산용)
const ID_TAGS = {
  kimbap: 'rice', roll: 'rice', sand: 'bread', dosirak: 'meal', dosirak2: 'meal',
  cupramen: 'noodle', cupramen2: 'noodle', bread: 'bread', chips: 'snack', choco: 'snack', jelly: 'snack',
  milk: 'milk', coffee: 'drink', cola: 'drink', water: 'drink', energy: 'drink', juice: 'drink',
  icebar: 'dessert', icecone: 'dessert', icecup: 'dessert',
};
export function foodTag(id, f) {
  const base = id.replace('#hot', '');
  if (ID_TAGS[base]) return ID_TAGS[base];
  if (f?.cat === 'drink') return 'drink';
  if (f?.cat === 'ice') return 'dessert';
  if (/라면|국수|우동|면/.test(f?.name || '')) return 'noodle';
  return 'meal';
}
const isDrink = (t) => t === 'drink' || t === 'milk';
// 같이 먹으면 좋은 조합
const COMBOS = [
  { a: 'noodle', b: 'rice', mood: 5, msg: '🍜🍙 라면엔 삼각김밥이죠!' },
  { a: 'noodle', b: 'meal', mood: 3, msg: '🍜🍱 국물이랑 밥, 든든해요' },
  { a: 'bread', b: 'milk', mood: 5, msg: '🍞🍼 빵이랑 우유, 최고의 조합!' },
  { a: 'bread', b: 'drink', mood: 3, msg: '🥪🥤 빵 한 입, 음료 한 모금' },
  { a: 'meal', b: 'drink', mood: 2, msg: '🍱🥤 밥 먹고 시원하게 한 모금' },
  { a: 'rice', b: 'drink', mood: 2, msg: '🍙🥤 김밥엔 음료' },
  { a: 'snack', b: 'drink', mood: 3, msg: '🥔🥤 과자엔 탄산이죠' },
];
const hasTag = (tags, t) => t === 'drink' ? tags.some(isDrink) : tags.includes(t);

// 상 차리기: 여러 개 골라서 같이 먹기
export function pickMealSheet({ ids, foodInfo, title = '상 차리기', sub = '같이 먹을 것을 골라요 · 조합이 좋으면 기분 UP', icon = '🍽', preselect = [] }, onGo) {
  const sel = new Set(preselect.filter(id => ids.includes(id)));
  const render = () => {
    const tags = [...sel].map(id => foodTag(id, foodInfo(id)));
    const combos = COMBOS.filter(c => hasTag(tags, c.a) && hasTag(tags, c.b));
    return ids.map(id => {
      const f = foodInfo(id);
      const on = sel.has(id);
      return `<div class="row"><div class="ic">${f.icon}</div><div class="info"><b>${f.name}</b><span>배고픔 +${f.hunger || 0}${f.energy ? ` · 에너지 ${f.energy > 0 ? '+' : ''}${f.energy}` : ''}</span></div><button class="btn ${on ? 'green' : 'gray'}" data-act="t:${id}">${on ? '✓ 올림' : '상에 올리기'}</button></div>`;
    }).join('') +
      (combos.length ? `<p class="note" style="color:var(--good)">${combos.map(c => c.msg).join('<br>')}</p>` : '') +
      `<button class="btn wide green" data-act="go" ${sel.size ? '' : 'disabled'}>🍽 먹기 시작 (${sel.size}개)</button>`;
  };
  const open = () => openSheet({
    icon, title, sub, html: render(),
    bind: (b) => bindActs(b, {
      t: (id) => { sel.has(id) ? sel.delete(id) : sel.add(id); open(); },
      go: () => { closeSheet(); onGo([...sel]); },
    }),
  });
  open();
}

/**
 * 한 입씩 먹는 화면
 * ctx: { S, foodInfo, audio, passTime(min), clamp, hud(), steam? }
 * ids: 상에 올린 음식 id (가방에서 1개씩 꺼냄)
 */
export function runMeal(ctx, ids, { place = '식사', minutes = 12, moodBonus = 0 } = {}) {
  const S = ctx.S, inv = S.inventory.food;
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const plates = [];
  for (const id of ids) {
    if (!inv[id]) continue;
    inv[id]--; if (inv[id] <= 0) delete inv[id];
    const f = ctx.foodInfo(id);
    const tag = foodTag(id, f);
    const bites = isDrink(tag) ? 3 : Math.max(2, Math.min(8, Math.round((f.hunger || 6) / 7)));
    plates.push({ id, f, tag, bites, left: bites });
  }
  if (!plates.length) return Promise.resolve({ bites: 0 });
  const total = plates.reduce((a, p) => a + p.bites, 0);
  const perBiteMin = minutes / total;
  const tagsEaten = new Set();
  const got = new Set();
  let last = null, bitesTaken = 0, overate = 0;
  return new Promise((resolve) => {
    const mg = $('mg');
    mg.classList.remove('hidden', 'soft');
    mg.innerHTML = `<div class="mg-box meal">
      <div class="mg-top"><span>🍽 ${place}</span><span class="full">배부름 <i class="pat"><i id="mealFull"></i></i></span></div>
      <div class="plates">${plates.map((p, k) => `<button class="plate" data-k="${k}"><span class="em"><i>${p.f.icon}</i></span>${p.id.endsWith('#hot') ? '<span class="steam">♨️</span>' : ''}<b>${p.f.name}</b><i class="left"><i></i></i><small></small></button>`).join('')}</div>
      <div class="meal-msg" id="mealMsg">접시를 눌러 한 입씩 먹어요${plates.length > 1 ? ' · 번갈아 먹으면 조합 보너스!' : ''}</div>
      <div class="meal-btns"><button class="btn gray" data-auto>⏩ 남은 거 빨리 먹기</button><button class="btn" data-stop>그만 먹기</button></div>
    </div>`;
    const els = [...mg.querySelectorAll('.plate')];
    const msg = $('mealMsg');
    const draw = () => {
      plates.forEach((p, k) => {
        const el = els[k];
        const r = p.left / p.bites;
        el.querySelector('.em i').style.transform = `scale(${0.45 + 0.55 * r})`;
        el.querySelector('.em i').style.opacity = p.left ? 1 : 0.25;
        el.querySelector('.left i').style.width = r * 100 + '%';
        el.querySelector('small').textContent = p.left ? (isDrink(p.tag) ? `한 모금 (${p.left}/${p.bites})` : `한 입 (${p.left}/${p.bites})`) : '다 먹었어요';
        el.disabled = !p.left;
      });
      $('mealFull').style.width = S.hunger + '%';
    };
    const bite = (k) => {
      const p = plates[k];
      if (!p || !p.left) return;
      p.left--; bitesTaken++;
      const f = p.f;
      const full = S.hunger >= 98;
      S.hunger = clamp(S.hunger + (f.hunger || 0) / p.bites);
      if (f.energy) S.energy = clamp(S.energy + f.energy / p.bites);
      S.mood = clamp(S.mood + ((f.mood || 0) + moodBonus * (p.bites / total)) / p.bites);
      if (full && !isDrink(p.tag)) { overate++; S.mood = clamp(S.mood - 1.5); if (overate === 1) toast('😵 배가 너무 불러요… 더 먹으면 속이 안 좋아요', 'bad'); }
      ctx.passTime(perBiteMin);
      ctx.audio?.play?.(isDrink(p.tag) ? 'pour' : 'eat', 0.6, 0.9 + Math.random() * 0.2);
      // 조합: 다른 음식을 번갈아 먹을 때
      if (last !== null && last !== k) {
        const t1 = plates[last].tag, t2 = p.tag;
        for (const c of COMBOS) {
          const key = c.a + c.b;
          if (got.has(key)) continue;
          const m = (x, t) => t === 'drink' ? isDrink(x) : x === t;
          if ((m(t1, c.a) && m(t2, c.b)) || (m(t1, c.b) && m(t2, c.a))) { got.add(key); S.mood = clamp(S.mood + c.mood); toast(`${c.msg} 기분 +${c.mood}`, 'good'); break; }
        }
      }
      // 후식
      if (p.tag === 'dessert' && !got.has('dessert') && [...tagsEaten].some(t => t !== 'dessert' && !isDrink(t))) { got.add('dessert'); S.mood = clamp(S.mood + 3); toast('🍦 후식까지 완벽해요 기분 +3', 'good'); }
      tagsEaten.add(p.tag);
      last = k;
      const el = els[k];
      el.classList.remove('bite'); void el.offsetWidth; el.classList.add('bite');
      msg.textContent = isDrink(p.tag) ? '꿀꺽' : ['냠', '냠냠', '오물오물', '음~ 맛있다'][Math.floor(Math.random() * 4)];
      draw(); ctx.hud?.();
      if (plates.every(q => !q.left)) setTimeout(() => end(), 450);
    };
    let ended = false, autoT = null;
    const end = () => {
      if (ended) return; ended = true;
      clearInterval(autoT);
      // 손 안 댄 음식은 다시 가방으로, 먹다 남긴 건 버려요
      let wasted = 0;
      for (const p of plates) {
        if (p.left === p.bites) inv[p.id] = (inv[p.id] || 0) + 1;
        else if (p.left > 0) wasted++;
      }
      mg.classList.add('hidden'); mg.innerHTML = '';
      if (wasted) toast(`🗑 먹다 남긴 음식 ${wasted}개는 버렸어요`);
      else if (bitesTaken) toast(`😋 잘 먹었습니다! (배부름 ${Math.round(S.hunger)}%)`, 'good');
      ctx.hud?.();
      resolve({ bites: bitesTaken });
    };
    els.forEach((el, k) => el.addEventListener('click', () => bite(k)));
    mg.querySelector('[data-stop]').addEventListener('click', () => end());
    mg.querySelector('[data-auto]').addEventListener('click', (e) => {
      e.target.disabled = true;
      let k = 0;
      autoT = setInterval(() => {
        // 번갈아 가며 먹기
        const open = plates.map((p, i) => i).filter(i => plates[i].left);
        if (!open.length) { clearInterval(autoT); return; }
        bite(open[k++ % open.length]);
      }, 260);
    });
    draw();
  });
}

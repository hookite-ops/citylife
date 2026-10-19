import { RECIPES, INGREDIENTS, DISHES, P } from './products.js';
import * as ST from './state.js';
import { $, toast, openSheet, closeSheet, bigMsg, row, bindActs, wait } from './ui.js';

// 집 주방: 요리 미니게임
// ctx: { S, interior, human, player, audio, setBusy, eatFood, persist, focusKitchen(on) }
export class Cooking {
  constructor(ctx) { this.c = ctx; this.active = false; }
  get S() { return this.c.S; }

  has(need) { const ing = this.S.inventory.ing; return Object.entries(need || {}).every(([k, v]) => (ing[k] || 0) >= v); }
  needText(need) { return Object.entries(need || {}).map(([k, v]) => `${INGREDIENTS[k].icon}${INGREDIENTS[k].name}${v > 1 ? '×' + v : ''}`).join(' + '); }

  menu() {
    const S = this.S, ing = S.inventory.ing, food = S.inventory.food;
    const stock = Object.entries(ing).filter(([, n]) => n > 0).map(([k, n]) => `${INGREDIENTS[k].icon} ${INGREDIENTS[k].name} ${n}`).join(' · ') || '없음 · 편의점 식재료 코너에서 사 오세요';
    const cups = Object.keys(food).filter(id => food[id] > 0 && P[id]?.needWater);
    const heats = Object.keys(food).filter(id => food[id] > 0 && P[id]?.heat);
    openSheet({
      icon: '🍳', title: '주방', sub: '냉장고에 있는 재료로 요리해요',
      html: `<p class="note">재료: <b>${stock}</b></p>` +
        RECIPES.map(r => {
          const ok = this.has(r.need);
          const ex = r.extra ? ` (+있으면 ${this.needText(r.extra)})` : r.alt ? ` (+${this.needText(r.alt.need)} 선택)` : '';
          return row({ icon: DISHES[r.dish].icon, title: r.name, desc: `${this.needText(r.need)}${ex} · 약 ${r.minutes}분`, btn: '요리', btnClass: ok ? 'green' : 'gray', disabled: !ok, action: 'cook:' + r.id });
        }).join('') +
        cups.map(id => row({ icon: '🫖', title: `${P[id].name} 물 붓기`, desc: '전기포트로 물 끓여서 3분', btn: '만들기', action: 'cup:' + id })).join('') +
        heats.map(id => row({ icon: '📟', title: `${P[id].name} 데우기`, desc: '전자레인지 1분 30초', btn: '데우기', action: 'heat:' + id })).join(''),
      bind: (b) => bindActs(b, {
        cook: (id) => { closeSheet(); this.start(RECIPES.find(r => r.id === id)); },
        cup: (id) => { closeSheet(); this.quick(id, 'kettle'); },
        heat: (id) => { closeSheet(); this.quick(id, 'micro'); },
      }),
    });
  }

  // 컵라면 물 붓기 / 도시락 데우기
  async quick(id, how) {
    const { interior } = this.c;
    this.begin();
    const pos = how === 'kettle' ? interior.kettle : interior.micro;
    this.c.audio.play(how === 'kettle' ? 'kettle' : 'microwave');
    await this.panel(how === 'kettle' ? '물 끓이고 붓는 중…' : '전자레인지 돌아가는 중…', 'wait', { sec: 2.5, steamAt: { x: pos.x, y: pos.y + 0.15, z: pos.z } });
    if (how === 'micro') this.c.audio.play('ding');
    ST.passTime(this.S, how === 'kettle' ? 5 : 2, 'idle');
    this.S.inventory.food[id]--;
    const hid = id + '#hot';
    this.S.inventory.food[hid] = (this.S.inventory.food[hid] || 0) + 1;
    this.end();
    this.afterSheet(hid, 1);
  }

  begin() {
    this.active = true;
    this.c.setBusy(true);
    const { interior, human, player } = this.c;
    player.pos.set(interior.cookSpot.x, 0, interior.cookSpot.z);
    player.heading = -Math.PI / 2;
    human.root.position.copy(player.pos);
    human.root.rotation.y = player.heading;
    this.c.focusKitchen(true);
  }
  end() {
    this.active = false;
    this.c.human.work = false;
    this.c.interior.cookReset();
    this.c.focusKitchen(false);
    this.c.setBusy(false);
  }

  async start(r) {
    const S = this.S, ing = S.inventory.ing;
    // 재료 소비
    for (const [k, v] of Object.entries(r.need)) ing[k] -= v;
    let useAlt = false, extras = [];
    if (r.alt && this.has(r.alt.need)) { useAlt = true; for (const [k, v] of Object.entries(r.alt.need)) ing[k] -= v; }
    if (r.extra) for (const [k, v] of Object.entries(r.extra)) if ((ing[k] || 0) >= v) { ing[k] -= v; extras.push(k); }
    this.begin();
    const { interior, human } = this.c;
    interior.cookShow(r.tool);
    const scores = [];
    const foodColor = { ramen: 0xd88a3a, friedegg: 0xfff4d8, eggrice: 0xf0e0b0, kimchirice: 0xd0502a, sausage: 0xb0503a, mandu: 0xe8c890, tunarice: 0xf2ead0, rice: 0xf6f2e8 }[r.id];
    let fireOn = false;
    for (const st of r.steps) {
      if (st.optional === 'alt' && !useAlt) continue;
      switch (st.t) {
        case 'fill': {
          this.c.audio.play('water');
          const s = await this.panel(st.label, 'fill', st);
          scores.push(s);
          break;
        }
        case 'fire':
          await this.panel(st.label, 'fire', st);
          fireOn = st.on;
          interior.cookFire(st.on);
          this.c.audio.play(st.on ? 'gas_on' : 'gas_off');
          break;
        case 'wait':
          this.c.audio.play('boil');
          await this.panel(st.label, 'wait', { sec: st.sec, boil: true });
          break;
        case 'add':
          human.work = true;
          await this.panel(st.label, 'add', st);
          human.work = false;
          interior.cookFood(foodColor, 0);
          this.c.audio.play(r.tool === 'pan' ? 'sizzle' : 'plop');
          break;
        case 'timing': {
          const s = await this.panel(st.label, 'timing', { ...st, fire: fireOn });
          scores.push(s);
          break;
        }
        case 'mash': {
          human.work = true;
          const s = await this.panel(st.label, 'mash', st);
          human.work = false;
          scores.push(s);
          break;
        }
        case 'micro':
          this.c.audio.play('microwave');
          await this.panel(st.label, 'wait', { sec: st.sec, steamAt: { x: interior.micro.x, y: interior.micro.y + 0.2, z: interior.micro.z } });
          this.c.audio.play('ding');
          if (r.tool === 'bowl') interior.cookFood(foodColor, 0);
          break;
      }
    }
    ST.passTime(S, r.minutes, 'idle');
    const q = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
    const dishId = useAlt ? r.alt.dish : r.dish;
    const key = `${dishId}@${Math.round(q * 100)}@${extras.join(',')}`;
    S.inventory.food[key] = (S.inventory.food[key] || 0) + 1;
    this.c.persist();
    await wait(300);
    this.end();
    const grade = q > 0.85 ? '👨‍🍳 완벽해요!' : q > 0.6 ? '😋 맛있게 됐어요' : q > 0.35 ? '😐 그럭저럭' : '🔥 망했어요…';
    bigMsg(grade, `${DISHES[dishId].name} 완성 · 맛 ${Math.round(q * 100)}점`, 2600);
    this.afterSheet(key, q);
  }

  afterSheet(key, q) {
    const f = this.c.foodInfo(key);
    openSheet({
      icon: f.icon, title: f.name, sub: '바로 먹을까요?',
      html: `<p class="note">배고픔 +${f.hunger} · 기분 +${f.mood || 0}</p><button class="btn wide green" data-act="eat">지금 먹기</button><button class="btn wide gray" data-act="keep">냉장고에 넣어 두기</button>`,
      bind: (b) => bindActs(b, { eat: () => { closeSheet(); this.c.eatAtHome(key); }, keep: () => { closeSheet(); toast('🧊 냉장고에 넣었어요'); } }),
    });
  }

  // ───────── 단계별 UI ─────────
  panel(label, type, st) {
    return new Promise((resolve) => {
      const mg = $('mg');
      mg.classList.remove('hidden'); mg.classList.add('soft');
      const { interior } = this.c;
      let raf, done = false, last = performance.now();
      const finish = (score) => { if (done) return; done = true; cancelAnimationFrame(raf); mg.classList.add('hidden'); mg.classList.remove('soft'); mg.innerHTML = ''; resolve(score); };
      const frame = (fn) => { const loop = (now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; interior.steamTick(dt, interior.flame.visible ? (interior.boil ? 9 : 3) : (st.steamAt ? 6 : 0), st.steamAt); if (fn(dt) !== false && !done) raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); };
      const box = (inner) => `<div class="cook"><div class="cook-t">🍳 ${label}${st.hint ? `<small>${st.hint}</small>` : ''}</div>${inner}</div>`;

      if (type === 'fire') {
        mg.innerHTML = box(`<button class="btn wide ${st.on ? 'red' : 'gray'}" id="ck">${st.on ? '🔥 불 켜기' : '⏻ 불 끄기'}</button>`);
        mg.querySelector('#ck').addEventListener('click', () => finish(1));
        frame(() => true);
      } else if (type === 'wait') {
        mg.innerHTML = box(`<div class="pbar"><i id="ckb"></i></div>`);
        let t = 0;
        frame((dt) => {
          t += dt;
          if (st.boil) { interior.boil = t > st.sec * 0.4 ? 1 : 0; }
          $('ckb').style.width = Math.min(100, t / st.sec * 100) + '%';
          if (t >= st.sec) { finish(1); return false; }
        });
      } else if (type === 'fill') {
        mg.innerHTML = box(`<div class="gauge"><div class="gline" style="bottom:${st.target * 100}%"><span>${Math.round(st.target * 1000)}ml</span></div><i id="gf"></i></div><button class="btn wide" id="ck">💧 누르고 있으면 물이 나와요</button>`);
        let level = 0, holding = false, released = false;
        const btn = mg.querySelector('#ck');
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); holding = true; });
        const up = () => { if (holding && level > 0.03) released = true; holding = false; };
        btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up); btn.addEventListener('pointercancel', up);
        frame((dt) => {
          if (holding) level = Math.min(1, level + dt * 0.32);
          $('gf').style.height = level * 100 + '%';
          interior.cookWater(level);
          if (released || level >= 1) {
            const err = Math.abs(level - st.target);
            const score = err <= st.tol ? 1 : Math.max(0, 1 - (err - st.tol) * 5);
            toast(err <= st.tol ? '👌 물 양 딱 맞아요' : level > st.target ? '💦 물이 좀 많아요 (싱거울 듯)' : '🥵 물이 좀 적어요 (짤 듯)', err <= st.tol ? 'good' : '');
            finish(score); return false;
          }
        });
      } else if (type === 'add') {
        const left = new Set(st.items.map((_, i) => i));
        mg.innerHTML = box(`<div class="adds">${st.items.map((e, i) => `<button class="add" data-i="${i}">${e}</button>`).join('')}</div><small class="ck-h">눌러서 넣으세요</small>`);
        mg.querySelectorAll('.add').forEach(b => b.addEventListener('click', () => { left.delete(+b.dataset.i); b.classList.add('used'); this.c.audio.play('plop'); if (!left.size) setTimeout(() => finish(1), 250); }));
        frame(() => true);
      } else if (type === 'timing') {
        const [z0, z1] = st.zone;
        mg.innerHTML = box(`<div class="tbar"><div class="tzone" style="left:${z0 * 100}%;width:${(z1 - z0) * 100}%"></div><div class="tneedle" id="tn"></div><span class="tl">덜 익음</span><span class="tr">탐</span></div><button class="btn wide green" id="ck">지금!</button>`);
        let v = 0;
        mg.querySelector('#ck').addEventListener('click', () => {
          const s = v >= z0 && v <= z1 ? 1 : Math.max(0, 1 - Math.min(Math.abs(v - z0), Math.abs(v - z1)) * 4);
          toast(s === 1 ? '👌 딱 좋아요!' : v < z0 ? '😬 덜 익었어요' : '🔥 너무 익었어요', s === 1 ? 'good' : '');
          finish(s);
        });
        frame((dt) => {
          v += dt * st.speed * 0.5;
          if (st.fire) interior.boil = 1;
          $('tn').style.left = Math.min(100, v * 100) + '%';
          if (v >= 1) { toast('🔥 다 타 버렸어요…', 'bad'); finish(0.05); return false; }
        });
      } else if (type === 'mash') {
        let n = 0, t = 0;
        const lim = st.n * 0.42 + 1.5;
        mg.innerHTML = box(`<div class="pbar"><i id="mb"></i></div><button class="btn wide" id="ck">🥄 빠르게 연타! (0/${st.n})</button><div class="pbar thin"><i id="mt" style="background:var(--warn)"></i></div>`);
        const btn = mg.querySelector('#ck');
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); n++; this.c.audio.play('stir'); btn.textContent = `🥄 빠르게 연타! (${n}/${st.n})`; $('mb').style.width = Math.min(100, n / st.n * 100) + '%'; if (n >= st.n) finish(t < lim ? 1 : 0.7); });
        frame((dt) => { t += dt; $('mt').style.width = Math.max(0, 100 - t / lim * 100) + '%'; if (t > lim * 1.6) { finish(Math.min(1, n / st.n) * 0.6); return false; } });
      }
    });
  }
}

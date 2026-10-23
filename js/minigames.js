// ───────── ⑤ 직업 손맛: 직접 하는 미니게임 (에스프레소 추출 · 소방 호스) ─────────
import { $ } from './ui.js';

// 공통: 미니게임 창 열기/닫기
function openMg(html) { const mg = $('mg'); mg.classList.remove('hidden', 'soft'); mg.innerHTML = `<div class="mg-box">${html}</div>`; return mg; }
function closeMg() { const mg = $('mg'); mg.classList.add('hidden'); mg.innerHTML = ''; }
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ─ 에스프레소: 분쇄(그램) → 탬핑(수평) → 추출(25~30초) → (라떼) 스팀(60~65도) → (라떼) 하트 붓기 ─
// opts: { name, icon, latte, iced, audio }  done(score 0~1, detail)
export function espressoGame(opts, done) {
  const steps = ['grind', 'tamp', 'shot'];
  if (opts.latte) steps.push('steam', 'pour');
  else if (opts.iced) steps.push('ice');
  const scores = [];
  let si = 0, raf = 0, ended = false;
  const title = `${opts.icon || '☕'} ${opts.name || '에스프레소'}`;
  const bar = (id, zone, col = '#46d1ff') => `<div style="position:relative;height:34px;border-radius:17px;background:rgba(255,255,255,.08);overflow:hidden">${zone ? `<i style="position:absolute;left:${zone[0] * 100}%;width:${(zone[1] - zone[0]) * 100}%;top:0;bottom:0;background:rgba(80,255,160,.3)"></i>` : ''}<i id="${id}" style="position:absolute;left:0;top:0;bottom:0;width:0;background:${col};opacity:.85"></i></div>`;
  const cup = () => `<div style="display:flex;justify-content:center;margin:6px 0 10px"><div style="position:relative;width:86px;height:70px;border:4px solid #e8e2d6;border-top:none;border-radius:0 0 26px 26px;overflow:hidden;background:rgba(255,255,255,.04)">
    <i id="cupFill" style="position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(#c88a4a,#5a3418)"></i><i id="cupMilk" style="position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(#f6ead8,#d8b48c)"></i>
    <b id="cupArt" style="position:absolute;left:0;right:0;top:4px;text-align:center;font-size:26px;opacity:0">🤍</b></div></div>`;
  const label = { grind: '1. 원두 갈기', tamp: '2. 탬핑', shot: '3. 샷 추출', steam: '4. 우유 스팀', pour: '5. 라떼 아트', ice: '4. 얼음 · 물' };
  const head = () => `<div class="mg-top"><span>${title}</span><span>${steps.map((s, i) => i < si ? '✅' : i === si ? '🔸' : '▫️').join('')}</span></div><div style="text-align:center;font-weight:700;margin-bottom:6px">${label[steps[si]]}</div>`;
  const msg = (t) => { const m = $('esMsg'); if (m) m.textContent = t; };
  const next = (sc, note) => {
    scores.push(clamp01(sc));
    opts.audio?.play?.(sc > 0.75 ? 'pick' : 'bad', 0.7);
    msg(note);
    cancelAnimationFrame(raf);
    setTimeout(() => { si++; if (si >= steps.length) finish(); else run(); }, 650);
  };
  const finish = () => {
    if (ended) return; ended = true;
    const s = scores.reduce((a, b) => a + b, 0) / scores.length;
    closeMg();
    done(s, scores);
  };
  // 누르고 있는 동안 차오르기 (분쇄 · 스팀)
  const holdGame = ({ unit, max, zone, rate, fmt, tip, onTick }) => {
    openMg(head() + cup() + bar('esBar', [zone[0] / max, zone[1] / max]) + `<p class="note" style="text-align:center" id="esMsg">${tip}</p><button class="btn wide green" id="esHold" style="padding:16px;font-size:18px;touch-action:none">누르고 있기</button>`);
    let v = 0, holding = false, last = performance.now(), started = false;
    const b = $('esHold');
    const dn = (e) => { e.preventDefault(); holding = true; started = true; };
    const up = () => { if (!holding) return; holding = false; const ok = v >= zone[0] && v <= zone[1]; const off = ok ? 0 : Math.min(1, Math.min(Math.abs(v - zone[0]), Math.abs(v - zone[1])) / (max * 0.25)); next(ok ? 1 : 0.7 - off * 0.7, ok ? `👍 ${fmt(v)} 딱 좋아요!` : v < zone[0] ? `😅 ${fmt(v)} · 조금 모자라요` : `😵 ${fmt(v)} · 너무 많아요`); };
    b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (holding) v = Math.min(max, v + rate * dt);
      const el = $('esBar'); if (!el) return;
      el.style.width = (v / max * 100) + '%';
      onTick?.(v / max);
      b.textContent = started ? `${fmt(v)}` : '누르고 있기';
      if (v >= max && holding) { holding = false; up(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  // 왔다갔다 하는 표시를 가운데에서 멈추기 (탬핑 · 붓기)
  const timingGame = ({ tip, speed, btn, zone = [0.42, 0.58], onHit }) => {
    openMg(head() + cup() + `<div style="position:relative;height:34px;border-radius:17px;background:rgba(255,255,255,.08);overflow:hidden"><i style="position:absolute;left:${zone[0] * 100}%;width:${(zone[1] - zone[0]) * 100}%;top:0;bottom:0;background:rgba(80,255,160,.35)"></i><i id="esDot" style="position:absolute;top:4px;width:26px;height:26px;border-radius:50%;background:#46d1ff"></i></div>
      <p class="note" style="text-align:center" id="esMsg">${tip}</p><button class="btn wide green" id="esHit" style="padding:16px;font-size:18px">${btn}</button>`);
    let pos = 0, dir = 1, last = performance.now(), done1 = false;
    $('esHit').onclick = () => { if (done1) return; done1 = true; const c = (zone[0] + zone[1]) / 2, w = (zone[1] - zone[0]) / 2; const d = Math.abs(pos - c); const sc = d <= w ? 1 : Math.max(0, 1 - (d - w) * 3); onHit?.(sc); next(sc, sc >= 1 ? '👍 완벽해요!' : sc > 0.5 ? '🙂 괜찮아요' : '😵 삐뚤어졌어요'); };
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      pos += dir * dt * speed; if (pos > 1 || pos < 0) { dir *= -1; pos = clamp01(pos); }
      const el = $('esDot'); if (!el || done1) return;
      el.style.left = `calc(${pos * 100}% - 13px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  const run = () => {
    const s = steps[si];
    if (s === 'grind') holdGame({ max: 26, zone: [17.5, 19], rate: 7, fmt: (v) => `${v.toFixed(1)}g`, tip: '누르고 있다가 18g쯤에서 떼요' });
    if (s === 'tamp') timingGame({ tip: '수평이 맞을 때 꾹 눌러요', speed: 1.1, btn: '탬핑!' });
    if (s === 'shot') {
      // 추출: 시작하면 초가 흘러요 · 25~30초에 멈추기
      openMg(head() + cup() + bar('esBar', [25 / 45, 30 / 45], '#8a5a2a') + `<p class="note" style="text-align:center" id="esMsg">추출 버튼을 누르고 25~30초에 멈춰요</p><button class="btn wide green" id="esGo" style="padding:16px;font-size:18px">▶ 추출 시작</button>`);
      let t = 0, on = false, last = performance.now(), stopped = false;
      const b = $('esGo');
      b.onclick = () => {
        if (!on) { on = true; b.textContent = '⏹ 멈추기'; return; }
        if (stopped) return; stopped = true;
        const ok = t >= 25 && t <= 30, sc = ok ? 1 : t < 25 ? Math.max(0, 1 - (25 - t) / 10) : Math.max(0, 1 - (t - 30) / 10);
        next(sc, ok ? `👍 ${t.toFixed(0)}초 · 크레마가 예뻐요` : t < 25 ? `😅 ${t.toFixed(0)}초 · 싱거워요 (덜 추출)` : `😵 ${t.toFixed(0)}초 · 써요 (과다 추출)`);
      };
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (on && !stopped) t += dt * 7.5;
        const el = $('esBar'); if (!el) return;
        el.style.width = Math.min(100, t / 45 * 100) + '%';
        const f = $('cupFill'); if (f) f.style.height = Math.min(38, t * 1.2) + '%';
        if (on && !stopped) b.textContent = `⏹ 멈추기 · ${t.toFixed(0)}초`;
        if (t >= 45 && !stopped) { b.click(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    if (s === 'steam') {
      holdGame({ max: 80, zone: [60, 66], rate: 16, fmt: (v) => `${Math.round(v)}°C`, tip: '누르고 있다가 60~65°C에서 떼요 (70°C 넘으면 우유가 타요)',
        onTick: (k) => { const m = $('cupMilk'); if (m) m.style.height = Math.min(30, k * 30) + '%'; } });
      const f = $('cupFill'); if (f) f.style.height = '38%';
    }
    if (s === 'pour') {
      timingGame({ tip: '피처를 흔들다 가운데에서 쭉 그어요', speed: 1.4, btn: '하트 그리기!', zone: [0.44, 0.56],
        onHit: (sc) => { const a = $('cupArt'); if (a) { a.style.opacity = sc > 0.5 ? 1 : 0.4; a.textContent = sc >= 1 ? '🤍' : sc > 0.5 ? '🫧' : '💧'; } const m = $('cupMilk'); if (m) m.style.height = '70%'; } });
      const f = $('cupFill'); if (f) f.style.height = '38%';
    }
    if (s === 'ice') {
      openMg(head() + cup() + `<p class="note" style="text-align:center" id="esMsg">얼음 → 물 순서로 담아요</p><div class="mg-btns"><button class="btn gray" id="esW">💧 물</button><button class="btn gray" id="esI">🧊 얼음</button></div>`);
      let got = 0;
      $('esI').onclick = () => { if (got === 0) { got = 1; opts.audio?.play?.('plop'); msg('🧊 얼음 넣었어요 · 이제 물'); } };
      $('esW').onclick = () => { if (got === 1) { const f = $('cupMilk'); if (f) { f.style.background = 'rgba(180,220,255,.5)'; f.style.height = '75%'; } next(1, '👍 시원한 아이스 완성!'); } else next(0.5, '😅 얼음 먼저 넣어야 해요'); };
    }
  };
  run();
}

// ─ 소방 호스: 손가락으로 조준해서 불길에 물 뿌리기 ─
// opts: { title, fires: n }  done(score)
export function hoseGame(opts, done) {
  const n = opts.fires || 4;
  openMg(`<div class="mg-top"><span>${opts.title || '🚒 화재 진압'}</span><span id="hsT"></span></div>
    <div id="hsField" style="position:relative;height:230px;border-radius:14px;overflow:hidden;background:linear-gradient(#3a2a26,#1a1414 60%,#2a2a2e);touch-action:none">
      <div style="position:absolute;left:8%;right:8%;bottom:0;height:62%;background:#6a5a52;border-radius:6px 6px 0 0;box-shadow:inset 0 0 0 3px #4a3a34"></div>
      ${Array.from({ length: n }, (_, i) => `<b class="hsFire" data-i="${i}" style="position:absolute;font-size:44px;left:${12 + i * (70 / Math.max(1, n - 1))}%;top:${38 + (i % 2) * 18}%;transition:transform .15s,opacity .3s">🔥</b>`).join('')}
      <i id="hsAim" style="position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border:3px solid #9fdcff;border-radius:50%;left:50%;top:50%;pointer-events:none"></i>
      <i id="hsJet" style="position:absolute;left:50%;bottom:-6px;width:10px;height:0;transform-origin:50% 100%;background:linear-gradient(rgba(170,220,255,.9),rgba(120,180,255,.2));border-radius:5px;pointer-events:none"></i>
    </div>
    <p class="note" style="text-align:center" id="hsMsg">화면을 누른 채로 불길을 겨눠요 · 물이 나가요</p>`);
  const field = $('hsField'), aim = $('hsAim'), jet = $('hsJet'), fires = [...field.querySelectorAll('.hsFire')];
  const hp = fires.map(() => 1);
  let ax = 0.5, ay = 0.5, spraying = false, t = 0, last = performance.now(), ended = false, raf = 0;
  const pt = (e) => { const r = field.getBoundingClientRect(); ax = clamp01((e.clientX - r.left) / r.width); ay = clamp01((e.clientY - r.top) / r.height); };
  field.addEventListener('pointerdown', (e) => { e.preventDefault(); spraying = true; pt(e); });
  field.addEventListener('pointermove', (e) => { pt(e); });
  const stop = () => { spraying = false; };
  field.addEventListener('pointerup', stop); field.addEventListener('pointerleave', stop); field.addEventListener('pointercancel', stop);
  const limit = 14 + n * 3;
  const tick = (now) => {
    if (ended) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const r = field.getBoundingClientRect();
    aim.style.left = ax * 100 + '%'; aim.style.top = ay * 100 + '%';
    // 물줄기 (아래 가운데에서 조준점까지)
    const dx = (ax - 0.5) * r.width, dy = (1 - ay) * r.height + 6;
    jet.style.height = spraying ? Math.hypot(dx, dy) + 'px' : '0';
    jet.style.transform = `rotate(${Math.atan2(dx, dy)}rad)`;
    fires.forEach((f, i) => {
      if (hp[i] <= 0) return;
      const fr = f.getBoundingClientRect(), fx = (fr.left + fr.width / 2 - r.left) / r.width, fy = (fr.top + fr.height / 2 - r.top) / r.height;
      const hit = spraying && Math.hypot((fx - ax) * r.width, (fy - ay) * r.height) < 34;
      // 물을 안 맞으면 불이 다시 커져요
      hp[i] = Math.min(1, hp[i] + (hit ? -dt * 0.55 : dt * 0.05));
      f.style.transform = `scale(${0.4 + hp[i] * 0.8}) translateY(${Math.sin(t * 9 + i) * 3}px)`;
      if (hp[i] <= 0) { f.textContent = '💨'; f.style.opacity = 0.5; opts.audio?.play?.('pick', 0.6); }
    });
    const left = hp.filter(h => h > 0).length;
    $('hsT').textContent = `🔥 ${left} · ${Math.max(0, Math.ceil(limit - t))}초`;
    if (!left || t >= limit) {
      ended = true;
      const sc = left ? Math.max(0, 1 - left / n) * 0.7 : 1 - Math.max(0, (t - limit * 0.5) / limit) * 0.4;
      $('hsMsg').textContent = left ? '😓 불길이 남았어요… 지원팀이 마무리했어요' : '💪 불길을 모두 잡았어요!';
      setTimeout(() => { closeMg(); done(clamp01(sc)); }, 900);
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  void raf;
}

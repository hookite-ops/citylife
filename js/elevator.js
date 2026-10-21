// ───────── 엘리베이터 (실제처럼 움직이는 카) ─────────
// 건물마다 하나. 카는 층 높이(y)를 따라 가속·감속하며 움직이고, 문은 열리고 닫혀요.
import { floorShort } from './bplan.js';

const DOOR_T = 1.3;     // 문 열리고 닫히는 시간 (초)
const HOLD_T = 4.5;     // 문 열어두는 시간

export class Lifts {
  constructor(B) {
    this.B = B;
    this.banks = B.banks.map(b => ({
      ...b,
      cars: Array.from({ length: b.cars }, (_, i) => {
        const start = b.serves[Math.floor(Math.random() * b.serves.length)];
        return { i, bank: b.id, y: this.yOf(start), v: 0, n: start, stops: new Set(), dir: 0, door: 0, state: 'idle', t: 0, riders: [], hold: 0 };
      }),
    }));
    this.t = 0;
    this.npcT = 4 + Math.random() * 6;
  }
  yOf(n) { return this.B.floorOf(n)?.y ?? 0; }
  bank(id) { return this.banks.find(b => b.id === id); }
  car(bankId, i) { return this.bank(bankId)?.cars[i]; }
  label(n) { return floorShort(n, this.B); }
  // 홀에서 부르기 → 가장 빨리 올 카
  call(bankId, n) {
    const b = this.bank(bankId); if (!b || !b.serves.includes(n)) return null;
    // 이미 이 층에 문 열려 있거나 오는 중인 카
    for (const c of b.cars) if (c.n === n && c.state !== 'moving' && Math.abs(c.y - this.yOf(n)) < 0.05) { this.openAt(c); return c; }
    for (const c of b.cars) if (c.stops.has(n)) return c;
    let best = null, bd = 1e9;
    for (const c of b.cars) {
      let d = Math.abs(c.y - this.yOf(n));
      if (c.state === 'moving' && Math.sign(this.yOf(n) - c.y) !== c.dir) d += 200;
      if (c.stops.size) d += 15 * c.stops.size;
      if (d < bd) { bd = d; best = c; }
    }
    best.stops.add(n);
    if (best.state === 'idle') this.depart(best);
    return best;
  }
  // 카 안에서 버튼
  press(c, n) {
    if (c.n === n && Math.abs(c.y - this.yOf(n)) < 0.05) { this.openAt(c); return; }
    c.stops.add(n);
    if (c.state === 'idle') this.depart(c);
    else if (c.state === 'open') c.hold = Math.min(c.hold, 1.2);
  }
  openAt(c) { if (c.state === 'idle' || c.state === 'closing') { c.state = 'opening'; this.onOpen?.(c); } else if (c.state === 'open') c.hold = Math.max(c.hold, HOLD_T); }
  depart(c) {
    if (!c.stops.size) { c.state = 'idle'; c.dir = 0; return; }
    if (c.door > 0) { c.state = 'closing'; return; }
    // 다음 정지층: 같은 방향 우선
    const here = c.y;
    const list = [...c.stops].map(n => [n, this.yOf(n)]);
    let next = null;
    if (c.dir) next = list.filter(([, y]) => Math.sign(y - here) === c.dir).sort((a, b) => Math.abs(a[1] - here) - Math.abs(b[1] - here))[0];
    if (!next) next = list.sort((a, b) => Math.abs(a[1] - here) - Math.abs(b[1] - here))[0];
    c.target = next[0]; c.ty = next[1];
    c.dir = Math.sign(c.ty - here) || 0;
    if (!c.dir) { c.stops.delete(c.target); c.n = c.target; c.state = 'opening'; this.onOpen?.(c); return; }
    c.state = 'moving';
  }
  update(dt) {
    this.t += dt;
    for (const b of this.banks) for (const c of b.cars) {
      switch (c.state) {
        case 'moving': {
          const vmax = b.speed, acc = Math.max(1.0, vmax / 2.2);
          const dist = c.ty - c.y, ad = Math.abs(dist);
          const stopD = c.v * c.v / (2 * acc);
          if (ad <= stopD + 0.02) c.v = Math.max(0.25, c.v - acc * dt);
          else c.v = Math.min(vmax, c.v + acc * dt);
          const step = c.v * dt;
          if (step >= ad) {
            c.y = c.ty; c.v = 0; c.n = c.target; c.stops.delete(c.target);
            c.state = 'opening'; this.onOpen?.(c);
          } else {
            c.y += Math.sign(dist) * step;
            // 지나가는 층 표시
            let best = c.n, bd = 1e9;
            for (const n of b.serves) { const d = Math.abs(this.yOf(n) - c.y); if (d < bd) { bd = d; best = n; } }
            c.n = best;
          }
          break;
        }
        case 'opening': c.door = Math.min(1, c.door + dt / DOOR_T); if (c.door >= 1) { c.state = 'open'; c.hold = HOLD_T; } break;
        case 'open': c.hold -= dt; if (c.hold <= 0 && !c.blocked) c.state = 'closing'; break;
        case 'closing':
          if (c.blocked) { c.state = 'opening'; break; }
          c.door = Math.max(0, c.door - dt / DOOR_T);
          if (c.door <= 0) { c.state = 'idle'; this.depart(c); }
          break;
      }
    }
    // 다른 사람들도 엘리베이터를 써요
    this.npcT -= dt;
    if (this.npcT <= 0) {
      this.npcT = 6 + Math.random() * 14;
      const b = this.banks[Math.floor(Math.random() * this.banks.length)];
      if (b) {
        const c = b.cars[Math.floor(Math.random() * b.cars.length)];
        if (c.state === 'idle' && !c.player) { const n = b.serves[Math.floor(Math.random() * b.serves.length)]; if (n !== c.n) { c.stops.add(n); c.npc = true; this.depart(c); } }
      }
    }
  }
  // 카 화살표
  arrow(c) { return c.state === 'moving' ? (c.dir > 0 ? '▲' : '▼') : ''; }
}

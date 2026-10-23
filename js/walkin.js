// ───────── 걸어 들어가는 건물 (편의점처럼 맵과 한 공간) ─────────
// 가까운 상가·쇼핑몰 1층 실내를 실제 위치에 미리 지어 두고, 문으로 걸어 들어가면 화면 전환 없이 실내 모드로 바뀌어요.
import * as THREE from 'three';
import { FloorView } from './floorview.js';
import { Lifts } from './elevator.js';
import { toWorldPt, toLocalPt } from './bplan.js';
import { setCuts, CUT_MAX } from './buildings.js';
import { isOpenType } from './bldggame.js';
import { createPed, SKINS, HAIRS, SHIRTS, PANTS, SHOES } from './human.js';
import * as ST from './state.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LIMIT = { low: { n: 2, r: 30 }, mid: { n: 3, r: 40 }, high: { n: 4, r: 48 } };

export function walkable(s) {
  return !!s && (s.bkind === 'shop' || s.bkind === 'mall') && (s.type === 'shop' || s.type === 'podium');
}

export class WalkIn {
  constructor(ctx) {   // { S, city, scene, bldg(), quality(), mode(), focus(), company }
    this.c = ctx; this.list = []; this.t = 0; this.buildT = 0; this.taken = null; this.hourKey = -1;
    ctx.city.openBldgs = this.list;
  }
  get S() { return this.c.S; }
  isOpen(s) { return this.list.some(o => o.s === s); }
  get(s) { return this.list.find(o => o.s === s); }
  dist(s, p) { const dx = Math.max(s.x0 - p.x, 0, p.x - s.x1), dz = Math.max(s.z0 - p.z, 0, p.z - s.z1); return Math.hypot(dx, dz); }

  // 그 건물 1층 짓기
  open(s) {
    const city = this.c.city, B = city.bldgOf(s), f = B.floorOf(1);
    if (!f) return null;
    const lifts = new Lifts(B);
    const col = s.color || [0.8, 0.8, 0.78];
    const view = new FloorView(B, 1, lifts, { myHome: this.S.homeUnit, company: this.c.company, lazyAll: true, skin: col });
    const anchor = new THREE.Group();
    anchor.position.set(B.cx, f.y + 0.03, B.cz); anchor.rotation.y = B.rot;
    anchor.add(view.root);
    this.c.scene.add(anchor);
    const gh = f.h, ext = 0.04;
    const ob = {
      s, B, f, view, lifts, anchor, wcols: [], ncol: -1, npcs: [], blockers: [],
      ceil: f.y + view.plan.ch,
      cut: {
        a0: new THREE.Vector3(s.x0 - ext, f.y - 0.2, s.z0 - ext), a1: new THREE.Vector3(s.x1 + ext, f.y + gh - 1.42, s.z1 + ext),
        b0: new THREE.Vector3(s.x0 + 0.24, f.y - 0.2, s.z0 + 0.24), b1: new THREE.Vector3(s.x1 - 0.24, f.y + gh - 0.04, s.z1 - 0.24),
      },
    };
    this.addBlockers(ob);
    s.open = true;
    this.list.push(ob);
    this.refreshCols(ob);
    this.applyCuts();
    return ob;
  }
  close(ob) {
    const i = this.list.indexOf(ob); if (i >= 0) this.list.splice(i, 1);
    ob.s.open = false;
    this.clearStaff(ob);
    ob.view?.dispose();
    ob.anchor.parent?.remove(ob.anchor);
    this.applyCuts();
  }
  closeAll() { for (const ob of [...this.list]) if (ob !== this.taken) this.close(ob); }
  applyCuts() { setCuts(this.list.slice(0, CUT_MAX).map(o => o.cut)); }
  // 실내 벽 → 월드 좌표 상자
  refreshCols(ob) {
    const cs = ob.view.colliders;
    if (ob.ncol === cs.length) return;
    ob.ncol = cs.length;
    ob.wcols = cs.map(c => { const a = toWorldPt(ob.B, c.x0, c.z0), b = toWorldPt(ob.B, c.x1, c.z1); return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]), src: c }; });
  }
  // 영업시간이 아닌 가게 · 새벽 상가 로비는 문이 잠겨요
  addBlockers(ob) {
    const p = ob.view.plan, hw = p.W / 2, hd = p.D / 2;
    for (const d of p.doors) {
      if (d.kind === 'elev') continue;
      const lc = d.ax === 'x' ? d.z : d.x;
      const outer = d.ax === 'x' ? Math.abs(Math.abs(d.z) - hd) < 0.3 : Math.abs(Math.abs(d.x) - hw) < 0.3;
      const unit = d.unit && !d.unit.home ? d.unit : null;
      if (!unit && !outer) continue;
      const w = d.w / 2 + 0.05;
      const c = d.ax === 'x' ? { x0: d.x - w, x1: d.x + w, z0: lc - 0.2, z1: lc + 0.2 } : { x0: lc - 0.2, x1: lc + 0.2, z0: d.z - w, z1: d.z + w };
      c.blocker = true; c.door = d; c.unit = unit; c.open = true;
      ob.view.colliders.push(c); ob.blockers.push(c);
    }
    this.updateBlockers(ob);
  }
  updateBlockers(ob) {
    const h = ST.hour(this.S) % 24, wd = (ST.day(this.S) - 1) % 7;
    const B = ob.B;
    for (const c of ob.blockers) {
      let open;
      const t = c.unit?.tenant;
      if (c.unit) open = !t ? false : t.vacant ? true : isOpenType(t.type, h, wd);
      else open = B.kind === 'mall' ? (h >= 9 && h < 23) : !(h >= 1 && h < 6);
      if (c.unit && t?.vacant) open = true;   // 빈 가게는 둘러볼 수 있어요
      // 안에 있을 때: 지금 있는 가게와 바깥 출입문은 언제나 나갈 수 있게
      if (ob === this.taken && (!c.unit || this.c.bldg().curUnit === c.unit)) open = true;
      c.open = open;
    }
  }
  // 밖에서도 보이는 직원 (실내에 들어가면 진짜 손님·직원이 대신)
  staffFor(ob, spots) {
    if (ob === this.taken || !spots?.length) return;
    const h = ST.hour(this.S) % 24, wd = (ST.day(this.S) - 1) % 7;
    for (const s of spots) {
      if (ob.npcs.length >= 6) break;
      const t = s.room?.tenant;
      if (!t || t.vacant || !isOpenType(t.type, h, wd)) continue;
      if (!['staff', 'barista', 'cook', 'stylist'].includes(s.kind)) continue;
      const p = createPed({ skin: pick(SKINS.slice(0, 6)), hair: pick(HAIRS), shirt: parseInt((t.color || '#444444').slice(1), 16), pants: pick(PANTS), shoes: pick(SHOES), hairStyle: pick(['short', 'long', 'bun']) });
      p.root.position.set(s.x, 0, s.z); p.root.rotation.y = s.rot;
      ob.view.root.add(p.root);
      ob.npcs.push(p);
    }
  }
  clearStaff(ob) { for (const p of ob.npcs) p.root.parent?.remove(p.root); ob.npcs = []; }

  // ─ 매 프레임 ─
  update(dt) {
    const mode = this.c.mode();
    if (mode !== 'city' && mode !== 'bldg') return;
    const p = this.c.focus();
    const L = LIMIT[this.c.quality()] || LIMIT.mid;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.5;
      // 시간이 바뀌면 문 잠금 다시 계산
      const hk = Math.floor(this.S.minutes / 10);
      if (hk !== this.hourKey) { this.hourKey = hk; for (const ob of this.list) this.updateBlockers(ob); }
      else if (this.taken) this.updateBlockers(this.taken);
      // 멀어진 건물 정리
      for (const ob of [...this.list]) if (ob !== this.taken && this.dist(ob.s, p) > L.r + 25) this.close(ob);
      // 가까운 건물 열기 (한 번에 하나씩)
      this.buildT -= 0.5;
      if (this.buildT <= 0 && !this.c.busy()) {
        let best = null, bd = L.r;
        for (const s of this.c.city.bldgs) {
          if (!walkable(s) || s.open) continue;
          const d = this.dist(s, p); if (d < bd) { bd = d; best = s; }
        }
        if (best) {
          if (this.list.length >= L.n) {
            // 가장 먼 것과 바꾸기
            let far = null, fd = bd + 8;
            for (const ob of this.list) { if (ob === this.taken) continue; const d = this.dist(ob.s, p); if (d > fd) { fd = d; far = ob; } }
            if (far) this.close(far);
          }
          if (this.list.length < L.n) { this.open(best); this.buildT = 0.6; }
        }
      }
    }
    // 가게 안 꾸미기는 가까운 곳부터 조금씩
    for (const ob of this.list) {
      if (ob === this.taken) { this.refreshCols(ob); continue; }
      const [lx, lz] = toLocalPt(ob.B, p.x, p.z);
      const added = ob.view.buildPending?.(lx, lz, 1);
      if (added?.length) this.staffFor(ob, added);
      this.refreshCols(ob);
    }
    // 걸어서 들어가기
    if (mode === 'city' && !this.taken && !this.c.inCar()) {
      for (const ob of this.list) {
        const [lx, lz] = toLocalPt(ob.B, p.x, p.z);
        if (Math.abs(lx) < ob.B.L / 2 - 0.35 && Math.abs(lz) < ob.B.D / 2 - 0.35) { this.adopt(ob, lx, lz); break; }
      }
    }
  }
  adopt(ob, lx, lz) {
    this.taken = ob;
    this.clearStaff(ob);
    this.updateBlockers(ob);
    this.c.bldg().adopt(ob, lx, lz);
  }
  // 실내에서 나왔을 때: 1층 그대로 돌려받기 (view 없으면 정리)
  release(B, view) {
    const ob = this.taken; this.taken = null;
    if (!ob) return;
    if (view && view === ob.view) {
      this.refreshCols(ob); this.updateBlockers(ob);
      this.staffFor(ob, ob.view.npcSpots);
    } else this.close(ob);
  }
  // 도시 문 표시(bdoor)가 잠긴 문인지
  doorClosed(bd) {
    const ob = this.get(bd.spec); if (!ob) return false;
    let best = null, d0 = 2.6;
    for (const c of ob.blockers) { const [x, z] = toWorldPt(ob.B, (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2); const d = Math.hypot(x - bd.x, z - bd.z); if (d < d0) { d0 = d; best = c; } }
    return best ? !best.open : false;
  }
  // 가게가 바뀐 건물은 다시 지어요
  invalidate(s) { const ob = this.get(s); if (ob && ob !== this.taken) this.close(ob); }
}

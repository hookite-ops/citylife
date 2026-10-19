// 터치(조이스틱 + 화면 드래그 시점) + 키보드/마우스
export class Controls {
  constructor(el, joyEl, knobEl) {
    this.el = el; this.joyEl = joyEl; this.knobEl = knobEl;
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.keys = new Set();
    this.joyId = null; this.lookId = null;
    this.joyOrigin = { x: 0, y: 0 };
    this.lastLook = { x: 0, y: 0 };
    this.lastLookTime = 0;
    this.enabled = true;
    this.pinch = null;
    const opt = { passive: false };
    el.addEventListener('pointerdown', (e) => this.down(e), opt);
    window.addEventListener('pointermove', (e) => this.moveEv(e), opt);
    window.addEventListener('pointerup', (e) => this.up(e), opt);
    window.addEventListener('pointercancel', (e) => this.up(e), opt);
    window.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.reset(); });
    el.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); e.preventDefault(); }, opt);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  reset() {
    this.joyId = null; this.lookId = null; this.move.x = this.move.y = 0;
    this.joyEl.classList.remove('active');
    this.knobEl.style.transform = 'translate(-50%,-50%)';
  }
  down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const w = window.innerWidth, h = window.innerHeight;
    const leftZone = e.clientX < w * 0.42 && e.clientY > h * 0.3;
    if (leftZone && this.joyId === null) {
      this.joyId = e.pointerId;
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.joyEl.style.left = e.clientX + 'px';
      this.joyEl.style.top = e.clientY + 'px';
      this.joyEl.classList.add('active');
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lastLook = { x: e.clientX, y: e.clientY };
    } else if (this.pinch === null && e.pointerType === 'touch') {
      // 두 번째 손가락: 확대/축소 용
      this.pinch = { id: e.pointerId, x: e.clientX, y: e.clientY, d: Math.hypot(e.clientX - this.lastLook.x, e.clientY - this.lastLook.y) };
    }
    try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
  }
  moveEv(e) {
    if (e.pointerId === this.joyId) {
      e.preventDefault();
      const R = 58;
      let dx = e.clientX - this.joyOrigin.x, dy = e.clientY - this.joyOrigin.y;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      this.move.x = dx / R; this.move.y = -dy / R;
      this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (e.pointerId === this.lookId) {
      e.preventDefault();
      this.look.dx += e.clientX - this.lastLook.x;
      this.look.dy += e.clientY - this.lastLook.y;
      this.lastLook = { x: e.clientX, y: e.clientY };
      this.lastLookTime = performance.now();
      if (this.pinch) {
        const d = Math.hypot(this.pinch.x - e.clientX, this.pinch.y - e.clientY);
        this.zoom -= (d - this.pinch.d) * 0.03; this.pinch.d = d;
      }
    } else if (this.pinch && e.pointerId === this.pinch.id) {
      const d = Math.hypot(e.clientX - this.lastLook.x, e.clientY - this.lastLook.y);
      this.zoom -= (d - this.pinch.d) * 0.03;
      this.pinch.d = d; this.pinch.x = e.clientX; this.pinch.y = e.clientY;
    }
  }
  up(e) {
    if (e.pointerId === this.joyId) this.reset();
    if (e.pointerId === this.lookId) { this.lookId = null; this.pinch = null; }
    if (this.pinch && e.pointerId === this.pinch.id) this.pinch = null;
  }
  // 이번 프레임의 입력
  read() {
    let x = this.move.x, y = this.move.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y = 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y = -1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x = -1;
    if (k.has('KeyD') || k.has('ArrowRight')) x = 1;
    const out = { x, y, run: k.has('ShiftLeft') || k.has('ShiftRight'), handbrake: k.has('Space'), dx: this.look.dx, dy: this.look.dy, zoom: this.zoom };
    this.look.dx = 0; this.look.dy = 0; this.zoom = 0;
    return out;
  }
  get looking() { return this.lookId !== null || performance.now() - this.lastLookTime < 1800; }
}

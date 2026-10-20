import * as THREE from 'three';

// 여러 박스/면을 한 지오메트리로 합쳐서 드로우콜을 줄이는 빌더
const _c = new THREE.Color();
export class GB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.color = null; }
  _v(x, y, z, nx, ny, nz, u, v) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v);
    if (this.color) this.c.push(this.color[0], this.color[1], this.color[2]);
    return this.p.length / 3 - 1;
  }
  setRGB(r, g, b) {
    const c = _c.setRGB(r, g, b, THREE.SRGBColorSpace);
    this.color = [c.r, c.g, c.b];
  }
  setColor(hex) {
    if (hex == null) { this.color = null; return; }
    const c = new THREE.Color(hex);
    this.color = [c.r, c.g, c.b];
  }
  quad(a, b, c, d, n, uvs) {
    const i0 = this._v(...a, ...n, ...uvs[0]);
    const i1 = this._v(...b, ...n, ...uvs[1]);
    const i2 = this._v(...c, ...n, ...uvs[2]);
    const i3 = this._v(...d, ...n, ...uvs[3]);
    this.i.push(i0, i1, i2, i0, i2, i3);
  }
  // p→q는 바깥에서 봤을 때 왼쪽→오른쪽
  wall(px, pz, qx, qz, y0, y1, uOff = 0, us = 1, vs = 1, vOff = 0) {
    const dx = qx - px, dz = qz - pz, L = Math.hypot(dx, dz);
    const tx = dx / L, tz = dz / L;
    const n = [-tz, 0, tx];
    this.quad([px, y0, pz], [qx, y0, qz], [qx, y1, qz], [px, y1, pz], n,
      [[uOff / us, (y0 + vOff) / vs], [(uOff + L) / us, (y0 + vOff) / vs], [(uOff + L) / us, (y1 + vOff) / vs], [uOff / us, (y1 + vOff) / vs]]);
    return L;
  }
  top(x0, z0, x1, z1, y, us = 1, vs = 1) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0],
      [[x0 / us, -z1 / vs], [x1 / us, -z1 / vs], [x1 / us, -z0 / vs], [x0 / us, -z0 / vs]]);
  }
  bottom(x0, z0, x1, z1, y) {
    this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  // 박스: 벽 UV는 월드 단위(m)/us, vs
  box(x0, y0, z0, x1, y1, z1, o = {}) {
    const us = o.us || 1, vs = o.vs || 1, vOff = o.vOff || 0;
    let u = o.uOff || 0;
    if (o.sides !== false) {
      u += this.wall(x1, z0, x0, z0, y0, y1, u, us, vs, vOff);
      u += this.wall(x0, z0, x0, z1, y0, y1, u, us, vs, vOff);
      u += this.wall(x0, z1, x1, z1, y0, y1, u, us, vs, vOff);
      u += this.wall(x1, z1, x1, z0, y0, y1, u, us, vs, vOff);
    }
    if (o.top !== false) this.top(x0, z0, x1, z1, y1, o.tus || us, o.tvs || vs);
    if (o.bottom) this.bottom(x0, z0, x1, z1, y0);
  }
  // 중심/크기로 박스
  cbox(cx, cy, cz, w, h, d, o) { this.box(cx - w / 2, cy - h / 2, cz - d / 2, cx + w / 2, cy + h / 2, cz + d / 2, o); }
  // 회전된 박스 (y축 회전)
  rbox(cx, cy, cz, w, h, d, rot) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateY(rot); g.translate(cx, cy, cz);
    this.addGeo(g);
  }
  addGeo(g, matrix) {
    if (matrix) g = g.clone().applyMatrix4(matrix);
    const gi = g.index ? g : null;
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const base = this.p.length / 3;
    for (let k = 0; k < pos.count; k++) {
      this.p.push(pos.getX(k), pos.getY(k), pos.getZ(k));
      this.n.push(nor.getX(k), nor.getY(k), nor.getZ(k));
      this.uv.push(uv ? uv.getX(k) : 0, uv ? uv.getY(k) : 0);
      if (this.color) this.c.push(this.color[0], this.color[1], this.color[2]);
    }
    if (gi) for (let k = 0; k < gi.index.count; k++) this.i.push(base + gi.index.getX(k));
    else for (let k = 0; k < pos.count; k++) this.i.push(base + k);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  get empty() { return this.i.length === 0; }
}

// 시드 랜덤
export function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

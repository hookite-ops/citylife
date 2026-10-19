import * as THREE from 'three';
import { N, ROAD, BLOCK, P, HALF, SIDEWALK, ROADS, STOP, blockRect } from './config.js';
import { GB, seeded } from './geo.js';
import * as T from './textures.js';

// 블록 용도 지도 (행 j, 열 i)
const ZONES = [
  'HRCCRR',
  'RPCCCR',
  'CCDDCR',
  'CCDDCC',
  'ERCCRM',
  'RRRCRU',
];

// 학교 (블록 하나 전체): E 초등 · M 중 · H 고 · U 대학
export const SCHOOLS = {
  E: { type: 'elem', name: '한빛초등학교', icon: '🎒', color: '#2a7a4a', h: 14, floors: 4 },
  M: { type: 'middle', name: '한빛중학교', icon: '🏫', color: '#2a4a8a', h: 14, floors: 4 },
  H: { type: 'high', name: '한빛고등학교', icon: '🏫', color: '#6a2a2a', h: 17.5, floors: 5 },
  U: { type: 'univ', name: '한빛대학교', icon: '🎓', color: '#1a2a5a', h: 24.5, floors: 7 },
};

// 특수 건물: "i,j,q" (q: 0=북서 1=북동 2=남서 3=남동)
export const SPECIALS = {
  '1,2,1': { id: 'home', name: '우리집 · 한빛빌라', kind: 'brick', h: 13, sign: ['한빛빌라', '#4a3426', '#ffe9c8', 'HANBIT VILLA'], icon: '🏠' },
  '2,1,2': { id: 'mart', name: '24시 편의점', kind: 'white', h: 9, sign: ['24 마트', '#1f8a4c', '#ffffff', '24시간 편의점'], icon: '🏪' },
  '3,1,2': { id: 'rest', name: '한끼식당', kind: 'beige', h: 10, sign: ['한끼식당', '#8a2a1a', '#ffe7b0', '한식 · 백반 · 갈비'], icon: '🍚' },
  '3,2,0': { id: 'office', name: '한빛그룹 본사', kind: 'glass', h: 96, sign: ['HANBIT GROUP', '#0f2a44', '#e8f1ff', '한빛그룹'], icon: '🏢' },
  '4,2,2': { id: 'delivery', name: '번개배달 센터', kind: 'white', h: 9, sign: ['번개배달', '#e0a20a', '#1a1a1a', '배달 기사 모집'], icon: '🛵' },
  '4,3,1': { id: 'cars', name: '드림모터스 전시장', kind: 'dark', h: 11, sign: ['DREAM MOTORS', '#111418', '#f2f2f2', '신차 · 중고차'], icon: '🚗', showroom: true },
  '1,3,1': { id: 'furn', name: '홈데코 가구점', kind: 'beige', h: 10, sign: ['홈데코', '#2f4a3a', '#f1ead8', '가구 · 인테리어'], icon: '🛋️' },
  '2,4,0': { id: 'realty', name: '행복 부동산', kind: 'brick', h: 9, sign: ['행복 부동산', '#1d3b6e', '#ffffff', '매매 · 전세 · 월세'], icon: '🏘️' },
  '4,4,3': { id: 'mart', name: '24시 편의점', kind: 'white', h: 9, sign: ['24 마트', '#1f8a4c', '#ffffff', '24시간 편의점'], icon: '🏪' },
  '1,4,1': { id: 'gym', name: '헬스장 · 핏라이프', kind: 'dark', h: 10, sign: ['FIT LIFE', '#202020', '#ff5a2a', '24시 헬스 · 샤워'], icon: '💪' },
};

export class City {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.colliders = [];
    this.entrances = [];
    this.doors = [];
    this.parking = {};
    this.parkedSpots = [];
    this.poleGrid = new Map();
    this.night = 0;
    this.signalT = 0;
    this.rand = seeded(20261019);
    this.group = new THREE.Group();
    scene.add(this.group);
    this.makeMaterials();
    this.buildGround();
    this.buildMarkings();
    this.buildBlocks();
    this.buildStreetFurniture();
    this.buildSignals();
    this.buildOutskirts();
  }

  makeMaterials() {
    const asp = T.asphalt();
    this.mat = {
      asphalt: new THREE.MeshStandardMaterial({ map: asp, roughness: 0.92, color: 0xffffff }),
      sidewalk: new THREE.MeshStandardMaterial({ map: T.sidewalk(), roughness: 0.9 }),
      curb: new THREE.MeshStandardMaterial({ color: 0x8c8a86, roughness: 0.85 }),
      grass: new THREE.MeshStandardMaterial({ map: T.grass(), roughness: 1 }),
      white: new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xe5b420, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      roof: new THREE.MeshStandardMaterial({ map: T.roofTex(), roughness: 0.95, color: 0xb8b4ae }),
      metal: new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.45, metalness: 0.7 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.5, metalness: 0.6 }),
      props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1 }),
      storefront: (() => { const t = T.storefront(); t.repeat.set(1 / 4, 1 / 3.6); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.15, metalness: 0.3 }); })(),
      water: new THREE.MeshStandardMaterial({ color: 0x23404a, roughness: 0.04, metalness: 0.9 }),
      lampHead: new THREE.MeshStandardMaterial({ color: 0xdedbd2, emissive: 0xffd9a0, emissiveIntensity: 0 }),
      pool: new THREE.MeshBasicMaterial({ map: T.lightPool(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      ring: new THREE.MeshBasicMaterial({ color: 0x46d1ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
    };
    asp.repeat.set(1 / 14, 1 / 14);
    this.facades = {};
    for (const k of T.FACADE_KEYS) {
      const f = T.facade(k);
      const glassy = k === 'glass' || k === 'dark';
      this.facades[k] = new THREE.MeshStandardMaterial({
        map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 0,
        roughness: glassy ? 0.25 : 0.78, metalness: glassy ? 0.55 : 0.05,
      });
    }
    this.facadeSize = { w: 24, h: 28 };
  }

  // 지면: 도로(아스팔트), 블록 보도, 외곽 잔디
  buildGround() {
    const size = N * P + ROAD;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(size + 8, size + 8), this.mat.asphalt);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    // 아스팔트 UV를 월드 단위로
    const uv = road.geometry.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (size + 8), uv.getY(k) * (size + 8));
    this.group.add(road);

    const outer = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), this.mat.grass);
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05;
    const ou = outer.geometry.attributes.uv;
    for (let k = 0; k < ou.count; k++) ou.setXY(k, ou.getX(k) * 400, ou.getY(k) * 400);
    outer.receiveShadow = true;
    this.group.add(outer);

    const side = new GB(), curb = new GB(), grass = new GB();
    const H = 0.18;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const r = blockRect(i, j);
      const zone = ZONES[j][i];
      if (zone === 'P') {
        // 공원: 보도 링 + 잔디
        const s = SIDEWALK;
        side.top(r.x0, r.z0, r.x1, r.z0 + s, H, 4, 4);
        side.top(r.x0, r.z1 - s, r.x1, r.z1, H, 4, 4);
        side.top(r.x0, r.z0 + s, r.x0 + s, r.z1 - s, H, 4, 4);
        side.top(r.x1 - s, r.z0 + s, r.x1, r.z1 - s, H, 4, 4);
        grass.top(r.x0 + s, r.z0 + s, r.x1 - s, r.z1 - s, H + 0.02, 6, 6);
      } else {
        side.top(r.x0, r.z0, r.x1, r.z1, H, 4, 4);
      }
      curb.box(r.x0, 0, r.z0, r.x1, H, r.z1, { top: false, us: 1, vs: 1 });
    }
    // 외곽 보도
    const e = HALF + ROAD / 2, w = 5;
    side.top(-e - w, -e - w, e + w, -e, H, 4, 4);
    side.top(-e - w, e, e + w, e + w, H, 4, 4);
    side.top(-e - w, -e, -e, e, H, 4, 4);
    side.top(e, -e, e + w, e, H, 4, 4);
    curb.wall(-e, -e, e, -e, 0, H); curb.wall(e, e, -e, e, 0, H);
    curb.wall(e, -e, e, e, 0, H); curb.wall(-e, e, -e, -e, 0, H);

    for (const [gb, m] of [[side, this.mat.sidewalk], [curb, this.mat.curb], [grass, this.mat.grass]]) {
      const mesh = new THREE.Mesh(gb.build(), m);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  buildMarkings() {
    const W = new GB(), Y = new GB();
    const yy = 0.02;
    const strip = (gb, x0, z0, x1, z1) => gb.top(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), yy);
    for (let k = 0; k <= N; k++) {
      const c = ROADS[k];
      for (let s = 0; s < N; s++) {
        const a = ROADS[s] + STOP, b = ROADS[s + 1] - STOP;
        for (const axis of ['x', 'z']) {
          // axis 'x': 도로가 x방향으로 뻗음 (z = c)
          const L = (u0, u1, off0, off1, gb) => axis === 'x' ? strip(gb, u0, c + off0, u1, c + off1) : strip(gb, c + off0, u0, c + off1, u1);
          // 중앙 이중 황색선
          L(a, b, -0.3, -0.15, Y); L(a, b, 0.15, 0.3, Y);
          // 차선 점선
          for (let u = a; u < b - 3; u += 8) { L(u, u + 3.5, -3.72, -3.58, W); L(u, u + 3.5, 3.58, 3.72, W); }
          // 가장자리선
          L(a - 3.5, b + 3.5, -7.5, -7.35, W); L(a - 3.5, b + 3.5, 7.35, 7.5, W);
          // 횡단보도 (양 끝)
          for (const [u0, u1] of [[ROADS[s] + ROAD / 2 + 0.6, ROADS[s] + ROAD / 2 + 3.6], [ROADS[s + 1] - ROAD / 2 - 3.6, ROADS[s + 1] - ROAD / 2 - 0.6]]) {
            for (let o = -7.2; o < 7.2; o += 1.0) L(u0, u1, o, o + 0.5, W);
          }
          // 정지선: 교차로로 들어가는 차선 쪽
          // 도로 시작(a 쪽)으로 들어오는 차 = 음의 방향 진행. 오른쪽 = ...
          if (axis === 'x') {
            L(a - 0.5, a, -7.4, -0.4, W);   // -x 방향 진행 차량, 차선 z<c
            L(b, b + 0.5, 0.4, 7.4, W);     // +x 방향 진행, 차선 z>c
          } else {
            L(a - 0.5, a, 0.4, 7.4, W);     // -z 방향 진행, 차선 x>c
            L(b, b + 0.5, -7.4, -0.4, W);   // +z 방향 진행, 차선 x<c
          }
        }
      }
    }
    for (const [gb, m] of [[W, this.mat.white], [Y, this.mat.yellow]]) {
      const mesh = new THREE.Mesh(gb.build(), m);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  buildBlocks() {
    const R = this.rand;
    const fac = {}; for (const k of T.FACADE_KEYS) fac[k] = new GB();
    const roof = new GB(), props = new GB(), store = new GB(), patch = new GB();
    const fw = this.facadeSize.w, fh = this.facadeSize.h;
    this.signs = [];

    const addBuilding = (kind, x0, z0, x1, z1, h, opts = {}) => {
      const uOff = Math.floor(R() * 8) * 3;
      const vOff = 0;
      fac[kind].box(x0, 0.18, z0, x1, h, z1, { us: fw, vs: fh, uOff, vOff, top: false });
      // 옥상 테두리 + 옥상면
      roof.top(x0, z0, x1, z1, h - 0.02, 8, 8);
      const p = 0.35;
      roof.box(x0, h, z0, x1, h + 0.9, z0 + p, { us: 4, vs: 4 });
      roof.box(x0, h, z1 - p, x1, h + 0.9, z1, { us: 4, vs: 4 });
      roof.box(x0, h, z0, x0 + p, h + 0.9, z1, { us: 4, vs: 4 });
      roof.box(x1 - p, h, z0, x1, h + 0.9, z1, { us: 4, vs: 4 });
      // 옥상 소품: 실외기, 물탱크, 기계실
      if (!opts.noProps) {
        const w = x1 - x0, d = z1 - z0;
        const n = 1 + Math.floor(R() * 4);
        props.setColor(0xa9acae);
        for (let k = 0; k < n; k++) {
          const cx = x0 + 2 + R() * (w - 4), cz = z0 + 2 + R() * (d - 4);
          props.cbox(cx, h + 0.6, cz, 1.4, 1.2, 1.0);
        }
        if (h > 20 && R() < 0.7) {
          props.setColor(0x8f9396);
          const cw = Math.min(w * 0.4, 8), cd = Math.min(d * 0.4, 6);
          props.cbox(x0 + w * 0.5, h + 1.8, z0 + d * 0.5, cw, 3.6, cd);
        }
        if (h < 30 && R() < 0.5) {
          props.setColor(0x5c88a8);
          const g = new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10);
          g.translate(x0 + 2.5, h + 1.3, z1 - 2.5);
          props.addGeo(g);
        }
        if (h > 60) {
          props.setColor(0xc03030);
          const g = new THREE.CylinderGeometry(0.15, 0.15, 8, 6); g.translate(x0 + w / 2, h + 7.5, z0 + d / 2); props.addGeo(g);
        }
      }
    };

    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const r = blockRect(i, j);
      const zone = ZONES[j][i];
      if (zone === 'P') { this.buildPark(r, props); continue; }
      if (SCHOOLS[zone]) { this.buildSchool(r, SCHOOLS[zone], addBuilding, props, store); continue; }
      const ix0 = r.x0 + SIDEWALK, iz0 = r.z0 + SIDEWALK, ix1 = r.x1 - SIDEWALK, iz1 = r.z1 - SIDEWALK;
      const hw = (ix1 - ix0) / 2;
      for (let q = 0; q < 4; q++) {
        const qx = q % 2, qz = Math.floor(q / 2);
        const lx0 = ix0 + qx * hw, lz0 = iz0 + qz * hw, lx1 = lx0 + hw, lz1 = lz0 + hw;
        const front = qz === 0 ? -1 : 1; // 정면이 향하는 z 방향
        const key = `${i},${j},${q}`;
        const sp = SPECIALS[key];
        const m = 1.2;
        if (sp) {
          // 앞마당(주차) + 건물
          const yard = 9;
          let bz0, bz1, zf;
          if (front < 0) { zf = lz0 + yard; bz0 = zf; bz1 = lz1 - m; }
          else { zf = lz1 - yard; bz0 = lz0 + m; bz1 = zf; }
          const bx0 = lx0 + m, bx1 = lx1 - m;
          patch.top(lx0 + 0.5, front < 0 ? lz0 : zf, lx1 - 0.5, front < 0 ? zf : lz1, 0.19, 1, 1);
          const h = sp.h;
          if (sp.id === 'office') {
            // 포디움 + 타워
            addBuilding('glass', bx0, bz0, bx1, bz1, 14, { noProps: true });
            addBuilding('glass', bx0 + 3, bz0 + (front < 0 ? 2 : 1), bx1 - 3, bz1 - (front < 0 ? 1 : 2), h);
          } else {
            addBuilding(sp.kind, bx0, bz0, bx1, bz1, h);
          }
          this.colliders.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, h });
          // 1층 유리 상점 전면
          const cx = (bx0 + bx1) / 2;
          const sw = sp.showroom ? (bx1 - bx0 - 1) : 12;
          if (front < 0) store.wall(cx + sw / 2, zf - 0.06, cx - sw / 2, zf - 0.06, 0.2, sp.showroom ? 7 : 3.6);
          else store.wall(cx - sw / 2, zf + 0.06, cx + sw / 2, zf + 0.06, 0.2, sp.showroom ? 7 : 3.6);
          // 차양
          props.setColor(sp.sign[1]);
          props.cbox(cx, 3.9, zf + front * 0.9, sw + 1, 0.18, 1.8);
          // 간판
          this.addSign(sp, cx, zf, front, sp.showroom ? 8.2 : 5.0);
          const ex = cx, ez = zf + front * 2.2;
          const ent = { id: sp.id, name: sp.name, icon: sp.icon, x: ex, z: ez, face: front < 0 ? Math.PI : 0, key };
          this.entrances.push(ent);
          const pz = front < 0 ? lz0 + 4.6 : lz1 - 4.6, prot = front < 0 ? 0 : Math.PI;
          this.parking[sp.id === 'home' ? 'home' : sp.id === 'cars' ? 'cars' : key] = { x: lx1 - 4, z: pz, rot: prot + Math.PI };
          const nPark = sp.id === 'cars' ? 3 : sp.id === 'home' ? 1 : 2;
          for (let k = 0; k < nPark; k++) if (R() < 0.85) this.parkedSpots.push({ x: lx0 + 3.2 + k * 3.4, z: pz, rot: prot, showroom: sp.id === 'cars' });
          if (sp.id === 'cars') this.showroomSpot = { x: cx, z: zf - front * 4, front };
          continue;
        }
        // 일반 건물
        let kind, h;
        if (zone === 'D') { kind = R() < 0.6 ? 'glass' : 'dark'; h = 40 + R() * 75; }
        else if (zone === 'C') { kind = ['beige', 'white', 'brick', 'glass', 'beige'][Math.floor(R() * 5)]; h = 10 + R() * 26; }
        else { kind = R() < 0.6 ? 'apt' : 'brick'; h = kind === 'apt' ? 28 + R() * 30 : 9 + R() * 8; }
        h = Math.round(h / 3.5) * 3.5 + 0.18;
        let bx0 = lx0 + m, bx1 = lx1 - m, bz0 = lz0 + m, bz1 = lz1 - m;
        if (kind === 'apt') {
          // 판상형 아파트: 얇고 긴 동
          if (front < 0) bz0 = bz1 - 11; else bz1 = bz0 + 11;
        } else if (R() < 0.35) {
          const sx = R() * 4, sz = R() * 4;
          bx0 += sx; bx1 -= R() * 3; if (front < 0) bz1 -= sz; else bz0 += sz;
        }
        if (zone === 'D' && R() < 0.5) {
          addBuilding(kind, bx0, bz0, bx1, bz1, 14, { noProps: true });
          addBuilding(kind, bx0 + 3, bz0 + 3, bx1 - 3, bz1 - 3, h);
        } else {
          addBuilding(kind, bx0, bz0, bx1, bz1, h);
        }
        this.colliders.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, h });
        // 1층 상가 (상업 지역)
        const zf = front < 0 ? bz0 : bz1;
        if (zone !== 'R' || kind === 'brick') {
          const cx = (bx0 + bx1) / 2, sw = Math.min(14, bx1 - bx0 - 2);
          if (front < 0) store.wall(cx + sw / 2, zf - 0.06, cx - sw / 2, zf - 0.06, 0.2, 3.4);
          else store.wall(cx - sw / 2, zf + 0.06, cx + sw / 2, zf + 0.06, 0.2, 3.4);
          if (R() < 0.6) {
            const cols = [0x2a5d8a, 0x8a2a2a, 0x2a7a4a, 0x7a5a2a, 0x444444, 0x6a2a6a];
            props.setColor(cols[Math.floor(R() * cols.length)]);
            props.cbox(cx, 3.7, zf + front * 0.8, sw, 0.15, 1.6);
          }
        }
        this.doors.push({ x: (bx0 + bx1) / 2, z: zf + front * 1.6, name: this.randomPlaceName(zone, kind) });
      }
    }

    for (const k of T.FACADE_KEYS) {
      if (fac[k].empty) continue;
      const mesh = new THREE.Mesh(fac[k].build(), this.facades[k]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    const roofMesh = new THREE.Mesh(roof.build(), this.mat.roof); roofMesh.receiveShadow = true; roofMesh.castShadow = true; this.group.add(roofMesh);
    const pm = new THREE.Mesh(props.build(), this.mat.props); pm.castShadow = true; pm.receiveShadow = true; this.group.add(pm);
    this.group.add(new THREE.Mesh(store.build(), this.mat.storefront));
    const patchMesh = new THREE.Mesh(patch.build(), this.mat.asphalt); patchMesh.receiveShadow = true; this.group.add(patchMesh);
    // 입구 표시 링
    const ringGeo = new THREE.RingGeometry(0.9, 1.15, 40); ringGeo.rotateX(-Math.PI / 2);
    this.rings = [];
    for (const e of this.entrances) {
      const ring = new THREE.Mesh(ringGeo, this.mat.ring);
      ring.position.set(e.x, 0.24, e.z);
      this.group.add(ring);
      this.rings.push(ring);
    }
  }

  buildSchool(r, sc, addBuilding, props, store) {
    const ix0 = r.x0 + SIDEWALK, iz0 = r.z0 + SIDEWALK, ix1 = r.x1 - SIDEWALK, iz1 = r.z1 - SIDEWALK;
    const cx = r.cx;
    // 본관 (뒤쪽)
    const bz1 = iz1 - 2, bz0 = bz1 - (sc.type === 'univ' ? 18 : 15);
    const bx0 = ix0 + 4, bx1 = ix1 - 4;
    const kind = sc.type === 'univ' ? 'beige' : sc.type === 'elem' ? 'white' : 'beige';
    addBuilding(kind, bx0, bz0, bx1, bz1, sc.h);
    this.colliders.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, h: sc.h });
    if (sc.type === 'univ') {
      // 시계탑
      addBuilding('brick', cx - 3, bz0 - 0.5, cx + 3, bz0 + 5, sc.h + 10);
      props.setColor(0xf2f2ee); props.cbox(cx, sc.h + 6, bz0 - 0.55, 3.2, 3.2, 0.1);
      props.setColor(0x222222); props.cbox(cx, sc.h + 6.4, bz0 - 0.62, 0.15, 1.2, 0.05); props.cbox(cx + 0.4, sc.h + 6, bz0 - 0.62, 0.9, 0.15, 0.05);
    }
    // 현관 캐노피 + 유리문
    props.setColor(0xd8d8d2); props.cbox(cx, 3.6, bz0 - 1.6, 8, 0.25, 3.2);
    props.setColor(0x9a9a94); props.cbox(cx - 3.8, 1.8, bz0 - 3.0, 0.3, 3.6, 0.3); props.cbox(cx + 3.8, 1.8, bz0 - 3.0, 0.3, 3.6, 0.3);
    store.wall(cx + 3, bz0 - 0.06, cx - 3, bz0 - 0.06, 0.2, 3.2);
    // 운동장 (흙) 또는 잔디 광장
    const fz0 = iz0 + 3, fz1 = bz0 - 4, fx0 = ix0 + 3, fx1 = ix1 - 3;
    const field = new THREE.Mesh(new THREE.PlaneGeometry(fx1 - fx0, fz1 - fz0), sc.type === 'univ' ? this.mat.grass : this.fieldMat());
    field.rotation.x = -Math.PI / 2; field.position.set((fx0 + fx1) / 2, 0.195, (fz0 + fz1) / 2); field.receiveShadow = true;
    this.group.add(field);
    if (sc.type !== 'univ') {
      // 축구 골대
      for (const s of [-1, 1]) {
        const gx = (fx0 + fx1) / 2 + s * ((fx1 - fx0) / 2 - 1.5), gz = (fz0 + fz1) / 2;
        props.setColor(0xf2f2f2);
        props.cbox(gx, 1.1, gz - 2.5, 0.12, 2.2, 0.12); props.cbox(gx, 1.1, gz + 2.5, 0.12, 2.2, 0.12); props.cbox(gx, 2.2, gz, 0.12, 0.12, 5.1);
      }
      // 구령대
      props.setColor(0xb0a898); props.cbox(cx + 14, 0.6, fz1 + 1.5, 6, 1.0, 3);
    } else {
      // 캠퍼스 산책로 + 벤치
      props.setColor(0xc8c0b0); props.cbox(cx, 0.21, (fz0 + fz1) / 2, 4, 0.02, fz1 - fz0);
      for (let k = 0; k < 6; k++) { props.setColor(0x7a5236); props.cbox(cx + (k % 2 ? 4 : -4), 0.5, fz0 + 4 + k * 3.5, 0.6, 0.1, 1.8); }
    }
    // 담장 (정문 자리만 비움)
    props.setColor(sc.type === 'univ' ? 0x8a7a6a : 0x3a6a4a);
    const fh = sc.type === 'univ' ? 0.9 : 1.6, gate = 5;
    const fence = (x0, z0, x1, z1) => { props.box(x0, 0.18, z0, x1, fh, z1); this.colliders.push({ x0, z0, x1, z1, h: fh, soft: true }); };
    fence(ix0, iz0, cx - gate, iz0 + 0.25); fence(cx + gate, iz0, ix1, iz0 + 0.25);
    fence(ix0, iz0, ix0 + 0.25, iz1); fence(ix1 - 0.25, iz0, ix1, iz1);
    fence(ix0, iz1 - 0.25, ix1, iz1);
    // 교문 기둥 + 이름판
    props.setColor(0xb8b0a0); props.cbox(cx - gate - 0.4, 1.4, iz0 + 0.1, 0.8, 2.8, 0.8); props.cbox(cx + gate + 0.4, 1.4, iz0 + 0.1, 0.8, 2.8, 0.8);
    const signSp = { id: 'school', sign: [sc.name, sc.color, '#ffffff', sc.type === 'univ' ? 'HANBIT UNIVERSITY' : ''] };
    this.addSign(signSp, cx, bz0, -1, sc.h - 2.5);
    // 입구
    const ent = { id: 'school', school: sc.type, name: sc.name, icon: sc.icon, x: cx, z: bz0 - 2.2, face: Math.PI, key: 'school-' + sc.type };
    this.entrances.push(ent);
    this.doors.push({ x: cx, z: iz0 - 1.5, name: sc.name + ' 정문' });
  }
  fieldMat() {
    if (this._field) return this._field;
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#b8936a'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},${50 + Math.random() * 30},0.25)`; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 4;
    x.beginPath(); x.roundRect(40, 90, 432, 332, 166); x.stroke();
    x.beginPath(); x.roundRect(70, 120, 372, 272, 136); x.stroke();
    x.beginPath(); x.moveTo(256, 120); x.lineTo(256, 392); x.stroke();
    x.beginPath(); x.arc(256, 256, 40, 0, 7); x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    this._field = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
    return this._field;
  }

  randomPlaceName(zone, kind) {
    const R = this.rand;
    const a = ['그린', '스카이', '해피', '드림', '푸른', '세종', '미래', '중앙', '한강', '새봄', '은하', '대한'];
    const b = zone === 'R' ? ['아파트', '빌라', '맨션', '오피스텔', '하우스'] : zone === 'D' ? ['타워', '빌딩', '센터', '트윈타워', '파이낸스'] : ['빌딩', '상가', '프라자', '오피스', '병원', '학원'];
    return a[Math.floor(R() * a.length)] + b[Math.floor(R() * b.length)] + ' ' + (1 + Math.floor(R() * 12)) + '동';
  }

  addSign(sp, cx, zf, front, y) {
    const t = T.sign(sp.sign[0], sp.sign[1], sp.sign[2], sp.sign[3]);
    const mat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5 });
    const w = sp.id === 'office' ? 14 : 9, h = w / 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(cx, y, zf + front * 0.12);
    m.rotation.y = front < 0 ? Math.PI : 0;
    this.group.add(m);
    this.signs.push(mat);
    if (sp.id === 'office') {
      // 타워 꼭대기 로고
      const m2 = m.clone(); m2.position.y = sp.h - 6; m2.position.z = zf + front * (front < 0 ? 2.1 : 2.1) + front * 0.1; m2.scale.setScalar(1.6);
      this.group.add(m2);
    }
  }

  buildPark(r, props) {
    const R = this.rand;
    const cx = r.cx, cz = r.cz;
    // 연못
    const pond = new THREE.Mesh(new THREE.CircleGeometry(11, 48), this.mat.water);
    pond.rotation.x = -Math.PI / 2; pond.position.set(cx + 6, 0.23, cz + 4);
    this.group.add(pond);
    props.setColor(0x8a8478);
    const rim = new THREE.TorusGeometry(11.2, 0.35, 6, 48); rim.rotateX(Math.PI / 2); rim.translate(cx + 6, 0.25, cz + 4);
    props.addGeo(rim);
    this.colliders.push({ x0: cx + 6 - 9, z0: cz + 4 - 9, x1: cx + 6 + 9, z1: cz + 4 + 9, h: 0.5, soft: true });
    // 산책로
    const path = new GB();
    path.top(r.x0 + 4, cz - 1.5, r.x1 - 4, cz + 1.5 - 0.01, 0.215, 4, 4);
    path.top(cx - 1.5, r.z0 + 4, cx + 1.5, r.z1 - 4, 0.215, 4, 4);
    const pm = new THREE.Mesh(path.build(), this.mat.sidewalk); pm.receiveShadow = true; this.group.add(pm);
    // 벤치
    for (let k = 0; k < 8; k++) {
      const bx = cx + (k % 2 ? 3 : -3), bz = r.z0 + 10 + k * 5.5;
      props.setColor(0x7a5236); props.cbox(bx, 0.62, bz, 0.5, 0.08, 1.8); props.cbox(bx + (k % 2 ? 0.25 : -0.25), 0.95, bz, 0.08, 0.5, 1.8);
      props.setColor(0x333333); props.cbox(bx, 0.4, bz - 0.7, 0.5, 0.4, 0.08); props.cbox(bx, 0.4, bz + 0.7, 0.5, 0.4, 0.08);
    }
    // 정자
    props.setColor(0x6b3d24);
    for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) props.cbox(cx - 16 + dx, 1.6, cz - 14 + dz, 0.3, 3, 0.3);
    props.setColor(0x3f4a44);
    const roofG = new THREE.ConeGeometry(4.8, 1.8, 4); roofG.rotateY(Math.PI / 4); roofG.translate(cx - 16, 4, cz - 14); props.addGeo(roofG);
    props.setColor(0x8a6a4a); props.cbox(cx - 16, 0.5, cz - 14, 5, 0.15, 5);
    this.parkTrees = [];
    for (let k = 0; k < 46; k++) {
      const tx = r.x0 + 6 + R() * (BLOCK - 12), tz = r.z0 + 6 + R() * (BLOCK - 12);
      if (Math.hypot(tx - cx - 6, tz - cz - 4) < 13) continue;
      if (Math.abs(tx - cx) < 3 || Math.abs(tz - cz) < 3) continue;
      if (Math.hypot(tx - cx + 16, tz - cz + 14) < 5) continue;
      this.parkTrees.push([tx, tz, 0.9 + R() * 0.7]);
    }
    this.parkRect = r;
  }

  buildStreetFurniture() {
    const R = this.rand;
    const lamps = [], trees = [...(this.parkTrees || [])];
    const props = new GB();
    for (let k = 0; k <= N; k++) {
      const c = ROADS[k];
      for (let s = 0; s < N; s++) {
        const a = ROADS[s] + 14, b = ROADS[s + 1] - 14;
        for (const side of [-1, 1]) {
          const off = side * (ROAD / 2 + 0.7);
          let idx = 0;
          for (let u = a; u <= b + 0.1; u += (b - a) / 3) {
            lamps.push({ x: c + off, z: u, rot: side, axis: 'z' }); // 도로가 z 방향 (x = c)
            lamps.push({ x: u, z: c + off, rot: side, axis: 'x' });
            idx++;
          }
          for (let u = a + 6; u < b - 4; u += 15) {
            if (R() < 0.15) continue;
            const toff = side * (ROAD / 2 + 2.6);
            trees.push([c + toff, u, 0.8 + R() * 0.4]);
            trees.push([u, c + toff, 0.8 + R() * 0.4]);
          }
          // 버스 정류장 / 쓰레기통 / 소화전
          const mid = (a + b) / 2;
          if (R() < 0.18) this.busStop(props, side, c, mid, 'z');
          if (R() < 0.18) this.busStop(props, side, c, mid, 'x');
          props.setColor(0x2f5f3a); props.cbox(c + side * (ROAD / 2 + 1.2), 0.65, mid + 9, 0.5, 0.95, 0.5);
          props.setColor(0xb52a1e); props.cbox(mid - 9, 0.55, c + side * (ROAD / 2 + 0.9), 0.3, 0.75, 0.3);
        }
      }
    }
    // 가로등 (인스턴스)
    const poleG = new THREE.CylinderGeometry(0.09, 0.14, 8, 8); poleG.translate(0, 4, 0);
    const armG = new THREE.BoxGeometry(0.12, 0.12, 2.0); armG.translate(0, 7.9, -1.0);
    const headG = new THREE.BoxGeometry(0.42, 0.16, 0.9); headG.translate(0, 7.82, -2.0);
    const pole = new THREE.InstancedMesh(poleG, this.mat.darkMetal, lamps.length);
    const arm = new THREE.InstancedMesh(armG, this.mat.darkMetal, lamps.length);
    const head = new THREE.InstancedMesh(headG, this.mat.lampHead, lamps.length);
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2), this.mat.pool, lamps.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    this.lampPos = [];
    lamps.forEach((l, k) => {
      // 팔이 도로 쪽(-side)으로 향하도록
      let ry;
      if (l.axis === 'z') ry = l.rot > 0 ? Math.PI / 2 : -Math.PI / 2;
      else ry = l.rot > 0 ? 0 : Math.PI;
      e.set(0, ry, 0); q.setFromEuler(e);
      m4.compose(v.set(l.x, 0.18, l.z), q, one);
      pole.setMatrixAt(k, m4); arm.setMatrixAt(k, m4); head.setMatrixAt(k, m4);
      const hx = l.x + (l.axis === 'z' ? -l.rot * 2 : 0), hz = l.z + (l.axis === 'x' ? -l.rot * 2 : 0);
      m4.compose(v.set(hx, 0.06, hz), new THREE.Quaternion(), one);
      pools.setMatrixAt(k, m4);
      this.lampPos.push([hx, hz]);
      this.addPole(l.x, l.z);
    });
    pole.castShadow = true;
    for (const im of [pole, arm, head, pools]) this.group.add(im);
    pools.renderOrder = 2;

    // 나무 (인스턴스)
    const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 7); trunkG.translate(0, 1.6, 0);
    const leafG = new THREE.IcosahedronGeometry(2.2, 1); leafG.translate(0, 4.6, 0);
    const pos = leafG.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const n = 1 + (Math.sin(pos.getX(k) * 3.1) + Math.cos(pos.getZ(k) * 2.7 + pos.getY(k))) * 0.08;
      pos.setXYZ(k, pos.getX(k) * n, 4.6 + (pos.getY(k) - 4.6) * 0.85 * n, pos.getZ(k) * n);
    }
    leafG.computeVertexNormals();
    const leaf2 = new THREE.IcosahedronGeometry(1.5, 0); leaf2.translate(0.9, 5.8, 0.4);
    const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x5a4532, roughness: 1 }), trees.length);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const leaves = new THREE.InstancedMesh(leafG, leafMat, trees.length);
    const leaves2 = new THREE.InstancedMesh(leaf2, leafMat, trees.length);
    const col = new THREE.Color();
    trees.forEach(([x, z, s], k) => {
      this.addPole(x, z);
      e.set(0, R() * 6.28, 0); q.setFromEuler(e);
      m4.compose(v.set(x, 0.18, z), q, new THREE.Vector3(s, s, s));
      trunk.setMatrixAt(k, m4); leaves.setMatrixAt(k, m4); leaves2.setMatrixAt(k, m4);
      col.setHSL(0.22 + R() * 0.08, 0.38 + R() * 0.2, 0.22 + R() * 0.1);
      leaves.setColorAt(k, col);
      col.offsetHSL(0.01, 0, 0.04); leaves2.setColorAt(k, col);
    });
    for (const im of [trunk, leaves, leaves2]) { im.castShadow = true; im.receiveShadow = true; this.group.add(im); }
    const pm = new THREE.Mesh(props.build(), this.mat.props); pm.castShadow = true; this.group.add(pm);
  }

  busStop(gb, side, c, u, axis) {
    const off = side * (ROAD / 2 + 2.6);
    const [x, z] = axis === 'z' ? [c + off, u] : [u, c + off];
    const w = 4.5, d = 1.5;
    const W = axis === 'z' ? d : w, D = axis === 'z' ? w : d;
    gb.setColor(0x3a3f45); gb.cbox(x, 2.6, z, W + 0.2, 0.12, D + 0.2);
    gb.setColor(0x2a2e33);
    gb.cbox(x - W / 2, 1.3, z - D / 2, 0.1, 2.6, 0.1); gb.cbox(x + W / 2, 1.3, z + D / 2, 0.1, 2.6, 0.1);
    gb.cbox(x - W / 2, 1.3, z + D / 2, 0.1, 2.6, 0.1); gb.cbox(x + W / 2, 1.3, z - D / 2, 0.1, 2.6, 0.1);
    gb.setColor(0x8fb4c9);
    if (axis === 'z') gb.cbox(x + side * d / 2, 1.5, z, 0.05, 2, w); else gb.cbox(x, 1.5, z + side * d / 2, w, 2, 0.05);
    gb.setColor(0x6b4a2e); gb.cbox(x + (axis === 'z' ? side * 0.3 : 0), 0.65, z + (axis === 'x' ? side * 0.3 : 0), axis === 'z' ? 0.45 : 3, 0.08, axis === 'z' ? 3 : 0.45);
    gb.setColor(0x1d6fb8); gb.cbox(x + (axis === 'z' ? -side * 0.9 : -2.6), 2.1, z + (axis === 'x' ? -side * 0.9 : -2.6), 0.6, 0.6, 0.06);
  }

  buildSignals() {
    // 각 교차로 4모서리, 접근 방향별 신호등 (한국식 동시신호 4현시)
    const poles = [], heads = { '+z': [], '-z': [], '+x': [], '-x': [] };
    const o = ROAD / 2 + 0.6;
    this.cameras = new Set();
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) {
      const X = ROADS[a], Z = ROADS[b];
      if (this.rand() < 0.3) this.cameras.add(a + ',' + b);
      const list = [
        [X - o, Z - o, Math.PI, '+z', b > 0],
        [X + o, Z + o, 0, '-z', b < N],
        [X - o, Z + o, -Math.PI / 2, '+x', a > 0],
        [X + o, Z - o, Math.PI / 2, '-x', a < N],
      ];
      for (const [x, z, ry, ap, ok] of list) {
        if (!ok) continue;
        poles.push([x, z, ry]);
        heads[ap].push([x, z, ry]);
        this.addPole(x, z);
      }
    }
    const poleG = new THREE.CylinderGeometry(0.12, 0.15, 6.2, 8); poleG.translate(0, 3.1, 0);
    const armG = new THREE.BoxGeometry(5.6, 0.16, 0.16); armG.translate(-2.8, 5.9, 0);
    const boxG = new THREE.BoxGeometry(1.25, 0.45, 0.35); boxG.translate(-4.6, 5.55, 0);
    const lampG = new THREE.CircleGeometry(0.15, 12);
    const dm = this.mat.darkMetal;
    const P1 = new THREE.InstancedMesh(poleG, dm, poles.length);
    const P2 = new THREE.InstancedMesh(armG, dm, poles.length);
    const P3 = new THREE.InstancedMesh(boxG, new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.6 }), poles.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
    poles.forEach(([x, z, ry], k) => {
      e.set(0, ry, 0); q.setFromEuler(e);
      m4.compose(v.set(x, 0.18, z), q, one);
      P1.setMatrixAt(k, m4); P2.setMatrixAt(k, m4); P3.setMatrixAt(k, m4);
    });
    P1.castShadow = true; P2.castShadow = true;
    this.group.add(P1, P2, P3);
    const colors = { r: 0xff2a1a, y: 0xffb000, g: 0x22ff88 };
    this.sigMats = {};
    for (const ap of Object.keys(heads)) {
      this.sigMats[ap] = {};
      const list = heads[ap];
      for (const [ci, c] of [['r', -0.4], ['y', 0], ['g', 0.4]]) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x222222, fog: false });
        this.sigMats[ap][ci] = { mat, on: new THREE.Color(colors[ci]).multiplyScalar(1.6), off: new THREE.Color(0x1d1d1d) };
        const im = new THREE.InstancedMesh(lampG, mat, list.length);
        list.forEach(([x, z, ry], k) => {
          e.set(0, ry, 0); q.setFromEuler(e);
          const base = new THREE.Matrix4().compose(v.set(x, 0.18, z), q, one);
          const local = new THREE.Matrix4().makeTranslation(-4.6 + c, 5.55, 0.18);
          im.setMatrixAt(k, base.multiply(local));
        });
        this.group.add(im);
      }
    }
  }

  buildOutskirts() {
    const R = this.rand;
    const gb = new GB(), gb2 = new GB();
    const fw = 24, fh = 28;
    for (let k = 0; k < 260; k++) {
      const ang = R() * Math.PI * 2, rad = 330 + Math.pow(R(), 0.7) * 520;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (Math.abs(x) < HALF + 60 && Math.abs(z) < HALF + 60) continue;
      const w = 16 + R() * 26, d = 16 + R() * 26, h = 15 + R() * R() * 120;
      (R() < 0.5 ? gb : gb2).box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, { us: fw, vs: fh, uOff: Math.floor(R() * 8) * 3 });
    }
    this.group.add(new THREE.Mesh(gb.build(), this.facades.dark));
    this.group.add(new THREE.Mesh(gb2.build(), this.facades.apt));
    // 먼 산
    const mtn = new THREE.MeshStandardMaterial({ color: 0x3c5048, roughness: 1, flatShading: true });
    for (let k = 0; k < 14; k++) {
      const ang = k / 14 * Math.PI * 2 + R() * 0.3, rad = 1300 + R() * 300;
      const g = new THREE.ConeGeometry(250 + R() * 250, 120 + R() * 200, 7);
      const m = new THREE.Mesh(g, mtn);
      m.position.set(Math.cos(ang) * rad, 40, Math.sin(ang) * rad);
      m.rotation.y = R() * 3;
      this.group.add(m);
    }
  }

  // 신호: 4현시 × 10초 (녹 8초 + 황 2초). 방향: '+z','-z','+x','-x'
  signal(ap) {
    const order = ['+z', '-z', '+x', '-x'];
    const t = this.signalT % 40;
    const idx = Math.floor(t / 10);
    if (order[idx] !== ap) return 'r';
    return t % 10 < 8 ? 'g' : 'y';
  }

  isOnBlock(x, z) {
    // 보도/블록 위인지 (높이 계산용)
    const e = HALF + ROAD / 2;
    if (Math.abs(x) > e || Math.abs(z) > e) return true;
    const fx = ((x + HALF) % P + P) % P, fz = ((z + HALF) % P + P) % P;
    return fx > ROAD / 2 && fx < P - ROAD / 2 && fz > ROAD / 2 && fz < P - ROAD / 2;
  }
  groundY(x, z) { return this.isOnBlock(x, z) ? 0.18 : 0; }

  addPole(x, z) {
    const k = Math.floor(x / 10) + ',' + Math.floor(z / 10);
    if (!this.poleGrid.has(k)) this.poleGrid.set(k, []);
    this.poleGrid.get(k).push(x, z);
  }
  nearPole(x, z, r) {
    const gx = Math.floor(x / 10), gz = Math.floor(z / 10);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.poleGrid.get((gx + i) + ',' + (gz + j));
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) if (Math.abs(a[k] - x) < r && Math.abs(a[k + 1] - z) < r && Math.hypot(a[k] - x, a[k + 1] - z) < r) return true;
    }
    return false;
  }

  // 원(반지름 r)과 건물 충돌 → 밀어내기
  collide(pos, r) {
    let hit = false;
    for (const c of this.colliders) {
      if (pos.x + r < c.x0 || pos.x - r > c.x1 || pos.z + r < c.z0 || pos.z - r > c.z1) continue;
      const nx = Math.max(c.x0, Math.min(pos.x, c.x1)), nz = Math.max(c.z0, Math.min(pos.z, c.z1));
      let dx = pos.x - nx, dz = pos.z - nz;
      const d = Math.hypot(dx, dz);
      if (d < r) {
        hit = true;
        if (d < 1e-4) {
          // 안쪽: 가장 가까운 면으로
          const l = pos.x - c.x0, rr = c.x1 - pos.x, t = pos.z - c.z0, b = c.z1 - pos.z;
          const mn = Math.min(l, rr, t, b);
          if (mn === l) pos.x = c.x0 - r; else if (mn === rr) pos.x = c.x1 + r; else if (mn === t) pos.z = c.z0 - r; else pos.z = c.z1 + r;
        } else {
          pos.x = nx + dx / d * r; pos.z = nz + dz / d * r;
        }
      }
    }
    // 기둥(가로등·신호등·나무)
    const gx = Math.floor(pos.x / 10), gz = Math.floor(pos.z / 10), pr = r + 0.18;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.poleGrid.get((gx + i) + ',' + (gz + j));
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) {
        const dx = pos.x - a[k], dz = pos.z - a[k + 1];
        if (Math.abs(dx) > pr || Math.abs(dz) > pr) continue;
        const d = Math.hypot(dx, dz);
        if (d < pr && d > 1e-4) { pos.x = a[k] + dx / d * pr; pos.z = a[k + 1] + dz / d * pr; hit = true; }
      }
    }
    const L = HALF + ROAD / 2 + 4;
    if (pos.x < -L) { pos.x = -L; hit = true; } if (pos.x > L) { pos.x = L; hit = true; }
    if (pos.z < -L) { pos.z = -L; hit = true; } if (pos.z > L) { pos.z = L; hit = true; }
    return hit;
  }

  update(dt, night, time) {
    this.signalT += dt;
    this.night = night;
    const fi = night * 0.85;
    for (const k in this.facades) this.facades[k].emissiveIntensity = fi;
    this.mat.lampHead.emissiveIntensity = night > 0.3 ? 2.2 : 0;
    this.mat.pool.opacity = Math.max(0, night - 0.25) * 0.6;
    this.mat.storefront.emissiveIntensity = 0.22 + night * 0.7;
    for (const s of this.signs) s.emissiveIntensity = 0.12 + night * 0.9;
    for (const ap in this.sigMats) {
      const st = this.signal(ap);
      for (const c of ['r', 'y', 'g']) {
        const m = this.sigMats[ap][c];
        m.mat.color.copy(c === st ? m.on : m.off);
      }
    }
    const pulse = 0.55 + Math.sin(time * 4) * 0.25;
    this.mat.ring.opacity = pulse;
  }
}

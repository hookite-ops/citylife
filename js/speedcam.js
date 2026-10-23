// ───────── ⑤ 결과가 남는 선택: 과속 단속 카메라 (제한속도 60km/h) ─────────
import * as THREE from 'three';
import { GB, seeded } from './geo.js';
import { N, ROADS, ROAD, hasEdge, segLen } from './config.js';

export const LIMIT_KMH = 60;
const Y0 = 0.18;

export class SpeedCams {
  constructor(scene, city) {
    this.list = [];
    const R = seeded(4242);
    const g = new GB();
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) for (const d of [[1, 0], [0, 1]]) {
      if (!hasEdge(a, b, d) || R() > 0.14) continue;
      const L = segLen(a, b, d);
      if (L < 150) continue;
      // 양방향 각각 (진행 방향 오른쪽 인도)
      for (const s of [1, -1]) {
        const dir = [d[0] * s, d[1] * s];
        const ax = d[0] ? 'x' : 'z';
        const mid = (d[0] ? ROADS[a] : ROADS[b]) + L / 2 + s * 18;     // 길 가운데쯤 (방향마다 조금 어긋나게)
        const c = d[0] ? ROADS[b] : ROADS[a];                           // 도로 중심선
        const rgt = [-dir[1], dir[0]];                                   // 오른쪽
        const side = d[0] ? rgt[1] : rgt[0];
        const px = ax === 'x' ? mid : c + side * (ROAD / 2 + 1.0), pz = ax === 'x' ? c + side * (ROAD / 2 + 1.0) : mid;
        // 가로등·나무·정류장과 겹치면 건너뛰기
        if (city?.nearPole?.(px, pz, 1.4) || (city?.busStops || []).some(b => Math.hypot(b.x - px, b.z - pz) < 5)) continue;
        city?.colliders.push({ x0: px - 0.18, x1: px + 0.18, z0: pz - 0.18, z1: pz + 0.18, h: 6.4 });
        this.list.push({ ax, at: mid, c, side, dir, x: px, z: pz });
        // 기둥 · 차로 위로 뻗은 팔 · 카메라 · 60 표지판
        g.setColor(0x8a9098); g.cbox(px, Y0 + 3.2, pz, 0.22, 6.4, 0.22);
        const armL = ROAD / 2 - 1.2;
        if (ax === 'x') g.cbox(px, Y0 + 6.2, pz - side * armL / 2, 0.16, 0.16, armL); else g.cbox(px - side * armL / 2, Y0 + 6.2, pz, armL, 0.16, 0.16);
        const cx = ax === 'x' ? px : px - side * (armL - 1), cz = ax === 'x' ? pz - side * (armL - 1) : pz;
        g.setColor(0xe8eaec); g.cbox(cx, Y0 + 5.85, cz, 0.5, 0.45, 0.5);
        g.setColor(0x15181c); g.cbox(cx - dir[0] * 0.26, Y0 + 5.85, cz - dir[1] * 0.26, 0.3, 0.26, 0.3);
        // 제한속도 표지판 (빨간 테두리 원)
        const sx = ax === 'x' ? px - dir[0] * 0.15 : px, sz = ax === 'x' ? pz : pz - dir[1] * 0.15;
        const disk = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20); disk.rotateX(Math.PI / 2); if (ax === 'x') disk.rotateY(Math.PI / 2);
        g.setColor(0xd8262a); g.addGeo(disk.clone().translate(sx, Y0 + 4.6, sz));
        const inner = new THREE.CylinderGeometry(0.33, 0.33, 0.05, 20); inner.rotateX(Math.PI / 2); if (ax === 'x') inner.rotateY(Math.PI / 2);
        g.setColor(0xf6f6f6); g.addGeo(inner.translate(sx, Y0 + 4.6, sz));
      }
    }
    this.mesh = new THREE.Mesh(g.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }));
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    // 표지판 숫자 (60)
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d'); x.fillStyle = '#111'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(LIMIT_KMH), 32, 34);
    const tex = new THREE.CanvasTexture(cv);
    const nm = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.5), nm, this.list.length);
    const o = new THREE.Object3D();
    this.list.forEach((c, i) => {
      o.position.set(c.ax === 'x' ? c.x - c.dir[0] * 0.19 : c.x, Y0 + 4.6, c.ax === 'x' ? c.z : c.z - c.dir[1] * 0.19);
      o.rotation.set(0, Math.atan2(-c.dir[0], -c.dir[1]), 0); o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
    });
    scene.add(inst);
  }
  // 이번 프레임에 카메라 선을 지났는지 (진행 방향 · 차로 쪽)
  check(prev, cur, speed) {
    for (const c of this.list) {
      const along0 = c.ax === 'x' ? prev.x : prev.z, along1 = c.ax === 'x' ? cur.x : cur.z;
      const lat = (c.ax === 'x' ? cur.z : cur.x) - c.c;
      if (Math.sign(lat) !== c.side || Math.abs(lat) > ROAD / 2) continue;
      const mv = c.dir[0] + c.dir[1];
      if ((along0 - c.at) * mv < 0 && (along1 - c.at) * mv >= 0) return { cam: c, kmh: Math.abs(speed) * 3.6 };
    }
    return null;
  }
  // 앞쪽 가까운 단속 카메라 (경고용)
  ahead(pos, heading, r = 140) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    for (const c of this.list) {
      if (fx * c.dir[0] + fz * c.dir[1] < 0.7) continue;
      const lat = (c.ax === 'x' ? pos.z : pos.x) - c.c;
      if (Math.sign(lat) !== c.side || Math.abs(lat) > ROAD / 2) continue;
      const dist = ((c.ax === 'x' ? c.at - pos.x : c.at - pos.z)) * (c.dir[0] + c.dir[1]);
      if (dist > 0 && dist < r) return { cam: c, dist };
    }
    return null;
  }
}

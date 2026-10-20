import * as THREE from 'three';
import { stars as starsTex } from './textures.js';

// 시간대별 색 (시각, 하늘 위, 지평선, 햇빛, 햇빛 세기, 반구광 세기, 안개)
const KEYS = [
  [0, 0x05070f, 0x0b1222, 0x6f86c8, 0.12, 0.55, 0x0a0f1c],
  [4.5, 0x070a16, 0x141a30, 0x6f86c8, 0.12, 0.55, 0x0e1424],
  [5.6, 0x1c2550, 0x8a5a6a, 0xff9a60, 0.3, 0.35, 0x5a4a5a],
  [6.4, 0x3d63a8, 0xf0a070, 0xffb070, 1.1, 0.6, 0xc49a88],
  [8, 0x3f7fd0, 0xbcd6ea, 0xfff0d8, 2.4, 0.9, 0xb9cfe0],
  [12, 0x3a7ad6, 0xc5dcef, 0xfffaf0, 2.9, 1.0, 0xc2d6e8],
  [16.5, 0x3c78cc, 0xc6d4e2, 0xfff0d8, 2.5, 0.9, 0xc0d0de],
  [18.4, 0x3b5a9a, 0xf2a46a, 0xff9550, 1.3, 0.65, 0xd9a07c],
  [19.2, 0x23295a, 0xc0606a, 0xff6a40, 0.45, 0.42, 0x6a4a5a],
  [20.2, 0x0a0e22, 0x1c2242, 0x6f86c8, 0.13, 0.56, 0x141a2c],
  [24, 0x05070f, 0x0b1222, 0x6f86c8, 0.12, 0.55, 0x0a0f1c],
];

const ca = new THREE.Color(), cb = new THREE.Color();
function lerpKey(h, idx) {
  for (let k = 0; k < KEYS.length - 1; k++) {
    const a = KEYS[k], b = KEYS[k + 1];
    if (h >= a[0] && h <= b[0]) {
      const t = (h - a[0]) / (b[0] - a[0]);
      if (typeof a[idx] === 'number' && idx === 4 || idx === 5) return a[idx] + (b[idx] - a[idx]) * t;
      return ca.set(a[idx]).lerp(cb.set(b[idx]), t).clone();
    }
  }
  return KEYS[0][idx];
}

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.uniforms = {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() },
      night: { value: 0 }, stars: { value: starsTex() }, moonDir: { value: new THREE.Vector3() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        uniform vec3 top, horizon, sunDir, sunCol, moonDir; uniform float night; uniform sampler2D stars; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          float t = pow(max(h, 0.0), 0.55);
          vec3 col = mix(horizon, top, t);
          if (h < 0.0) col = mix(horizon, horizon*0.55, clamp(-h*5.0,0.0,1.0));
          float sd = max(dot(d, sunDir), 0.0);
          col += sunCol * (pow(sd, 8.0)*0.35 + pow(sd, 64.0)*0.6) * (1.0 - night*0.7);
          col += sunCol * smoothstep(0.9993, 0.9997, sd) * 6.0 * step(-0.02, sunDir.y);
          float md = max(dot(d, moonDir), 0.0);
          col += vec3(0.85,0.9,1.0) * smoothstep(0.9990, 0.9994, md) * 1.6 * night;
          col += vec3(0.5,0.6,0.8) * pow(md, 30.0) * 0.12 * night;
          vec2 uv = vec2(atan(d.z, d.x)/6.2832 + 0.5, d.y*0.5+0.5);
          float s = texture2D(stars, uv*vec2(2.0,1.0)).r;
          col += vec3(s) * night * smoothstep(0.05, 0.3, h) * 0.9;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x4a4238, 0.8);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xc2d6e8, 80, 1500);

    // 환경맵(반사)
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat);
    this.envScene.add(this.envDome);
    this.envTimer = 999;
    this.envRT = null;
    this.night = 0;
  }

  setShadowQuality(size, range) {
    this.shadowRange = range;
    const s = this.sun.shadow;
    s.mapSize.set(size, size);
    if (s.map) { s.map.dispose(); s.map = null; }
    s.camera.left = -range; s.camera.right = range; s.camera.top = range; s.camera.bottom = -range;
    s.camera.near = 1; s.camera.far = 600;
    s.camera.updateProjectionMatrix();
  }

  update(hours, focus, dt) {
    const h = ((hours % 24) + 24) % 24;
    const sunAng = (h - 6) / 13 * Math.PI; // 6시 일출 ~ 19시 일몰
    const elev = Math.sin(sunAng);
    const azi = (h - 12) / 12 * Math.PI;
    const sd = new THREE.Vector3(Math.sin(azi) * Math.cos(Math.asin(Math.max(-1, Math.min(1, elev)))), elev, -0.45).normalize();
    // 남쪽(-z 아님)으로 기울인 궤도
    sd.set(-Math.cos(sunAng), Math.max(Math.sin(sunAng), -0.4), 0.42).normalize();
    this.uniforms.sunDir.value.copy(sd);
    const md = new THREE.Vector3(Math.cos(sunAng), Math.max(-Math.sin(sunAng), -0.3) + 0.15, -0.35).normalize();
    this.uniforms.moonDir.value.copy(md);
    this.uniforms.top.value.copy(lerpKey(h, 1));
    this.uniforms.horizon.value.copy(lerpKey(h, 2));
    const sunCol = lerpKey(h, 3);
    this.uniforms.sunCol.value.copy(sunCol);
    const night = THREE.MathUtils.clamp((0.15 - sd.y) / 0.3, 0, 1);
    this.night = night;
    this.uniforms.night.value = night;

    const intensity = lerpKey(h, 4);
    const isDay = sd.y > -0.05;
    const dir = isDay ? sd : md;
    this.sun.color.copy(isDay ? sunCol : new THREE.Color(0xaab6d0));
    this.sun.intensity = isDay ? intensity * THREE.MathUtils.clamp(sd.y * 6, 0, 1) + (isDay && sd.y < 0.1 ? 0.1 : 0) : 0.32;
    this.hemi.intensity = lerpKey(h, 5);
    this.hemi.color.copy(this.uniforms.top.value).lerp(new THREE.Color(0xffffff), 0.45);
    this.hemi.groundColor.set(night > 0.5 ? 0x1a1814 : 0x4a4238);
    this.scene.fog.color.copy(lerpKey(h, 6));
    this.scene.fog.far = night > 0.5 ? 1100 : 1500;

    // 그림자 카메라는 플레이어를 따라감 (텍셀 단위로 스냅해서 깜빡임 방지)
    const R = this.shadowRange || 60;
    const tex = (2 * R) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / tex) * tex, fz = Math.round(focus.z / tex) * tex;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + dir.x * 250, Math.max(dir.y, 0.15) * 250, fz + dir.z * 250);
    this.dome.position.copy(focus);

    this.envTimer += dt;
    if (this.envTimer > 20 || (Math.abs(night - (this.envNight ?? -1)) > 0.06 && this.envTimer > 0.5)) { this.envTimer = 0; this.refreshEnv(); }
  }

  refreshEnv() {
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 50);
    this.scene.environment = this.envRT.texture;
    this.envNight = this.night;
    this.scene.environmentIntensity = 0.12 + (1 - this.night) * 0.65;
    if (old) old.dispose();
  }
}

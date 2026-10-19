import * as THREE from 'three';

let maxAniso = 4;
export function setAniso(a) { maxAniso = a; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function rnd(a, b) { return a + Math.random() * (b - a); }

function tex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function noise(ctx, w, h, amount, alpha = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export function asphalt() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#56585c'; x.fillRect(0, 0, 512, 512);
  // 얼룩
  for (let i = 0; i < 60; i++) {
    const r = rnd(20, 90);
    const g = x.createRadialGradient(rnd(0, 512), rnd(0, 512), 0, 256, 256, r);
    x.globalAlpha = rnd(0.03, 0.08);
    x.fillStyle = Math.random() < 0.5 ? '#25272a' : '#4a4c4f';
    x.beginPath(); x.arc(rnd(0, 512), rnd(0, 512), r, 0, 7); x.fill();
  }
  x.globalAlpha = 1;
  noise(x, 512, 512, 34);
  // 균열
  x.strokeStyle = 'rgba(30,30,32,0.28)'; x.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    x.beginPath(); let px = rnd(0, 512), py = rnd(0, 512); x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += rnd(-25, 25); py += rnd(-25, 25); x.lineTo(px, py); }
    x.stroke();
  }
  return tex(c);
}

export function sidewalk() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#9d9a94'; x.fillRect(0, 0, 256, 256);
  const s = 32;
  for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
    const v = rnd(-12, 12);
    const base = (yy + xx) % 3 === 0 ? 150 : 165;
    x.fillStyle = `rgb(${base + v},${base - 4 + v},${base - 10 + v})`;
    x.fillRect(xx * s + 1, yy * s + 1, s - 2, s - 2);
  }
  noise(x, 256, 256, 18);
  return tex(c);
}

export function grass() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#4c6b32'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    x.fillStyle = `hsl(${rnd(75, 105)},${rnd(30, 50)}%,${rnd(22, 38)}%)`;
    x.fillRect(rnd(0, 256), rnd(0, 256), 1.5, rnd(2, 5));
  }
  return tex(c);
}

export function roofTex() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#6d6a66'; x.fillRect(0, 0, 128, 128);
  noise(x, 128, 128, 40);
  return tex(c);
}

// 건물 외벽: 8칸 × 8층 (24m × 28m)
const FACADE = {
  glass: { wall: '#4d5a66', win: ['#6f8aa0', '#5d7a92', '#8aa6bb'], frame: '#2c343c', ww: 0.92, wh: 0.84, lit: 0.35 },
  apt: { wall: '#e4e1d9', win: ['#5b6d78', '#4f5f6a'], frame: '#c9c4ba', ww: 0.62, wh: 0.5, lit: 0.45, balcony: true },
  brick: { wall: '#8e4d36', win: ['#3d4a52', '#34424a'], frame: '#d8d0c0', ww: 0.42, wh: 0.55, lit: 0.4, brick: true },
  beige: { wall: '#c8b79a', win: ['#4a5862', '#56646e'], frame: '#efe8da', ww: 0.55, wh: 0.55, lit: 0.4 },
  dark: { wall: '#2f3236', win: ['#3e5163', '#4a6278'], frame: '#1c1e21', ww: 0.8, wh: 0.7, lit: 0.3 },
  white: { wall: '#d6d8da', win: ['#506270', '#5d7180'], frame: '#9aa0a6', ww: 0.7, wh: 0.45, lit: 0.4 },
};
export const FACADE_KEYS = Object.keys(FACADE);

export function facade(kind) {
  const f = FACADE[kind];
  const S = 512, cols = 8, rows = 8, tw = S / cols, th = S / rows;
  const [c, x] = canvas(S, S);
  const [ce, xe] = canvas(S, S);
  x.fillStyle = f.wall; x.fillRect(0, 0, S, S);
  if (f.brick) {
    for (let yy = 0; yy < S; yy += 6) {
      for (let xx = (yy / 6) % 2 ? -6 : 0; xx < S; xx += 12) {
        x.fillStyle = `rgb(${130 + rnd(-15, 15)},${70 + rnd(-10, 10)},${50 + rnd(-8, 8)})`;
        x.fillRect(xx + 0.5, yy + 0.5, 11, 5);
      }
    }
  }
  noise(x, S, S, 14);
  xe.fillStyle = '#000'; xe.fillRect(0, 0, S, S);
  const warm = ['#ffd9a0', '#ffe7c2', '#fff2d8', '#ffcf86', '#d8ecff', '#fff9ee'];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const wx = col * tw + tw * (1 - f.ww) / 2, wy = r * th + th * (1 - f.wh) / 2;
      const w = tw * f.ww, h = th * f.wh;
      x.fillStyle = f.frame; x.fillRect(wx - 2, wy - 2, w + 4, h + 4);
      const g = x.createLinearGradient(wx, wy, wx + w, wy + h);
      const base = f.win[(r * 7 + col * 3) % f.win.length];
      g.addColorStop(0, base); g.addColorStop(0.6, shade(base, -18)); g.addColorStop(1, shade(base, 10));
      x.fillStyle = g; x.fillRect(wx, wy, w, h);
      // 반사 하이라이트
      x.fillStyle = 'rgba(255,255,255,0.10)';
      x.beginPath(); x.moveTo(wx, wy + h); x.lineTo(wx + w * 0.4, wy); x.lineTo(wx + w * 0.55, wy); x.lineTo(wx + w * 0.15, wy + h); x.fill();
      // 커튼/블라인드
      if (Math.random() < 0.35) { x.fillStyle = 'rgba(230,225,210,0.35)'; x.fillRect(wx, wy, w, h * rnd(0.2, 0.7)); }
      if (f.ww > 0.85) { x.fillStyle = f.frame; x.fillRect(wx + w / 2 - 1, wy, 2, h); }
      // 야간 조명
      if (Math.random() < f.lit) {
        const lc = warm[Math.floor(Math.random() * warm.length)];
        xe.fillStyle = lc; xe.globalAlpha = rnd(0.55, 1);
        xe.fillRect(wx, wy, w, h);
        if (Math.random() < 0.4) { xe.fillStyle = '#000'; xe.globalAlpha = 0.5; xe.fillRect(wx, wy, w, h * rnd(0.2, 0.6)); }
        xe.globalAlpha = 1;
      }
      if (f.balcony) {
        x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(col * tw, r * th + th * 0.78, tw, th * 0.05);
        x.fillStyle = 'rgba(160,170,175,0.55)'; x.fillRect(col * tw, r * th + th * 0.80, tw, th * 0.2);
      }
    }
    // 층 구분선
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, r * th, S, 2);
  }
  return { map: tex(c), emissive: tex(ce), w: 24, h: 28 };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export function sign(text, bg, fg, sub, w = 512, h = 128) {
  const [c, x] = canvas(w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -30));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 4; x.strokeRect(4, 4, w - 8, h - 8);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `800 ${sub ? h * 0.42 : h * 0.55}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  x.fillText(text, w / 2, sub ? h * 0.4 : h / 2 + 4);
  if (sub) { x.font = `600 ${h * 0.2}px sans-serif`; x.globalAlpha = 0.85; x.fillText(sub, w / 2, h * 0.78); }
  const t = tex(c, false);
  return t;
}

export function lightPool() {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,238,215,0.85)');
  g.addColorStop(0.4, 'rgba(255,226,196,0.32)');
  g.addColorStop(1, 'rgba(255,220,190,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return tex(c, false);
}

export function glow() {
  const [c, x] = canvas(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return tex(c, false);
}

export function floorWood() {
  const [c, x] = canvas(256, 256);
  for (let i = 0; i < 8; i++) {
    const v = rnd(-12, 12);
    x.fillStyle = `rgb(${168 + v},${124 + v},${84 + v})`;
    x.fillRect(0, i * 32, 256, 32);
    for (let k = 0; k < 40; k++) {
      x.strokeStyle = `rgba(90,60,30,${rnd(0.05, 0.18)})`;
      x.beginPath(); const yy = i * 32 + rnd(2, 30); x.moveTo(0, yy); x.bezierCurveTo(80, yy + rnd(-3, 3), 160, yy + rnd(-3, 3), 256, yy); x.stroke();
    }
    x.fillStyle = 'rgba(40,25,10,0.5)'; x.fillRect(0, i * 32, 256, 1.5);
    x.fillRect(((i * 97) % 200) + 20, i * 32, 1.5, 32);
  }
  return tex(c);
}

export function wallpaper(color) {
  const [c, x] = canvas(128, 128);
  x.fillStyle = color; x.fillRect(0, 0, 128, 128);
  noise(x, 128, 128, 8);
  return tex(c);
}

export function stars() {
  const [c, x] = canvas(1024, 512);
  x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(255,255,255,${rnd(0.2, 1)})`;
    const s = Math.random() < 0.05 ? 2 : 1;
    x.fillRect(rnd(0, 1024), rnd(0, 512), s, s);
  }
  return tex(c, false);
}

// 1층 상가 유리창 (안쪽 매장이 보이는 느낌) · 가로 4m × 세로 3.6m
export function storefront() {
  const W = 256, H = 230;
  const [c, x] = canvas(W, H);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f6e7c8'); g.addColorStop(0.5, '#d9c3a0'); g.addColorStop(1, '#8a7a66');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 천장 조명
  x.fillStyle = '#fffaf0';
  for (let i = 0; i < 4; i++) x.fillRect(10 + i * 64, 12, 40, 5);
  // 진열대
  const cols = ['#d9433a', '#3a7bd9', '#f2c230', '#3aa860', '#e8e8e8', '#9a5ad9', '#f28a30'];
  for (let r = 0; r < 4; r++) {
    const y = 70 + r * 32;
    x.fillStyle = '#6a5a4a'; x.fillRect(0, y + 22, W, 4);
    for (let k = 0; k < 40; k++) { x.fillStyle = cols[Math.floor(Math.random() * cols.length)]; x.fillRect(k * 6.4 + 1, y + 6 + Math.random() * 6, 5, 16); }
  }
  // 사람 실루엣
  for (let k = 0; k < 2; k++) { const px = 40 + Math.random() * 170; x.fillStyle = 'rgba(40,35,30,0.55)'; x.beginPath(); x.arc(px, 120, 9, 0, 7); x.fill(); x.fillRect(px - 11, 130, 22, 70); }
  // 유리 반사 + 어둡게
  x.fillStyle = 'rgba(20,28,38,0.38)'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,0.12)';
  x.beginPath(); x.moveTo(30, H); x.lineTo(110, 0); x.lineTo(150, 0); x.lineTo(70, H); x.fill();
  // 창틀
  x.fillStyle = '#1c2026'; x.fillRect(0, 0, W, 8); x.fillRect(0, H - 14, W, 14); x.fillRect(0, 0, 6, H); x.fillRect(W / 2 - 3, 0, 6, H); x.fillRect(W - 6, 0, 6, H);
  return tex(c);
}

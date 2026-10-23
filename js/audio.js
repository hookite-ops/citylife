// 소리 슬롯: sounds/<이름>.mp3 파일이 있으면 재생, 없으면 조용히 넘어감.
// 소리 파일은 나중에 받아서 sounds 폴더에 넣으면 바로 적용돼요.
export const SOUND_SLOTS = {
  click: '버튼 누를 때', coin: '돈 받을 때', pay: '결제 완료', bad: '실수·경고', success: '성공·합격', goal: '목표 달성',
  horn: '경적', crash: '충돌', engine: '엔진 (반복)', city: '도시 소음 (반복)', door: '편의점 문 차임',
  pick: '상품 담기', scan: '바코드 삑', scanfail: '바코드 인식 실패', card: '카드 결제', clockin: '출근 찍기',
  restock: '진열', mop: '걸레질', spill: '음료 쏟음', truck: '물류 트럭',
  pour: '물 붓기', microwave: '전자레인지 (돌아감)', ding: '전자레인지 땡', kettle: '전기포트',
  water: '수돗물', gas_on: '가스불 켜기', gas_off: '가스불 끄기', boil: '물 끓음', sizzle: '지글지글', plop: '재료 넣기', stir: '휘젓기',
  alarm: '알람', snore: '잠자기', light: '전등 스위치', jump: '점프', land: '착지', step: '발소리 (반복)', skid: '타이어 미끄러짐', toggle: '토글', open: '열기', close: '닫기', rain: '빗소리 (반복)',
};

export class Audio {
  constructor() { this.ctx = null; this.on = true; this.buf = {}; this.missing = new Set(); this.loops = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(this.ctx.destination);
    this.list = null;
    fetch('sounds/sounds.json').then(r => r.ok ? r.json() : []).then(a => { this.list = new Set(a); for (const n of a) this.load(n); }).catch(() => { this.list = new Set(); });
  }
  setEnabled(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.8 : 0; }
  async load(name) {
    if (this.buf[name] || this.missing.has(name) || !this.ctx || !this.list || !this.list.has(name)) return this.buf[name];
    this.missing.add(name); // 중복 요청 방지
    try {
      const r = await fetch(`sounds/${name}.mp3`);
      if (!r.ok) return null;
      const data = await r.arrayBuffer();
      this.buf[name] = await this.ctx.decodeAudioData(data);
      this.missing.delete(name);
      return this.buf[name];
    } catch (e) { return null; }
  }
  play(name, vol = 1, rate = 1) {
    if (!this.ctx || !this.on) return;
    const b = this.buf[name];
    if (!b) { this.load(name); return; }
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.master); s.start();
  }
  loop(name, vol, rate = 1) {
    if (!this.ctx) return;
    let l = this.loops[name];
    if (!l) {
      const b = this.buf[name];
      if (!b) { this.load(name); return; }
      const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true;
      // mp3 앞뒤 무음 때문에 끊기지 않게 반복 구간을 살짝 안쪽으로
      if (b.duration > 0.5) { s.loopStart = Math.min(0.06, b.duration * 0.05); s.loopEnd = b.duration - Math.min(0.06, b.duration * 0.05); }
      const g = this.ctx.createGain(); g.gain.value = 0;
      s.connect(g); g.connect(this.master); s.start();
      l = this.loops[name] = { s, g };
    }
    l.g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2);
    l.s.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.1);
  }
  // 기존 호출 호환
  click() { this.play('click', 0.6); }
  coin() { this.play('coin'); }
  beep() { this.play('scan'); }
  bad() { this.play('bad'); }
  chime() { this.play('goal'); }
  horn() { this.play('horn'); }
  crash(v = 1) { this.play('crash', v); }
  tone() {}
  ambient(night, inside) { this.loop('city', inside ? 0.05 : night ? 0.25 : 0.45); }
  engine(active, speed, throttle, maxSpeed) {
    const r = Math.min(1, Math.abs(speed) / (maxSpeed || 30));
    this.loop('engine', active ? 0.35 + r * 0.4 : 0, 0.7 + r * 1.1 + Math.abs(throttle) * 0.1);
  }
}

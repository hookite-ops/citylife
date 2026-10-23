// ───────── ⑤ 결과가 남는 선택: 건강 (식사 · 잠 · 운동 · 군것질이 쌓여요) ─────────
import { toast } from './ui.js';
import * as ST from './state.js';

const JUNK = /라면|콜라|과자|칩|젤리|에너지|초코|햄버거|버거|치킨|피자|핫도그|솜사탕|탕후루|떡볶이|아이스|콘|바$/;
const GOOD = /샐러드|과일|사과|바나나|귤|딸기|수박|김치|나물|비빔|두부|생선|채소|우유|주스|정식|백반|국밥|된장/;

export class Health {
  constructor(ctx) { this.c = ctx; }   // { S }
  get S() { return this.c.S; }
  hd() {
    const S = this.S, day = ST.day(S);
    if (S.health == null) S.health = 70;
    if (!S.hd) S.hd = { day, meals: 0, junk: 0, good: 0, sleep: 0, fit0: S.fitness || 0, ex: 0 };
    return S.hd;
  }
  // 무엇을 먹었는지
  eat(f) {
    if (!f) return;
    const h = this.hd(), name = f.name || '';
    if ((f.hunger || 0) >= 12) h.meals++;
    if (f.id === 'energy' || JUNK.test(name)) h.junk++;
    else if (GOOD.test(name) || f.tag === 'veg' || f.tag === 'dessert' && /과일|딸기|사과/.test(name)) h.good++;
  }
  sleep(hours) { this.hd().sleep += hours; }
  exercise() { this.hd().ex++; }
  // 하루가 지나면 정산 (main의 날짜 확인에서 불러요)
  daily() {
    const S = this.S, h = this.hd(), day = ST.day(S);
    if (h.day === day) return;
    const ex = h.ex + Math.max(0, (S.fitness || 0) - h.fit0);
    let d = 0; const why = [];
    if (h.meals >= 2) { d += 3; why.push(`🍚 식사 ${h.meals}번`); } else if (h.meals === 0) { d -= 6; why.push('🍚 굶었어요'); } else { d -= 1; why.push('🍚 한 끼만'); }
    if (h.sleep >= 6.5 && h.sleep <= 10) { d += 3; why.push(`😴 ${h.sleep.toFixed(1)}시간`); } else if (h.sleep < 5) { d -= 5; why.push(`😴 ${h.sleep.toFixed(1)}시간 (부족)`); }
    if (h.junk >= 3) { d -= 4; why.push(`🍟 군것질 ${h.junk}번`); }
    if (h.good >= 1) { d += 2; why.push('🥗 건강식'); }
    if (ex > 0) { d += 4; why.push('💪 운동'); }
    if (S.sick) d -= 2;
    const before = Math.round(S.health);
    S.health = ST.clamp(S.health + d);
    const after = Math.round(S.health);
    S.hd = { day, meals: 0, junk: 0, good: 0, sleep: 0, fit0: S.fitness || 0, ex: 0 };
    if (day > 1) toast(`${after >= 70 ? '💚' : after >= 40 ? '💛' : '❤️‍🩹'} 건강 ${after} (${d >= 0 ? '+' : ''}${after - before}) · ${why.join(' · ')}`, d >= 0 ? 'good' : 'bad', 4600);
    // 결과: 건강하면 기분 · 체력 좋아지고, 나쁘면 잘 아파요
    if (S.health >= 80) S.mood = ST.clamp(S.mood + 4);
    if (S.health < 35 && !S.sick && Math.random() < 0.4) { S.sick = { days: 2 }; toast('🤒 몸이 안 좋아요… 건강 관리가 필요해요 (잘 먹고 · 푹 자고 · 운동)', 'bad', 4200); }
  }
  label() { const v = Math.round(this.S.health ?? 70); return `${v >= 70 ? '💚' : v >= 40 ? '💛' : '❤️‍🩹'} ${v}`; }
  // 건강이 나쁘면 에너지가 빨리 줄어요 (분당 배율)
  drain() { const v = this.S.health ?? 70; return v < 35 ? 1.25 : v > 80 ? 0.9 : 1; }
}

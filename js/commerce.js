// ───────── 공통 틀: 지갑(현금·카드) · 결제 · ATM · 영업시간 ─────────
import { won } from './config.js';
import { openSheet, closeSheet, bindActs, toast } from './ui.js';

// S.money = 통장(카드·간편결제가 여기서 빠져나가요), S.cash = 지갑 속 현금
export function ensureWallet(S) {
  if (typeof S.cash !== 'number' || !Number.isFinite(S.cash)) S.cash = 20000;
  if (!S.payPref) S.payPref = 'card';
}

// 현금으로 낼 때 실제로 건네는 돈 (지폐 단위로 올림) → 거스름돈
function handOver(total, cash) {
  // 지갑에 있는 돈으로 낼 수 있는 가장 자연스러운 금액
  const opts = [total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000];
  const ok = opts.filter(g => g <= cash);
  // 동전이 넉넉하면 딱 맞게, 아니면 지폐로
  const coins = cash % 1000;
  if (coins >= total % 1000 && ok.includes(total)) return total;
  return ok.find(g => g > total) ?? total;
}

/**
 * 결제창
 * ctx: { S, audio, flash(good), persist }
 * opts: { title, icon, sub, lines: html, cashOnly, cardOnly, onPaid(method), onCancel, staff }
 */
export function paySheet(ctx, total, opts = {}) {
  const S = ctx.S;
  ensureWallet(S);
  let paid = false;
  const done = (method) => {
    if (method === 'cash') {
      if (S.cash < total) { ctx.audio?.bad?.(); toast(`💵 현금이 모자라요 (지갑 ${won(S.cash)}) · ATM에서 뽑아 오세요`, 'bad', 3600); return; }
      const g = handOver(total, S.cash);
      S.cash -= total;
      paid = true; closeSheet();
      toast(`💵 ${won(g)} 냈어요${g > total ? ` · 거스름돈 ${won(g - total)}` : ''}`, 'good');
    } else {
      if (S.money < total) {
        ctx.audio?.bad?.();
        toast(method === 'easy' ? '📱 결제 실패 · 연결된 통장 잔액이 부족해요' : '💳 "카드 승인이 거절됐어요" · 잔액 부족', 'bad', 3600);
        return;
      }
      S.money -= total;
      paid = true; closeSheet();
      toast(method === 'easy' ? `📱 삑! 간편결제 ${won(total)}` : `💳 카드 결제 ${won(total)} · 영수증 드릴까요?`, 'good');
    }
    S.payPref = method;
    ctx.audio?.play?.('pay');
    ctx.flash?.(false);
    opts.onPaid?.(method);
    ctx.persist?.();
  };
  const can = { card: !opts.cashOnly, easy: !opts.cashOnly, cash: !opts.cardOnly };
  const btn = (m, label, sub, bal) => `<button class="btn wide ${can[m] ? (S.payPref === m ? 'green' : '') : 'gray'}" data-act="m:${m}" ${can[m] ? '' : 'disabled'} style="display:flex;justify-content:space-between;align-items:center">
      <span>${label}</span><small style="opacity:.8;font-weight:600">${can[m] ? sub + ' ' + won(bal) : sub}</small></button>`;
  openSheet({
    icon: opts.icon || '💳', title: opts.title || '계산하기', sub: opts.sub || '',
    html: (opts.lines || '') +
      `<div class="row" style="background:rgba(70,209,255,0.1)"><div class="info"><b>결제할 금액</b>${opts.cashOnly ? '<span>🪙 현금만 받아요</span>' : opts.cardOnly ? '<span>현금은 안 받아요</span>' : ''}</div><div class="price" style="font-size:18px">${won(total)}</div></div>` +
      btn('card', '💳 카드', '통장', S.money) +
      btn('easy', '📱 간편결제', '통장', S.money) +
      btn('cash', '💵 현금', '지갑', S.cash) +
      (opts.cashOnly && S.cash < total ? '<p class="note" style="color:var(--bad)">현금이 모자라요. 편의점 ATM에서 뽑을 수 있어요.</p>' : ''),
    bind: (b) => bindActs(b, { m: (m) => done(m) }),
    onClose: () => { if (!paid) opts.onCancel?.(); },
  });
}

// ───────── ATM ─────────
export function atmSheet(ctx, { name = '편의점 ATM', fee = 1300 } = {}) {
  const S = ctx.S;
  ensureWallet(S);
  const open = () => openSheet({
    icon: '🏧', title: name, sub: fee ? `출금·입금 수수료 ${won(fee)}` : '수수료 없음',
    html: `<div class="grid2" style="margin-bottom:10px"><div class="stat"><span>💳 통장 잔액</span><b>${won(S.money)}</b></div><div class="stat"><span>💵 지갑 현금</span><b>${won(S.cash)}</b></div></div>
      <div class="note" style="color:#ddd">현금 뽑기</div>
      <div class="tabs">${[10000, 30000, 50000, 100000].map(a => `<button data-act="out:${a}" ${S.money < a + fee ? 'disabled' : ''}>${a / 10000}만 원</button>`).join('')}</div>
      <div class="note" style="color:#ddd;margin-top:10px">통장에 넣기</div>
      <div class="tabs">${[10000, 50000].map(a => `<button data-act="in:${a}" ${S.cash < a || S.money + a < fee ? 'disabled' : ''}>${a / 10000}만 원</button>`).join('')}<button data-act="in:all" ${S.cash < 1000 ? 'disabled' : ''}>지폐 전부</button></div>`,
    bind: (b) => bindActs(b, {
      out: (a) => {
        a = +a;
        if (S.money < a + fee) return toast('잔액이 부족해요', 'bad');
        S.money -= a + fee; S.cash += a;
        ctx.audio?.play?.('pay'); ctx.flash?.(true);
        toast(`🏧 ${won(a)} 뽑았어요${fee ? ` (수수료 ${won(fee)})` : ''}`, 'good');
        ctx.persist?.(); open();
      },
      in: (a) => {
        a = a === 'all' ? Math.floor(S.cash / 1000) * 1000 : +a;
        if (S.cash < a || a <= 0) return;
        S.cash -= a; S.money += a - fee;
        ctx.audio?.play?.('pay'); ctx.flash?.(true);
        toast(`🏧 ${won(a)} 입금했어요${fee ? ` (수수료 ${won(fee)})` : ''}`, 'good');
        ctx.persist?.(); open();
      },
    }),
  });
  open();
}

// ───────── 영업시간 ─────────
// [여는 시각, 닫는 시각] (시 단위, 24 넘으면 다음 날 새벽), days: 쉬는 요일(0=월)
export const HOURS = {
  mart: { open: 0, close: 24, name: '24 마트' },
  stat: { open: 8, close: 21, name: '문구랜드' },
  rest: { open: 11, close: 22, name: '한끼식당', breakFrom: 15, breakTo: 17 },
  gym: { open: 0, close: 24, name: '핏라이프' },
  realty: { open: 9, close: 19, name: '행복 부동산', off: [6] },
  cars: { open: 10, close: 20, name: '드림모터스' },
  furn: { open: 10, close: 21, name: '홈데코' },
  delivery: { open: 0, close: 24, name: '번개배달 센터' },
};
const hm = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
export function hoursText(key) {
  const H = HOURS[key];
  if (!H) return '';
  if (H.open === 0 && H.close === 24) return '24시간 영업';
  return `${hm(H.open)} ~ ${hm(H.close)}${H.breakFrom ? ` · 브레이크타임 ${hm(H.breakFrom)}~${hm(H.breakTo)}` : ''}${H.off ? ` · ${H.off.map(d => '월화수목금토일'[d]).join('')}요일 휴무` : ''}`;
}
// hour: 0~24 (소수), weekday: 0=월
export function openStatus(key, hour, weekday = 0) {
  const H = HOURS[key];
  if (!H || (H.open === 0 && H.close === 24)) return { open: true, minsToClose: Infinity, reason: '' };
  if (H.off?.includes(weekday)) return { open: false, minsToClose: 0, reason: '오늘은 쉬는 날이에요' };
  let h = hour;
  if (H.close > 24 && h < H.close - 24) h += 24;
  if (h < H.open) return { open: false, minsToClose: 0, reason: `아직 문을 안 열었어요 (${hm(H.open)} 오픈)` };
  if (h >= H.close) return { open: false, minsToClose: 0, reason: '오늘 영업이 끝났어요' };
  if (H.breakFrom && h >= H.breakFrom && h < H.breakTo) return { open: false, minsToClose: 0, reason: `브레이크타임이에요 (${hm(H.breakTo)}에 다시 열어요)` };
  const end = H.breakFrom && h < H.breakFrom ? H.breakFrom : H.close;
  return { open: true, minsToClose: (end - h) * 60, reason: '' };
}
// 닫혀 있을 때 문 앞 안내문
export function closedNotice(key, st) {
  const H = HOURS[key];
  openSheet({
    icon: '🔒', title: `${H?.name || ''} · 영업 준비 중`, sub: st.reason,
    html: `<div class="row"><div class="ic">🕘</div><div class="info"><b>영업시간</b><span>${hoursText(key)}</span></div></div>
      <p class="note">문 앞에 안내문이 붙어 있어요. 영업시간에 다시 와 주세요.</p>`,
  });
}
// 안에 있을 때 마감 알림 (매 프레임 호출) → 'warn' | 'closed' | null
export class ClosingWatch {
  constructor() { this.key = null; this.warned = false; this.closed = false; }
  reset(key) { this.key = key; this.warned = false; this.closed = false; }
  tick(hour, weekday) {
    if (!this.key) return null;
    const st = openStatus(this.key, hour, weekday);
    if (st.open && st.minsToClose <= 30 && !this.warned) { this.warned = true; return 'warn'; }
    if (!st.open && !this.closed) { this.closed = true; return 'closed'; }
    return null;
  }
}

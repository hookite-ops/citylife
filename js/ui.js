// DOM 도우미: 시트, 토스트, 페이드
export const $ = (id) => document.getElementById(id);

let audioRef = null;
export function setAudio(a) { audioRef = a; }

export function toast(text, type = '', ms = 2600) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = text;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
}

const sheet = $('sheet');
let sheetClose = null;
export function openSheet({ icon = '', title = '', sub = '', html = '', bind, onClose }) {
  sheet.querySelector('.sh-icon').textContent = icon;
  sheet.querySelector('h2').textContent = title;
  sheet.querySelector('.sh-titles p').textContent = sub;
  const body = sheet.querySelector('.sheet-body');
  body.innerHTML = html;
  body.scrollTop = 0;
  sheet.classList.remove('hidden');
  sheetClose = onClose || null;
  if (bind) bind(body);
  return body;
}
export function closeSheet() {
  if (sheet.classList.contains('hidden')) return;
  sheet.classList.add('hidden');
  const f = sheetClose; sheetClose = null;
  if (f) f();
}
export function sheetOpen() { return !sheet.classList.contains('hidden'); }
sheet.querySelector('.x').addEventListener('click', () => { audioRef?.click(); closeSheet(); });
sheet.addEventListener('pointerdown', (e) => { if (e.target === sheet) closeSheet(); });

export function fade(on) {
  $('fade').classList.toggle('on', on);
  return new Promise(r => setTimeout(r, 480));
}
export function bigMsg(text, sub = '', ms = 2200) {
  const el = $('bigmsg');
  el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), ms);
}
export const wait = (ms) => new Promise(r => setTimeout(r, ms));

export function row({ icon, title, desc, price, btn, btnClass = '', disabled = false, action, extra = '' }) {
  return `<div class="row"><div class="ic">${icon}</div><div class="info"><b>${title}</b><span>${desc || ''}</span></div>${price ? `<div class="price">${price}</div>` : ''}${extra}${btn ? `<button class="btn ${btnClass}" data-act="${action}" ${disabled ? 'disabled' : ''}>${btn}</button>` : ''}</div>`;
}
export function bindActs(root, handlers) {
  root.querySelectorAll('[data-act]').forEach(b => {
    b.addEventListener('click', () => {
      const [name, arg] = b.dataset.act.split(':');
      audioRef?.click();
      handlers[name]?.(arg, b);
    });
  });
}

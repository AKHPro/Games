/* Small UI helpers: escaping, icons, toast, bottom sheet, confirm. */
import { ICONS } from './icons.js';
import { avatar } from './avatars.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ico = (name, size = 22, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" ${extra}>${ICONS[name] || ''}</svg>`;
export { avatar };
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const clock = (ms) => new Date(ms).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
export const dateShort = (ms) => new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) + ' ' + clock(ms);
export const num = (t) => `<bdi dir="ltr">${esc(t)}</bdi>`;
export const fmtKm = (km) => (Math.round(km * 10) / 10).toFixed(1);

export function logoLockup() {
  return `<div class="brand-lockup"><svg width="28" height="28" viewBox="0 0 128 128" aria-hidden="true"><rect width="128" height="128" rx="30" fill="#FF4D28"/><circle cx="38" cy="90" r="13.5" fill="#fff"/><path d="M38 76.5C46 40 72 26 86.5 40" fill="none" stroke="#fff" stroke-width="11.5" stroke-linecap="round"/><path fill="#fff" d="M94 79.5C94 79.5 73.5 58.5 73.5 43.5A20.5 20.5 0 1 1 114.5 43.5C114.5 58.5 94 79.5 94 79.5Z"/><circle cx="94" cy="42" r="7.8" fill="#FF4D28"/></svg><span class="word">Get<span class="n4">4</span>You</span></div>`;
}

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/** Bottom sheet. Returns {el, close}. */
export function openSheet(html, { onClose, cls = '' } = {}) {
  const host = document.getElementById('sheet-host');
  closeSheet();
  host.innerHTML = `<div class="scrim" data-close></div><div class="modal-sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-handle"></div>${html}</div>`;
  host.classList.add('open');
  const close = () => { host.classList.remove('open'); host.innerHTML = ''; onClose && onClose(); };
  host._close = close;
  host.querySelector('[data-close]').addEventListener('click', close);
  return { el: host.querySelector('.modal-sheet'), close };
}
export function closeSheet() {
  const host = document.getElementById('sheet-host');
  if (host._close) { const c = host._close; host._close = null; c(); }
}
export function confirmSheet({ title, text, okLabel, danger }) {
  return new Promise((resolve) => {
    const s = openSheet(`<h3 class="sheet-title">${esc(title)}</h3><p class="sheet-text">${esc(text)}</p>
      <div class="action-btns"><button class="btn ${danger ? 'btn-danger-ghost' : 'btn-primary'}" data-ok>${esc(okLabel)}</button><button class="btn btn-ghost" data-no>ביטול</button></div>`, { onClose: () => resolve(false) });
    s.el.querySelector('[data-ok]').addEventListener('click', () => { const host = document.getElementById('sheet-host'); host._close = null; host.classList.remove('open'); host.innerHTML = ''; resolve(true); });
    s.el.querySelector('[data-no]').addEventListener('click', () => s.close());
  });
}

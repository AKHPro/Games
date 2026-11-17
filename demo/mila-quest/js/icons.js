/* v12: drawn SVG icons for the game UI. Classroom PCs (old Windows) show modern emoji as empty squares,
   so every UI emoji is swapped for an inline SVG. Word pictures (content) are left alone. */
const S = (body, vb = "0 0 24 24", cls = "") => `<svg class="ui-ico ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const K = 'stroke="#2b1a08" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
export const UI_ICON = {
  heart: S(`<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="#ff3d5a" ${K}/><path d="M8 9.2a2 2 0 0 1 2.2-1" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>`, undefined, "heart"),
  heartOff: S(`<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="#3a3346" stroke="#140818" stroke-width="1.5" stroke-linejoin="round"/>`, undefined, "heart"),
  star: S(`<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="#ffd23d" ${K}/>`),
  bigStar: S(`<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="#ffd23d" ${K}/>`, undefined, "big"),
  bigStarOff: S(`<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="#ffffff55" stroke="#ffffffaa" stroke-width="1.5" stroke-linejoin="round"/>`, undefined, "big"),
  flame: S(`<path d="M12 21.5c-4 0-6.5-2.7-6.5-6.3 0-4.4 4-6.4 4.4-11 2.8 1.8 4.3 4.4 4.3 6.6 1-.6 1.6-1.7 1.8-2.9 1.6 1.6 2.5 4 2.5 6.6 0 4.3-2.7 7-6.5 7z" fill="#ff7a1a" ${K}/><path d="M12 21c-1.8 0-3-1.2-3-2.9 0-2 1.8-3 2.3-5 1.6 1.2 3.7 2.6 3.7 4.9 0 1.8-1.3 3-3 3z" fill="#ffd23d"/>`),
  key: S(`<circle cx="8" cy="12" r="4.2" fill="#ffd23d" ${K}/><circle cx="8" cy="12" r="1.5" fill="#fff"/><path d="M12 12h9M18 12v3M21 12v2.5" fill="none" stroke="#2b1a08" stroke-width="2.2" stroke-linecap="round"/>`),
  lock: S(`<rect x="5" y="10.5" width="14" height="10" rx="2" fill="#ffd23d" ${K}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#2b1a08" stroke-width="2"/><circle cx="12" cy="15.5" r="1.6" fill="#2b1a08"/>`),
  speaker: S(`<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff" ${K}/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="#2b1a08" stroke-width="1.8" stroke-linecap="round"/>`),
  mute: S(`<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff" ${K}/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="#d12f2f" stroke-width="2.2" stroke-linecap="round"/>`),
  gear: S(`<path d="M12 2.8l1.6 2.3 2.7-.6.6 2.7 2.3 1.6-1.2 2.5 1.2 2.5-2.3 1.6-.6 2.7-2.7-.6L12 21.2l-1.6-2.3-2.7.6-.6-2.7-2.3-1.6 1.2-2.5-1.2-2.5 2.3-1.6.6-2.7 2.7.6z" fill="#cfd8e6" ${K}/><circle cx="12" cy="12" r="3.2" fill="#fff" ${K}/>`),
  map: S(`<path d="M3 6l6-2.5 6 2.5 6-2.5v14.5L15 20.5l-6-2.5L3 20.5z" fill="#bfe6a0" ${K}/><path d="M9 3.5v14.5M15 6v14.5" stroke="#2b1a08" stroke-width="1.3"/><path d="M5.5 14l2-2 2 1.5" stroke="#d12f2f" stroke-width="1.4" fill="none" stroke-dasharray="1.6 1.4"/>`),
  help: S(`<circle cx="12" cy="12" r="9.3" fill="#5ab0ff" ${K}/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9v.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.3" fill="#fff"/>`),
  pause: S(`<rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="#fff" ${K}/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="#fff" ${K}/>`),
  owl: S(`<path d="M5 7l2.5 1.5h9L19 7v8.5a7 7 0 0 1-14 0z" fill="#a0723e" ${K}/><circle cx="9.2" cy="11.5" r="2.6" fill="#fff" ${K}/><circle cx="14.8" cy="11.5" r="2.6" fill="#fff" ${K}/><circle cx="9.2" cy="11.7" r="1.1" fill="#2b1a08"/><circle cx="14.8" cy="11.7" r="1.1" fill="#2b1a08"/><path d="M11 14.4l1 1.5 1-1.5z" fill="#ffb02a" ${K}/>`),
  repeat: S(`<path d="M5 11a6 6 0 0 1 10.5-4M19 13a6 6 0 0 1-10.5 4" fill="none" stroke="#2b1a08" stroke-width="2" stroke-linecap="round"/><path d="M15 3.5l1 3.8-3.8.6M9 20.5l-1-3.8 3.8-.6" fill="none" stroke="#2b1a08" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  globe: S(`<circle cx="12" cy="12" r="9" fill="#5ab0ff" ${K}/><path d="M7 7.5c2 .5 2.5 2 1.5 3.5s.5 3 2 3.5-.5 3.5-1 4.5M14.5 4c-.5 1.5.5 2.5 2 2.5s2 2 .5 3-1 3 .5 3.5" fill="#6ad06a" stroke="#2b1a08" stroke-width="1.2"/>`),
  book: S(`<path d="M4 5.5c3-1 5.5-.8 8 1 2.5-1.8 5-2 8-1v13c-3-1-5.5-.8-8 1-2.5-1.8-5-2-8-1z" fill="#fff6dc" ${K}/><path d="M12 6.5v13" stroke="#2b1a08" stroke-width="1.4"/>`),
  target: S(`<circle cx="12" cy="12" r="9" fill="#ff5a5a" ${K}/><circle cx="12" cy="12" r="6" fill="#fff"/><circle cx="12" cy="12" r="3" fill="#ff5a5a"/>`),
  screen: S(`<rect x="3" y="4.5" width="18" height="12" rx="2" fill="#5ab0ff" ${K}/><path d="M9 20.5h6M12 16.5v4" stroke="#2b1a08" stroke-width="1.8" stroke-linecap="round"/>`),
  bolt: S(`<path d="M13.5 2.5L5 13.5h6l-1.5 8 8.5-11h-6z" fill="#ffd23d" ${K}/>`),
  trophy: S(`<path d="M7 3.5h10v4.2a5 5 0 0 1-10 0z" fill="#ffd43b" ${K}/><path d="M7 5.5H4.2a3 3 0 0 0 3.3 4.2M17 5.5h2.8a3 3 0 0 1-3.3 4.2" fill="none" stroke="#2b1a08" stroke-width="1.5"/><path d="M12 12.7v3.3" stroke="#2b1a08" stroke-width="1.8"/><path d="M8.5 20.5h7l-.8-3.6H9.3z" fill="#ffd43b" ${K}/>`),
  flag: S(`<path d="M5 21V3.5" stroke="#2b1a08" stroke-width="2" stroke-linecap="round"/><path d="M5.5 4h13v9h-13z" fill="#fff" ${K}/><path d="M5.5 4h3.3v3H12V4h3.3v3h3.2v3h-3.2v3H12v-3H8.8v3H5.5v-3h3.3V7H5.5z" fill="#2b1a08"/>`),
  sparkle: S(`<path d="M12 2.5l2.2 7.3L21.5 12l-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z" fill="#ffd23d" ${K}/>`),
  headphones: S(`<path d="M4 15v-3a8 8 0 0 1 16 0v3" fill="none" stroke="#2b1a08" stroke-width="2"/><rect x="3" y="13" width="4.5" height="7" rx="1.8" fill="#8a5cff" ${K}/><rect x="16.5" y="13" width="4.5" height="7" rx="1.8" fill="#8a5cff" ${K}/>`),
  swords: S(`<path d="M4 4l10 10M20 4L10 14" stroke="#cfd8e6" stroke-width="3" stroke-linecap="round"/><path d="M4 4l10 10M20 4L10 14" stroke="#2b1a08" stroke-width="1" stroke-linecap="round"/><path d="M12.5 16.5l3-3M11.5 16.5l-3-3M16 18l2 2M8 18l-2 2" stroke="#a0723e" stroke-width="2.4" stroke-linecap="round"/>`),
  check: S(`<circle cx="12" cy="12" r="9" fill="#2fb86a" ${K}/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  medal: S(`<path d="M8 2.5h3l1 5-2.5 1zM16 2.5h-3l-1 5 2.5 1z" fill="#5ab0ff" ${K}/><circle cx="12" cy="15" r="6" fill="#ffd23d" ${K}/><path d="M12 12l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" fill="#fff6c4"/>`),
  teacher: S(`<circle cx="12" cy="7.5" r="3.6" fill="#f2c9a0" ${K}/><path d="M5 20.5c0-4.5 3-7.5 7-7.5s7 3 7 7.5z" fill="#6a46d6" ${K}/>`),
  user: S(`<circle cx="12" cy="8" r="4" fill="#fff" ${K}/><path d="M4.5 20.5c0-4.2 3.3-7 7.5-7s7.5 2.8 7.5 7z" fill="#fff" ${K}/>`),
  bulb: S(`<path d="M12 3a6 6 0 0 1 3.6 10.8c-.6.5-1 1.2-1 2v1H9.4v-1c0-.8-.4-1.5-1-2A6 6 0 0 1 12 3z" fill="#ffe066" ${K}/><path d="M9.5 19.5h5M10.5 21.5h3" stroke="#2b1a08" stroke-width="1.6" stroke-linecap="round"/>`),
  notebook: S(`<rect x="5" y="3" width="14" height="18" rx="2" fill="#ffd23d" ${K}/><path d="M8 3v18M11 8h5M11 11.5h5" stroke="#2b1a08" stroke-width="1.4"/>`),
  arrowL: S(`<path d="M19 12H6M11 6.5L5.5 12l5.5 5.5" fill="none" stroke="#2b1a08" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  arrowR: S(`<path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" fill="none" stroke="#2b1a08" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  shop: S(`<path d="M4 9h16l-1.5 11h-13z" fill="#ffd43b" ${K}/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="#2b1a08" stroke-width="1.8"/>`),
  shield: S(`<path d="M12 2.8l7.5 2.7v5.5c0 4.8-3.3 8.3-7.5 10.2-4.2-1.9-7.5-5.4-7.5-10.2V5.5z" fill="#2fb8ff" ${K}/><path d="M13 6.5l-4 6h3l-1 5 4.2-6.5h-3z" fill="#fff6a0"/>`, undefined, "heart"),
  life: S(`<circle cx="12" cy="12" r="7.5" fill="none" stroke="#ff4d4d" stroke-width="4.2"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="#fff" stroke-width="4.2" stroke-dasharray="3.9 3.95"/><circle cx="12" cy="12" r="9.6" fill="none" stroke="#2b1a08" stroke-width="1"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="#2b1a08" stroke-width="1"/>`),
  wand: S(`<path d="M4 20L15 9" stroke="#2b1a08" stroke-width="2.6" stroke-linecap="round"/><path d="M17 2.5l1.1 3 3 1.1-3 1.1L17 10.7l-1.1-3-3-1.1 3-1.1z" fill="#ffd23d" ${K}/>`),
  // worlds
  w1: S(`<path d="M12 21V11" stroke="#7a4a1a" stroke-width="2.4" stroke-linecap="round"/><path d="M12 11c-2-3-5.5-3.6-8-2.2 2.6-.1 4.8.8 6.3 2.4M12 11c2-3 5.5-3.6 8-2.2-2.6-.1-4.8.8-6.3 2.4M12 11c-.5-3.3 1-6 3.5-7.4-1.3 2.3-1.8 4.5-1.6 6.8M12 11c-1.8-2.5-4.6-3.6-7.2-3" fill="#2fb86a" stroke="#14592f" stroke-width="1.6" stroke-linecap="round"/>`),
  w2: S(`<path d="M6 21V3" stroke="#2b1a08" stroke-width="2" stroke-linecap="round"/><path d="M6.5 4h12l-2.5 4 2.5 4h-12z" fill="#2b2433" ${K}/><circle cx="11.5" cy="7.6" r="1.8" fill="#fff"/><path d="M9.5 10.5l4 0" stroke="#fff" stroke-width="1.2"/>`),
  w3: S(`<path d="M4 21V9l2-1.5L8 9v-4l2-1.5L12 5v-2l2 1.5V9l2-1.5L18 9v-2l2 1.5V21z" fill="#c9a6ff" ${K}/><path d="M10 21v-4a2 2 0 0 1 4 0v4" fill="#6a46d6"/>`),
  w4: S(`<path d="M12 2.5c3 2.5 4.5 6 4.5 10l-2 3h-5l-2-3c0-4 1.5-7.5 4.5-10z" fill="#e8eef8" ${K}/><circle cx="12" cy="9.5" r="2" fill="#5ab0ff" ${K}/><path d="M7.5 12.5L5 16l3 .5M16.5 12.5L19 16l-3 .5" fill="#ff5a5a" ${K}/><path d="M10 16.5l2 4.5 2-4.5" fill="#ffb02a"/>`),
  w5: S(`<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" stroke="#5ab0ff" stroke-width="2.2" stroke-linecap="round"/><path d="M9.5 3.8L12 6l2.5-2.2M9.5 20.2L12 18l2.5 2.2" fill="none" stroke="#5ab0ff" stroke-width="1.8" stroke-linecap="round"/>`),
  w6: S(`<path d="M2.5 20.5L10 6l7.5 14.5z" fill="#f2c46a" ${K}/><path d="M12 20.5l5-9.5 4.5 9.5z" fill="#e0a84a" ${K}/><circle cx="18.5" cy="5" r="2" fill="#ffb02a"/>`),
  w7: S(`<path d="M3 12c3-4 9-5.5 13-1.5l4-3v9l-4-3c-4 4-10 2.5-13-1.5z" fill="#ff8a3a" ${K}/><circle cx="7.5" cy="11.2" r="1.1" fill="#2b1a08"/><path d="M11 9v6" stroke="#fff" stroke-width="1.6"/>`),
  w8: S(`<path d="M2.5 20.5L9 9h6l6.5 11.5z" fill="#6a4a3a" ${K}/><path d="M9 9l1.5 3 1.5-2 1.5 2L15 9z" fill="#ff5a1a"/><path d="M10.5 6c-.5-2 .8-3 2-3.5-.3 1.3.6 2 1.5 2.5" fill="none" stroke="#9a9a9a" stroke-width="1.6" stroke-linecap="round"/>`)
};
const EMOJI = [
  ["🏴‍☠️", "w2"], ["👩‍🏫", "teacher"], ["🔊", "speaker"], ["🔇", "mute"], ["🎧", "headphones"], ["⭐", "star"], ["🦉", "owl"], ["🔒", "lock"],
  ["⚔️", "swords"], ["📚", "book"], ["⚙️", "gear"], ["🗺️", "map"], ["❤️", "heart"], ["🖤", "heartOff"], ["💪", "bolt"], ["📒", "notebook"],
  ["🔁", "repeat"], ["🌍", "globe"], ["❓", "help"], ["💡", "bulb"], ["⚡", "bolt"], ["🏆", "trophy"], ["🏁", "flag"], ["⬅️", "arrowL"],
  ["➡️", "arrowR"], ["👤", "user"], ["✨", "sparkle"], ["✅", "check"], ["🏅", "medal"], ["🎯", "target"], ["🖥️", "screen"], ["🔑", "key"],
  ["🔥", "flame"], ["🌴", "w1"], ["🏰", "w3"], ["🚀", "w4"], ["❄️", "w5"], ["🐫", "w6"], ["🐠", "w7"], ["🌋", "w8"], ["⏸️", "pause"],
  ["⚙", "gear"], ["🗺", "map"], ["❤", "heart"], ["⏸", "pause"], ["🖥", "screen"], ["❄", "w5"], ["⚔", "swords"]
];
const RX = new RegExp(EMOJI.map((e) => e[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + "|\\uFE0F", "g");
const MAP = Object.fromEntries(EMOJI);
const KEEP = ".deco-emoji,.pic-big,.pic,.emoji,.nb-pic,[data-keep-emoji],script,style,textarea,input,title,svg";
export function iconize(text) { return String(text).replace(RX, (m) => (m === "\uFE0F" ? "" : UI_ICON[MAP[m]] || m)); }
function sweepNode(node) {
  if (node.nodeType === 3) {
    const v = node.nodeValue;
    if (!v || !RX.test(v)) { RX.lastIndex = 0; return; }
    RX.lastIndex = 0;
    const p = node.parentElement;
    if (!p || p.closest(KEEP)) return;
    const span = document.createElement("span");
    span.className = "ico-run";
    span.innerHTML = iconize(v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])));
    node.replaceWith(span);
    return;
  }
  if (node.nodeType !== 1 || node.matches(KEEP)) return;
  if (node.hasAttribute && node.hasAttribute("aria-label")) {
    const a = node.getAttribute("aria-label"); if (RX.test(a)) { RX.lastIndex = 0; node.setAttribute("aria-label", a.replace(RX, "").trim()); }
    RX.lastIndex = 0;
  }
  for (const c of Array.from(node.childNodes)) sweepNode(c);
}
export function startEmojiSweep(root) {
  root = root || document.body;
  sweepNode(root);
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") sweepNode(m.target);
      else m.addedNodes.forEach((n) => sweepNode(n));
    }
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true });
  return mo;
}

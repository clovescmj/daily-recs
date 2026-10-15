// The menu that opens from the hide button of a card: why the album is hidden. One click picks the reason and hides it.
import { HIDE_REASON_LABELS } from '../../lib/decisions.js';

const MARGIN_PX = 4;
let menu = null;
let onPickReason = () => {};

export function closeHideMenu() {
  if (!menu) return;
  menu.remove();
  menu = null;
}

/** Opens the menu under `button` (above it when there is no room below: this page is as tall as its content). `onPick(reason)`: '' is "just hide it". */
export function openHideMenu(button, onPick) {
  closeHideMenu();
  onPickReason = onPick;
  menu = document.createElement('div');
  menu.className = 'dr-menu hide-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Why hide this album?');
  const row = (reason, label, extra = '') => `<button type="button" class="dr-menu-row${extra}" role="menuitem" data-hide-reason="${reason}">${label}</button>`;
  menu.innerHTML = `<div class="dr-menu-head"><b>Why hide it?</b></div>`
    + Object.entries(HIDE_REASON_LABELS).map(([reason, label]) => row(reason, label)).join('')
    + row('', 'Just hide it', ' hide-menu-plain');
  document.body.appendChild(menu);

  const rect = button.getBoundingClientRect();
  const height = menu.offsetHeight;
  const width = menu.offsetWidth;
  const below = rect.bottom + MARGIN_PX + height <= document.documentElement.clientHeight;
  const top = below ? rect.bottom + MARGIN_PX : Math.max(0, rect.top - MARGIN_PX - height);
  menu.style.top = `${top + window.scrollY}px`;
  menu.style.left = `${Math.max(0, Math.min(rect.right - width, document.documentElement.clientWidth - width)) + window.scrollX}px`;
  menu.querySelector('button').focus();
}

document.addEventListener('click', (event) => {
  if (!menu) return;
  const item = event.target.closest('[data-hide-reason]');
  if (item && menu.contains(item)) {
    const reason = item.dataset.hideReason;
    closeHideMenu();
    onPickReason(reason);
    return;
  }
  if (!event.target.closest('[data-dislike]')) closeHideMenu();   // (a click on the button itself opens it again)
}, true);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeHideMenu(); });

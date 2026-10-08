// The switch between the lists of the day (My tags, Best matches, Surprise me) and the genre picker behind "My tags".
import { DAILY_COUNT } from '../../lib/state.js';
import { $, alignDropdown, esc } from './dom.js';
import { CHEVRON_DOWN_ICON, SPARKLES_ICON, TAGS_ICON, TARGET_ARROW_ICON } from './icons.js';
import { session } from './session.js';
import { createTagPicker, labelOf } from './tag-picker.js';

export const VIEW_HELP = {
  tags: 'Pick the genres you feel like hearing today. The list starts from your own albums of those genres.',
  best: 'The albums your collection and wishlist point to the most. Nothing is reloaded.',
  surprise: `Reads new albums from your collection and picks ${DAILY_COUNT} from deeper in the ranking, away from the obvious.`,
};

// This page lives in an iframe as tall as its content: while the menu is open the page is kept tall enough to show all of it.
const MENU_ROOM_PX = 480;
let picker = null;

/** What the toggle shows as chosen: the list being built (if the user just asked for one), otherwise the list on screen. */
const shownChoice = () => (session.pending ? { view: session.pending.view, keys: session.pending.keys } : { view: session.view, keys: session.tagKeys });

function tagsButtonText(state) {
  const { view, keys } = shownChoice();
  if (view !== 'tags') return 'My tags';
  const labels = keys.map((key) => labelOf(state, key));
  return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ');
}

/** Draws the three buttons: which one is active, and that they rest while a list is being built. */
export function renderViewSwitch(state, status) {
  const busy = Boolean(status.running);
  const chosen = shownChoice().view;
  const button = (id, view, icon, text, extra = '') => {
    const el = $(id);
    const html = `${icon}<span>${esc(text)}</span>${extra}`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    el.classList.toggle('is-active', chosen === view);
    el.setAttribute('aria-pressed', String(chosen === view));
    el.title = VIEW_HELP[view];
    el.disabled = busy;
  };
  button('view-tags', 'tags', TAGS_ICON, tagsButtonText(state), CHEVRON_DOWN_ICON);
  button('view-best', 'best', TARGET_ARROW_ICON, 'Best matches');
  button('view-surprise', 'surprise', SPARKLES_ICON, 'Surprise me');
  if (busy) closeTagsMenu();
}

export function closeTagsMenu() {
  document.body.style.minHeight = '';
  $('tags-menu').hidden = true;
  $('view-tags').setAttribute('aria-expanded', 'false');
}

function openTagsMenu() {
  picker.setSelected(session.view === 'tags' ? session.tagKeys : []);
  document.body.style.minHeight = `${MENU_ROOM_PX}px`;
  $('tags-menu').hidden = false;
  alignDropdown($('tags-menu'));
  $('view-tags').setAttribute('aria-expanded', 'true');
  picker.focus();
}

/** Wires the switch. `onChoose(view, keys)` is called when the user picks a list. */
export function initViewSwitch(onChoose) {
  picker = createTagPicker($('tags-menu'), { withButton: true, onGo: (keys) => { closeTagsMenu(); onChoose('tags', keys); } });
  $('view-best').addEventListener('click', () => { closeTagsMenu(); onChoose('best'); });
  $('view-surprise').addEventListener('click', () => { closeTagsMenu(); onChoose('surprise'); });
  $('view-tags').addEventListener('click', () => { if ($('tags-menu').hidden) openTagsMenu(); else closeTagsMenu(); });
  document.addEventListener('click', (event) => { if (!event.target.closest('.tags-picker')) closeTagsMenu(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeTagsMenu(); $('view-tags').focus(); } });
}

// The opening screen, shown the first time the user opens the tab each day: "What do you want to hear today?".
import { $, alignDropdown, esc } from './dom.js';
import { CHEVRON_DOWN_ICON, SPARKLES_ICON, TAGS_ICON, TARGET_ARROW_ICON } from './icons.js';
import { session } from './session.js';
import { createTagPicker, labelOf } from './tag-picker.js';
import { VIEW_HELP } from './views.js';

const OPTIONS = [
  { id: 'landing-tags-option', view: 'tags', icon: TAGS_ICON, text: 'My tags' },
  { id: 'landing-best-option', view: 'best', icon: TARGET_ARROW_ICON, text: 'Best matches' },
  { id: 'landing-surprise-option', view: 'surprise', icon: SPARKLES_ICON, text: 'Surprise me' },
];

// The pop-up of "My tags" works exactly like the one on the list: the button opens a drop-down with the genres.
// The page is an iframe as tall as its content, so the opening screen is always tall enough for the menu: it is measured (and
// kept up to date as genres are found), so there is no more room than the list needs, and opening the menu doesn't change the height
// and doesn't push Bandcamp's footer down.
let choice = null; // nothing is chosen until the user picks one
let picker = null;

const tagsButtonText = () => {
  const keys = picker.getSelected();
  if (!keys.length) return 'My tags';
  const labels = keys.map((key) => labelOf(session.state, key));
  return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ');
};

function setOptionHtml(option) {
  const el = $(option.id);
  const text = option.view === 'tags' ? tagsButtonText() : option.text;
  const html = `${option.icon}<span>${esc(text)}</span>${option.view === 'tags' ? CHEVRON_DOWN_ICON : ''}`;
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
}

const ROOM_BELOW_MENU_PX = 40;

/** Reserves just the height the genre menu needs: it is shown out of sight for a moment to measure it. */
function reserveMenuRoom() {
  const menu = $('landing-tags');
  const wasHidden = menu.hidden;
  if (wasHidden) { picker.render(); menu.style.transition = 'none'; menu.hidden = false; menu.style.visibility = 'hidden'; } // (no fade while measuring)
  const bottom = menu.getBoundingClientRect().bottom - $('landing').getBoundingClientRect().top;
  if (wasHidden) { menu.hidden = true; menu.style.visibility = ''; requestAnimationFrame(() => { menu.style.transition = ''; }); }
  if (bottom > 0) $('landing').style.minHeight = `${Math.ceil(bottom + ROOM_BELOW_MENU_PX)}px`;
}

function closeMenu() {
  $('landing-tags').hidden = true;
  $('landing-tags-option').setAttribute('aria-expanded', 'false');
}

function openMenu() {
  picker.render();
  $('landing-tags').hidden = false;
  alignDropdown($('landing-tags'));
  $('landing-tags-option').setAttribute('aria-expanded', 'true');
  picker.focus();
}

function renderChoice() {
  for (const option of OPTIONS) {
    const el = $(option.id);
    setOptionHtml(option);
    el.classList.toggle('is-active', option.view === choice);
    el.setAttribute('aria-checked', String(option.view === choice));
  }
  $('landing-go').disabled = !choice || (choice === 'tags' && !picker.getSelected().length);
  $('landing-hint').textContent = choice ? VIEW_HELP[choice] : ''; // what the chosen list is, under the buttons
}

/** `onStart(view, keys)` runs when the user presses "Start digging". */
export function initLanding(onStart) {
  picker = createTagPicker($('landing-tags'), { onChange: () => { renderChoice(); } });
  for (const option of OPTIONS) {
    const el = $(option.id);
    el.title = VIEW_HELP[option.view];
    el.addEventListener('click', () => {
      choice = option.view;
      if (choice === 'tags') { if ($('landing-tags').hidden) openMenu(); else closeMenu(); } else closeMenu();
      renderChoice();
    });
  }
  $('landing-go').addEventListener('click', () => { if (!choice) return; closeMenu(); onStart(choice, choice === 'tags' ? picker.getSelected() : []); });
  document.addEventListener('click', (event) => { if (session.landing && !event.target.closest('#landing .tags-picker')) closeMenu(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && session.landing) { closeMenu(); $('landing-tags-option').focus(); } });
  renderChoice();
}

const FADE_MS = 300; // = --dr-dur-base

/**
 * "Start digging": the opening screen fades out, then the list (its header, the progress and the placeholders) fades in.
 * Resolves when the opening screen is gone; with "reduce motion" on, at once.
 */
export async function leaveLanding() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) {
    $('landing').classList.add('is-leaving');
    await new Promise((resolve) => setTimeout(resolve, FADE_MS));
  }
  setLandingVisible(false);
  if (reduced) return;
  document.body.classList.add('is-revealing');
  setTimeout(() => document.body.classList.remove('is-revealing'), FADE_MS + 50);
}

/** Shows or hides the opening screen (and, with it, the list and its header). */
export function setLandingVisible(visible) {
  session.landing = visible;
  $('landing').classList.remove('is-leaving');
  $('landing').hidden = !visible;
  document.body.classList.toggle('is-landing', visible);
  if (visible) { renderChoice(); reserveMenuRoom(); } else closeMenu();
}

/** Keeps the genre list on the opening screen current while it is open. */
export const refreshLanding = () => {
  if (!session.landing) return;
  if ($('landing-tags').hidden) reserveMenuRoom(); else picker.render(); // genres found in the meantime: the room follows
};

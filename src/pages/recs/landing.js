// The opening screen, shown the first time the user opens the tab each day: "What do you want to hear today?".
import { $, esc } from './dom.js';
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
const MENU_ROOM_PX = 520;   // the page is an iframe as tall as its content: keep it tall enough to show the whole menu
let choice = 'best';
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

function closeMenu() {
  document.body.style.minHeight = '';
  $('landing-tags').hidden = true;
  $('landing-tags-option').setAttribute('aria-expanded', 'false');
}

function openMenu() {
  picker.render();
  document.body.style.minHeight = `${MENU_ROOM_PX}px`;
  $('landing-tags').hidden = false;
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
  $('landing-go').disabled = choice === 'tags' && !picker.getSelected().length;
  $('landing-hint').textContent = VIEW_HELP[choice];
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
  $('landing-go').addEventListener('click', () => { closeMenu(); onStart(choice, choice === 'tags' ? picker.getSelected() : []); });
  document.addEventListener('click', (event) => { if (session.landing && !event.target.closest('#landing .tags-picker')) closeMenu(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && session.landing) { closeMenu(); $('landing-tags-option').focus(); } });
  renderChoice();
}

/** Shows or hides the opening screen (and, with it, the list and its header). */
export function setLandingVisible(visible) {
  session.landing = visible;
  $('landing').hidden = !visible;
  document.body.classList.toggle('is-landing', visible);
  if (visible) renderChoice(); else closeMenu();
}

/** Keeps the genre list on the opening screen current while it is open. */
export const refreshLanding = () => { if (session.landing && !$('landing-tags').hidden) picker.render(); };

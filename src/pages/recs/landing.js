// The opening screen, shown the first time the user opens the tab each day: "What do you want to hear today?".
import { $ } from './dom.js';
import { SPARKLES_ICON, TAGS_ICON, TARGET_ARROW_ICON } from './icons.js';
import { session } from './session.js';
import { createTagPicker } from './tag-picker.js';
import { VIEW_HELP } from './views.js';

const OPTIONS = [
  { id: 'landing-tags-option', view: 'tags', icon: TAGS_ICON, text: 'My tags' },
  { id: 'landing-best-option', view: 'best', icon: TARGET_ARROW_ICON, text: 'Best matches' },
  { id: 'landing-surprise-option', view: 'surprise', icon: SPARKLES_ICON, text: 'Surprise me' },
];

let choice = 'best';
let picker = null;

function renderChoice() {
  for (const option of OPTIONS) {
    const el = $(option.id);
    el.classList.toggle('is-active', option.view === choice);
    el.setAttribute('aria-checked', String(option.view === choice));
  }
  $('landing-tags').hidden = choice !== 'tags';
  if (choice === 'tags') picker.render();
  $('landing-go').disabled = choice === 'tags' && !picker.getSelected().length;
  $('landing-hint').textContent = VIEW_HELP[choice];
}

/** `onStart(view, keys)` runs when the user presses "Start digging". */
export function initLanding(onStart) {
  picker = createTagPicker($('landing-tags'), { onChange: () => { $('landing-go').disabled = choice === 'tags' && !picker.getSelected().length; } });
  for (const option of OPTIONS) {
    const el = $(option.id);
    el.innerHTML = `${option.icon}<span>${option.text}</span>`;
    el.title = VIEW_HELP[option.view];
    el.addEventListener('click', () => { choice = option.view; renderChoice(); if (choice === 'tags') picker.focus(); });
  }
  $('landing-go').addEventListener('click', () => onStart(choice, choice === 'tags' ? picker.getSelected() : []));
  renderChoice();
}

/** Shows or hides the opening screen (and, with it, the list and its header). */
export function setLandingVisible(visible) {
  session.landing = visible;
  $('landing').hidden = !visible;
  document.body.classList.toggle('is-landing', visible);
  if (visible) renderChoice();
}

/** Keeps the genre list on the opening screen current while it is open. */
export const refreshLanding = () => { if (session.landing && choice === 'tags') picker.render(); };

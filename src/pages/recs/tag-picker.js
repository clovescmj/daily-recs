// The genre picker: scanned genres as check boxes (with how many of the user's albums have each), and a field to type one that
// isn't listed yet. Used in the pop-up of the "My tags" button and, inline, on the opening screen.
import { normalizeTag } from '../../lib/bandcamp.js';
import { GENERIC_GENRES, scanProgress, selectableTags } from '../../lib/taste-profile.js';
import { esc, formatNumber } from './dom.js';
import { session } from './session.js';

const MAX_LISTED_TAGS = 80;
export const MAX_PICKED_TAGS = 5;
const customLabels = new Map();   // genres typed by the user that are not in the scanned list yet: key -> text

export const labelOf = (state, key) => (state && state.tagLabels && state.tagLabels[key]) || customLabels.get(key) || key;

/**
 * Fills `root` with the picker. `withButton`: add a "Find music" button (calls `onGo(keys)`); `onChange(keys)` runs whenever
 * the ticked genres change. Returns { render, getSelected, setSelected, focus }.
 */
export function createTagPicker(root, { withButton = false, onGo = () => {}, onChange = () => {} } = {}) {
  root.innerHTML = `<div class="tags-coverage"></div>
    <input class="tags-input" type="search" placeholder="Type a genre…" aria-label="Find or add a genre" autocomplete="off">
    <ul class="tags-list"></ul>${withButton ? '<div class="tags-foot"><button type="button" class="button tags-go">Find music</button><p class="tags-note">This will refresh your list with a new search.</p></div>' : ''}`;
  const $in = (selector) => root.querySelector(selector);
  let selected = new Set();

  const update = () => {
    const go = $in('.tags-go');
    if (go) {
      go.disabled = !selected.size;
      go.textContent = selected.size > 1 ? `Find music (${selected.size} genres)` : 'Find music';
    }
    onChange([...selected].sort());
  };

  function render() {
    const state = session.state;
    const { scanned, total } = state ? scanProgress(state) : { scanned: 0, total: 0 };
    $in('.tags-coverage').textContent = total
      ? `Genres found so far · ${formatNumber(scanned)} of ${formatNumber(total)} albums scanned`
      : 'Your genres will show up as your albums are scanned';
    const typed = $in('.tags-input').value.trim();
    const typedKey = normalizeTag(typed);
    const known = state ? selectableTags(state) : [];
    const rows = known
      .filter((tag) => !typed || tag.key.includes(typedKey) || tag.label.toLowerCase().includes(typed.toLowerCase()))
      .slice(0, MAX_LISTED_TAGS)
      .map((tag) => ({ key: tag.key, label: tag.label, count: tag.count }));
    for (const key of selected) if (!rows.some((row) => row.key === key)) rows.unshift({ key, label: labelOf(state, key), count: null }); // ticked, not scanned yet
    if (typed && typedKey && !GENERIC_GENRES.has(typedKey) && !known.some((tag) => tag.key === typedKey) && !rows.some((row) => row.key === typedKey)) {
      rows.unshift({ key: typedKey, label: typed.toLowerCase(), count: null, typed: true }); // first, so it is never lost at the end of a long list
    }
    // A genre that was typed but isn't in the scanned list yet is added with "+ Add": it then shows up ticked, like the others.
    $in('.tags-list').innerHTML = rows.length ? rows.map((row) => (row.typed
      ? `<li><button type="button" class="tags-add-button" data-key="${esc(row.key)}" data-label="${esc(row.label)}">+ Add “${esc(row.label)}”</button></li>`
      : `<li><label>
        <input type="checkbox" value="${esc(row.key)}" data-label="${esc(row.label)}"${selected.has(row.key) ? ' checked' : ''}>
        <span class="tag-name">${esc(row.label)}</span>
        ${row.count ? `<span class="tag-count">${formatNumber(row.count)}</span>` : ''}</label></li>`)).join('')
      : '<li class="tags-empty">No genres yet. Type one to look for it in your albums.</li>';
    update();
  }

  const add = (key, label) => { selected.add(key); customLabels.set(key, label); };

  $in('.tags-input').addEventListener('input', render);
  $in('.tags-input').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    // Enter takes the "+ Add" row when there is one, otherwise the first genre of the list that is not ticked yet
    const first = $in('.tags-list .tags-add-button') || $in('.tags-list input[type=checkbox]:not(:checked)');
    if (first && selected.size < MAX_PICKED_TAGS) { add(first.value || first.dataset.key, first.dataset.label); $in('.tags-input').value = ''; render(); }
  });
  $in('.tags-list').addEventListener('click', (event) => {
    const addButton = event.target.closest('.tags-add-button');
    if (!addButton || selected.size >= MAX_PICKED_TAGS) return;
    add(addButton.dataset.key, addButton.dataset.label);
    $in('.tags-input').value = '';
    render();
  });
  $in('.tags-list').addEventListener('change', (event) => {
    const box = event.target.closest('input[type=checkbox]');
    if (!box) return;
    if (box.checked && selected.size >= MAX_PICKED_TAGS) { box.checked = false; return; }
    if (box.checked) add(box.value, box.dataset.label); else selected.delete(box.value);
    update();
  });
  const go = $in('.tags-go');
  if (go) go.addEventListener('click', () => { if (selected.size) onGo([...selected].sort()); });

  return {
    render,
    getSelected: () => [...selected].sort(),
    setSelected(keys) { selected = new Set(keys); $in('.tags-input').value = ''; render(); },
    focus: () => $in('.tags-input').focus(),
  };
}

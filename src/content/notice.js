// Small notices at the bottom right of the Bandcamp page, above the player bar, in the style of the snackbar: a dark box with a close
// button. Classic script (content scripts cannot import): it adds `DRNotice` for profile-tab.js.
// DRNotice.show({ id, title, lines, action: { label, onClick }, onClose }) shows one (a second call with the same id replaces it).
// DRNotice.hide(id) takes one away without calling onClose.
window.DRNotice = (() => {
  const FADE_MS = 200;
  let box = null;

  function container() {
    if (box && box.isConnected) return box;
    box = document.createElement('div');
    box.id = 'dr-notices';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Daily Recs notices');
    document.body.appendChild(box);
    return box;
  }

  function remove(el) {
    el.classList.remove('show');
    setTimeout(() => el.remove(), FADE_MS);
  }

  function hide(id) {
    const el = container().querySelector(`[data-notice="${CSS.escape(id)}"]`);
    if (el) remove(el);
  }

  function show({ id, title, lines = [], action = null, onClose = () => {} }) {
    hide(id);
    const el = document.createElement('section');
    el.className = 'dr-notice';
    el.dataset.notice = id;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dr-notice-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => { remove(el); onClose(); });
    const heading = document.createElement('strong');
    heading.className = 'dr-notice-title';
    heading.textContent = title;
    el.append(close, heading);
    if (lines.length) {
      const list = document.createElement('ul');
      for (const line of lines) {
        const item = document.createElement('li');
        item.textContent = line;   // (text only: what comes from a page is never markup)
        list.appendChild(item);
      }
      el.appendChild(list);
    }
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dr-notice-action';
      button.textContent = action.label;
      button.addEventListener('click', () => { button.disabled = true; action.onClick(); });
      el.appendChild(button);
    }
    container().appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
  }

  return { show, hide };
})();

// Small notices at the bottom right of the Bandcamp page, above the player bar, in the style of the snackbar: a dark box with a close
// button. Classic script (content scripts cannot import): it adds `DRNotice` for profile-tab.js.
// DRNotice.show({ id, title, lines, action: { label, onClick }, onClose }) shows one (a second call with the same id replaces it).
// DRNotice.hide(id) takes one away without calling onClose.
window.DRNotice = (() => {
  const FADE_MS = 200;
  // the close icon of the panels of the player bar (Material "close"), so the X is the same everywhere
  const CLOSE_PATH = 'M6.75 18.667l-1.417 -1.417 5.25 -5.25 -5.25 -5.25 1.417 -1.417 5.25 5.25 5.25 -5.25 1.417 1.417 -5.25 5.25 5.25 5.25 -1.417 1.417 -5.25 -5.25 -5.25 5.25Z';
  let box = null;

  function container() {
    if (box && box.isConnected) return box;
    box = document.createElement('div');
    box.id = 'dr-notices';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Daily Recs notices');
    document.body.appendChild(box);
    // Escape closes the notice that has the focus
    box.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const el = event.target.closest('.dr-notice');
      if (el) el.querySelector('.dr-notice-close').click();
    });
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
    el.setAttribute('role', 'status');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dr-notice-close';
    close.setAttribute('aria-label', 'Close');
    close.title = 'Close';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', CLOSE_PATH);
    icon.appendChild(path);
    close.appendChild(icon);
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
    void el.offsetWidth;   // (the first state is drawn before `show` is added, so it opens with a transition)
    el.classList.add('show');
  }

  return { show, hide };
})();

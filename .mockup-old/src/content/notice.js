// Small notices at the bottom of the Bandcamp page, above the player bar, in the centre like the snackbar of the confirmations. Classic script
// (content scripts cannot import): it adds `DRNotice` for profile-tab.js.
//
// The pattern is the one of a snackbar with an action (Material) and of a toast with an action (Carbon): one line of text, the action as a
// text button at its end, and, when the notice can be dismissed, a close icon after it. A notice that asks for something (to update, to
// reload) has no close icon: it stays until the action is taken.
//
// DRNotice.show({ id, text, action: { label, onClick }, closable = true, autoHide = 0, onClose }) shows one (the same id replaces it); `autoHide`
// is the time in ms after which it goes away by itself (a confirmation); the pointer over it keeps it.
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
    // Escape closes the notice that has the focus (when it can be closed)
    box.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const el = event.target.closest('.dr-notice');
      const close = el && el.querySelector('.dr-notice-close');
      if (close) close.click();
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

  function closeButton(onClick) {
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
    close.addEventListener('click', onClick);
    return close;
  }

  function show({ id, text, action = null, closable = true, autoHide = 0, onClose = () => {} }) {
    hide(id);
    const el = document.createElement('section');
    el.className = 'dr-notice';
    el.dataset.notice = id;
    el.setAttribute('role', 'status');
    const message = document.createElement('span');
    message.className = 'dr-notice-text';
    message.textContent = text;   // (text only: what comes from a page is never markup)
    el.appendChild(message);
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dr-notice-action';
      button.textContent = action.label;
      button.addEventListener('click', () => { button.disabled = true; action.onClick(); if (autoHide) remove(el); });
      el.appendChild(button);
    }
    if (closable) el.appendChild(closeButton(() => { remove(el); onClose(); }));
    if (autoHide) {
      let timer = null;
      const arm = () => { clearTimeout(timer); timer = setTimeout(() => remove(el), autoHide); };
      el.addEventListener('pointerenter', () => clearTimeout(timer));
      el.addEventListener('pointerleave', arm);
      arm();
    }
    container().appendChild(el);
    void el.offsetWidth;   // (the first state is drawn before `show` is added, so it opens with a transition)
    el.classList.add('show');
  }

  return { show, hide };
})();

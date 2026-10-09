// Player that looks identical to Bandcamp's own. Classic script (no imports), used by the content script.
// It never touches audio: it receives state via update() and returns commands via onCmd().
(() => {
  const P = {
    vol: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    mute: 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
    heart: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
    heartOn: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    addCircle: 'M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    checkCircle: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM7.668 11.497 10.242 14.348 16.275 7.505 17.625 8.695 10.258 17.052 6.332 12.703z',
    block: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z',
    queue: 'M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  };
  const svg = (p, cls, label, name) => `<svg class="${cls}" viewBox="0 0 24 24" role="img" aria-label="${name}"><title>${name}</title><path d="${p}"/>${label ? `<text x="12" y="16" font-size="7.5" font-weight="bold" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${label}</text>` : ''}</svg>`;
  // Icons of the three ways to play (each one centred in its own box and of a similar size): a music note (one song per album), and a record box (our own drawing) turned 90° to the right (whole albums).
  const MODE_ICON = {
    shuffle: `<svg class="pb-ico" viewBox="3 3 18 18" aria-hidden="true" focusable="false"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`,
    one: `<svg class="pb-ico" viewBox="4 2 14 20" aria-hidden="true" focusable="false"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`,
    album: `<svg class="pb-ico" viewBox="2.67 5.15 19.5 19.5" aria-hidden="true" focusable="false"><g transform="rotate(90 12.42 14.9)"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.925 7.041H18.91a1.268 1.268 0 0 1 1.268 1.268V21.497a1.268 1.268 0 0 1-1.268 1.268H5.925a1.268 1.268 0 0 1-1.268-1.268V8.309a1.268 1.268 0 0 1 1.268-1.268zM6.178 8.563H18.657V21.243H6.178zM7.724 14.903a4.694 4.739 0 1 1 9.388 0 4.694 4.739 0 1 1-9.388 0zM10.889 14.903a1.529 1.573 0 1 1 3.057 0 1.529 1.573 0 1 1-3.057 0z"/></g></svg>`,
  };
  // The icon of the Liked Songs list (Material "library music": your own file, as it is).
  const LIKED_ICON = `<svg class="x-icon" viewBox="0 -960 960 960" role="img" aria-label="Liked Songs"><title>Liked Songs</title><path d="M500-360q42 0 71-29t29-71v-220h120v-80H560v220q-13-10-28-15t-32-5q-42 0-71 29t-29 71q0 42 29 71t71 29ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z"/></svg>`;
  const LIKED_PATH = 'M500-360q42 0 71-29t29-71v-220h120v-80H560v220q-13-10-28-15t-32-5q-42 0-71 29t-29 71q0 42 29 71t71 29ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z';
  const EMPTY_LIKED = `<li class="empty"><svg class="empty-icon" viewBox="0 -960 960 960" aria-hidden="true"><path d="${LIKED_PATH}"/></svg><strong>No liked songs yet</strong><span>Click the ${svg(P.addCircle, 'ci', '', 'Add to Liked Songs')} on an album or in the player to save songs here.</span></li>`;
  const mmss = (s) => (isFinite(s) && s > 0 ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '00:00');
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let savedCount = null;
  const ACT_KIND = { wish: 'wish', save: 'save', saveAlbum: 'save', dislike: 'dislike' };
  /** One icon of a row of the queue or of the Liked list. */
  const action = (name, on, label, onLabel, path, onPath) => `<a href="#" class="dr-act dr-act--${ACT_KIND[name]} q-${name}${on ? ' on' : ''}" data-act="${name}" title="${on ? onLabel : label}" aria-label="${on ? onLabel : label}">${svg(on ? onPath : path, 'ci', '', on ? onLabel : label)}</a>`;
  const queueVersion = (items) => items.map((it) => `${it.id}${it.wished ? 'w' : ''}${it.saved ? 's' : ''}`).join(',');
  /** The cover of a row (the same box when there is none, so the rows keep their height). */
  const rowCover = (art, playing) => `<span class="qcover">${typeof art === 'string' && /^(https:|data:image)/.test(art) ? `<img src="${esc(art)}" alt="">` : ''}${playing ? '<span class="qeq"><i></i><i></i><i></i></span>' : ''}</span>`;
  const rowText = (title, sub) => `<span class="qtext"><b>${esc(title)}</b><span>${esc(sub)}</span></span>`;
  const pct = (x) => `${Math.max(0, Math.min(1, x || 0)) * 100}%`;

  function create({ onCmd }) {
    const el = document.createElement('div');
    el.id = 'dr-player';
    el.hidden = true;
    el.classList.add('is-offscreen');
    el.innerHTML = `<div class="carousel-player-inner">
      <div class="col col-4-15 now-playing">
        <a class="np-art" target="_blank" rel="noopener" aria-label="Open album on Bandcamp"><img alt="No album playing"></a>
        <div class="info"><a class="np-link" target="_blank" rel="noopener"><div class="title"></div><div class="artist">by <span></span></div></a>
          <div class="collect"><a class="dr-act dr-act--wish wish" href="#" title="Add to wishlist" aria-label="Add to wishlist">${svg(P.heart, 'ci', '', 'Add to wishlist')}</a><a class="dr-act dr-act--save save" href="#" title="Add to Liked Songs" aria-label="Add to Liked Songs">${svg(P.addCircle, 'ci', '', 'Add to Liked Songs')}</a><a class="dr-act dr-act--dislike dislike" href="#" title="Don't show music like this" aria-label="Don't show music like this">${svg(P.block, 'ci', '', 'Don\'t show music like this')}</a></div></div>
      </div>
      <div class="col col-7-15 progress-transport">
        <div class="playpause" role="button" tabindex="0" aria-label="Play" title="Play"><div class="play"></div><div class="pause"></div><div class="busy" role="img" aria-label="Loading"><svg viewBox="0 0 46 44" aria-hidden="true" focusable="false"><g><circle cx="14.59" cy="13.56" r="3.42"/><circle cx="23.03" cy="10.06" r="3.42" fill-opacity="0.47"/><circle cx="31.47" cy="13.56" r="3.42" fill-opacity="0.47"/><circle cx="34.97" cy="22.00" r="3.42" fill-opacity="0.68"/><circle cx="31.47" cy="30.44" r="3.42" fill-opacity="0.68"/><circle cx="23.03" cy="33.94" r="3.42" fill-opacity="0.87"/><circle cx="14.59" cy="30.44" r="3.42" fill-opacity="0.87"/><circle cx="11.09" cy="22.00" r="3.42"/></g></svg></div></div>
        <div class="info-progress">
          <div class="info">
            <div class="title"><a class="no-queue"><span class="trk-no"></span><span class="trk"></span></a></div>
            <div class="pos-dur"><span class="pos">00:00</span> / <span class="dur">00:00</span></div>
          </div>
          <div class="progress-bar" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress"></div><div class="buffer"></div><div class="progress-bg"></div>
            <div class="seek-control-outer"><div class="seek-control"></div></div></div>
        </div>
        <div class="transport"><div class="prev"><div class="icon prev-icon" role="button" tabindex="0" aria-label="Previous track" title="Previous track"><svg viewBox="0 0 40 24" aria-hidden="true" focusable="false"><path d="M4 2h4v20H4zM8 12 24 2v20zM22 12 38 2v20z"/></svg></div></div><div class="next"><div class="icon next-icon" role="button" tabindex="0" aria-label="Next track" title="Next track"><svg viewBox="0 0 40 24" aria-hidden="true" focusable="false"><path d="M34 2h4v20h-4zM4 2l16 10L4 22zM18 2l16 10L18 22z"/></svg></div></div></div>
      </div>
      <div class="col col-4-15 controls-extra">
        <div class="pb-wrap">
          <a href="#" class="x-btn dr-select pb-btn" role="button" aria-haspopup="true" aria-expanded="false" title="Play mode" aria-label="Play mode"><span class="pb-slot">${MODE_ICON.one}</span><span class="pb-label">One per album</span><svg class="pb-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></a>
          <div class="dr-menu dr-menu--up pb-menu" role="menu" aria-label="Play mode" hidden>
            <div class="dr-menu-head pb-head"><b>Play mode</b><span>Choose how the list plays.</span></div>
            <a href="#" class="dr-menu-row pb-opt" role="menuitemradio" data-mode="one"><span class="pb-check"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.939 14.498 7.468 19.593 20.03 7.03 18.97 5.97 7.532 17.407 4.061 13.502z"/></svg></span>${MODE_ICON.one}One song per album</a>
            <a href="#" class="dr-menu-row pb-opt" role="menuitemradio" data-mode="shuffle"><span class="pb-check"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.939 14.498 7.468 19.593 20.03 7.03 18.97 5.97 7.532 17.407 4.061 13.502z"/></svg></span>${MODE_ICON.shuffle}Shuffle</a>
            <a href="#" class="dr-menu-row pb-opt" role="menuitemradio" data-mode="album"><span class="pb-check"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.03 7.03 7.468 19.593l-4.529-5.095 1.122-.996 3.471 3.905L18.97 5.97z"/></svg></span>${MODE_ICON.album}Full album</a>
          </div>
        </div>
        <span class="x-sep" aria-hidden="true"></span>
        <a href="#" class="x-btn x-queue" title="Recommendations queue" aria-label="Recommendations queue">${svg(P.queue, 'x-icon', '', 'Recommendations queue')}</a>
        <a href="#" class="x-btn x-saved" title="Liked Songs" aria-label="Liked Songs">${LIKED_ICON}</a>
        <span class="x-sep" aria-hidden="true"></span>
        <div class="vol">
          <div class="vol-icon-wrapper" role="button" tabindex="0" aria-label="Mute or unmute" title="Mute or unmute">${svg(P.vol, 'vol-icon', '', 'Volume')}</div>
          <div class="vol-slider" role="slider" tabindex="0" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div class="vol-amt"></div><div class="vol-bg"></div>
            <div class="vol-control-outer"><div class="vol-control"></div></div></div>
        </div>
      </div></div>
      <div class="queue" role="dialog" aria-label="Recommendations queue">
        <div class="queue-header"><h2>Recommendations queue</h2><span class="q-count"></span><span class="q-close" role="button" tabindex="0" aria-label="Close queue" title="Close queue">${svg(P.close, 'close-icon', '', 'Close queue')}</span></div>
        <ol></ol>
        <div class="queue-foot"><span class="q-foot"></span></div>
      </div>
      <div class="queue saved" role="dialog" aria-label="Liked Songs">
        <div class="queue-header"><h2>Liked Songs</h2><span class="l-count"></span><span class="l-close" role="button" tabindex="0" aria-label="Close Liked Songs" title="Close Liked Songs">${svg(P.close, 'close-icon', '', 'Close Liked Songs')}</span></div>
        <ol>${EMPTY_LIKED}</ol>
        <div class="queue-foot"><span>Stored on this computer</span></div>
      </div>`;
    const q = (s) => el.querySelector(s);
    /** The cover of a song just added: it shows above the icon and shrinks into it (see .liked-fly). It lives in the bar, not in the button, so it does not get the button's fade. */
    const flyCover = (icon, art) => {
      const cover = document.createElement('span');
      const img = document.createElement('img');
      img.alt = ''; img.src = art;
      cover.className = 'liked-fly'; cover.setAttribute('aria-hidden', 'true'); cover.append(img);
      const ir = icon.getBoundingClientRect(); const er = el.getBoundingClientRect();
      cover.style.left = `${ir.left + ir.width / 2 - 22 - er.left}px`;
      cover.style.top = `${ir.top - 56 - er.top}px`;
      cover.style.setProperty('--dr-fly-dy', `${34 + ir.height / 2}px`);
      el.append(cover);
      return cover;
    };
    el.addEventListener('keydown', (e) => { // Enter/Space activate role=button controls
      const t = e.target.closest('[role=button]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); }
    });
    let seeking = false, lastState = null;
    const setText = (node, v) => { if (node.textContent !== v) node.textContent = v; };
    const setStyle = (node, prop, v) => { if (node.style[prop] !== v) node.style[prop] = v; };

    // generic drag for bars (progress and volume): click, mousedown+move, release
    const drag = (bar, onMove, onDone, flag) => {
      const frac = (e) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
      bar.addEventListener('mousedown', (e) => {
        e.preventDefault(); flag(true); onMove(frac(e));
        const move = (ev) => onMove(frac(ev));
        const up = (ev) => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); flag(false); onDone(frac(ev)); };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      });
    };
    drag(q('.progress-bar'),
      (f) => { q('.progress').style.width = pct(f); q('.seek-control').style.left = pct(f); },
      (f) => onCmd('seek', f), (on) => { seeking = on; q('.progress-bar').classList.toggle('seeking', on); });
    drag(q('.vol-slider'),
      (f) => { q('.vol-amt').style.width = pct(f); q('.vol-control').style.left = pct(f); onCmd('vol', f); },
      () => {}, (on) => q('.vol-slider').classList.toggle('changing', on));

    // Keyboard: both bars announce themselves as sliders, so they must respond to the arrow keys.
    q('.progress-bar').addEventListener('keydown', (e) => {
      const d = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
      if (d !== undefined) { e.preventDefault(); onCmd('seekBy', d); }
      else if (e.key === 'Home') { e.preventDefault(); onCmd('seek', 0); }
      else if (e.key === 'End') { e.preventDefault(); onCmd('seek', 1); }
    });
    q('.vol-slider').addEventListener('keydown', (e) => {
      const d = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[e.key];
      if (d !== undefined && lastState) { e.preventDefault(); onCmd('vol', Math.max(0, Math.min(1, (lastState.vol || 0) + d))); }
    });
    q('.playpause').addEventListener('click', () => onCmd('toggle'));
    q('.prev-icon').addEventListener('click', (e) => { if (!e.currentTarget.classList.contains('disabled')) onCmd('prev'); });
    q('.next-icon').addEventListener('click', (e) => { if (!e.currentTarget.classList.contains('disabled')) onCmd('next'); });
    // Play mode: a button that opens a short list (it opens upwards, the bar is at the foot of the page)
    let closePanels = () => {};
    const setModeMenu = (on) => { q('.pb-menu').hidden = !on; q('.pb-btn').classList.toggle('open', on); q('.pb-btn').setAttribute('aria-expanded', String(on)); };
    q('.pb-btn').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setModeMenu(q('.pb-menu').hidden); });
    q('.pb-menu').addEventListener('click', (e) => {
      const option = e.target.closest('[data-mode]');
      if (!option) return;
      e.preventDefault();
      onCmd('mode', option.dataset.mode);
      setModeMenu(false);
    });
    document.addEventListener('click', () => setModeMenu(false));
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') setModeMenu(false); });
    q('.wish').addEventListener('click', (e) => { e.preventDefault(); onCmd('wish'); });
    q('.save').addEventListener('click', (e) => { e.preventDefault(); onCmd('save'); });
    q('.dislike').addEventListener('click', (e) => { e.preventDefault(); onCmd('dislike'); });
    // the queue and the Liked list are two panels over the bar: opening one closes the other
    const setQueue = (on) => { if (on) setSaved(false); q('.queue').classList.toggle('show', on); q('.x-queue').classList.toggle('active', on); };
    const setSaved = (on) => { if (on) setQueue(false); q('.saved').classList.toggle('show', on); q('.x-saved').classList.toggle('active', on); };
    q('.x-queue').addEventListener('click', (e) => { e.preventDefault(); setQueue(!q('.queue').classList.contains('show')); });
    q('.x-saved').addEventListener('click', (e) => { e.preventDefault(); setSaved(!q('.saved').classList.contains('show')); });
    // a click outside the bar closes the panels too (the page inside the frame reports its clicks through closeMenus)
    document.addEventListener('click', (e) => { if (!e.composedPath().includes(el)) { setQueue(false); setSaved(false); } });
    closePanels = () => { setQueue(false); setSaved(false); };
    q('.q-close').addEventListener('click', () => setQueue(false));
    q('.l-close').addEventListener('click', () => setSaved(false));
    q('.queue ol').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      const act = e.target.closest('[data-act]');
      if (act) { e.preventDefault(); onCmd(act.dataset.act, li.dataset.id); } else onCmd('playAlbum', li.dataset.id);
    });
    q('.saved ol').addEventListener('click', (e) => { // each item is a track: { id, i, title }
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      const track = { id: li.dataset.id, i: Number(li.dataset.i), title: li.dataset.title };
      const act = e.target.closest('[data-act]');
      if (act) { e.preventDefault(); onCmd(act.dataset.act, act.dataset.act === 'wish' ? track.id : track); } else onCmd('playTrack', track);
    });
    let queueSig = '', queueKey = '', queue = [];
    q('.vol-icon-wrapper').addEventListener('click', () => onCmd('mute'));

    function update(s) {
      lastState = s;
      // Slide up / down instead of popping in and out (`hidden` only applies before the first show).
      if (s.has && el.hidden) { el.hidden = false; void el.offsetWidth; }
      el.classList.toggle('is-offscreen', !s.has);
      const img = q('.np-art img');
      if (s.art) { if (img.getAttribute('src') !== s.art) img.src = s.art; } else img.removeAttribute('src');
      q('.np-art').href = q('.np-link').href = s.url || '#';
      img.alt = s.albumTitle ? `Cover of ${s.albumTitle}${s.artist ? ` by ${s.artist}` : ''}` : 'No album playing';
      setText(q('.now-playing .title'), s.songTitle || s.albumTitle || ''); // the song, with the artist under it
      setText(q('.now-playing .artist span'), s.artist || '');
      q('.now-playing .artist').style.display = s.artist ? '' : 'none';
      q('.collect').style.visibility = s.artist && !s.plain ? '' : 'hidden'; // a song played while waiting is not on any list: nothing to wish, like or skip
      // queue: only redraw when the list or the current album change (`queue` omitted = unchanged)
      if (s.queue != null) { queue = s.queue; queueKey = queueVersion(queue); }
      const sig = `${s.curId}|${queueKey}`;
      if (sig !== queueSig) {
        queueSig = sig;
        const at = queue.findIndex((it) => it.id === s.curId);
        const heading = (i) => (i === 0 && at > 0 ? '<li class="qsec">Played</li>' : '') + (at < 0 ? (i === 0 ? '<li class="qsec">Up next</li>' : '') : i === at ? '<li class="qsec">Playing now</li>' : i === at + 1 ? '<li class="qsec">Up next</li>' : '');
        q('.queue ol').innerHTML = queue.map((it, i) => heading(i)
          + `<li data-id="${esc(it.id)}" class="${it.id === s.curId ? 'active' : ''}">${rowCover(it.art, it.id === s.curId)}${rowText(it.title, it.artist)}<span class="qact">`
          + action('wish', it.wished, 'Add to wishlist', 'Remove from wishlist', P.heart, P.heartOn)
          + action('saveAlbum', it.saved, 'Add album to Liked Songs', 'Remove album from Liked Songs', P.addCircle, P.checkCircle)
          + action('dislike', false, 'Don\'t show music like this', 'Show this album again', P.block, P.block)
          + '</span></li>').join('');
        q('.q-count').textContent = queue.length ? `${queue.length} albums` : '';
        q('.q-foot').textContent = queue.length ? `${Math.max(0, at)} of ${queue.length} played` : '';
      }
      if (s.savedList !== undefined) {
        // a song was added: its cover appears above the Liked Songs icon and shrinks into it, and the icon jumps and wobbles as if it kept it
        if (savedCount !== null && s.savedList.length > savedCount) {
          // one at a time: songs that arrive while it plays (an album adds many, one after the other) don't restart it halfway
          const ic = q('.x-saved .x-icon');
          if (!ic.classList.contains('bump')) {
            const art = (s.savedList[0] || {}).art;
            const cover = typeof art === 'string' && art.startsWith('https://') ? flyCover(ic, art) : null;
            ic.style.setProperty('--dr-bump-delay', cover ? 'var(--dr-fly-land)' : '0s'); // with a cover, it lands first
            const done = () => { ic.classList.remove('bump'); if (cover) cover.remove(); };
            ic.classList.add('bump');
            ic.addEventListener('animationend', done, { once: true });
            setTimeout(done, 1600); // (no animationend when motion is reduced or the bar is out of sight)
          }
        }
        savedCount = s.savedList.length;
        q('.saved ol').innerHTML = s.savedList.length
          ? s.savedList.map((it) => `<li data-id="${esc(it.id)}" data-i="${esc(it.i)}" data-title="${esc(it.title || '')}">${rowCover(it.art, false)}${rowText(it.title, `${it.artist} · ${it.album}`)}<span class="qact">`
            + action('wish', it.wished, 'Add to wishlist', 'Remove from wishlist', P.heart, P.heartOn)
            + action('save', true, '', 'Remove from Liked Songs', P.addCircle, P.checkCircle)
            + '</span></li>').join('')
          : EMPTY_LIKED;
        q('.l-count').textContent = s.savedList.length ? `${s.savedList.length} ${s.savedList.length === 1 ? 'song' : 'songs'}` : '';
      }
      q('.queue').classList.toggle('audible', !!s.playing);
      // wishlist heart and thumb down: each one has its own icon and label
      const paint = (selector, on, offLabel, onLabel, offPath, onPath) => {
        const el = q(selector); el.classList.toggle('on', on);
        const label = on ? onLabel : offLabel;
        el.title = label; el.setAttribute('aria-label', label); el.querySelector('title').textContent = label;
        const path = el.querySelector('path'); const d = on ? onPath : offPath;
        if (path.getAttribute('d') !== d) path.setAttribute('d', d);
      };
      paint('.wish', !!s.wished, 'Add to wishlist', 'Remove from wishlist', P.heart, P.heartOn);
      paint('.save', !!s.isSaved, 'Add to Liked Songs', 'Remove from Liked Songs', P.addCircle, P.checkCircle); // a ticked, filled circle once it is in the list
      paint('.dislike', !!s.disliked, "Don't show music like this", 'Show this album again', P.block, P.block);
      setText(q('.trk-no'), s.trackNo && !s.msg ? `${s.trackNo}. ` : '');
      setText(q('.trk'), s.msg || s.track || '');
      setText(q('.pos'), mmss(s.cur)); setText(q('.dur'), mmss(s.dur));
      const busy = !!s.busy, playing = !!s.playing && !busy;
      q('.play').style.display = !busy && !playing ? 'inline-block' : 'none';
      q('.pause').style.display = playing ? 'inline-block' : 'none';
      q('.busy').style.display = busy ? 'block' : 'none';
      const pp = q('.playpause'); const ppl = busy ? 'Loading' : playing ? 'Pause' : 'Play';
      pp.setAttribute('aria-label', ppl); pp.title = ppl;
      const f = s.dur ? s.cur / s.dur : 0;
      if (!seeking) { q('.progress').style.width = pct(f); q('.seek-control').style.left = pct(f); }
      q('.buffer').style.width = pct(s.dur ? s.buf / s.dur : 0);
      q('.progress-bar').setAttribute('aria-valuenow', Math.round(f * 100));
      q('.progress-bar').setAttribute('aria-valuetext', `${mmss(s.cur)} of ${mmss(s.dur)}`);
      q('.vol-slider').setAttribute('aria-valuenow', Math.round((s.vol || 0) * 100));
      q('.prev-icon').classList.toggle('disabled', !s.hasPrev);
      q('.prev-icon').setAttribute('aria-disabled', String(!s.hasPrev)); q('.next-icon').setAttribute('aria-disabled', String(!s.hasNext));
      q('.next-icon').classList.toggle('disabled', !s.hasNext);
      q('.vol-amt').style.width = pct(s.vol); q('.vol-control').style.left = pct(s.vol);
      const icon = q('.vol-icon path'); const want = s.vol > 0 ? P.vol : P.mute;
      if (icon.getAttribute('d') !== want) icon.setAttribute('d', want);
      // Play mode: the label of the button is the mode that is on
      const modeIcon = s.mode === 'album' || s.mode === 'shuffle' ? s.mode : 'one';
      setText(q('.pb-label'), { one: 'One per album', shuffle: 'Shuffle', album: 'Full album' }[modeIcon]); // short on the button, the list has the full names
      const slot = q('.pb-slot');
      if (slot.dataset.icon !== modeIcon) { slot.innerHTML = MODE_ICON[modeIcon]; slot.dataset.icon = modeIcon; }
      for (const option of el.querySelectorAll('.pb-opt')) {
        const on = option.dataset.mode === modeIcon;
        option.classList.toggle('sel', on); option.setAttribute('aria-checked', String(on));
      }
    }
    return { el, update, closeMenus: () => { setModeMenu(false); closePanels(); } };
  }
  globalThis.BCPlayer = { create };
})();

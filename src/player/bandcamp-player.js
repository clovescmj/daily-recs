// Player that looks identical to Bandcamp's own. Classic script (no imports), used by the content script.
// It never touches audio: it receives state via update() and returns commands via onCmd().
(() => {
  // Paths on a 24 grid: Material Symbols (the 18 px variants), converted. The Liked Songs icon, the play and pause of the big button and the spinner are in the markup below.
  const P = {
    vol: 'M14 21.111v-2.083q2.389 -0.639 3.861 -2.597T19.333 12q0 -2.472 -1.486 -4.403T14 4.944v-2.083q3.222 0.694 5.278 3.25t2.056 5.861q0 3.306 -2.042 5.875T14 21.111ZM2.667 14.639v-5.333h4l5.333 -5.333v16L6.667 14.639H2.667Zm11.333 1.528v-8.389q1.25 0.556 1.958 1.694t0.708 2.5q0 1.361 -0.708 2.486T14 16.167Z',
    mute: 'M20 22.833 17.028 19.861q-0.611 0.389 -1.458 0.736T14 21.111v-2.056q0.333 -0.139 0.792 -0.319T15.556 18.389L12 14.833v5.194L6.667 14.694H2.667v-5.333h3.833L1.167 4l1.417 -1.417 18.833 18.833 -1.417 1.417Zm-0.167 -5.806 -1.444 -1.444q0.444 -0.806 0.694 -1.708t0.25 -1.847q0 -2.472 -1.486 -4.403T14 4.972v-2.056q3.25 0.639 5.292 3.222T21.333 12.028q0 1.333 -0.389 2.597T19.833 17.028ZM16.389 13.583l-2.389 -2.389v-3.389q1.25 0.556 1.958 1.708T16.667 12.028q0 0.389 -0.056 0.778t-0.222 0.778ZM12 9.194l-2.583 -2.583 2.583 -2.583v5.167Z',
    heart: 'M12 21.333l-1.389 -1.25q-2.778 -2.472 -4.583 -4.236t-2.847 -3.139Q2.139 11.333 1.736 10.194T1.333 7.861q0 -2.472 1.694 -4.167t4.167 -1.694q1.361 0 2.639 0.583t2.167 1.639q0.889 -1.056 2.167 -1.639t2.639 -0.583q2.472 0 4.167 1.694t1.694 4.167q0 1.194 -0.389 2.306t-1.431 2.472q-1.042 1.361 -2.861 3.153T13.333 20.139l-1.333 1.194Zm0 -2.694q2.583 -2.306 4.25 -3.931t2.653 -2.833Q19.889 10.667 20.278 9.722t0.389 -1.861q0 -1.639 -1.111 -2.75t-2.75 -1.111q-0.972 0 -1.819 0.403T13.528 5.528l-0.972 1.139h-1.111l-0.972 -1.139q-0.611 -0.722 -1.486 -1.125T7.194 4q-1.639 0 -2.75 1.111t-1.111 2.75q0 0.917 0.361 1.819t1.319 2.097q0.958 1.194 2.639 2.833T12 18.639Zm0 -7.333Z',
    heartOn: 'M12 21.333l-1.389 -1.25q-2.778 -2.472 -4.583 -4.236t-2.847 -3.139Q2.139 11.333 1.736 10.194T1.333 7.861q0 -2.472 1.694 -4.167t4.167 -1.694q1.361 0 2.639 0.583t2.167 1.639q0.889 -1.056 2.167 -1.639t2.639 -0.583q2.472 0 4.167 1.694t1.694 4.167q0 1.194 -0.389 2.306t-1.431 2.472q-1.042 1.361 -2.861 3.153T13.333 20.139l-1.333 1.194Z',
    addCircle: 'M11 17.333h2v-4.333h4.333v-2H13v-4.333h-2v4.333H6.667v2h4.333v4.333Zm1.008 5.333Q9.806 22.667 7.861 21.833t-3.403 -2.292Q3 18.083 2.167 16.14t-0.833 -4.153Q1.333 9.778 2.167 7.847q0.833 -1.931 2.292 -3.389T7.86 2.167q1.943 -0.833 4.153 -0.833t4.14 0.833q1.931 0.833 3.389 2.292T21.833 7.853q0.833 1.937 0.833 4.139Q22.667 14.194 21.833 16.139t-2.292 3.403Q18.083 21 16.147 21.833q-1.937 0.833 -4.139 0.833Zm-0.008 -2q3.611 0 6.139 -2.528t2.528 -6.139q0 -3.611 -2.528 -6.139t-6.139 -2.528q-3.611 0 -6.139 2.528t-2.528 6.139q0 3.611 2.528 6.139t6.139 2.528Zm0 -8.667Z',
    checkCircle: 'M10.583 16l6.611 -6.583 -1.417 -1.417 -5.194 5.167 -2.361 -2.333 -1.417 1.417 3.778 3.75Zm1.417 6.667q-2.194 0 -4.139 -0.833t-3.403 -2.292Q3 18.083 2.167 16.139T1.333 12q0 -2.222 0.833 -4.153t2.292 -3.389Q5.917 3 7.861 2.167t4.139 -0.833q2.222 0 4.153 0.833t3.389 2.292Q21 5.917 21.833 7.847T22.667 12q0 2.194 -0.833 4.139t-2.292 3.403Q18.083 21 16.153 21.833T12 22.667Z',
    block: 'M7.861 21.833q-1.944 -0.833 -3.403 -2.292T2.167 16.139q-0.833 -1.944 -0.833 -4.139 0 -2.222 0.833 -4.153t2.292 -3.389Q5.917 3 7.861 2.167t4.153 -0.833q2.208 0 4.139 0.833t3.389 2.292Q21 5.917 21.833 7.847T22.667 12q0 2.194 -0.833 4.139t-2.292 3.403Q18.083 21 16.153 21.833t-4.139 0.833Q9.806 22.667 7.861 21.833Zm4.139 -1.167q1.528 0 2.889 -0.5t2.472 -1.389L5.222 6.639q-0.889 1.111 -1.389 2.472t-0.5 2.889q0 3.611 2.528 6.139t6.139 2.528Zm6.778 -3.306q0.889 -1.111 1.389 -2.472t0.5 -2.889q0 -3.611 -2.528 -6.139t-6.139 -2.528q-1.528 0 -2.889 0.5t-2.472 1.389l12.139 12.139ZM12 12Z',
    queue: 'M2.667 14.333v-2h8v2H2.667Zm0 -4.167v-2h12v2H2.667Zm0 -4.167v-2h12v2H2.667Zm13.333 14v-8.667l6.667 4.333 -6.667 4.333Z',
    pause: 'M14.333 19v-14h4.667v14H14.333Zm-9.333 0v-14h4.667v14H5Z',
    play: 'M8 19.333v-14.667l11.333 7.333 -11.333 7.333Z',
    close: 'M6.75 18.667l-1.417 -1.417 5.25 -5.25 -5.25 -5.25 1.417 -1.417 5.25 5.25 5.25 -5.25 1.417 1.417 -5.25 5.25 5.25 5.25 -1.417 1.417 -5.25 -5.25 -5.25 5.25Z',
    shuffle: 'M14.667 20v-2h1.917L13.417 14.833l1.417 -1.417 3.167 3.167v-1.917h2v5.333H14.667Zm-9.25 0 -1.417 -1.417 12.583 -12.583h-1.917v-2h5.333v5.333h-2v-1.917L5.417 20Zm3.75 -9.417L4 5.417l1.417 -1.417 5.167 5.167 -1.417 1.417Z',
    shuffleOn: 'M2 24q-0.825 0 -1.412 -0.587Q0 22.825 0 22v-20q0 -0.825 0.587 -1.412Q1.175 0 2 0h20q0.825 0 1.412 0.587Q24 1.175 24 2v20q0 0.825 -0.587 1.412Q22.825 24 22 24H2Zm12.667 -4h5.333v-5.333h-2v1.917L14.833 13.417l-1.417 1.417 3.167 3.167h-1.917v2Zm-9.25 0 12.583 -12.583v1.917h2v-5.333H14.667v2h1.917L4 18.583l1.417 1.417Zm3.75 -9.417 1.417 -1.417 -5.167 -5.167 -1.417 1.417 5.167 5.167Z',
  };
  const svg = (p, cls, label, name) => `<svg class="${cls}" viewBox="0 0 24 24" role="img" aria-label="${name}"><title>${name}</title><path d="${p}"/>${label ? `<text x="12" y="16" font-size="7.5" font-weight="bold" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${label}</text>` : ''}</svg>`;
  // The icon of the Liked Songs list (Material "library music": your own file, as it is).
  const LIKED_ICON = `<svg class="x-icon" viewBox="0 0 24 24" role="img" aria-label="Liked Songs"><title>Liked Songs</title><path d="M12.66 15.333Q13.778 15.333 14.556 14.56q0.778 -0.773 0.778 -1.893v-5.333h3.333v-2.667H14v5.694q-0.306 -0.167 -0.625 -0.264T12.667 10q-1.12 0 -1.893 0.771 -0.773 0.772 -0.773 1.889Q10 13.778 10.771 14.556q0.772 0.778 1.889 0.778ZM7.333 18.667q-0.825 0 -1.412 -0.587Q5.333 17.492 5.333 16.667v-13.333q0 -0.825 0.587 -1.412Q6.508 1.333 7.333 1.333h13.333q0.825 0 1.412 0.587Q22.667 2.508 22.667 3.333v13.333q0 0.825 -0.587 1.412Q21.492 18.667 20.667 18.667H7.333ZM3.333 22.667q-0.825 0 -1.412 -0.587Q1.333 21.492 1.333 20.667v-15.333h2v15.333h15.333v2H3.333Z"/></svg>`;
  const LIKED_PATH = 'M12.66 15.333Q13.778 15.333 14.556 14.56q0.778 -0.773 0.778 -1.893v-5.333h3.333v-2.667H14v5.694q-0.306 -0.167 -0.625 -0.264T12.667 10q-1.12 0 -1.893 0.771 -0.773 0.772 -0.773 1.889Q10 13.778 10.771 14.556q0.772 0.778 1.889 0.778ZM7.333 18.667q-0.825 0 -1.412 -0.587Q5.333 17.492 5.333 16.667v-13.333q0 -0.825 0.587 -1.412Q6.508 1.333 7.333 1.333h13.333q0.825 0 1.412 0.587Q22.667 2.508 22.667 3.333v13.333q0 0.825 -0.587 1.412Q21.492 18.667 20.667 18.667H7.333ZM3.333 22.667q-0.825 0 -1.412 -0.587Q1.333 21.492 1.333 20.667v-15.333h2v15.333h15.333v2H3.333Z';
  const EMPTY_LIKED = `<li class="empty"><svg class="empty-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${LIKED_PATH}"/></svg><strong>No liked songs yet</strong><span>Click the ${svg(P.addCircle, 'ci', '', 'Add to Liked Songs')} on an album or in the player to save songs here.</span></li>`;
  const isImageUrl = (u) => typeof u === 'string' && /^(https:|data:image)/.test(u);
  const mmss = (s) => (isFinite(s) && s > 0 ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '00:00');
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let savedCount = null;
  // The menu of the hide button: why the album is hidden (the labels are those of HIDE_REASON_LABELS in src/lib/decisions.js).
  const HIDE_REASONS = [['genre', 'Wrong genre'], ['sound', 'Not my sound'], ['obscure', 'Too obscure'], ['known', 'Already know it']];
  const ACT_KIND = { wish: 'wish', save: 'save', saveAlbum: 'save', saveSong: 'save', dislike: 'dislike' };
  /** One icon of a row of the queue or of the Liked list. */
  const action = (name, on, label, onLabel, path, onPath) => `<a href="#" class="dr-act dr-act--${ACT_KIND[name]} q-${name}${on ? ' on' : ''}" data-act="${name}" title="${on ? onLabel : label}" aria-label="${on ? onLabel : label}">${svg(on ? onPath : path, 'ci', '', on ? onLabel : label)}</a>`;
  const queueVersion = (items) => items.map((it) => `${it.id}:${it.i === undefined ? '' : it.i}${it.sec || ''}${it.wished ? 'w' : ''}${it.saved ? 's' : ''}${it.placeholder ? 'p' : ''}`).join(',');
  /** The cover of a row (the same box when there is none, so the rows keep their height). */
  const rowCover = (art) => `<span class="qcover" role="button" tabindex="0" aria-label="Play song">${isImageUrl(art) ? `<img src="${esc(art)}" alt="">` : ''}<span class="qplay"><svg class="qp-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P.play}"/></svg><svg class="qp-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P.pause}"/></svg></span></span>`;
  /**
   * The song and the artist (or the album) of a row: one link to the album, in a new tab, that wraps both lines and is underlined under the pointer.
   * Without an address, the same two lines as plain text.
   */
  const rowText = (title, sub, url) => {
    const lines = `<b>${esc(title)}</b><span>${esc(sub)}</span>`;
    const link = typeof url === 'string' && url.startsWith('https://')
      ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="qlink" data-open title="View album">${lines}</a>` : `<span class="qlink">${lines}</span>`;
    return `<span class="qtext">${link}</span>`;
  };
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
        <div class="playpause" role="button" tabindex="0" aria-label="Play" title="Play"><svg class="play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 19.333v-14.667l11.333 7.333 -11.333 7.333Z"/></svg><svg class="pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.333 19v-14h4.667v14H14.333Zm-9.333 0v-14h4.667v14H5Z"/></svg><div class="busy" role="img" aria-label="Loading"><svg viewBox="0 0 46 44" aria-hidden="true" focusable="false"><g><circle cx="14.59" cy="13.56" r="3.42"/><circle cx="23.03" cy="10.06" r="3.42" fill-opacity="0.47"/><circle cx="31.47" cy="13.56" r="3.42" fill-opacity="0.47"/><circle cx="34.97" cy="22.00" r="3.42" fill-opacity="0.68"/><circle cx="31.47" cy="30.44" r="3.42" fill-opacity="0.68"/><circle cx="23.03" cy="33.94" r="3.42" fill-opacity="0.87"/><circle cx="14.59" cy="30.44" r="3.42" fill-opacity="0.87"/><circle cx="11.09" cy="22.00" r="3.42"/></g></svg></div></div>
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
        <a href="#" class="x-btn x-shuffle" role="button" aria-pressed="false" title="Shuffle&#10;One song from each album, in random order" aria-label="Shuffle: one song from each album, in random order">${svg(P.shuffle, 'x-icon', '', 'Shuffle')}</a>
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
        <div class="queue-header"><div class="queue-title"><h2>Recommendations queue</h2><span class="q-count"></span></div><span class="q-close" role="button" tabindex="0" aria-label="Close queue" title="Close queue">${svg(P.close, 'close-icon', '', 'Close queue')}</span></div>
        <ol></ol>
        <div class="queue-foot"><span class="q-foot"></span></div>
      </div>
      <div class="queue saved" role="dialog" aria-label="Liked Songs">
        <div class="queue-header"><div class="queue-title"><h2>Liked Songs</h2><span class="l-count"></span></div><span class="l-close" role="button" tabindex="0" aria-label="Close Liked Songs" title="Close Liked Songs">${svg(P.close, 'close-icon', '', 'Close Liked Songs')}</span></div>
        <ol>${EMPTY_LIKED}</ol>
        <div class="queue-foot"><span>Saved in this browser · not synced</span><button type="button" class="l-export" title="Download your Liked Songs as a CSV file" hidden>Export liked songs</button></div>
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
    // Shuffle: one button that is on or off (Full album, the other way to play, is the default)
    let closePanels = () => {};
    let shuffleOn = false;
    q('.x-shuffle').addEventListener('click', (e) => { e.preventDefault(); onCmd('mode', shuffleOn ? 'album' : 'shuffle'); });
    q('.wish').addEventListener('click', (e) => { e.preventDefault(); onCmd('wish'); });
    q('.save').addEventListener('click', (e) => { e.preventDefault(); onCmd('save'); });
    // The hide button asks why first (the menu opens over the bar); when the album is already hidden, the click takes it back.
    let hideMenu = null;
    const closeHideMenu = () => { if (hideMenu) { hideMenu.remove(); hideMenu = null; } };
    const openHideMenu = (anchor, albumId) => {
      closeHideMenu();
      hideMenu = document.createElement('div');
      hideMenu.className = 'dr-menu dr-hide-menu';
      hideMenu.setAttribute('role', 'menu');
      hideMenu.setAttribute('aria-label', 'Why hide this album?');
      const row = (reason, label, extra = '') => `<button type="button" class="dr-menu-row${extra}" role="menuitem" data-hide-reason="${reason}">${esc(label)}</button>`;
      hideMenu.innerHTML = '<div class="dr-menu-head"><b>Why hide it?</b></div>'
        + HIDE_REASONS.map(([reason, label]) => row(reason, label)).join('') + row('', 'Just hide it', ' dr-hide-plain');
      el.appendChild(hideMenu);
      const box = el.getBoundingClientRect();
      const rect = anchor.getBoundingClientRect();
      const width = hideMenu.offsetWidth;
      hideMenu.style.left = `${Math.max(0, Math.min(rect.left - box.left, box.width - width - 8))}px`;
      // above the button (the bar is at the bottom of the window), and never out of the top of it
      hideMenu.style.bottom = `${Math.max(0, Math.min(box.bottom - rect.top + 6, box.bottom - hideMenu.offsetHeight - 8))}px`;
      hideMenu.addEventListener('click', (event) => {
        const item = event.target.closest('[data-hide-reason]');
        if (!item) return;
        event.stopPropagation();
        const reason = item.dataset.hideReason;
        closeHideMenu();
        onCmd('dislike', albumId ? { id: albumId, reason } : { reason });
      });
      hideMenu.querySelector('button').focus();
    };
    document.addEventListener('click', (event) => { if (hideMenu && !hideMenu.contains(event.target) && !event.target.closest('.dislike, .q-dislike')) closeHideMenu(); }, true);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeHideMenu(); });
    q('.dislike').addEventListener('click', (e) => {
      e.preventDefault();
      if (lastState && lastState.disliked) onCmd('dislike'); else openHideMenu(e.currentTarget, '');
    });
    // the queue and the Liked list are two panels over the bar: opening one closes the other
    /** Opening the queue brings the album that is playing to the top of the list, under its "Playing now" heading. */
    const scrollToPlaying = () => {
      const list = q('.queue ol'); const row = list.querySelector('li.active');
      if (!row) { list.scrollTop = 0; return; }
      const from = row.previousElementSibling && row.previousElementSibling.classList.contains('qsec') ? row.previousElementSibling : row;
      list.scrollTop += from.getBoundingClientRect().top - list.getBoundingClientRect().top;
    };
    const setQueue = (on) => { if (on) setSaved(false); q('.queue').classList.toggle('show', on); q('.x-queue').classList.toggle('active', on); if (on) scrollToPlaying(); };
    const setSaved = (on) => { if (on) setQueue(false); q('.saved').classList.toggle('show', on); q('.x-saved').classList.toggle('active', on); };
    q('.x-queue').addEventListener('click', (e) => { e.preventDefault(); setQueue(!q('.queue').classList.contains('show')); });
    q('.x-saved').addEventListener('click', (e) => { e.preventDefault(); setSaved(!q('.saved').classList.contains('show')); });
    // a click outside the bar closes the panels too (the page inside the frame reports its clicks through closeMenus)
    document.addEventListener('click', (e) => { if (!e.composedPath().includes(el)) { setQueue(false); setSaved(false); } });
    closePanels = () => { setQueue(false); setSaved(false); };
    q('.q-close').addEventListener('click', () => setQueue(false));
    q('.l-close').addEventListener('click', () => setSaved(false));
    q('.l-export').addEventListener('click', () => onCmd('exportLiked'));
    // the elements with role="button" that are not links or buttons answer Enter and Space like a click
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target.closest('.q-close, .l-close, .qcover');
      if (!target) return;
      e.preventDefault();
      target.click();
    });
    q('.queue ol').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      if (e.target.closest('[data-open]')) return; // the link of the song and the artist opens the album in a new tab
      const act = e.target.closest('[data-act]');
      if (!act && li.classList.contains('active')) { onCmd('toggle'); return; } // the song that plays: the click pauses or resumes it
      const i = li.dataset.i === undefined ? -1 : Number(li.dataset.i);
      const track = { id: li.dataset.id, i, title: li.dataset.title || '' };
      if (act && act.dataset.act === 'dislike') { e.preventDefault(); openHideMenu(act, li.dataset.id); return; } // (the hide button asks why first)
      if (act) { e.preventDefault(); onCmd(act.dataset.act, act.dataset.act === 'save' ? track : li.dataset.id); } // (a song row: its own + )
      else if (i >= 0) onCmd('playTrack', track); // a song of the queue: its album from that song
      else onCmd('playAlbum', li.dataset.id);
    });
    q('.saved ol').addEventListener('click', (e) => { // each item is a track: { id, i, title }
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      const track = { id: li.dataset.id, i: Number(li.dataset.i), title: li.dataset.title };
      if (e.target.closest('[data-open]')) return; // the link to the album opens in a new tab: no song starts
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
      if (isImageUrl(s.art)) { if (img.getAttribute('src') !== s.art) img.src = s.art; } else img.removeAttribute('src');
      q('.np-art').href = q('.np-link').href = typeof s.url === 'string' && s.url.startsWith('https://') ? s.url : '#'; // (only https: this page is bandcamp.com)
      img.alt = s.albumTitle ? `Cover of ${s.albumTitle}${s.artist ? ` by ${s.artist}` : ''}` : 'No album playing';
      setText(q('.now-playing .title'), s.songTitle || s.albumTitle || ''); // the song, with the artist under it
      setText(q('.now-playing .artist span'), s.artist || '');
      q('.now-playing .artist').style.display = s.artist ? '' : 'none';
      q('.collect').style.visibility = s.artist && !s.plain ? '' : 'hidden'; // a song played while waiting is not on any list: nothing to wish, like or skip
      // queue: only redraw when the rows, the song that plays or the play mode change (`queue` omitted = unchanged)
      if (s.queue != null) { queue = s.queue; queueKey = queueVersion(queue); }
      const sig = `${s.curId}|${queueKey}|${s.mode}|${s.queueMore ? 1 : 0}|${s.queuePlayed || 0}|${s.queueAlbums || 0}`;
      if (sig !== queueSig) {
        queueSig = sig;
        const bySection = queue.some((it) => it.sec); // Full album: the queue says itself which songs played, play now and come next
        const at = queue.findIndex((it) => it.id === s.curId);
        const NAMES = { played: 'Played', now: 'Playing now', next: 'Up next' };
        const sectionLi = (name) => `<li class="qsec">${name}</li>`;
        // Shuffle rows carry no section: what is before the song that plays played, the rest comes next
        const shuffleHeading = (i) => {
          let html = '';
          if (i === 0 && at > 0) html += sectionLi('Played');
          if (at < 0) return i === 0 ? html + sectionLi('Up next') : html;
          if (i === at) html += sectionLi('Playing now');
          else if (i === at + 1) html += sectionLi('Up next');
          return html;
        };
        const heading = (it, i) => {
          if (!bySection) return shuffleHeading(i);
          return i === 0 || queue[i - 1].sec !== it.sec ? sectionLi(NAMES[it.sec]) : '';
        };
        const sub = (it) => (it.track || it.named ? `${it.artist} · ${it.album}` : it.artist); // (a row named by its album has no song to say)
        q('.queue ol').innerHTML = queue.map((it, i) => {
          const current = bySection ? it.sec === 'now' : it.id === s.curId;
          const song = it.track === true;
          return heading(it, i)
            + `<li data-id="${esc(it.id)}"${song ? ` data-i="${esc(it.i)}" data-title="${esc(it.title)}"` : ''} class="${current ? 'active' : ''}" title="${current ? (s.playing ? 'Pause' : 'Play') : 'Play song'}">${rowCover(it.art)}${rowText(it.title, sub(it), it.url)}<span class="qact">`
            + action('wish', it.wished, 'Add to wishlist', 'Remove from wishlist', P.heart, P.heartOn)
            + (song
              ? action('save', it.saved, 'Add to Liked Songs', 'Remove from Liked Songs', P.addCircle, P.checkCircle)
              : action(s.mode === 'shuffle' ? 'saveSong' : 'saveAlbum', it.saved, s.mode === 'shuffle' ? 'Add song to Liked Songs' : 'Add album to Liked Songs', s.mode === 'shuffle' ? 'Remove song from Liked Songs' : 'Remove album from Liked Songs', P.addCircle, P.checkCircle))
            + action('dislike', false, 'Don\'t show music like this', 'Show this album again', P.block, P.block)
            + '</span></li>';
        }).join('') + (s.queueMore ? '<li class="qmore">More songs load as you listen</li>' : '');
      }
      const playingRow = q('.queue ol li.active');
      if (playingRow) {
        const label = s.playing ? 'Pause' : 'Play'; // (the song that plays: its click pauses or resumes it)
        playingRow.title = label;
        playingRow.querySelector('.qcover').setAttribute('aria-label', label);
      }
      // the count at the top is always of albums; the foot says how far the list has gone
      const albums = s.queueAlbums != null ? s.queueAlbums : queue.length;
      setText(q('.q-count'), albums ? `${albums} album${albums === 1 ? '' : 's'}` : '');
      setText(q('.q-foot'), albums ? `${s.queuePlayed || 0} of ${albums} albums played` : '');
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
          ? s.savedList.map((it) => `<li data-id="${esc(it.id)}" data-i="${esc(it.i)}" data-title="${esc(it.title || '')}" title="Play song">${rowCover(it.art)}${rowText(it.title, `${it.artist} · ${it.album}`, it.url)}<span class="qact">`
            + action('wish', it.wished, 'Add to wishlist', 'Remove from wishlist', P.heart, P.heartOn)
            + action('save', true, '', 'Remove from Liked Songs', P.addCircle, P.checkCircle)
            + '</span></li>').join('')
          : EMPTY_LIKED;
        q('.l-export').hidden = !s.savedList.length;
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
      // Shuffle: its own icon and the blue of the active icons when it is on
      shuffleOn = s.mode === 'shuffle';
      const shuffleBtn = q('.x-shuffle');
      shuffleBtn.classList.toggle('active', shuffleOn); shuffleBtn.setAttribute('aria-pressed', String(shuffleOn));
      const shufflePath = shuffleBtn.querySelector('path'); const wantShuffle = shuffleOn ? P.shuffleOn : P.shuffle;
      if (shufflePath.getAttribute('d') !== wantShuffle) shufflePath.setAttribute('d', wantShuffle);
    }
    return { el, update, closeMenus: () => { closePanels(); } };
  }
  globalThis.BCPlayer = { create };
})();

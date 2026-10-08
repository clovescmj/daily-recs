// Player that looks identical to Bandcamp's own. Classic script (no imports), used by the content script.
// It never touches audio: it receives state via update() and returns commands via onCmd().
(() => {
  const P = {
    vol: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    mute: 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
    skip: 'M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z',
    heart: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
    heartOn: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    addCircle: 'M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    bookmark: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z',
    musicNote: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
    albumDisc: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z',
    block: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z',
    queue: 'M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  };
  // Material "shuffle": straight diagonals and solid arrow heads.
  const SHUFFLE = `<svg class="x-icon x-shuffle" viewBox="0 0 24 24" role="img" aria-label="Shuffle"><title>Shuffle</title><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`;
  const svg = (p, cls, label, name) => `<svg class="${cls}" viewBox="0 0 24 24" role="img" aria-label="${name}"><title>${name}</title><path d="${p}"/>${label ? `<text x="12" y="16" font-size="7.5" font-weight="bold" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${label}</text>` : ''}</svg>`;
  // "Next album" icon: the record box from Bandcamp's menu (collection-outline-icon, minus the two top lines),
  // with a notch in the bottom-right corner where the ▶| triangle sits.
  const NEXT_ALBUM = `<svg class="x-icon x-wide" viewBox="3.75 3.9 22 22" fill="currentColor" stroke="none" role="img" aria-label="Next album">
    <title>Next album</title><defs><mask id="dr-notch" maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
      <rect width="40" height="40" fill="#fff"/><rect x="17.25" y="13.9" width="20" height="20" fill="#000"/></mask></defs>
    <g mask="url(#dr-notch)">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M4.657 8.31c0-.7.567-1.269 1.268-1.269H18.91c.7 0 1.268.568 1.268 1.269v13.187c0 .7-.567 1.268-1.268 1.268H5.925c-.7 0-1.268-.568-1.268-1.268zm1.521.253v12.68h12.479V8.563z"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M12.418 13.33c-.823 0-1.529.683-1.529 1.573s.706 1.573 1.529 1.573c.822 0 1.528-.682 1.528-1.573s-.706-1.573-1.528-1.573m-4.694 1.573c0-2.595 2.08-4.738 4.694-4.738s4.694 2.143 4.694 4.738-2.08 4.74-4.694 4.74-4.694-2.144-4.694-4.74"/>
    </g>
    <g transform="translate(18.72 15.37) scale(0.212)"><path d="M22.9043 13.2236V0.106445H28.2109V30.5322H22.9043V17.4141L0 30.6387V0L22.9043 13.2236Z"/></g></svg>`;
  const mmss = (s) => (isFinite(s) && s > 0 ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '00:00');
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const queueVersion = (items) => items.map((it) => `${it.id}${it.wished ? 'w' : ''}`).join(',');
  const pct = (x) => `${Math.max(0, Math.min(1, x || 0)) * 100}%`;

  function create({ spriteUrl, busyUrl, onCmd }) {
    const el = document.createElement('div');
    el.id = 'dr-player';
    el.hidden = true;
    el.classList.add('is-offscreen');
    el.style.setProperty('--dr-sprite', `url(${spriteUrl})`);
    el.style.setProperty('--dr-busy', `url(${busyUrl})`);
    el.innerHTML = `<div class="carousel-player-inner">
      <div class="col col-4-15 now-playing">
        <a class="np-art" target="_blank" rel="noopener" aria-label="Open album on Bandcamp"><img alt="No album playing"></a>
        <div class="info"><a class="np-link" target="_blank" rel="noopener"><div class="title"></div><div class="artist">by <span></span></div></a>
          <div class="collect"><a class="wish" href="#" title="Add to wishlist" aria-label="Add to wishlist">${svg(P.heart, 'ci', '', 'Add to wishlist')}</a><a class="save" href="#" title="Add this song to Liked" aria-label="Add this song to Liked">${svg(P.addCircle, 'ci', '', 'Add this song to Liked')}</a><a class="dislike" href="#" title="Don't show music like this" aria-label="Don't show music like this">${svg(P.block, 'ci', '', 'Don\'t show music like this')}</a></div></div>
      </div>
      <div class="col col-7-15 progress-transport">
        <div class="playpause" role="button" tabindex="0" aria-label="Play" title="Play"><div class="play"></div><div class="pause"></div><div class="busy" role="img" aria-label="Loading"></div></div>
        <div class="info-progress">
          <div class="info">
            <div class="title"><a class="no-queue"><span class="trk-no"></span><span class="trk"></span></a></div>
            <div class="pos-dur"><span class="pos">00:00</span> / <span class="dur">00:00</span></div>
          </div>
          <div class="progress-bar" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress"></div><div class="buffer"></div><div class="progress-bg"></div>
            <div class="seek-control-outer"><div class="seek-control"></div></div></div>
        </div>
        <div class="transport"><div class="prev"><div class="icon prev-icon" role="button" tabindex="0" aria-label="Previous track" title="Previous track"></div></div><div class="next"><div class="icon next-icon" role="button" tabindex="0" aria-label="Next track" title="Next track"></div></div></div>
      </div>
      <div class="col col-4-15 controls-extra">
        <a href="#" class="x-btn x-shuf" title="Shuffle" aria-label="Shuffle">${SHUFFLE}</a>
        <a href="#" class="x-btn x-skip" title="Next album" aria-label="Next album">${NEXT_ALBUM}</a>
        <a href="#" class="x-btn x-mode active" title="One song per album" aria-label="One song per album">${svg(P.musicNote, 'x-icon', '', 'One song per album')}</a>
        <span class="x-sep" aria-hidden="true"></span>
        <a href="#" class="x-btn x-queue" title="Today's queue" aria-label="Today's queue">${svg(P.queue, 'x-icon', '', 'Today\'s queue')}</a>
        <a href="#" class="x-btn x-saved" title="Liked songs" aria-label="Liked songs">${svg(P.bookmark, 'x-icon', '', 'Liked songs')}</a>
        <span class="x-sep" aria-hidden="true"></span>
        <div class="vol">
          <div class="vol-icon-wrapper" role="button" tabindex="0" aria-label="Mute or unmute" title="Mute or unmute">${svg(P.vol, 'vol-icon', '', 'Volume')}</div>
          <div class="vol-slider" role="slider" tabindex="0" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div class="vol-amt"></div><div class="vol-bg"></div>
            <div class="vol-control-outer"><div class="vol-control"></div></div></div>
        </div>
      </div></div>
      <div class="queue" role="dialog" aria-label="Now playing recommendations">
        <div class="queue-header"><h2>now playing <b>recommendations</b></h2><span class="q-close" role="button" tabindex="0" aria-label="Close queue" title="Close queue">${svg(P.close, 'close-icon', '', 'Close queue')}</span></div>
        <ol></ol>
      </div>
      <div class="queue saved" role="dialog" aria-label="Liked">
        <div class="queue-header"><h2>your <b>liked</b> songs</h2><span class="l-close" role="button" tabindex="0" aria-label="Close Liked" title="Close Liked">${svg(P.close, 'close-icon', '', 'Close Liked')}</span></div>
        <ol></ol>
      </div>`;
    const q = (s) => el.querySelector(s);
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
    q('.prev-icon').addEventListener('click', (e) => { if (!e.target.classList.contains('disabled')) onCmd('prev'); });
    q('.next-icon').addEventListener('click', (e) => { if (!e.target.classList.contains('disabled')) onCmd('next'); });
    q('.x-shuf').addEventListener('click', (e) => { e.preventDefault(); onCmd('shuf'); });
    q('.x-mode').addEventListener('click', (e) => { e.preventDefault(); onCmd('mode'); });
    q('.wish').addEventListener('click', (e) => { e.preventDefault(); onCmd('wish'); });
    q('.save').addEventListener('click', (e) => { e.preventDefault(); onCmd('save'); });
    q('.dislike').addEventListener('click', (e) => { e.preventDefault(); onCmd('dislike'); });
    // the queue and the Liked list are two panels over the bar: opening one closes the other
    const setQueue = (on) => { if (on) setSaved(false); q('.queue').classList.toggle('show', on); q('.x-queue').classList.toggle('active', on); };
    const setSaved = (on) => { if (on) setQueue(false); q('.saved').classList.toggle('show', on); q('.x-saved').classList.toggle('active', on); };
    q('.x-queue').addEventListener('click', (e) => { e.preventDefault(); setQueue(!q('.queue').classList.contains('show')); });
    q('.x-saved').addEventListener('click', (e) => { e.preventDefault(); setSaved(!q('.saved').classList.contains('show')); });
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
    q('.x-skip').addEventListener('click', (e) => { e.preventDefault(); onCmd('skip'); });
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
      setText(q('.now-playing .title'), s.albumTitle || '');
      setText(q('.now-playing .artist span'), s.artist || '');
      q('.now-playing .artist').style.display = s.artist ? '' : 'none';
      q('.collect').style.visibility = s.artist ? '' : 'hidden';
      // queue: only redraw when the list or the current album change (`queue` omitted = unchanged)
      if (s.queue !== undefined) { queue = s.queue; queueKey = queueVersion(queue); }
      const sig = `${s.curId}|${queueKey}`;
      if (sig !== queueSig) {
        queueSig = sig;
        const action = (name, on, label, onLabel, path, onPath) => `<a href="#" class="q-${name}${on ? ' on' : ''}" data-act="${name}" title="${on ? onLabel : label}" aria-label="${on ? onLabel : label}">${svg(on ? onPath : path, 'ci', '', on ? onLabel : label)}</a>`;
        q('.queue ol').innerHTML = queue.map((it, i) =>
          `<li data-id="${esc(it.id)}" class="${it.id === s.curId ? 'active' : ''}"><span class="qpp"></span><span class="qlabel">${i + 1}. ${esc(it.label)}</span><span class="qact">`
          + action('wish', it.wished, 'Add to wishlist', 'Remove from wishlist', P.heart, P.heartOn)
          + action('dislike', false, 'Don\'t show music like this', 'Show this album again', P.block, P.block)
          + '</span></li>').join('');
      }
      if (s.savedList !== undefined) {
        const action = (name, on, label, onLabel, path, onPath) => `<a href="#" class="q-${name}${on ? ' on' : ''}" data-act="${name}" title="${on ? onLabel : label}" aria-label="${on ? onLabel : label}">${svg(on ? onPath : path, 'ci', '', on ? onLabel : label)}</a>`;
        q('.saved ol').innerHTML = s.savedList.length
          ? s.savedList.map((it) => `<li data-id="${esc(it.id)}" data-i="${esc(it.i)}" data-title="${esc(it.title || '')}"><span class="qlabel">${esc(it.label)}</span><span class="qact">`
            + action('wish', it.wished, 'Add to wishlist', 'Remove from wishlist', P.heart, P.heartOn)
            + action('save', true, '', 'Remove from Liked', P.addCircle, P.addCircle)
            + '</span></li>').join('')
          : '<li class="empty">Nothing here yet. Tap the + on a song you like.</li>';
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
      paint('.save', !!s.isSaved, 'Add this song to Liked', 'Remove this song from Liked', P.addCircle, P.addCircle);
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
      q('.x-shuf').classList.toggle('active', !!s.shuffle);
      // a song per album (the default) has no shuffle: the list plays in order
      const one = s.mode !== 'album';
      q('.x-shuf').style.display = one ? 'none' : '';
      const mode = q('.x-mode'); mode.classList.toggle('active', one);
      const modeLabel = one ? 'One song per album (the featured song, or the first). Click for whole albums' : 'Whole albums. Click for one song per album';
      mode.title = modeLabel; mode.setAttribute('aria-label', modeLabel); mode.querySelector('title').textContent = modeLabel;
      const modePath = mode.querySelector('path'); const modeD = one ? P.musicNote : P.albumDisc;
      if (modePath.getAttribute('d') !== modeD) modePath.setAttribute('d', modeD);
    }
    return { el, update };
  }
  globalThis.BCPlayer = { create };
})();

// SVG icons (Material-style paths on a 24×24 grid) and the labels that go with them.
export const HEART = 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z';
export const HEART_FILLED = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
/** Circle with a slash: "don't show this again". */
export const BLOCK = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z';


/** Circle with a plus: add a song to Liked Songs. Once it is there: a filled disc with a check mark cut out of it (filled, like the heart). */
export const ADD_CIRCLE = 'M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z';
export const CHECK_CIRCLE = 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM7.668 11.497 10.242 14.348 16.275 7.505 17.625 8.695 10.258 17.052 6.332 12.703z';
export const wishlistLabel = (on) => (on ? 'Remove from wishlist' : 'Add to wishlist');
export const saveLabel = (on) => (on ? 'Remove album from Liked Songs' : 'Add album to Liked Songs'); // on the cards: the whole album
export const dislikeLabel = (on) => (on ? 'Show this album again' : "Don't show music like this");

/** An icon that carries its own accessible name. */
export const labelledIcon = (path, label) =>
  `<svg viewBox="0 0 24 24" role="img" aria-label="${label}"><title>${label}</title><path d="${path}"/></svg>`;

/** A purely decorative icon. */
export const decorativeIcon = (path) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;

/** Filled icons inside buttons (Material Symbols, 24×24): the list buttons and the arrow of the genre button. */
const fillIcon = (path, rule = 'nonzero', cls = '') =>
  `<svg class="icon-fill${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="${rule}" d="${path}"/></svg>`;

export const SPARKLES_ICON = fillIcon('M5.825 21l1.625 -7.025L2 9.25l7.2 -0.625 2.8 -6.625 2.8 6.625 7.2 0.625 -5.45 4.725 1.625 7.025 -6.175 -3.725 -6.175 3.725ZM17.25 7l0.525 -2.225 -1.775 -1.475 2.35 -0.2 0.9 -2.1 0.9 2.1 2.35 0.2 -1.775 1.475 0.525 2.225 -2 -1.175 -2 1.175Z');
export const TAGS_ICON = fillIcon('M11.15 22q-0.375 0 -0.75 -0.15t-0.675 -0.45L2.575 14.25q-0.3 -0.3 -0.438 -0.663T2 12.85q0 -0.375 0.138 -0.75t0.438 -0.675l8.8 -8.825q0.275 -0.275 0.65 -0.438t0.775 -0.163h7.175q0.825 0 1.413 0.588T21.975 4v7.175q0 0.4 -0.15 0.763T21.4 12.575L12.575 21.4q-0.3 0.3 -0.675 0.45t-0.75 0.15ZM17.475 8q0.625 0 1.062 -0.438T18.975 6.5q0 -0.625 -0.438 -1.062T17.475 5q-0.625 0 -1.062 0.438T15.975 6.5q0 0.625 0.438 1.062T17.475 8Z', 'evenodd');
export const TARGET_ARROW_ICON = fillIcon('M12 22.667q-2.194 0 -4.139 -0.833t-3.403 -2.292Q3 18.083 2.167 16.139T1.333 12q0 -2.222 0.833 -4.153t2.292 -3.389Q5.917 3 7.861 2.167t4.139 -0.833q1.611 0 3.069 0.458T17.778 3.056l-1.472 1.417q-0.972 -0.556 -2.056 -0.847T12 3.333q-3.611 0 -6.139 2.528t-2.528 6.139q0 3.611 2.528 6.139t6.139 2.528q3.611 0 6.139 -2.528t2.528 -6.139q0 -0.806 -0.139 -1.542T20.139 9l1.528 -1.5q0.472 1.028 0.736 2.153T22.667 12q0 2.194 -0.833 4.139t-2.292 3.403Q18.083 21 16.153 21.833T12 22.667Zm0 -4.333q-2.639 0 -4.486 -1.847T5.667 12q0 -2.639 1.847 -4.486T11.972 5.667q0.667 0 1.319 0.125T14.583 6.194l-1.611 1.556q-0.25 -0.056 -0.486 -0.083t-0.486 -0.028q-1.833 0 -3.097 1.264T7.639 12q0 1.833 1.264 3.083T12 16.333q0.889 0 1.694 -0.333t1.389 -0.917q0.444 -0.444 0.722 -0.972t0.417 -1.111l2.028 -2q0.222 1.472 -0.222 2.917t-1.556 2.556q-0.861 0.861 -2 1.361t-2.472 0.5Zm0 -3.917L9 11.417l1.417 -1.417 1.583 1.583 8.583 -8.583 1.417 1.417 -10 10Z'); // the 18 px (optical size 20) variant of Material's target_check
export const CHEVRON_DOWN_ICON = fillIcon('M12 15 7 10h10L12 15Z', 'nonzero', ' icon-chevron'); // Material's arrow_drop_down

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

/** Outline icons drawn with strokes (24×24, 2px, round caps). Decorative: the button text names the action. */
const strokeIcon = (shapes) =>
  `<svg class="icon-stroke" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shapes}</svg>`;

/** Filled icons of the list buttons (Material Symbols, 24×24): the same 20px box as the icons of the player. */
const fillIcon = (path, rule = 'nonzero') =>
  `<svg class="icon-fill" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="${rule}" d="${path}"/></svg>`;

export const SPARKLES_ICON = fillIcon('M5.825 21l1.625 -7.025L2 9.25l7.2 -0.625 2.8 -6.625 2.8 6.625 7.2 0.625 -5.45 4.725 1.625 7.025 -6.175 -3.725 -6.175 3.725ZM17.25 7l0.525 -2.225 -1.775 -1.475 2.35 -0.2 0.9 -2.1 0.9 2.1 2.35 0.2 -1.775 1.475 0.525 2.225 -2 -1.175 -2 1.175Z');
export const TAGS_ICON = fillIcon('M11.15 22q-0.375 0 -0.75 -0.15t-0.675 -0.45L2.575 14.25q-0.3 -0.3 -0.438 -0.663T2 12.85q0 -0.375 0.138 -0.75t0.438 -0.675l8.8 -8.825q0.275 -0.275 0.65 -0.438t0.775 -0.163h7.175q0.825 0 1.413 0.588T21.975 4v7.175q0 0.4 -0.15 0.763T21.4 12.575L12.575 21.4q-0.3 0.3 -0.675 0.45t-0.75 0.15ZM17.475 8q0.625 0 1.062 -0.438T18.975 6.5q0 -0.625 -0.438 -1.062T17.475 5q-0.625 0 -1.062 0.438T15.975 6.5q0 0.625 0.438 1.062T17.475 8Z', 'evenodd');
export const TARGET_ARROW_ICON = fillIcon('M12 22q-2.075 0 -3.9 -0.788T4.925 19.075q-1.35 -1.35 -2.138 -3.175T2 12q0 -2.075 0.788 -3.9T4.925 4.925q1.35 -1.35 3.175 -2.138T12 2q1.45 0 2.788 0.388T17.275 3.5l-1.475 1.45q-0.85 -0.45 -1.8 -0.7t-2 -0.25q-3.35 0 -5.675 2.325t-2.325 5.675q0 3.35 2.325 5.675t5.675 2.325q3.35 0 5.675 -2.325t2.325 -5.675q0 -0.625 -0.1 -1.225t-0.275 -1.175l1.575 -1.55q0.4 0.925 0.6 1.913t0.2 2.038q0 2.075 -0.788 3.9T19.075 19.075q-1.35 1.35 -3.175 2.138T12 22ZM12 18q-2.5 0 -4.25 -1.75t-1.75 -4.25q0 -2.5 1.75 -4.25t4.25 -1.75q0.625 0 1.2 0.113t1.1 0.338l-1.6 1.6q-0.175 -0.05 -0.338 -0.05H12q-1.65 0 -2.825 1.175t-1.175 2.825q0 1.65 1.175 2.825t2.825 1.175q0.8 0 1.538 -0.312T14.85 14.8q0.275 -0.275 0.488 -0.588T15.7 13.55l2.25 -2.275q0.175 1.375 -0.275 2.688T16.25 16.25q-0.8 0.8 -1.9 1.275t-2.35 0.475ZM12 14.4 9 11.4l1.4 -1.4 1.6 1.6 8.6 -8.6 1.4 1.4 -10 10Z');
export const CHEVRON_DOWN_ICON = strokeIcon('<path d="M6 9l6 6l6 -6"/>');

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

export const SPARKLES_ICON = strokeIcon('<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6"/>');
export const TAGS_ICON = strokeIcon('<path d="M3 8v4.172a2 2 0 0 0 .586 1.414l5.71 5.71a2.41 2.41 0 0 0 3.408 0l3.592 -3.592a2.41 2.41 0 0 0 0 -3.408l-5.71 -5.71a2 2 0 0 0 -1.414 -.586h-4.172a2 2 0 0 0 -2 2z"/><path d="M18 19l1.592 -1.592a4.82 4.82 0 0 0 0 -6.816l-4.592 -4.592"/><path d="M7 10h-.01"/>');
export const CHEVRON_DOWN_ICON = strokeIcon('<path d="M6 9l6 6l6 -6"/>');
export const TARGET_ARROW_ICON = strokeIcon('<path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M13 3.055a9 9 0 1 0 7.941 7.945"/><path d="M15 6v3h3l3 -3h-3v-3z"/><path d="M15 9l-3 3"/>');

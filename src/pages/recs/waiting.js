// The link between the loading box and the player: the box asks for a song while a list is built, the player answers.
// (The player filled this in when it starts; the box does not import the player, which needs a browser to load.)
export const waiting = {
  can: () => false,                                  // is there a collection to pick a song from?
  toggle: () => {},                                  // start a random song, or pause / resume it
  info: () => ({ playing: false, artist: '', song: '' }),
  finish: () => {},                                  // the list is ready: the song fades out and the list starts
  listeners: [],                                     // called with the new info when what the box says changes
};
export const onWaitingChange = (listener) => { waiting.listeners.push(listener); };

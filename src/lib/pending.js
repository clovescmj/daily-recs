// A list the user asked for (My tags, Best matches or Surprise me) is "pending" until the run that builds it ends.

/**
 * What to do with a pending list after the state or the run status changed:
 *  - 'ready':   the list exists (show it);
 *  - 'running': the run is going on (remember that it was seen running);
 *  - 'ended':   the run is over and there is no list (an error, or no album of that genre): the status box says why;
 *  - 'waiting': the run has not started yet.
 */
export function pendingOutcome(pending, { hasList, running }) {
  if (hasList) return 'ready';
  if (running) return 'running';
  return pending.sawRunning ? 'ended' : 'waiting';
}

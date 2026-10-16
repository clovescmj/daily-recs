// Version numbers: MAJOR.MINOR.PATCH. A new capability raises the minor number; a fix or a small adjustment raises the patch number.

const parts = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || ''));
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

/** True when `current` is a newer major or minor version than `previous` (1.2.30 to 1.3.0: yes; 1.2.30 to 1.2.31: no). */
export function isMajorUpdate(previous, current) {
  const before = parts(previous);
  const now = parts(current);
  if (!before || !now) return false;
  if (now[0] !== before[0]) return now[0] > before[0];
  return now[1] > before[1];
}

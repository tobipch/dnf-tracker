/**
 * Scramble-Generator für 3BLD.
 *
 * Zufällige Zugfolge statt Random-State: das kommt ohne Solver-WASM aus, ist
 * sofort verfügbar und funktioniert offline auf dem Handy. Nach 25 Zügen ist der
 * Würfel für Trainingszwecke ausreichend durchmischt.
 *
 * Wie bei WCA-BLD-Scrambles folgt am Schluss eine zufällige Orientierung, damit
 * nicht immer dieselbe Fläche oben liegt.
 */

const FACES = ["U", "D", "L", "R", "F", "B"] as const;
const AXIS: Record<string, number> = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
const SUFFIXES = ["", "'", "2"];

/** Welche Fläche liegt oben (6 Möglichkeiten). */
const ORIENT_FLIP = ["", "Rw", "Rw2", "Rw'", "Fw", "Fw'"];
/** Drehung um die vertikale Achse (4 Möglichkeiten). */
const ORIENT_SPIN = ["", "Uw", "Uw2", "Uw'"];

function randomInt(max: number): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    // Verwerfen des Überhangs, damit die Verteilung gleichmässig bleibt.
    const limit = Math.floor(0xffffffff / max) * max;
    let v: number;
    do {
      crypto.getRandomValues(buf);
      v = buf[0];
    } while (v >= limit);
    return v % max;
  }
  return Math.floor(Math.random() * max);
}

function pick<T>(list: readonly T[]): T {
  return list[randomInt(list.length)];
}

export function randomScramble(length = 25): string {
  const moves: string[] = [];
  const faces: string[] = [];

  while (moves.length < length) {
    const face = pick(FACES);

    // Keine zwei Züge hintereinander auf derselben Fläche …
    if (faces.length > 0 && face === faces[faces.length - 1]) continue;
    // … und kein dritter Zug auf einer Achse, die schon zweimal dran war (U D U).
    if (
      faces.length > 1 &&
      AXIS[face] === AXIS[faces[faces.length - 1]] &&
      AXIS[face] === AXIS[faces[faces.length - 2]]
    ) {
      continue;
    }

    faces.push(face);
    moves.push(face + pick(SUFFIXES));
  }

  const orientation = [pick(ORIENT_FLIP), pick(ORIENT_SPIN)].filter(Boolean);
  return [...moves, ...orientation].join(" ");
}

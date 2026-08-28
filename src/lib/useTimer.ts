"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TimerState = "idle" | "holding" | "ready" | "running";

/** Wie lange gedrückt werden muss, bis der Timer startbereit ist. */
const READY_DELAY_MS = 300;

/**
 * Timer nach Cubing-Konvention: gedrückt halten bis "ready", loslassen startet,
 * der nächste Druck stoppt. Funktioniert mit Touch und Leertaste gleichermassen.
 */
export function useTimer(onStop: (ms: number) => void) {
  const [state, setState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);

  const startedAt = useRef(0);
  const rafId = useRef<number | null>(null);
  const holdTimeout = useRef<number | null>(null);
  // Der Druck, der den Timer stoppt, darf ihn beim Loslassen nicht neu starten.
  const swallowRelease = useRef(false);
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  const clearHold = useCallback(() => {
    if (holdTimeout.current !== null) {
      window.clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setElapsed(performance.now() - startedAt.current);
    rafId.current = window.requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    if (rafId.current !== null) {
      window.cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    const ms = Math.round(performance.now() - startedAt.current);
    setElapsed(ms);
    setState("idle");
    onStopRef.current(ms);
  }, []);

  /** Finger auf dem Feld bzw. Leertaste gedrückt. */
  const pressStart = useCallback(() => {
    setState((current) => {
      if (current === "running") {
        swallowRelease.current = true;
        stop();
        return "idle";
      }
      if (current === "idle") {
        clearHold();
        holdTimeout.current = window.setTimeout(() => setState("ready"), READY_DELAY_MS);
        return "holding";
      }
      return current;
    });
  }, [clearHold, stop]);

  /** Losgelassen. */
  const pressEnd = useCallback(() => {
    if (swallowRelease.current) {
      swallowRelease.current = false;
      return;
    }
    clearHold();
    setState((current) => {
      if (current === "ready") {
        startedAt.current = performance.now();
        setElapsed(0);
        rafId.current = window.requestAnimationFrame(tick);
        return "running";
      }
      if (current === "holding") return "idle";
      return current;
    });
  }, [clearHold, tick]);

  /** Zurück auf 0 – z.B. nachdem der Versuch gespeichert wurde. */
  const reset = useCallback(() => {
    clearHold();
    if (rafId.current !== null) {
      window.cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    swallowRelease.current = false;
    setElapsed(0);
    setState("idle");
  }, [clearHold]);

  useEffect(
    () => () => {
      if (rafId.current !== null) window.cancelAnimationFrame(rafId.current);
      if (holdTimeout.current !== null) window.clearTimeout(holdTimeout.current);
    },
    []
  );

  return { state, elapsed, pressStart, pressEnd, stop, reset };
}

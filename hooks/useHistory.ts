// hooks/useHistory.ts
"use client";

import { useCallback, useRef, useState } from "react";

type Options = { limit?: number };

// Hook d'historique simple pour undo/redo
// - state          : valeur actuelle
// - set(next)      : remplace la valeur (utilise pour les éditions atomiques)
// - commit(next)   : remplace ET pousse l'ancienne valeur dans l'undo stack
// - undo / redo    : navigation dans l'historique
// - canUndo/Redo   : booléens pour activer/désactiver les boutons
// - reset(next)    : remet à zéro l'historique avec une nouvelle valeur de base
export function useHistory<T>(initial: T, options: Options = {}) {
  const limit = options.limit ?? 30;

  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, force] = useState(0);

  const refresh = () => force((v) => v + 1);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      return value;
    });
  }, []);

  const commit = useCallback((next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      past.current.push(prev);
      if (past.current.length > limit) past.current.shift();
      future.current = [];
      refresh();
      return value;
    });
  }, [limit]);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    setState((prev) => {
      const previous = past.current.pop() as T;
      future.current.push(prev);
      refresh();
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    setState((prev) => {
      const next = future.current.pop() as T;
      past.current.push(prev);
      refresh();
      return next;
    });
  }, []);

  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    setState(next);
    refresh();
  }, []);

  return {
    state,
    set,
    commit,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

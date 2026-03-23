import { useCallback, useReducer } from "react";

export interface UndoableAction {
  type: string;
  description: string;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
}

interface UndoRedoState {
  past: UndoableAction[];
  future: UndoableAction[];
}

type UndoRedoAction =
  | { type: "push"; action: UndoableAction }
  | { type: "undo" }
  | { type: "redo" };

const MAX_STACK_SIZE = 50;

function reducer(state: UndoRedoState, dispatched: UndoRedoAction): UndoRedoState {
  switch (dispatched.type) {
    case "push": {
      const past = [...state.past, dispatched.action];
      if (past.length > MAX_STACK_SIZE) {
        past.shift();
      }
      return { past, future: [] };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const action = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        future: [...state.future, action],
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const action = state.future[state.future.length - 1];
      return {
        past: [...state.past, action],
        future: state.future.slice(0, -1),
      };
    }
  }
}

export function useUndoRedo() {
  const [state, dispatch] = useReducer(reducer, { past: [], future: [] });

  const push = useCallback(async (action: UndoableAction) => {
    await action.execute();
    dispatch({ type: "push", action });
  }, []);

  const undoWithEffect = useCallback(async () => {
    const action = state.past[state.past.length - 1];
    if (!action) return;
    dispatch({ type: "undo" });
    await action.undo();
  }, [state.past]);

  const redoWithEffect = useCallback(async () => {
    const action = state.future[state.future.length - 1];
    if (!action) return;
    dispatch({ type: "redo" });
    await action.execute();
  }, [state.future]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const undoDescription = canUndo
    ? state.past[state.past.length - 1].description
    : null;
  const redoDescription = canRedo
    ? state.future[state.future.length - 1].description
    : null;

  return {
    push,
    undo: undoWithEffect,
    redo: redoWithEffect,
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
  };
}

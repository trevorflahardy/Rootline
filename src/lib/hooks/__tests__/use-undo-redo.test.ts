/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoRedo, type UndoableAction } from "../use-undo-redo";

function makeAction(overrides: Partial<UndoableAction> = {}): UndoableAction {
  return {
    type: "test",
    description: overrides.description ?? "Test action",
    execute: overrides.execute ?? vi.fn().mockResolvedValue(undefined),
    undo: overrides.undo ?? vi.fn().mockResolvedValue(undefined),
  };
}

describe("useUndoRedo", () => {
  it("starts with empty stacks", () => {
    const { result } = renderHook(() => useUndoRedo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoDescription).toBeNull();
    expect(result.current.redoDescription).toBeNull();
  });

  it("push executes action and adds to past", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const action = makeAction({ execute, description: "Add member" });
    const { result } = renderHook(() => useUndoRedo());

    await act(() => result.current.push(action));

    expect(execute).toHaveBeenCalledOnce();
    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoDescription).toBe("Add member");
    expect(result.current.canRedo).toBe(false);
  });

  it("push clears future stack", async () => {
    const { result } = renderHook(() => useUndoRedo());

    await act(() => result.current.push(makeAction({ description: "First" })));
    await act(() => result.current.push(makeAction({ description: "Second" })));
    await act(() => result.current.undo());

    expect(result.current.canRedo).toBe(true);

    await act(() => result.current.push(makeAction({ description: "Third" })));

    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoDescription).toBe("Third");
  });

  it("undo moves from past to future and calls undo()", async () => {
    const undoFn = vi.fn().mockResolvedValue(undefined);
    const action = makeAction({ undo: undoFn, description: "Delete member" });
    const { result } = renderHook(() => useUndoRedo());

    await act(() => result.current.push(action));
    await act(() => result.current.undo());

    expect(undoFn).toHaveBeenCalledOnce();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.redoDescription).toBe("Delete member");
  });

  it("redo moves from future to past and calls execute()", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const action = makeAction({ execute, description: "Redo action" });
    const { result } = renderHook(() => useUndoRedo());

    await act(() => result.current.push(action));
    await act(() => result.current.undo());

    expect(result.current.canRedo).toBe(true);

    await act(() => result.current.redo());

    // execute called twice: once on push, once on redo
    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoDescription).toBe("Redo action");
  });

  it("undo on empty stack is a no-op", async () => {
    const { result } = renderHook(() => useUndoRedo());
    await act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("redo on empty future is a no-op", async () => {
    const { result } = renderHook(() => useUndoRedo());
    await act(() => result.current.redo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("canUndo/canRedo reflect correct state through operations", async () => {
    const { result } = renderHook(() => useUndoRedo());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    await act(() => result.current.push(makeAction({ description: "A" })));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    await act(() => result.current.push(makeAction({ description: "B" })));
    expect(result.current.canUndo).toBe(true);

    await act(() => result.current.undo());
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    await act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("enforces max stack size of 50 (drops oldest)", async () => {
    const { result } = renderHook(() => useUndoRedo());

    // Push 51 actions
    for (let i = 0; i < 51; i++) {
      await act(() => result.current.push(makeAction({ description: `Action ${i}` })));
    }

    // The oldest (Action 0) should have been dropped
    expect(result.current.undoDescription).toBe("Action 50");

    // Undo all 50 remaining
    for (let i = 0; i < 50; i++) {
      await act(() => result.current.undo());
    }

    // After undoing 50, should not be able to undo further
    expect(result.current.canUndo).toBe(false);
    // The earliest remaining should be Action 1 (Action 0 was dropped)
    expect(result.current.redoDescription).toBe("Action 1");
  });

  it("undoDescription/redoDescription return correct strings", async () => {
    const { result } = renderHook(() => useUndoRedo());

    await act(() => result.current.push(makeAction({ description: "Create node" })));
    expect(result.current.undoDescription).toBe("Create node");
    expect(result.current.redoDescription).toBeNull();

    await act(() => result.current.push(makeAction({ description: "Delete node" })));
    expect(result.current.undoDescription).toBe("Delete node");

    await act(() => result.current.undo());
    expect(result.current.undoDescription).toBe("Create node");
    expect(result.current.redoDescription).toBe("Delete node");
  });

  it("multiple sequential undo/redo operations work correctly", async () => {
    const executes = [
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
    ];
    const undos = [
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
    ];

    const { result } = renderHook(() => useUndoRedo());

    await act(() => result.current.push(makeAction({ execute: executes[0], undo: undos[0], description: "A" })));
    await act(() => result.current.push(makeAction({ execute: executes[1], undo: undos[1], description: "B" })));
    await act(() => result.current.push(makeAction({ execute: executes[2], undo: undos[2], description: "C" })));

    // Undo C, B
    await act(() => result.current.undo());
    expect(undos[2]).toHaveBeenCalledOnce();
    await act(() => result.current.undo());
    expect(undos[1]).toHaveBeenCalledOnce();

    expect(result.current.undoDescription).toBe("A");
    expect(result.current.redoDescription).toBe("B");

    // Redo B
    await act(() => result.current.redo());
    expect(executes[1]).toHaveBeenCalledTimes(2);
    expect(result.current.undoDescription).toBe("B");
    expect(result.current.redoDescription).toBe("C");

    // Redo C
    await act(() => result.current.redo());
    expect(executes[2]).toHaveBeenCalledTimes(2);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoDescription).toBe("C");
  });
});

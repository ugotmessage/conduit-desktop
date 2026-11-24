// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getTerminalRendererMode, setTerminalRendererMode, clearTerminalRendererMode,
  TERMINAL_RENDERER_EVENT,
} from "../terminalRenderer";

describe("per-tab terminal renderer mode", () => {
  afterEach(() => {
    clearTerminalRendererMode("ssh-1");
    clearTerminalRendererMode("ssh-2");
  });

  it("defaults to DOM and only changes the selected session", () => {
    expect(getTerminalRendererMode("ssh-1")).toBe("dom");
    expect(getTerminalRendererMode("ssh-2")).toBe("dom");
    setTerminalRendererMode("ssh-1", "auto");
    expect(getTerminalRendererMode("ssh-1")).toBe("auto");
    expect(getTerminalRendererMode("ssh-2")).toBe("dom");
    setTerminalRendererMode("ssh-1", "webgl");
    expect(getTerminalRendererMode("ssh-1")).toBe("webgl");
  });

  it("emits a session-scoped event without creating or closing a session", () => {
    const listener = vi.fn();
    document.addEventListener(TERMINAL_RENDERER_EVENT, listener);
    try {
      setTerminalRendererMode("ssh-1", "auto");
      expect(listener).toHaveBeenCalledOnce();
      expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ sessionId: "ssh-1", mode: "auto" });
    } finally {
      document.removeEventListener(TERMINAL_RENDERER_EVENT, listener);
    }
  });
});

/** Per-session renderer preference. No SSH reconnect, terminal recreation or buffer reset. */
export type TerminalRendererMode = "auto" | "dom" | "webgl";
export const TERMINAL_RENDERER_EVENT = "conduit:terminal-renderer-change";
const modes = new Map<string, TerminalRendererMode>();

export function getTerminalRendererMode(sessionId: string): TerminalRendererMode {
  return modes.get(sessionId) ?? "dom";
}

export function setTerminalRendererMode(sessionId: string, mode: TerminalRendererMode): void {
  modes.set(sessionId, mode);
  document.dispatchEvent(new CustomEvent(TERMINAL_RENDERER_EVENT, { detail: { sessionId, mode } }));
}

export function clearTerminalRendererMode(sessionId: string): void {
  modes.delete(sessionId);
}

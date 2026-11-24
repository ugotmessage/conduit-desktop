/** Reserve plain Ctrl+V for terminal applications (nano Page Down, shell quoted insert). */
export function isTerminalPasteShortcut(ev: KeyboardEvent): boolean {
  return ev.ctrlKey && ev.shiftKey && !ev.altKey && !ev.metaKey && ev.key.toLowerCase() === "v";
}

export type EditCopyAction =
  | { action: "write"; text: string }
  | { action: "fallback" }
  | { action: "noop" };

/**
 * Decide how macOS Cmd+C (taken in main before Edit → Copy) should behave.
 * Terminal focus with a selection copies xterm text; terminal focus with no
 * selection is a no-op so we do not wipe the clipboard; elsewhere fall back
 * to Electron's native DOM copy.
 */
export function resolveEditCopy(terminal: { getSelection(): string } | null): EditCopyAction {
  if (!terminal) return { action: "fallback" };
  const text = terminal.getSelection();
  if (text) return { action: "write", text };
  return { action: "noop" };
}

/** macOS keeps Ctrl+C as interrupt; Windows/Linux terminal emulators often copy on selection. */
export function defaultCtrlCCopiesSelection(isMac: boolean): boolean {
  return !isMac;
}

/** Effective Ctrl+C-with-selection behavior; unset saved value → platform default. */
export function resolveCtrlCCopiesSelection(
  saved: { ctrlCCopiesSelection?: boolean } | undefined,
  isMac: boolean,
): boolean {
  if (typeof saved?.ctrlCCopiesSelection === "boolean") return saved.ctrlCCopiesSelection;
  return defaultCtrlCCopiesSelection(isMac);
}

/**
 * Whether this keydown should copy the terminal selection (not send to the PTY).
 * macOS: Cmd+C and Ctrl+Shift+C; Ctrl+C only when the setting allows.
 * Other platforms: Ctrl+Shift+C, and Ctrl+C when there is a selection and the setting allows.
 */
export function isTerminalCopyShortcut(
  ev: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
  opts: { isMac: boolean; hasSelection: boolean; ctrlCCopiesSelection: boolean },
): boolean {
  if (ev.key.toLowerCase() !== "c" || ev.altKey) return false;

  if (opts.isMac && ev.metaKey && !ev.ctrlKey && !ev.shiftKey) return true;
  if (ev.ctrlKey && !ev.metaKey && ev.shiftKey) return true;
  if (
    ev.ctrlKey &&
    !ev.metaKey &&
    !ev.shiftKey &&
    opts.hasSelection &&
    opts.ctrlCCopiesSelection
  ) {
    return true;
  }
  return false;
}

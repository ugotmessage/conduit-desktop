/** Reserve plain Ctrl+V for terminal applications (nano Page Down, shell quoted insert). */
export function isTerminalPasteShortcut(ev: KeyboardEvent): boolean {
  return ev.ctrlKey && ev.shiftKey && !ev.altKey && !ev.metaKey && ev.key.toLowerCase() === "v";
}

import { describe, expect, it } from "vitest";
import { isTerminalPasteShortcut } from "../terminalClipboardKeys";

describe("terminal paste shortcuts", () => {
  it("leaves Ctrl+V to xterm for nano Page Down and shell quoted insert", () => {
    expect(isTerminalPasteShortcut(new KeyboardEvent("keydown", { key: "v", ctrlKey: true }))).toBe(false);
  });

  it.each(["v", "V"])("handles Ctrl+Shift+%s as paste", (key) => {
    expect(isTerminalPasteShortcut(new KeyboardEvent("keydown", { key, ctrlKey: true, shiftKey: true }))).toBe(true);
  });

  it("leaves Cmd+V to the native macOS paste handler", () => {
    expect(isTerminalPasteShortcut(new KeyboardEvent("keydown", { key: "v", metaKey: true }))).toBe(false);
  });

  it.each([{ altKey: true }, { metaKey: true }])("does not capture extra modifiers: %o", (modifiers) => {
    expect(isTerminalPasteShortcut(new KeyboardEvent("keydown", { key: "V", ctrlKey: true, shiftKey: true, ...modifiers }))).toBe(false);
  });

  it("leaves plain v and unrelated control keys alone", () => {
    expect(isTerminalPasteShortcut(new KeyboardEvent("keydown", { key: "v" }))).toBe(false);
    expect(isTerminalPasteShortcut(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, shiftKey: true }))).toBe(false);
  });
});

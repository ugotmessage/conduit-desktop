import { describe, expect, it } from "vitest";
import {
  defaultCtrlCCopiesSelection,
  isTerminalCopyShortcut,
  isTerminalPasteShortcut,
  resolveCtrlCCopiesSelection,
  resolveEditCopy,
} from "../terminalClipboardKeys";

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

describe("resolveEditCopy", () => {
  it("writes the focused terminal selection", () => {
    expect(resolveEditCopy({ getSelection: () => "ls -la" })).toEqual({ action: "write", text: "ls -la" });
  });

  it("no-ops when the terminal has focus but no selection", () => {
    expect(resolveEditCopy({ getSelection: () => "" })).toEqual({ action: "noop" });
  });

  it("falls back to native copy outside a terminal", () => {
    expect(resolveEditCopy(null)).toEqual({ action: "fallback" });
  });
});

describe("Ctrl+C copy-vs-interrupt setting", () => {
  it("defaults to interrupt on macOS and copy-on-selection elsewhere", () => {
    expect(defaultCtrlCCopiesSelection(true)).toBe(false);
    expect(defaultCtrlCCopiesSelection(false)).toBe(true);
    expect(resolveCtrlCCopiesSelection(undefined, true)).toBe(false);
    expect(resolveCtrlCCopiesSelection({}, false)).toBe(true);
  });

  it("honors an explicit saved preference", () => {
    expect(resolveCtrlCCopiesSelection({ ctrlCCopiesSelection: true }, true)).toBe(true);
    expect(resolveCtrlCCopiesSelection({ ctrlCCopiesSelection: false }, false)).toBe(false);
  });
});

describe("isTerminalCopyShortcut", () => {
  const macOff = { isMac: true, hasSelection: true, ctrlCCopiesSelection: false };
  const macOn = { isMac: true, hasSelection: true, ctrlCCopiesSelection: true };
  const winOn = { isMac: false, hasSelection: true, ctrlCCopiesSelection: true };

  it("uses Cmd+C and Ctrl+Shift+C on macOS regardless of the Ctrl+C setting", () => {
    expect(isTerminalCopyShortcut(new KeyboardEvent("keydown", { key: "c", metaKey: true }), macOff)).toBe(true);
    expect(isTerminalCopyShortcut(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, shiftKey: true }), macOff)).toBe(true);
  });

  it("lets plain Ctrl+C interrupt on macOS when the setting is off", () => {
    expect(isTerminalCopyShortcut(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }), macOff)).toBe(false);
  });

  it("copies with Ctrl+C on macOS only when the setting is on and text is selected", () => {
    expect(isTerminalCopyShortcut(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }), macOn)).toBe(true);
    expect(isTerminalCopyShortcut(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }), {
      ...macOn,
      hasSelection: false,
    })).toBe(false);
  });

  it("copies with Ctrl+C on Windows/Linux when selected and the setting allows", () => {
    expect(isTerminalCopyShortcut(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }), winOn)).toBe(true);
    expect(isTerminalCopyShortcut(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, shiftKey: true }), {
      ...winOn,
      hasSelection: false,
    })).toBe(true);
  });
});

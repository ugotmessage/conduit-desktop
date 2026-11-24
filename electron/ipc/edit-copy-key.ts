import { clipboard, ipcMain, type BrowserWindow, type Input } from 'electron';

/** Main → renderer: Cmd+C was taken before the Edit menu could clear the clipboard. */
export const EDIT_COPY_KEY_EVENT = 'edit-copy-key';
/** Renderer → main: write xterm selection text (menu accelerator already blocked). */
export const EDIT_COPY_TEXT_EVENT = 'edit-copy-text';
/** Renderer → main: focus is outside a terminal — use native DOM copy. */
export const EDIT_COPY_FALLBACK_EVENT = 'edit-copy-fallback';

/** macOS Cmd+C with no other modifiers (Edit → Copy accelerator). */
export function isMacCopyKey(
  input: Pick<Input, 'type' | 'code' | 'key' | 'meta' | 'control' | 'alt' | 'shift'>,
  isMac: boolean,
): boolean {
  if (!isMac || input.type !== 'keyDown') return false;
  if (!input.meta || input.control || input.alt || input.shift) return false;
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  return key === 'c' || input.code === 'KeyC';
}

/**
 * Take Cmd+C before the page and the Edit menu see it. Menu `{ role: 'copy' }`
 * still fires after renderer preventDefault and copies an empty DOM selection,
 * wiping the xterm text we just wrote — same pattern as zoom-keys.
 */
export function installEditCopyKey(win: BrowserWindow, isMac = process.platform === 'darwin'): void {
  if (!isMac) return;
  win.webContents.on('before-input-event', (event, input) => {
    if (!isMacCopyKey(input, isMac)) return;
    event.preventDefault();
    win.webContents.send(EDIT_COPY_KEY_EVENT);
  });
}

export function registerEditCopyHandlers(): void {
  ipcMain.on(EDIT_COPY_TEXT_EVENT, (_event, text: unknown) => {
    if (typeof text === 'string' && text.length > 0) clipboard.writeText(text);
  });
  ipcMain.on(EDIT_COPY_FALLBACK_EVENT, (event) => {
    event.sender.copy();
  });
}

export function sendEditCopyKey(win: BrowserWindow | null | undefined): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(EDIT_COPY_KEY_EVENT);
}

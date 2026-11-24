// @vitest-environment node
import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => void>());
const clipboard = vi.hoisted(() => ({ writeText: vi.fn() }));

vi.mock('electron', () => ({
  ipcMain: { on: (channel: string, fn: (...args: unknown[]) => void) => ipcHandlers.set(channel, fn) },
  clipboard,
}));

import {
  EDIT_COPY_FALLBACK_EVENT,
  EDIT_COPY_KEY_EVENT,
  EDIT_COPY_TEXT_EVENT,
  installEditCopyKey,
  isMacCopyKey,
  registerEditCopyHandlers,
  sendEditCopyKey,
} from '../edit-copy-key.js';

const key = (
  code: string,
  mods: { meta?: boolean; control?: boolean; alt?: boolean; shift?: boolean; key?: string } = {},
  type = 'keyDown',
) => ({ type, code, key: mods.key ?? '', meta: false, control: false, alt: false, shift: false, ...mods });

function fakeContents() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    send: vi.fn(),
    copy: vi.fn(),
  });
}

describe('isMacCopyKey', () => {
  it('matches Cmd+C on macOS', () => {
    expect(isMacCopyKey(key('KeyC', { meta: true, key: 'c' }), true)).toBe(true);
    expect(isMacCopyKey(key('KeyC', { meta: true, key: 'C' }), true)).toBe(true);
  });

  it('ignores non-mac, key ups, and extra modifiers', () => {
    expect(isMacCopyKey(key('KeyC', { meta: true, key: 'c' }), false)).toBe(false);
    expect(isMacCopyKey(key('KeyC', { meta: true, key: 'c' }, 'keyUp'), true)).toBe(false);
    expect(isMacCopyKey(key('KeyC', { meta: true, shift: true, key: 'c' }), true)).toBe(false);
    expect(isMacCopyKey(key('KeyC', { meta: true, control: true, key: 'c' }), true)).toBe(false);
    expect(isMacCopyKey(key('KeyC', { meta: true, alt: true, key: 'c' }), true)).toBe(false);
    expect(isMacCopyKey(key('KeyV', { meta: true, key: 'v' }), true)).toBe(false);
    expect(isMacCopyKey(key('KeyC', { control: true, key: 'c' }), true)).toBe(false);
  });
});

describe('installEditCopyKey', () => {
  it('does nothing on Windows and Linux', () => {
    const contents = fakeContents();
    installEditCopyKey({ webContents: contents, isDestroyed: () => false } as never, false);
    expect(contents.listenerCount('before-input-event')).toBe(0);
  });

  it('takes Cmd+C from the page and the menu and notifies the renderer', () => {
    const contents = fakeContents();
    installEditCopyKey({ webContents: contents, isDestroyed: () => false } as never, true);
    const copyEvent = { preventDefault: vi.fn() };
    contents.emit('before-input-event', copyEvent, key('KeyC', { meta: true, key: 'c' }));
    expect(copyEvent.preventDefault).toHaveBeenCalled();
    expect(contents.send).toHaveBeenCalledWith(EDIT_COPY_KEY_EVENT);

    const typing = { preventDefault: vi.fn() };
    contents.emit('before-input-event', typing, key('KeyA', { meta: true, key: 'a' }));
    expect(typing.preventDefault).not.toHaveBeenCalled();
    expect(contents.send).toHaveBeenCalledTimes(1);
  });
});

describe('registerEditCopyHandlers', () => {
  beforeEach(() => {
    ipcHandlers.clear();
    clipboard.writeText.mockReset();
  });

  it('writes terminal selection text from the renderer', () => {
    registerEditCopyHandlers();
    ipcHandlers.get(EDIT_COPY_TEXT_EVENT)!({}, 'selected lines');
    expect(clipboard.writeText).toHaveBeenCalledWith('selected lines');
    ipcHandlers.get(EDIT_COPY_TEXT_EVENT)!({}, '');
    ipcHandlers.get(EDIT_COPY_TEXT_EVENT)!({}, 42);
    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it('falls back to native webContents.copy outside the terminal', () => {
    registerEditCopyHandlers();
    const contents = fakeContents();
    ipcHandlers.get(EDIT_COPY_FALLBACK_EVENT)!({ sender: contents });
    expect(contents.copy).toHaveBeenCalled();
  });
});

describe('sendEditCopyKey', () => {
  it('sends the same event the keyboard path uses', () => {
    const contents = fakeContents();
    sendEditCopyKey({ webContents: contents, isDestroyed: () => false } as never);
    expect(contents.send).toHaveBeenCalledWith(EDIT_COPY_KEY_EVENT);
    sendEditCopyKey(null);
    sendEditCopyKey({ isDestroyed: () => true } as never);
    expect(contents.send).toHaveBeenCalledTimes(1);
  });
});

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VncView from '../VncView';

const mock = vi.hoisted(() => ({ clients: [] as { showDotCursor: boolean; scaleViewport: boolean; disconnect: ReturnType<typeof vi.fn> }[] }));
vi.mock('../../../lib/electron', () => ({
  invoke: vi.fn(async (command: string) => command === 'vnc_get_ws_info' ? { wsUrl: 'ws://127.0.0.1:1234', credentials: {} } : undefined),
  listen: vi.fn(async () => () => {}),
}));
vi.mock('@novnc/novnc/lib/rfb.js', () => ({
  default: class extends EventTarget {
    showDotCursor = false;
    scaleViewport = false;
    resizeSession = true;
    disconnect = vi.fn();
    focus = vi.fn();
    constructor() { super(); mock.clients.push(this); }
  },
}));

describe('VNC renderer setup', () => {
  it('enables the missing-cursor fallback and disconnects on unmount', async () => {
    const view = render(<VncView sessionId="vnc-test" />);
    await waitFor(() => expect(mock.clients[0]?.showDotCursor).toBe(true));
    expect(mock.clients[0].scaleViewport).toBe(true);
    view.unmount();
    expect(mock.clients[0].disconnect).toHaveBeenCalledOnce();
  });
});

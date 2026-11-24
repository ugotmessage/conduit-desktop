import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRemoteClipboard } from '../useRemoteClipboard';

const ipc = vi.hoisted(() => ({ invoke: vi.fn(async () => {}), listenSync: vi.fn(() => () => {}) }));
vi.mock('../../lib/electron', () => ipc);
vi.mock('../../components/common/Toast', () => ({ toast: { success: vi.fn() } }));

function Harness({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useRemoteClipboard({ sessionId: 'rdp-1', protocol: 'rdp', isConnected: true, isActive: active, enabled: true, containerRef: ref });
  return <div ref={ref}><canvas data-testid="remote-canvas" tabIndex={0} /></div>;
}

beforeEach(() => { vi.clearAllMocks(); });

describe('RDP clipboard focus routing', () => {
  it('syncs when the canvas inside the active container gains focus', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    const view = render(<Harness active />);
    ipc.invoke.mockClear();
    fireEvent.focusIn(screen.getByTestId('remote-canvas'));
    expect(ipc.invoke).toHaveBeenCalledWith('rdp_clipboard_sync', { sessionId: 'rdp-1' });
    view.unmount();
    vi.restoreAllMocks();
  });

  it('does not send focus or paste data through an inactive session', () => {
    render(<Harness active={false} />);
    fireEvent.focusIn(screen.getByTestId('remote-canvas'));
    fireEvent.paste(screen.getByTestId('remote-canvas'), { clipboardData: { getData: () => 'private text' } });
    expect(ipc.invoke).not.toHaveBeenCalled();
  });
});

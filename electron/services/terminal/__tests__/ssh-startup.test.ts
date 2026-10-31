// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events');

  class FakeSshSession extends EventEmitter {
    static instances: FakeSshSession[] = [];
    static holdConnect = false;
    written: Buffer[] = [];
    connected = false;
    private connectWait: ((value: void) => void) | null = null;

    constructor() {
      super();
      FakeSshSession.instances.push(this);
    }

    async connect() {
      if (FakeSshSession.holdConnect) {
        await new Promise<void>((resolve) => {
          this.connectWait = resolve;
        });
      }
      this.connected = true;
    }

    releaseConnect() {
      this.connectWait?.();
      this.connectWait = null;
    }

    write(data: Buffer | Uint8Array) {
      this.written.push(Buffer.from(data));
    }

    resize() {}

    close() {
      this.connected = false;
      this.emit('close');
    }
  }

  return { FakeSshSession };
});

vi.mock('electron', () => ({}));
vi.mock('../pty.js', () => ({
  parseShellType: (s?: string | null) => s ?? 'default',
  createLocalPty: () => ({ pty: { onData() { return { dispose() {} }; }, onExit() { return { dispose() {} }; }, write() {}, resize() {} }, file: '/bin/zsh', kill() {} }),
}));
vi.mock('../../ssh/client.js', () => ({ SshSession: fakes.FakeSshSession }));

const { TerminalManager } = await import('../manager.js');
const { SSH_STARTUP_ENTER } = await import('../../ssh/startup-script.js');

type Manager = InstanceType<typeof TerminalManager>;

function payloads(session: InstanceType<typeof fakes.FakeSshSession>): string[] {
  return session.written.map((buf) => buf.toString('utf8'));
}

const SCRIPT = {
  steps: [
    { delayMs: 1_000, kind: 'text' as const, text: 'sudo -i' },
    { delayMs: 500, kind: 'text' as const, text: 'id' },
  ],
};

describe('TerminalManager SSH startup steps', () => {
  let manager: Manager;

  beforeEach(() => {
    vi.useFakeTimers();
    fakes.FakeSshSession.instances = [];
    fakes.FakeSshSession.holdConnect = false;
    manager = new TerminalManager(() => null);
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  it('does not type until connect() has opened the interactive shell', async () => {
    fakes.FakeSshSession.holdConnect = true;
    const pending = manager.createSshSession(
      { host: 'h', auth: { type: 'password', username: 'u', password: 'p' } },
      { startup: SCRIPT },
    );
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fakes.FakeSshSession.instances[0].written).toEqual([]);

    fakes.FakeSshSession.instances[0].releaseConnect();
    const sessionId = await pending;
    expect(fakes.FakeSshSession.instances[0].connected).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(payloads(fakes.FakeSshSession.instances[0])).toEqual([`sudo -i${SSH_STARTUP_ENTER}`]);
    manager.close(sessionId);
  });

  it('runs once per session even if startReading is repeated', async () => {
    const sessionId = await manager.createSshSession(
      { host: 'h', auth: { type: 'password', username: 'u', password: 'p' } },
      { startup: SCRIPT },
    );
    manager.startReading(sessionId);
    manager.startReading(sessionId);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(payloads(fakes.FakeSshSession.instances[0])).toEqual([
      `sudo -i${SSH_STARTUP_ENTER}`,
      `id${SSH_STARTUP_ENTER}`,
    ]);
  });

  it('does not send anything when startup is off', async () => {
    await manager.createSshSession({ host: 'h', auth: { type: 'password', username: 'u', password: 'p' } });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fakes.FakeSshSession.instances[0].written).toEqual([]);
  });

  it('cancels on error even when the transport has not emitted close', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await manager.createSshSession(
        { host: 'h', auth: { type: 'password', username: 'u', password: 'p' } },
        { startup: SCRIPT },
      );
      const ssh = fakes.FakeSshSession.instances[0];
      ssh.emit('error', new Error('fixture error'));
      expect(ssh.connected).toBe(true);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(ssh.written).toEqual([]);
    } finally { log.mockRestore(); }
  });

  it('does not start a runner after an error during connect', async () => {
    fakes.FakeSshSession.holdConnect = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const pending = manager.createSshSession(
        { host: 'h', auth: { type: 'password', username: 'u', password: 'p' } },
        { startup: SCRIPT },
      );
      const ssh = fakes.FakeSshSession.instances[0];
      ssh.emit('error', new Error('fixture error'));
      ssh.releaseConnect();
      await pending;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(ssh.written).toEqual([]);
    } finally { log.mockRestore(); }
  });

  it('cancels leftover steps on close and on error, and never writes to another session', async () => {
    const first = await manager.createSshSession(
      { host: 'h', auth: { type: 'password', username: 'u', password: 'p' } },
      { startup: SCRIPT },
    );
    const second = await manager.createSshSession(
      { host: 'other', auth: { type: 'password', username: 'u', password: 'p' } },
      { startup: { steps: [{ delayMs: 1_000, kind: 'text', text: 'other-only' }] } },
    );
    const [ssh1, ssh2] = fakes.FakeSshSession.instances;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(payloads(ssh1)).toEqual([`sudo -i${SSH_STARTUP_ENTER}`]);
    expect(payloads(ssh2)).toEqual([`other-only${SSH_STARTUP_ENTER}`]);

    manager.close(first);
    ssh1.emit('error', new Error('reset'));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(payloads(ssh1)).toEqual([`sudo -i${SSH_STARTUP_ENTER}`]);
    expect(payloads(ssh2)).toEqual([`other-only${SSH_STARTUP_ENTER}`]);
    manager.close(second);
  });
});

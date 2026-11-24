// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));
vi.mock('../../services/state.js', () => ({ AppState: { getInstance: () => ({ getMainWindow: () => null }) } }));
vi.mock('../../services/env-config.js', () => ({ getSocketPath: () => '/tmp/x.sock', isNamedPipe: () => false }));
vi.mock('../../ipc/settings.js', () => ({ readSettings: () => ({}) }));
vi.mock('../../services/ssh/resolve-connection.js', () => ({
  resolveSshConnection: vi.fn((input: { host: string; port?: number | null }) => ({
    config: {
      host: input.host,
      port: input.port ?? 22,
      auth: { type: 'public_key', username: 'u', keyContent: 'KEY' },
    },
    alias: input.host,
  })),
  sshInputFromSessionArgs: vi.fn((args: { host: string; port?: number | null; credential?: unknown; sshAuthMethod?: string | null }) => ({
    host: args.host,
    port: args.port,
    credential: args.credential ?? null,
    sshAuthMethod: args.sshAuthMethod,
  })),
}));
vi.mock('../open-session.js', () => ({
  openSshSession: vi.fn(async () => ({ session_id: 'ssh-new', connection_type: 'ssh', host: '10.0.0.5', port: 22, status: 'connected' })),
  openRdpSession: vi.fn(),
  openVncSession: vi.fn(),
  buildRdpEngineConfigFromEntry: vi.fn(() => ({})),
}));

const { handleRequest } = await import('../server.js');
const { openSshSession } = await import('../open-session.js');

const STARTUP = {
  enabled: true,
  steps: [
    { delaySeconds: 1, inputMode: 'text', text: 'sudo -i' },
    { delaySeconds: 2, inputMode: 'credential_password' },
  ],
};

const ENTRY = {
  id: 'e-ssh',
  name: 'Web server',
  entry_type: 'ssh',
  host: '10.0.0.5',
  port: 22,
  credential_id: 'c1',
  config: { ssh_auth_method: 'key', startup: STARTUP },
};

const CREDENTIAL = {
  username: 'alice',
  password: 'vault-pass',
  private_key: 'KEY',
};

function fakeState() {
  return {
    getActiveVault: () => ({
      isUnlocked: () => true,
      listEntries: () => [ENTRY],
      getEntry: (id: string) => {
        if (id !== ENTRY.id) throw new Error('not found');
        return ENTRY;
      },
      getCredential: (id: string) => {
        if (id !== 'c1') throw new Error('missing');
        return CREDENTIAL;
      },
      resolveCredential: () => CREDENTIAL,
    }),
    terminalManager: { listSessions: () => [], isAgentTerminal: () => false, isConnected: () => false },
    rdpManager: { get: () => undefined },
    vncManager: { get: () => undefined },
    webManager: { listSessions: () => [] },
    mcpConnections: new Map(),
  };
}

type State = Parameters<typeof handleRequest>[1];

const call = (type: string, payload: Record<string, unknown>) =>
  handleRequest({ type, payload }, fakeState() as unknown as State);

beforeEach(() => {
  vi.mocked(openSshSession).mockClear();
});

describe('MCP SSH startup steps', () => {
  it('returns an error before connecting when a required credential password is missing', async () => {
    const password = CREDENTIAL.password;
    CREDENTIAL.password = '';
    try {
      const res = await call('ConnectionOpenEntry', { entry_id: 'e-ssh' });
      expect(JSON.stringify(res)).toContain('no password is available');
      expect(openSshSession).not.toHaveBeenCalled();
    } finally { CREDENTIAL.password = password; }
  });

  it('connection_open_entry prepares the entry script with the resolved credential password', async () => {
    const res = await call('ConnectionOpenEntry', { entry_id: 'e-ssh' });
    expect(res).toMatchObject({ type: 'Success', payload: { session_id: 'ssh-new', entry_id: 'e-ssh' } });
    expect(openSshSession).toHaveBeenCalledOnce();
    const opts = vi.mocked(openSshSession).mock.calls[0][1];
    expect(opts.startup).toEqual({
      steps: [
        { delayMs: 1000, kind: 'text', text: 'sudo -i' },
        { delayMs: 2000, kind: 'credential_password', text: '' },
      ],
      password: 'vault-pass',
    });
    expect(JSON.stringify(ENTRY.config)).not.toContain('vault-pass');
    expect(ENTRY.config.startup).toEqual(STARTUP);
  });

  it('connection_open does not apply another entry’s startup steps', async () => {
    const res = await call('ConnectionOpen', {
      connection_type: 'ssh',
      host: '10.0.0.5',
      port: 22,
      credential_id: 'c1',
      username: null,
      password: null,
    });
    expect(res).toMatchObject({ type: 'Success' });
    expect(openSshSession).toHaveBeenCalledOnce();
    expect(vi.mocked(openSshSession).mock.calls[0][1].startup).toBeUndefined();
  });
});

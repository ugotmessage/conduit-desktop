// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('../../../ipc/settings.js', () => ({
  readSettings: () => ({ session_defaults_ssh: { authMethodWhenKeyPresent: 'key' } }),
}));

const { resolveSshConnection, sshInputFromSessionArgs } = await import('../resolve-connection.js');
const { SshConfigError } = await import('../ssh-config-error.js');

const dirs: string[] = [];

function makeHome(config: string, keys: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conduit-ssh-home-'));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, '.ssh'));
  fs.writeFileSync(path.join(dir, '.ssh', 'config'), config);
  for (const [name, body] of Object.entries(keys)) {
    fs.writeFileSync(path.join(dir, '.ssh', name), body);
  }
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const CONFIG = `
Host lab-bastion
  HostName 203.0.113.10
  User labuser
  Port 2222
  IdentityFile ~/.ssh/lab_ed25519
  ProxyCommand nc -X 5 -x 127.0.0.1:1086 %h %p
  ForwardAgent yes
  ServerAliveInterval 30

Host jump-only.test
  ProxyJump bastion.test
`;

describe('sshInputFromSessionArgs (UI / MCP)', () => {
  it('keeps a linked credential ahead of inline username', () => {
    const input = sshInputFromSessionArgs({
      host: 'lab-bastion',
      port: undefined,
      credential: { username: 'vault-user', password: 'pw', private_key: null },
      username: 'typed-user',
      password: 'typed-pw',
    });
    expect(input.credential?.username).toBe('vault-user');
    expect(input.port).toBeUndefined();
  });

  it('treats a username without a credential as inline secrets, and neither as system mode', () => {
    expect(
      sshInputFromSessionArgs({ host: 'lab-bastion', username: 'typed', password: 'pw' }).credential,
    ).toEqual({ username: 'typed', password: 'pw', private_key: null });
    expect(sshInputFromSessionArgs({ host: 'lab-bastion' }).credential).toBeNull();
  });
});

describe('resolveSshConnection precedence', () => {
  it('uses a config User with an explicit inline password and no inline username', () => {
    const home = makeHome('Host fixture\n User config-user\n');
    const resolved = resolveSshConnection(sshInputFromSessionArgs({ host: 'fixture', password: 'explicit-pw' }),
      { homedir: home, env: {} });
    expect(resolved.config.auth).toEqual({ type: 'password', username: 'config-user', password: 'explicit-pw' });
  });

  it('honours first routing option and explicit none/no without inventing a proxy', () => {
    const home = makeHome('Host fixture\n ProxyCommand none\n ProxyJump ignored.test\n ProxyUseFdpass no\n');
    expect(resolveSshConnection({ host: 'fixture' }, { homedir: home, env: {} }).config.proxy).toBeUndefined();
  });

  it('fills HostName, User, Port, IdentityFile, SOCKS5, keepalive and agent from config in system mode', () => {
    const home = makeHome(CONFIG, { lab_ed25519: 'NOT-A-REAL-KEY\n' });
    const sock = path.join(home, 'agent.sock');
    fs.writeFileSync(sock, '');
    const resolved = resolveSshConnection(
      sshInputFromSessionArgs({ host: 'lab-bastion' }),
      { homedir: home, env: { SSH_AUTH_SOCK: sock } },
    );
    expect(resolved.alias).toBe('lab-bastion');
    expect(resolved.config.host).toBe('203.0.113.10');
    expect(resolved.config.port).toBe(2222);
    expect(resolved.config.auth).toEqual({
      type: 'public_key',
      username: 'labuser',
      keyPath: path.join(home, '.ssh', 'lab_ed25519'),
    });
    expect(resolved.config.proxy).toEqual({ type: 'socks5', proxyHost: '127.0.0.1', proxyPort: 1086 });
    expect(resolved.config.keepaliveMs).toBe(30_000);
    expect(resolved.config.agent).toBe(sock);
    expect(resolved.config.agentForward).toBe(true);
  });

  it('does not enable ForwardAgent when SSH_AUTH_SOCK is missing', () => {
    const home = makeHome(CONFIG, { lab_ed25519: 'NOT-A-REAL-KEY\n' });
    const resolved = resolveSshConnection(
      sshInputFromSessionArgs({ host: 'lab-bastion' }),
      { homedir: home, env: {} },
    );
    expect(resolved.config.agent).toBeUndefined();
    expect(resolved.config.agentForward).toBeUndefined();
  });

  it('lets an explicit UI/MCP user and port win over config, including an explicit 22', () => {
    const home = makeHome(CONFIG, { lab_ed25519: 'NOT-A-REAL-KEY\n' });
    const resolved = resolveSshConnection(
      sshInputFromSessionArgs({
        host: 'lab-bastion',
        port: 22,
        username: 'typed-user',
      }),
      { homedir: home, env: {} },
    );
    expect(resolved.config.port).toBe(22);
    expect(resolved.config.auth).toMatchObject({ type: 'public_key', username: 'typed-user' });
  });

  it('does not cover an explicit vault password or private key with IdentityFile', () => {
    const home = makeHome(CONFIG, { lab_ed25519: 'NOT-A-REAL-KEY\n' });
    const password = resolveSshConnection(
      sshInputFromSessionArgs({
        host: 'lab-bastion',
        credential: { username: 'vault-user', password: 'vault-pw', private_key: null },
      }),
      { homedir: home, env: {} },
    );
    expect(password.config.auth).toEqual({ type: 'password', username: 'vault-user', password: 'vault-pw' });

    const key = resolveSshConnection(
      sshInputFromSessionArgs({
        host: 'lab-bastion',
        credential: {
          username: 'vault-user',
          password: null,
          private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----',
        },
      }),
      { homedir: home, env: {} },
    );
    expect(key.config.auth.type).toBe('public_key');
    if (key.config.auth.type === 'public_key') {
      expect(key.config.auth.keyContent).toContain('BEGIN OPENSSH PRIVATE KEY');
      expect(key.config.auth.keyPath).toBeUndefined();
    }
  });

  it('does not switch an explicit password sshAuthMethod to IdentityFile', () => {
    const home = makeHome(CONFIG, { lab_ed25519: 'NOT-A-REAL-KEY\n' });
    const resolved = resolveSshConnection(
      sshInputFromSessionArgs({
        host: 'lab-bastion',
        username: 'typed-user',
        sshAuthMethod: 'password',
      }),
      { homedir: home, env: {} },
    );
    expect(resolved.config.auth).toEqual({ type: 'password', username: 'typed-user', password: '' });
  });

  it('keeps previous behaviour when no ssh config file exists', () => {
    const home = makeHome('', {});
    fs.rmSync(path.join(home, '.ssh', 'config'));
    const resolved = resolveSshConnection(
      sshInputFromSessionArgs({ host: '203.0.113.20', username: 'typed' }),
      { homedir: home, env: {} },
    );
    expect(resolved.config.host).toBe('203.0.113.20');
    expect(resolved.config.port).toBe(22);
    expect(resolved.config.auth).toEqual({ type: 'password', username: 'typed', password: '' });
    expect(resolved.config.proxy).toBeUndefined();
  });

  it('expands HostName %h and IdentityFile ~ / % tokens against a fake home', () => {
    const home = makeHome(
      `
Host db.lab.test
  HostName %h.internal.example
  User tokenuser
  IdentityFile ~/.ssh/%r_ed25519
`,
      { 'tokenuser_ed25519': 'NOT-A-REAL-KEY\n' },
    );
    const resolved = resolveSshConnection(
      sshInputFromSessionArgs({ host: 'db.lab.test' }),
      { homedir: home, env: {} },
    );
    expect(resolved.config.host).toBe('db.lab.test.internal.example');
    expect(resolved.config.auth).toMatchObject({
      type: 'public_key',
      username: 'tokenuser',
      keyPath: path.join(home, '.ssh', 'tokenuser_ed25519'),
    });
  });

  it('fails closed on ProxyJump and on a missing IdentityFile', () => {
    const home = makeHome(CONFIG);
    expect(() =>
      resolveSshConnection(sshInputFromSessionArgs({ host: 'jump-only.test' }), { homedir: home, env: {} }),
    ).toThrow(/ProxyJump/);

    expect(() =>
      resolveSshConnection(sshInputFromSessionArgs({ host: 'lab-bastion' }), { homedir: home, env: {} }),
    ).toThrow(SshConfigError);
    expect(() =>
      resolveSshConnection(sshInputFromSessionArgs({ host: 'lab-bastion' }), { homedir: home, env: {} }),
    ).toThrow(/IdentityFile is not readable/);
  });
});

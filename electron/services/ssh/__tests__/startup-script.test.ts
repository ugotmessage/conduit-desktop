// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SSH_STARTUP,
  SSH_STARTUP_ENTER,
  SSH_STARTUP_MAX_DELAY_SECONDS,
  SSH_STARTUP_MAX_INPUT_LENGTH,
  SSH_STARTUP_MAX_STEPS,
  SshStartupError,
  SshStartupRunner,
  loadSshStartupConfig,
  parseSshStartupConfig,
  passwordFromConnectionSecrets,
  prepareSshStartup,
  serializeSshStartupConfig,
  sshStartupSaveError,
} from '../startup-script.js';

function writesOf(runnerWrites: Uint8Array[]): string[] {
  return runnerWrites.map((chunk) => Buffer.from(chunk).toString('utf8'));
}

describe('parseSshStartupConfig', () => {
  it('treats missing config as disabled so existing entries do nothing', () => {
    expect(parseSshStartupConfig(undefined)).toEqual({ enabled: false, steps: [] });
    expect(parseSshStartupConfig(null)).toEqual({ enabled: false, steps: [] });
    expect(loadSshStartupConfig(undefined)).toEqual(DEFAULT_SSH_STARTUP);
    expect(loadSshStartupConfig({ ssh_auth_method: 'key' })).toEqual({ enabled: false, steps: [] });
  });

  it('rejects negative, non-numeric and infinite delays when enabled', () => {
    const bad = [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 'nope', null];
    for (const delaySeconds of bad) {
      expect(() => parseSshStartupConfig({
        enabled: true,
        steps: [{ delaySeconds, inputMode: 'text', text: 'sudo -i' }],
      })).toThrow(SshStartupError);
    }
  });

  it('caps step count, wait, and input length', () => {
    expect(() => parseSshStartupConfig({
      enabled: true,
      steps: Array.from({ length: SSH_STARTUP_MAX_STEPS + 1 }, () => ({ delaySeconds: 1, inputMode: 'text', text: 'x' })),
    })).toThrow(/at most/);
    expect(() => parseSshStartupConfig({
      enabled: true,
      steps: [{ delaySeconds: SSH_STARTUP_MAX_DELAY_SECONDS + 1, inputMode: 'text', text: 'x' }],
    })).toThrow(/at most/);
    expect(() => parseSshStartupConfig({
      enabled: true,
      steps: [{ delaySeconds: 1, inputMode: 'text', text: 'a'.repeat(SSH_STARTUP_MAX_INPUT_LENGTH + 1) }],
    })).toThrow(/too long/);
  });
});

describe('serializeSshStartupConfig / password mode', () => {
  it('omits startup when disabled and empty, and never stores a password', () => {
    expect(serializeSshStartupConfig({ enabled: false, steps: [] })).toBeUndefined();
    const serialized = serializeSshStartupConfig({
      enabled: true,
      steps: [
        { delaySeconds: 1, inputMode: 'text', text: 'sudo -i' },
        { delaySeconds: 2, inputMode: 'credential_password', text: 'should-not-keep' },
      ],
    });
    expect(serialized).toEqual({
      enabled: true,
      steps: [
        { delaySeconds: 1, inputMode: 'text', text: 'sudo -i' },
        { delaySeconds: 2, inputMode: 'credential_password' },
      ],
    });
    expect(JSON.stringify(serialized)).not.toMatch(/should-not-keep|secret-pass/);
  });

  it('refuses to enable password-mode steps without a password source', () => {
    const script = {
      enabled: true,
      steps: [{ delaySeconds: 1, inputMode: 'credential_password' as const }],
    };
    expect(sshStartupSaveError(script, { hasInlinePassword: false, hasLinkedCredential: false }))
      .toMatch(/no password or linked credential/);
    expect(sshStartupSaveError(script, { hasInlinePassword: true, hasLinkedCredential: false })).toBeNull();
    expect(sshStartupSaveError(script, { hasInlinePassword: false, hasLinkedCredential: true })).toBeNull();
    expect(sshStartupSaveError(script, { hasInlinePassword: false, hasLinkedCredential: false,
      allowRuntimePasswordLookup: true })).toBeNull();
  });
});

describe('prepareSshStartup', () => {
  const config = {
    startup: {
      enabled: true,
      steps: [
        { delaySeconds: 1, inputMode: 'text', text: 'sudo -i' },
        { delaySeconds: 0.5, inputMode: 'credential_password' },
      ],
    },
  };

  it('is a no-op when disabled or missing', () => {
    expect(prepareSshStartup({}, 'pw')).toBeUndefined();
    expect(prepareSshStartup({ startup: { enabled: false, steps: [{ delaySeconds: 1, inputMode: 'text', text: 'x' }] } }, 'pw'))
      .toBeUndefined();
  });

  it('keeps the password only in memory and uses key+password credentials', () => {
    const prepared = prepareSshStartup(config, 's3cret');
    expect(prepared?.password).toBe('s3cret');
    expect(prepared?.steps[1]).toEqual({ delayMs: 500, kind: 'credential_password', text: '' });
    expect(JSON.stringify(config)).not.toContain('s3cret');
  });

  it('refuses password-mode scripts when no usable password exists', () => {
    expect(() => prepareSshStartup(config, null)).toThrow(/no password is available/);
    expect(() => prepareSshStartup(config, '')).toThrow(/no password is available/);

  });

  it('reads the password from a linked credential, not from empty inline leftovers', () => {
    expect(passwordFromConnectionSecrets({ password: 'vault-pw' }, 'inline-ignored')).toBe('vault-pw');
    expect(passwordFromConnectionSecrets({ password: null }, 'inline-ignored')).toBeNull();
    expect(passwordFromConnectionSecrets(null, 'inline-pw')).toBe('inline-pw');
  });
});

describe('SshStartupRunner', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function run(script: Parameters<typeof prepareSshStartup>[0], password: string | null = 'pw') {
    const prepared = prepareSshStartup(script, password);
    if (!prepared) throw new Error('expected script');
    const written: Uint8Array[] = [];
    let active = true;
    const runner = new SshStartupRunner(prepared, {
      write: (data) => written.push(data),
      isActive: () => active,
    });
    return {
      runner,
      written,
      deactivate() { active = false; },
    };
  }

  it('starts only after start(), then sends relative delays, order, and Enter', async () => {
    vi.useFakeTimers();
    const { runner, written } = run({
      startup: {
        enabled: true,
        steps: [
          { delaySeconds: 1, inputMode: 'text', text: 'sudo -i' },
          { delaySeconds: 2, inputMode: 'text', text: 'whoami' },
        ],
      },
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(writesOf(written)).toEqual([]);

    runner.start();
    runner.start();
    await vi.advanceTimersByTimeAsync(999);
    expect(writesOf(written)).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(writesOf(written)).toEqual([`sudo -i${SSH_STARTUP_ENTER}`]);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(writesOf(written)).toEqual([`sudo -i${SSH_STARTUP_ENTER}`]);
    await vi.advanceTimersByTimeAsync(1);
    expect(writesOf(written)).toEqual([`sudo -i${SSH_STARTUP_ENTER}`, `whoami${SSH_STARTUP_ENTER}`]);
  });

  it('sends the in-memory password, never a placeholder', async () => {
    vi.useFakeTimers();
    const { runner, written } = run({
      startup: {
        enabled: true,
        steps: [{ delaySeconds: 0, inputMode: 'credential_password' }],
      },
    }, 'real-pass');
    runner.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(writesOf(written)).toEqual([`real-pass${SSH_STARTUP_ENTER}`]);
    expect(writesOf(written).join('')).not.toMatch(/credential_password|\{\{?password\}?\}/i);
  });

  it('cancels remaining steps when the session is no longer active', async () => {
    vi.useFakeTimers();
    const { runner, written, deactivate } = run({
      startup: {
        enabled: true,
        steps: [
          { delaySeconds: 1, inputMode: 'text', text: 'first' },
          { delaySeconds: 1, inputMode: 'text', text: 'second' },
        ],
      },
    });
    runner.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(writesOf(written)).toEqual([`first${SSH_STARTUP_ENTER}`]);
    deactivate();
    runner.cancel();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(writesOf(written)).toEqual([`first${SSH_STARTUP_ENTER}`]);
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { localFileSyncEnabled } from '../host-electron-settings.js';
import { devLimitCollaborators } from '../app-sync-dev.js';
import { UNLIMITED } from '../../vault-session/effective-limit.js';
import { earlyInUseCheck } from '../../vault-session/open-gate.js';
import type { OpenContext } from '../../vault-session/open-deps.js';
import type { VaultLocation } from '../../vault-session/open-location.js';

describe('local file multi-device opt-in', () => {
  it('is disabled by default and only accepts a strict boolean true when signed out', () => {
    expect(localFileSyncEnabled({}, null)).toBe(false);
    expect(localFileSyncEnabled({ local_file_sync_unlimited: 'true' }, null)).toBe(false);
    expect(localFileSyncEnabled({ local_file_sync_unlimited: true }, 'account-id')).toBe(false);
    expect(localFileSyncEnabled({ local_file_sync_unlimited: true }, null)).toBe(true);
  });

  it('uses the unlimited limit for both open and runtime claim decisions', () => {
    const c = devLimitCollaborators(UNLIMITED);
    expect(c.effectiveLimit).toBeDefined();
    expect(c.effectiveLimit!({
      signedIn: false, confirmed: false, serverLimit: null,
      localLast: null, tierCache: null, nowMs: Date.now(),
    })).toMatchObject({ limit: -1 });
  });

  it('skips the server peek entirely on a signed-out local file open', async () => {
    let calls = 0;
    const ctx = {
      signedIn: false,
      deps: { localFileSync: true },
      input: { takeover: false },
      client: { peek: () => { calls++; throw new Error('should not call backend'); } },
    } as unknown as OpenContext;
    const loc = { realpath: '/synced/Vault.conduit', shared: true } as VaultLocation;
    await expect(earlyInUseCheck(ctx, loc, {
      lineageId: 'local-vault', shared: true, claimState: null, local: null,
    })).resolves.toBeUndefined();
    expect(calls).toBe(0);
  });
});

// @vitest-environment node
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LocalFileSyncRuntime } from '../app-sync-local.js';
import { makeTempRoot } from './host-fakes.js';
import { makeTestSessionHost } from '../../vault-session/__tests__/session-fakes.js';
import { LeaseTracker } from '../../vault-session/lease.js';
import { SessionClient } from '../../vault-session/session-client.js';
import { LINEAGE, OWN, NONCE, RuntimeEngine, RuntimeReplica, stateWithClaim, presence } from '../../vault-session/__tests__/runtime-fakes.js';
import { localFileSyncEnabled } from '../host-electron-settings.js';
import { localFileSyncCollaborators } from '../app-sync-local.js';

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
    const c = localFileSyncCollaborators();
    expect(c.effectiveLimit).toBeDefined();
    expect(c.effectiveLimit!({
      signedIn: false, confirmed: false, serverLimit: null,
      localLast: null, tierCache: null, nowMs: Date.now(),
    })).toMatchObject({ limit: -1 });
  });

  it('does not override an authenticated account even if auth changes during unlock', () => {
    const c = localFileSyncCollaborators();
    expect(c.effectiveLimit!({
      signedIn: true, confirmed: true, serverLimit: 1,
      localLast: null, tierCache: null, nowMs: Date.now(),
    }).limit).toBe(1);
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

// Exercise the real runtime, not only the unlock collaborator's numeric result.
it('does not start backend links or displace Local Mode after merging another device claim', async () => {
  const root = makeTempRoot('local-runtime');
  const t = makeTestSessionHost(root);
  t.knobs.userId = null;
  const engine = new RuntimeEngine();
  const replica = new RuntimeReplica();
  replica.current = stateWithClaim(presence(t.clock.now()), true);
  const runtime = new LocalFileSyncRuntime({
    host: t.host, config: { syncRoot: root, machineDir: root, dataDir: root, deviceUuid: OWN, sessionNonce: NONCE },
    lineageId: LINEAGE, shared: true, fileName: 'Vault.conduit',
    client: new SessionClient(t.rpc, t.host), lease: new LeaseTracker(), replica: replica.asReplica(), ignoreOwnerTag: true,
  });
  runtime.attachEngine(engine.asEngine());
  try {
    runtime.start(null);
    runtime.signals().afterMerge();
    await t.clock.advance(60_000);
    expect(runtime.effectiveLimit().limit).toBe(-1);
    expect(runtime.isSoftLocked()).toBe(false);
    expect(t.rpc.calls).toEqual([]);
    expect(t.realtime.activeCount()).toBe(0);
    expect(replica.writes).toEqual([]);
    t.knobs.userId = 'signed-in-account';
    expect(runtime.effectiveLimit().limit).toBe(1);
  } finally {
    await runtime.lock();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

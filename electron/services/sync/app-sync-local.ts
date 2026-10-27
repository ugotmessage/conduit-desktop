/** Production local-file mode, separate from the development-only device-limit override. */
import { effectiveLimit, UNLIMITED, type EffectiveLimit } from '../vault-session/effective-limit.js';
import type { OpenCollaborators } from '../vault-session/open-personal-vault.js';
import { PersonalVaultRuntime, type RuntimeDeps } from '../vault-session/session-runtime.js';

export class LocalFileSyncRuntime extends PersonalVaultRuntime {
  constructor(private readonly localDeps: RuntimeDeps) { super(localDeps); }

  override effectiveLimit(): EffectiveLimit {
    // Auth transitions close this runtime; never retain the override while that close runs.
    return this.localDeps.host.account.userId() === null
      ? { limit: UNLIMITED, source: 'default' }
      : super.effectiveLimit();
  }
}

export function localFileSyncCollaborators(): Partial<OpenCollaborators> {
  return {
    effectiveLimit: (input) => input.signedIn ? effectiveLimit(input) : { limit: UNLIMITED, source: 'default' },
    createRuntime: (deps) => new LocalFileSyncRuntime(deps),
  };
}

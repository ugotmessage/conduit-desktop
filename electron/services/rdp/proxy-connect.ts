// Main-process side of RDP SOCKS5: resolve an optional vault login and build the engine hop.

import { isRdGateway } from './gateway-config.js';
import { isEntryNotFound, type GatewayVault, type GatewayVaultEntry } from './gateway-connect.js';
import {
  PROXY_CREDENTIAL_MESSAGE,
  ProxyConfigError,
  proxyCredentialIdOf,
  proxyEnabledOf,
  rdpProxyValidationError,
  resolveProxyEngineConfig,
  type ProxyLogin,
  type RdpProxyEngineConfig,
} from './proxy-config.js';

function tryGetEntry(vault: GatewayVault, id: string): GatewayVaultEntry | null {
  try {
    return vault.getEntry(id) ?? null;
  } catch (e) {
    if (isEntryNotFound(e)) return null;
    const reason = e instanceof Error ? e.message : String(e);
    throw new ProxyConfigError(`Could not read the SOCKS5 proxy credential from the vault: ${reason}`);
  }
}

function isLoginCredential(entry: GatewayVaultEntry): boolean {
  return entry.entry_type === 'credential' && !isRdGateway(entry);
}

function loginFrom(entry: GatewayVaultEntry): ProxyLogin {
  return { username: entry.username ?? '', password: entry.password ?? '' };
}

/** Resolve the optional vault login for an enabled SOCKS5 hop. Throws instead of connecting directly. */
export function connectProxy(
  fields: unknown,
  vault: GatewayVault | undefined,
  opts?: { gatewayEnabled?: boolean },
): RdpProxyEngineConfig | undefined {
  const validationError = rdpProxyValidationError(fields);
  if (validationError) throw new ProxyConfigError(validationError);
  if (!proxyEnabledOf(fields)) return undefined;
  const credentialId = proxyCredentialIdOf(fields);
  let login: ProxyLogin | undefined;
  if (credentialId) {
    if (!vault) throw new ProxyConfigError(PROXY_CREDENTIAL_MESSAGE);
    const entry = tryGetEntry(vault, credentialId);
    if (!entry || !isLoginCredential(entry)) {
      throw new ProxyConfigError(PROXY_CREDENTIAL_MESSAGE);
    }
    login = loginFrom(entry);
  }
  return resolveProxyEngineConfig(fields, login, opts);
}

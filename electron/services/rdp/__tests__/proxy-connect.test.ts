import { describe, expect, it, vi } from 'vitest';
import { PROXY_CREDENTIAL_MESSAGE, PROXY_GATEWAY_MESSAGE } from '../proxy-config.js';
import { connectProxy } from '../proxy-connect.js';
import type { GatewayVault, GatewayVaultEntry } from '../gateway-connect.js';

function entry(over: Partial<GatewayVaultEntry> = {}): GatewayVaultEntry {
  return {
    id: 'c1',
    name: 'Proxy login',
    entry_type: 'credential',
    credential_type: 'generic',
    config: {},
    credential_id: null,
    username: 'alice',
    password: 'secret',
    domain: null,
    ...over,
  };
}

function vaultWith(...entries: GatewayVaultEntry[]): GatewayVault {
  return {
    getEntry: vi.fn((id: string) => {
      const e = entries.find((x) => x.id === id);
      if (!e) throw new Error(`Entry not found: ${id}`);
      return e;
    }),
  };
}

const enabled = { proxyEnabled: true, proxyHost: '127.0.0.1', proxyPort: 1080 };

describe('connectProxy', () => {
  it('returns undefined when the hop is off and does not touch the vault', () => {
    const vault = vaultWith(entry());
    expect(connectProxy({}, vault)).toBeUndefined();
    expect(connectProxy({ proxyEnabled: false, proxyCredentialId: 'gone' }, vault)).toBeUndefined();
    expect(vault.getEntry).not.toHaveBeenCalled();
  });

  it('builds an unauthenticated hop without reading a credential', () => {
    const vault = vaultWith(entry());
    expect(connectProxy(enabled, vault)).toEqual({ type: 'socks5', host: '127.0.0.1', port: 1080 });
    expect(vault.getEntry).not.toHaveBeenCalled();
  });

  it('resolves a vault login and keeps the password off the stored fields', () => {
    const hop = connectProxy({ ...enabled, proxyCredentialId: 'c1' }, vaultWith(entry()));
    expect(hop).toEqual({
      type: 'socks5',
      host: '127.0.0.1',
      port: 1080,
      username: 'alice',
      password: 'secret',
    });
  });

  it('rejects a missing, non-login or gateway credential', () => {
    expect(() => connectProxy({ ...enabled, proxyCredentialId: 'gone' }, vaultWith())).toThrow(PROXY_CREDENTIAL_MESSAGE);
    expect(() => connectProxy(
      { ...enabled, proxyCredentialId: 'c1' },
      vaultWith(entry({ entry_type: 'rdp' })),
    )).toThrow(PROXY_CREDENTIAL_MESSAGE);
    expect(() => connectProxy(
      { ...enabled, proxyCredentialId: 'c1' },
      vaultWith(entry({ credential_type: 'rd_gateway' })),
    )).toThrow(PROXY_CREDENTIAL_MESSAGE);
  });

  it('refuses a gateway mix', () => {
    expect(() => connectProxy(enabled, vaultWith(), { gatewayEnabled: true })).toThrow(PROXY_GATEWAY_MESSAGE);
  });
});

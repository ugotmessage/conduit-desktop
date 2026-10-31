import { describe, expect, it } from 'vitest';
import {
  PROXY_CREDENTIAL_MESSAGE,
  PROXY_GATEWAY_MESSAGE,
  PROXY_HOST_MESSAGE,
  PROXY_PORT_MESSAGE,
  PROXY_TYPE_MESSAGE,
  ProxyConfigError,
  describeProxy,
  readProxyFields,
  rdpProxyConfigForSave,
  rdpProxyValidationError,
  resolveProxyEngineConfig,
} from '../proxy-config.js';

describe('readProxyFields', () => {
  it('defaults to disabled with port 1080', () => {
    expect(readProxyFields({})).toMatchObject({
      enabled: false,
      host: '',
      port: 1080,
      credentialId: undefined,
      typeInvalid: false,
      portInvalid: false,
    });
  });

  it('reads an enabled hop and trims the host', () => {
    expect(readProxyFields({
      proxyEnabled: true,
      proxyType: 'socks5',
      proxyHost: ' 127.0.0.1 ',
      proxyPort: 1080,
      proxyCredentialId: 'c1',
    })).toMatchObject({
      enabled: true,
      type: 'socks5',
      host: '127.0.0.1',
      port: 1080,
      credentialId: 'c1',
    });
  });

  it('flags an unknown type and a non-integer port', () => {
    expect(readProxyFields({ proxyType: 'http', proxyPort: 12.5 })).toMatchObject({
      typeInvalid: true,
      portInvalid: true,
    });
    expect(readProxyFields({ proxyPort: 70000 }).portInvalid).toBe(true);
  });
});

describe('rdpProxyValidationError', () => {
  it('is silent when the hop is off', () => {
    expect(rdpProxyValidationError({})).toBeNull();
    expect(rdpProxyValidationError({ proxyEnabled: true, proxyHost: '127.0.0.1' })).toBeNull();
  });

  it('requires a host, a valid port and SOCKS5, and refuses a gateway mix', () => {
    expect(rdpProxyValidationError({ proxyEnabled: true })).toBe(PROXY_HOST_MESSAGE);
    expect(rdpProxyValidationError({ proxyEnabled: true, proxyHost: '127.0.0.1', proxyPort: 0 })).toBe(PROXY_PORT_MESSAGE);
    expect(rdpProxyValidationError({ proxyEnabled: true, proxyHost: '127.0.0.1', proxyType: 'http' })).toBe(PROXY_TYPE_MESSAGE);
    expect(rdpProxyValidationError({ proxyEnabled: true, proxyHost: '127.0.0.1', gatewayId: 'g1' })).toBe(PROXY_GATEWAY_MESSAGE);
  });
});

describe('rdpProxyConfigForSave', () => {
  it('omits proxyEnabled when the hop is off and keeps a typed host', () => {
    expect(rdpProxyConfigForSave({ enableNla: true, proxyHost: '127.0.0.1', proxyPort: 1080 })).toEqual({
      enableNla: true,
      proxyHost: '127.0.0.1',
      proxyPort: 1080,
    });
  });

  it('stores socks5 and the default port when enabled', () => {
    expect(rdpProxyConfigForSave({ proxyEnabled: true, proxyHost: 'proxy.example' })).toEqual({
      proxyEnabled: true,
      proxyType: 'socks5',
      proxyHost: 'proxy.example',
      proxyPort: 1080,
    });
  });

  it('never persists a password field', () => {
    const saved = rdpProxyConfigForSave({
      proxyEnabled: true,
      proxyHost: '127.0.0.1',
      proxyCredentialId: 'c1',
    } as { proxyEnabled: true; proxyHost: string; proxyCredentialId: string; password?: string });
    expect(saved).toMatchObject({ proxyCredentialId: 'c1' });
    expect(saved).not.toHaveProperty('password');
  });
});

describe('resolveProxyEngineConfig', () => {
  it('omits the hop when it is off', () => {
    expect(resolveProxyEngineConfig({}, undefined)).toBeUndefined();
  });

  it('builds an unauthenticated hop', () => {
    expect(resolveProxyEngineConfig(
      { proxyEnabled: true, proxyHost: '127.0.0.1', proxyPort: 1080 },
      undefined,
    )).toEqual({ type: 'socks5', host: '127.0.0.1', port: 1080 });
  });

  it('attaches a resolved login and refuses a missing one', () => {
    expect(resolveProxyEngineConfig(
      { proxyEnabled: true, proxyHost: '127.0.0.1', proxyCredentialId: 'c1' },
      { username: 'alice', password: 'secret' },
    )).toEqual({ type: 'socks5', host: '127.0.0.1', port: 1080, username: 'alice', password: 'secret' });
    expect(() => resolveProxyEngineConfig(
      { proxyEnabled: true, proxyHost: '127.0.0.1', proxyCredentialId: 'gone' },
      undefined,
    )).toThrow(ProxyConfigError);
    expect(() => resolveProxyEngineConfig(
      { proxyEnabled: true, proxyHost: '127.0.0.1', proxyCredentialId: 'gone' },
      undefined,
    )).toThrow(PROXY_CREDENTIAL_MESSAGE);
  });

  it('refuses a gateway mix instead of connecting directly', () => {
    expect(() => resolveProxyEngineConfig(
      { proxyEnabled: true, proxyHost: '127.0.0.1' },
      undefined,
      { gatewayEnabled: true },
    )).toThrow(PROXY_GATEWAY_MESSAGE);
  });
});

describe('describeProxy', () => {
  it('never includes the password', () => {
    const line = describeProxy({ type: 'socks5', host: '127.0.0.1', port: 1080, username: 'alice', password: 'secret' });
    expect(line).toContain('proxy=socks5 127.0.0.1:1080');
    expect(line).toContain('auth=set');
    expect(line).not.toContain('secret');
  });
});

// Invalid metadata must fail closed, never silently select a direct route.
describe('proxy validation regressions', () => {
  it('rejects malformed enable flags and explicit invalid proxy fields', () => {
    for (const proxyEnabled of ['true', 1, null]) {
      expect(() => resolveProxyEngineConfig({ proxyEnabled }, undefined)).toThrow(ProxyConfigError);
    }
    for (const override of [{ proxyPort: null }, { proxyType: null }, { proxyType: '' }, { proxyHost: 'bad host' }]) {
      expect(() => resolveProxyEngineConfig({ proxyEnabled: true, proxyHost: 'proxy.test', ...override }, undefined)).toThrow(ProxyConfigError);
    }
  });
  it('enforces RFC1929 byte lengths and strips inline secrets on save', () => {
    for (const login of [{ username: '', password: 'x' }, { username: 'x', password: '' }, { username: '界'.repeat(86), password: 'x' }]) {
      expect(() => resolveProxyEngineConfig({ proxyEnabled: true, proxyHost: 'proxy.test' }, login)).toThrow(ProxyConfigError);
    }
    const saved = rdpProxyConfigForSave({ proxyEnabled: true, proxyHost: 'proxy.test', proxyUsername: 'u', proxyPassword: 'secret' });
    expect(saved).not.toHaveProperty('proxyUsername');
    expect(saved).not.toHaveProperty('proxyPassword');
  });
});

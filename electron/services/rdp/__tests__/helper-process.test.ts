import { describe, expect, it } from 'vitest';
import { helperChildEnv, shouldPreResolveRdpTarget } from '../engines/helper-process.js';

describe('shouldPreResolveRdpTarget', () => {
  it('resolves only a direct hop', () => {
    expect(shouldPreResolveRdpTarget({})).toBe(true);
    expect(shouldPreResolveRdpTarget({ gateway: { hostname: 'gw' } as never })).toBe(false);
    expect(shouldPreResolveRdpTarget({ proxy: { type: 'socks5', host: '127.0.0.1', port: 1080 } })).toBe(false);
  });
});

describe('helperChildEnv', () => {
  it('sets OPENSSL_MODULES and keeps ambient proxy bypass unless a SOCKS hop is on', () => {
    const base = { PATH: '/bin', no_proxy: 'rdp.fixture.test', NO_PROXY: '*', OTHER: '1' };
    expect(helperChildEnv(base, { osslModulesDir: '/ossl', clearProxyBypass: false })).toEqual({
      PATH: '/bin',
      no_proxy: 'rdp.fixture.test',
      NO_PROXY: '*',
      OTHER: '1',
      OPENSSL_MODULES: '/ossl',
    });
  });

  it('strips no_proxy variants so FreeRDP cannot cancel an explicit SOCKS hop', () => {
    const env = helperChildEnv(
      { no_proxy: 'rdp.fixture.test', NO_PROXY: '*', No_Proxy: 'yes', nO_pRoXy: '*', KEEP: '1' },
      { osslModulesDir: '/ossl', clearProxyBypass: true },
    );
    expect(env.OPENSSL_MODULES).toBe('/ossl');
    expect(env.KEEP).toBe('1');
    expect(env).not.toHaveProperty('no_proxy');
    expect(env).not.toHaveProperty('NO_PROXY');
    expect(env).not.toHaveProperty('No_Proxy');
    expect(env).not.toHaveProperty('nO_pRoXy');
  });
});

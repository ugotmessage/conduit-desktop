import { describe, it, expect } from 'vitest';
import type { RdpEngineConfig } from '../engine.js';
import { buildHelperConnectConfig, helperErrorMessage, parseHelperError, parseHelperJson } from '../engines/helper-protocol.js';

const base: RdpEngineConfig = {
  host: '10.0.0.5',
  port: 3389,
  username: 'alice',
  password: 'pw',
  width: 1280,
  height: 720,
  enableNla: true,
  skipCertVerification: true,
};

describe('buildHelperConnectConfig', () => {
  it('omits gateway when there is none', () => {
    const cfg = buildHelperConnectConfig(base);
    expect('gateway' in cfg).toBe(false);
    expect(cfg).toMatchObject({ host: '10.0.0.5', port: 3389, domain: '', enableGfx: true, drives: [] });
  });

  it('prefers the hostname alias over the host', () => {
    expect(buildHelperConnectConfig({ ...base, hostname: 'pc01.corp.local' }).host).toBe('pc01.corp.local');
  });

  it('omits proxy when there is none', () => {
    expect('proxy' in buildHelperConnectConfig(base)).toBe(false);
  });

  it('sends an unauthenticated SOCKS5 hop and keeps the target hostname', () => {
    const cfg = buildHelperConnectConfig({
      ...base,
      hostname: 'pc01.corp.local',
      port: 3390,
      proxy: { type: 'socks5', host: '127.0.0.1', port: 1080 },
    });
    expect(cfg.host).toBe('pc01.corp.local');
    expect(cfg.port).toBe(3390);
    expect(cfg.proxy).toEqual({ type: 'socks5', host: '127.0.0.1', port: 1080 });
    expect(cfg.proxy).not.toHaveProperty('password');
  });

  it('sends resolved proxy auth only in the helper payload', () => {
    const cfg = buildHelperConnectConfig({
      ...base,
      proxy: { type: 'socks5', host: 'proxy.example', port: 1080, username: 'alice', password: 'proxy-pw' },
    });
    expect(cfg.proxy).toEqual({
      type: 'socks5',
      host: 'proxy.example',
      port: 1080,
      username: 'alice',
      password: 'proxy-pw',
    });
  });

  it('sends the gateway with host = gateway hostname', () => {
    const cfg = buildHelperConnectConfig({
      ...base,
      gateway: {
        hostname: 'gw.corp.example',
        port: 8443,
        username: 'gwuser',
        password: 'gw-pw',
        domain: 'CORP',
        transport: 'http',
        bypassLocal: true,
      },
    });
    expect(cfg.gateway).toEqual({
      host: 'gw.corp.example',
      port: 8443,
      username: 'gwuser',
      password: 'gw-pw',
      domain: 'CORP',
      transport: 'http',
      bypassLocal: true,
    });
  });
});

describe('parseHelperJson', () => {
  it('parses an object payload', () => {
    expect(parseHelperJson(Buffer.from('{"width":10,"height":20}'))).toEqual({ width: 10, height: 20 });
  });

  it('returns null for malformed or non-object payloads', () => {
    expect(parseHelperJson(Buffer.from('{"message":"bad "quote"}'))).toBeNull();
    expect(parseHelperJson(Buffer.from('42'))).toBeNull();
  });
});

describe('helperErrorMessage', () => {
  it('uses the message field and ignores a code', () => {
    expect(helperErrorMessage(Buffer.from('{"message":"Gateway auth failed","code":2}'))).toBe('Gateway auth failed');
  });

  it('falls back to the raw text when the payload is not valid JSON', () => {
    expect(helperErrorMessage(Buffer.from('{"message":"bad "quote"}'))).toBe('{"message":"bad "quote"}');
  });

  it('gives a generic message for an empty payload', () => {
    expect(helperErrorMessage(Buffer.from(''))).toBe('The RDP helper reported an error.');
  });
});

describe('parseHelperError', () => {
  it('reads the message, code and phase of an ERROR frame', () => {
    const payload = Buffer.from('{"message":"Access denied.","code":131094,"phase":"gateway"}');
    expect(parseHelperError(payload)).toEqual({ message: 'Access denied.', code: 131094, phase: 'gateway' });
  });

  it('drops a phase or code it does not know', () => {
    const payload = Buffer.from('{"message":"x","code":"nope","phase":"moon"}');
    expect(parseHelperError(payload)).toEqual({ message: 'x' });
  });

  it('falls back to the raw text for a malformed frame', () => {
    expect(parseHelperError(Buffer.from('boom'))).toEqual({ message: 'boom' });
  });
});

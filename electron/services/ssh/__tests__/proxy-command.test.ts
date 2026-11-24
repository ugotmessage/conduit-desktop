// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseSupportedProxyCommand } from '../proxy-command.js';
import { SshConfigError } from '../ssh-config-error.js';

describe('parseSupportedProxyCommand', () => {
  it('accepts the nc SOCKS5 form used with a local proxy', () => {
    expect(parseSupportedProxyCommand('nc -X 5 -x 127.0.0.1:1086 %h %p')).toEqual({
      type: 'socks5',
      proxyHost: '127.0.0.1',
      proxyPort: 1086,
    });
  });

  it('accepts a path to nc and optional -n', () => {
    expect(parseSupportedProxyCommand('/usr/bin/nc -n -X 5 -x 127.0.0.1:1086 %h %p')).toEqual({
      type: 'socks5',
      proxyHost: '127.0.0.1',
      proxyPort: 1086,
    });
  });

  it('rejects shell syntax instead of executing it', () => {
    expect(() => parseSupportedProxyCommand('nc -X 5 -x 127.0.0.1:1086 %h %p; rm -rf /')).toThrow(
      SshConfigError,
    );
    expect(() => parseSupportedProxyCommand('ssh -W %h:%p bastion.test')).toThrow(/not supported/);
  });

  it('rejects ProxyCommand that is not SOCKS5 nc', () => {
    expect(() => parseSupportedProxyCommand('nc -X 4 -x 127.0.0.1:1086 %h %p')).toThrow(/SOCKS5/);
    expect(() => parseSupportedProxyCommand('nc -X 5 -x 127.0.0.1:1086 %h')).toThrow(/%h %p/);
  });
});

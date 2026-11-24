import os from 'node:os';
import path from 'node:path';
import { SshConfigError } from './ssh-config-error.js';

export interface SshPathTokens {
  /** Original Host alias (`%n`). */
  alias: string;
  /** HostName, or the alias when HostName is unset (`%h`). */
  hostName: string;
  port: number;
  remoteUser: string;
  localUser: string;
  home: string;
  localHost: string;
}

const TOKEN = /%(%|h|n|p|r|u|d|l)/g;

/**
 * Expand `~` and the OpenSSH tokens we support in IdentityFile / HostName.
 * Unknown `%` tokens fail instead of producing a silent wrong path.
 */
export function expandSshPath(value: string, tokens: SshPathTokens): string {
  const withHome = expandTilde(value, tokens.home);
  if (/%(?![%hnprudl])/.test(withHome)) {
    throw new SshConfigError(
      'CONFIG_PARSE',
      `SSH config path contains an unsupported % token: ${value}`,
    );
  }
  return withHome.replace(TOKEN, (_all, code: string) => {
    switch (code) {
      case '%':
        return '%';
      case 'h':
        return tokens.hostName;
      case 'n':
        return tokens.alias;
      case 'p':
        return String(tokens.port);
      case 'r':
        return tokens.remoteUser;
      case 'u':
        return tokens.localUser;
      case 'd':
        return tokens.home;
      case 'l':
        return tokens.localHost;
      default:
        return _all;
    }
  });
}

export function expandTilde(value: string, home: string = os.homedir()): string {
  if (value === '~') return home;
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(home, value.slice(2));
  }
  return value;
}

export function defaultPathTokens(partial: Partial<SshPathTokens> & { alias: string }): SshPathTokens {
  const home = partial.home ?? os.homedir();
  const localUser = partial.localUser ?? os.userInfo().username;
  const hostName = partial.hostName ?? partial.alias;
  return {
    alias: partial.alias,
    hostName,
    port: partial.port ?? 22,
    remoteUser: partial.remoteUser ?? localUser,
    localUser,
    home,
    localHost: partial.localHost ?? os.hostname(),
  };
}

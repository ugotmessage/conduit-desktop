import { SshConfigError } from './ssh-config-error.js';

export interface Socks5ProxyTarget {
  type: 'socks5';
  proxyHost: string;
  proxyPort: number;
}

const SHELL_META = /[|><&;`$(){}\n\r]|\$\(/;

/**
 * Parse a ProxyCommand that we can honour without a shell.
 *
 * Supported: `nc` / `ncat` (or a path ending in those names) with
 * `-X 5` (SOCKS5) and `-x host[:port]` (default proxy port 1080), plus
 * `%h %p` as the destination. Optional `-n` is ignored.
 *
 * Anything else — pipes, redirects, ProxyJump, unknown flags — fails.
 */
export function parseSupportedProxyCommand(command: string): Socks5ProxyTarget {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new SshConfigError('UNSUPPORTED_ROUTING', 'SSH config ProxyCommand is empty');
  }
  if (SHELL_META.test(trimmed)) {
    throw new SshConfigError(
      'UNSUPPORTED_ROUTING',
      `SSH config ProxyCommand is not a supported SOCKS5 nc form (shell syntax is not executed): ${summarize(trimmed)}`,
    );
  }

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) {
    throw new SshConfigError('UNSUPPORTED_ROUTING', 'SSH config ProxyCommand is empty');
  }

  const exe = basename(tokens[0]);
  if (exe !== 'nc' && exe !== 'ncat') {
    throw new SshConfigError(
      'UNSUPPORTED_ROUTING',
      `SSH config ProxyCommand is not supported (only nc/ncat SOCKS5 is implemented): ${summarize(trimmed)}`,
    );
  }

  let proxySpec: string | undefined;
  let socksVersion: string | undefined;
  const positional: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === '-X') {
      socksVersion = requireArg(tokens, ++i, trimmed, '-X');
    } else if (tok === '-x') {
      proxySpec = requireArg(tokens, ++i, trimmed, '-x');
    } else if (tok === '-n') {
      continue;
    } else if (tok.startsWith('-')) {
      throw new SshConfigError(
        'UNSUPPORTED_ROUTING',
        `SSH config ProxyCommand uses unsupported nc flag ${tok}: ${summarize(trimmed)}`,
      );
    } else {
      positional.push(tok);
    }
  }

  if (socksVersion !== '5') {
    throw new SshConfigError(
      'UNSUPPORTED_ROUTING',
      `SSH config ProxyCommand must use SOCKS5 (-X 5): ${summarize(trimmed)}`,
    );
  }
  if (!proxySpec) {
    throw new SshConfigError(
      'UNSUPPORTED_ROUTING',
      `SSH config ProxyCommand is missing -x proxy address: ${summarize(trimmed)}`,
    );
  }
  if (positional.length !== 2 || positional[0] !== '%h' || positional[1] !== '%p') {
    throw new SshConfigError(
      'UNSUPPORTED_ROUTING',
      `SSH config ProxyCommand must end with %h %p (destination DNS is done by SOCKS): ${summarize(trimmed)}`,
    );
  }

  const { host, port } = parseProxyAddr(proxySpec);
  return { type: 'socks5', proxyHost: host, proxyPort: port };
}

function requireArg(tokens: string[], index: number, command: string, flag: string): string {
  const value = tokens[index];
  if (!value || value.startsWith('-')) {
    throw new SshConfigError(
      'UNSUPPORTED_ROUTING',
      `SSH config ProxyCommand ${flag} is missing a value: ${summarize(command)}`,
    );
  }
  return value;
}

function parseProxyAddr(spec: string): { host: string; port: number } {
  if (spec.startsWith('[')) {
    const m = spec.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (!m) {
      throw new SshConfigError('UNSUPPORTED_ROUTING', `Invalid SOCKS5 proxy address: ${spec}`);
    }
    return { host: m[1], port: m[2] ? parsePort(m[2]) : 1080 };
  }
  const colon = spec.lastIndexOf(':');
  if (colon <= 0) return { host: spec, port: 1080 };
  const host = spec.slice(0, colon);
  const portPart = spec.slice(colon + 1);
  if (!/^\d+$/.test(portPart)) return { host: spec, port: 1080 };
  return { host, port: parsePort(portPart) };
}

function parsePort(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new SshConfigError('UNSUPPORTED_ROUTING', `Invalid SOCKS5 proxy port: ${raw}`);
  }
  return n;
}

export function tokenize(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (quote) {
    throw new SshConfigError('CONFIG_PARSE', 'Unclosed quote in SSH config value');
  }
  if (current) tokens.push(current);
  return tokens;
}

function basename(p: string): string {
  const norm = p.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/');
  return (i >= 0 ? norm.slice(i + 1) : norm).toLowerCase();
}

function summarize(command: string): string {
  return command.length > 160 ? `${command.slice(0, 157)}...` : command;
}

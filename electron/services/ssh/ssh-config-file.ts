/**
 * User SSH config loader (~/.ssh/config).
 *
 * Supports Host (wildcards, negation, first-value-wins), top-level Include,
 * and the directives Conduit honours. Match blocks are skipped unless they
 * set routing options, which fail closed. This is not a full OpenSSH clone.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tokenize } from './proxy-command.js';
import { expandTilde } from './expand-ssh-path.js';
import { globMatch, hostLineMatches } from './host-glob.js';
import { SshConfigError } from './ssh-config-error.js';

const ROUTING_KEYS = new Set(['proxycommand', 'proxyjump', 'proxyusefdpass']);
const YES = new Set(['yes', 'true', 'on']);
const NO = new Set(['no', 'false', 'off']);
const MAX_INCLUDE_DEPTH = 16;

export interface HostBlock {
  patterns: string[];
  /** Lowercased keyword → values in file order. */
  values: Map<string, string[]>;
  kind: 'host' | 'match';
}

export interface LoadedSshConfig {
  blocks: HostBlock[];
}

export interface ComputedSshConfig {
  hostName?: string;
  user?: string;
  port?: number;
  identityFiles: string[];
  serverAliveInterval?: number;
  forwardAgent?: boolean;
  proxyCommand?: string;
  proxyJump?: string;
  proxyUseFdpass?: string;
}

export function loadSshConfigFile(
  configPath: string,
  opts?: { homedir?: string; readFile?: (p: string) => string; exists?: (p: string) => boolean },
): LoadedSshConfig {
  const homedir = opts?.homedir ?? os.homedir();
  const readFile = opts?.readFile ?? ((p: string) => fs.readFileSync(p, 'utf8'));
  const exists = opts?.exists ?? ((p: string) => fs.existsSync(p));
  if (!exists(configPath)) return { blocks: [] };
  return { blocks: parseBlocks(loadText(configPath, homedir, readFile, exists, new Set(), 0, { allowInclude: true })) };
}

export function parseSshConfigText(text: string): HostBlock[] {
  return parseBlocks(text);
}

export function computeSshConfig(loaded: LoadedSshConfig, alias: string): ComputedSshConfig {
  const routingMatch = loaded.blocks.find(
    (b) => b.kind === 'match' && [...b.values.keys()].some((k) => ROUTING_KEYS.has(k)),
  );
  if (routingMatch) {
    throw new SshConfigError(
      'UNSUPPORTED_ROUTING',
      'SSH config Match blocks that set ProxyCommand, ProxyJump, or ProxyUseFdpass are not supported',
    );
  }

  const first = new Map<string, string>();
  const identityFiles: string[] = [];

  for (const block of loaded.blocks) {
    if (block.kind !== 'host') continue;
    if (!hostLineMatches(alias, block.patterns)) continue;
    for (const [key, values] of block.values) {
      if (key === 'identityfile') {
        for (const v of values) {
          if (v.toLowerCase() === 'none') {
            throw new SshConfigError('CONFIG_PARSE', 'IdentityFile none is not yet supported');
          }
          identityFiles.push(v);
        }
        continue;
      }
      // OpenSSH: the first ProxyCommand OR ProxyJump wins, including 'none'.
      if ((key === 'proxycommand' || key === 'proxyjump') &&
          (first.has('proxycommand') || first.has('proxyjump'))) continue;
      if (!first.has(key) && values[0] !== undefined) {
        first.set(key, values[0]);
      }
    }
  }

  const portRaw = first.get('port');
  const intervalRaw = first.get('serveraliveinterval');
  const forwardRaw = first.get('forwardagent');

  return {
    hostName: first.get('hostname'),
    user: first.get('user'),
    port: portRaw !== undefined ? parsePort(portRaw, 'Port') : undefined,
    identityFiles,
    serverAliveInterval:
      intervalRaw !== undefined ? parseNonNegativeInt(intervalRaw, 'ServerAliveInterval') : undefined,
    forwardAgent: forwardRaw !== undefined ? parseYesNo(forwardRaw, 'ForwardAgent') : undefined,
    proxyCommand: first.get('proxycommand'),
    proxyJump: first.get('proxyjump'),
    proxyUseFdpass: first.get('proxyusefdpass'),
  };
}

function loadText(
  filePath: string,
  homedir: string,
  readFile: (p: string) => string,
  exists: (p: string) => boolean,
  seen: Set<string>,
  depth: number,
  state: { allowInclude: boolean },
): string {
  if (depth > MAX_INCLUDE_DEPTH) {
    throw new SshConfigError('CONFIG_PARSE', 'SSH config Include nested too deeply');
  }
  const resolved = path.resolve(filePath);
  if (seen.has(resolved)) {
    throw new SshConfigError('CONFIG_PARSE', `SSH config Include cycle at ${resolved}`);
  }
  seen.add(resolved);
  try {
    const out: string[] = [];
    for (const raw of joinContinuations(readFile(resolved).split(/\r?\n/))) {
      const line = stripComment(raw).trim();
      if (!line) { out.push(raw); continue; }
      const { keyword, value } = splitKeywordValue(line);
      const key = keyword.toLowerCase();
      if (key === 'host') {
        const patterns = tokenize(value);
        state.allowInclude = patterns.length === 1 && patterns[0] === '*';
      } else if (key === 'match') {
        state.allowInclude = false;
      }
      if (key !== 'include') { out.push(raw); continue; }
      if (!state.allowInclude) {
        throw new SshConfigError('CONFIG_PARSE', 'SSH config Include inside a named Host / Match block is not supported');
      }
      for (const pattern of tokenize(value)) {
        // User config relative Include paths are always based at ~/.ssh.
        for (const included of expandInclude(pattern, path.join(homedir, '.ssh'), homedir, exists)) {
          out.push(loadText(included, homedir, readFile, exists, seen, depth + 1, state));
        }
      }
    }
    return out.join('\n');
  } finally {
    seen.delete(resolved);
  }
}

function expandInclude(
  pattern: string,
  fromDir: string,
  homedir: string,
  exists: (p: string) => boolean,
): string[] {
  const expanded = expandTilde(pattern, homedir);
  const abs = path.isAbsolute(expanded) ? expanded : path.resolve(fromDir, expanded);
  const dir = path.dirname(abs);
  const filePattern = path.basename(abs);
  if (!/[*?]/.test(filePattern)) {
    return exists(abs) ? [abs] : [];
  }
  if (!exists(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => globMatch(name, filePattern))
      .map((name) => path.join(dir, name))
      .filter((p) => {
        try {
          return fs.statSync(p).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

function parseBlocks(text: string): HostBlock[] {
  const lines = joinContinuations(text.split(/\r?\n/));
  const blocks: HostBlock[] = [];
  let current: HostBlock = { patterns: ['*'], values: new Map(), kind: 'host' };
  let started = false;

  const flush = () => {
    if (started || current.values.size > 0) blocks.push(current);
  };

  for (const raw of lines) {
    const line = stripComment(raw).trim();
    if (!line) continue;
    const { keyword, value } = splitKeywordValue(line);
    const key = keyword.toLowerCase();

    if (key === 'host') {
      flush();
      started = true;
      current = { patterns: tokenize(value), values: new Map(), kind: 'host' };
      continue;
    }
    if (key === 'match') {
      flush();
      started = true;
      current = { patterns: [], values: new Map(), kind: 'match' };
      continue;
    }

    appendValue(current, key, unquote(value));
  }
  flush();
  return blocks;
}

function appendValue(block: HostBlock, key: string, value: string): void {
  const list = block.values.get(key);
  if (list) list.push(value);
  else block.values.set(key, [value]);
}

function joinContinuations(lines: string[]): string[] {
  const out: string[] = [];
  let buf = '';
  for (const line of lines) {
    const trimmedEnd = line.replace(/[ \t]+$/, '');
    if (trimmedEnd.endsWith('\\')) {
      buf += trimmedEnd.slice(0, -1);
      continue;
    }
    out.push(buf + line);
    buf = '';
  }
  if (buf) out.push(buf);
  return out;
}

function stripComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#') return line.slice(0, i);
  }
  return line;
}

function splitKeywordValue(line: string): { keyword: string; value: string } {
  const m = line.match(/^([A-Za-z][A-Za-z0-9]*)\s*(?:=\s*|\s+)(.*)$/);
  if (m) return { keyword: m[1], value: m[2].trim() };
  const eq = line.match(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.*)$/);
  if (eq) return { keyword: eq[1], value: eq[2].trim() };
  return { keyword: line.trim(), value: '' };
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parsePort(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new SshConfigError('CONFIG_PARSE', `SSH config ${label} is not a valid port: ${raw}`);
  }
  return n;
}

function parseNonNegativeInt(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new SshConfigError('CONFIG_PARSE', `SSH config ${label} is not a valid integer: ${raw}`);
  }
  return n;
}

function parseYesNo(raw: string, label: string): boolean {
  const v = raw.toLowerCase();
  if (YES.has(v)) return true;
  if (NO.has(v) || v === 'ask') return false;
  throw new SshConfigError('CONFIG_PARSE', `SSH config ${label} must be yes or no: ${raw}`);
}

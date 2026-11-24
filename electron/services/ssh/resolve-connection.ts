/**
 * Unified SSH connection resolution for UI and MCP.
 *
 * Reads ~/.ssh/config (or an injected fixture) and fills gaps that the
 * session did not set explicitly. Explicit user/port/credentials always win.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SshAuth, SshConfig } from './client.js';
import { expandSshPath, defaultPathTokens } from './expand-ssh-path.js';
import { parseSupportedProxyCommand, type Socks5ProxyTarget } from './proxy-command.js';
import {
  resolveSshAuth,
  resolveSshAuthSystem,
  type CredentialData,
} from './resolve-auth.js';
import {
  computeSshConfig,
  loadSshConfigFile,
  type LoadedSshConfig,
} from './ssh-config-file.js';
import { SshConfigError } from './ssh-config-error.js';

export interface SshConnectionInput {
  host: string;
  /** Set only when the user/entry/MCP request named a port. `null`/`undefined` lets ssh config fill it. */
  port?: number | null;
  credential?: CredentialData | null;
  sshAuthMethod?: string | null;
}

export interface SshResolveOptions {
  configPath?: string;
  homedir?: string;
  env?: NodeJS.ProcessEnv;
  loadedConfig?: LoadedSshConfig;
}

export interface ResolvedSshConnection {
  config: SshConfig;
  alias: string;
}

export function defaultUserSshConfigPath(homedir: string = os.homedir()): string {
  return path.join(homedir, '.ssh', 'config');
}

/**
 * Build the shared resolver input from UI / MCP session args.
 * A linked credential wins; otherwise an explicit username selects inline
 * secrets; otherwise this is system mode (config + default keys).
 */
export function sshInputFromSessionArgs(args: {
  host: string;
  port?: number | null;
  credential?: CredentialData | null;
  username?: string | null;
  password?: string | null;
  privateKey?: string | null;
  sshAuthMethod?: string | null;
}): SshConnectionInput {
  if (args.credential) {
    return {
      host: args.host,
      port: args.port,
      credential: args.credential,
      sshAuthMethod: args.sshAuthMethod,
    };
  }
  if (args.username || args.password || args.privateKey) {
    return {
      host: args.host,
      port: args.port,
      credential: {
        username: args.username ?? null,
        password: args.password ?? null,
        private_key: args.privateKey ?? null,
      },
      sshAuthMethod: args.sshAuthMethod,
    };
  }
  return {
    host: args.host,
    port: args.port,
    credential: null,
    sshAuthMethod: args.sshAuthMethod,
  };
}

export function resolveSshConnection(
  input: SshConnectionInput,
  options: SshResolveOptions = {},
): ResolvedSshConnection {
  const alias = input.host.trim();
  if (!alias) {
    throw new SshConfigError('CONFIG_PARSE', 'SSH host is required');
  }

  const homedir = options.homedir ?? os.homedir();
  const env = options.env ?? process.env;
  const loaded =
    options.loadedConfig ??
    loadSshConfigFile(options.configPath ?? defaultUserSshConfigPath(homedir), { homedir });
  const computed = computeSshConfig(loaded, alias);

  const cred = input.credential ?? null;
  const explicitUser = nonEmpty(cred?.username);
  const localUser = os.userInfo().username;
  const username = explicitUser ?? nonEmpty(computed.user) ?? localUser;

  const explicitPort = explicitPortNumber(input.port);
  const port = explicitPort ?? computed.port ?? 22;

  const hostName = computed.hostName
    ? expandSshPath(computed.hostName, defaultPathTokens({
        alias,
        hostName: alias,
        port,
        remoteUser: username,
        localUser,
        home: homedir,
      }))
    : alias;

  const tokens = defaultPathTokens({
    alias,
    hostName,
    port,
    remoteUser: username,
    localUser,
    home: homedir,
  });

  const identityFiles = computed.identityFiles.map((p) => expandSshPath(p, tokens));
  const systemMode = !cred;
  const auth = resolveAuth({
    username,
    cred,
    sshAuthMethod: input.sshAuthMethod,
    identityFiles,
    systemMode,
    homedir,
  });

  const proxy = resolveRouting(computed);
  const agent = resolveAgent(computed.forwardAgent === true, env);

  const config: SshConfig = {
    host: hostName,
    port,
    auth,
  };
  if (computed.serverAliveInterval !== undefined) {
    config.keepaliveMs = computed.serverAliveInterval * 1000;
  }
  if (proxy) config.proxy = proxy;
  if (agent) {
    config.agent = agent;
    config.agentForward = true;
  }

  return { config, alias };
}

function resolveRouting(computed: ReturnType<typeof computeSshConfig>): Socks5ProxyTarget | undefined {
  if (computed.proxyJump && computed.proxyJump.toLowerCase() !== 'none') {
    throw new SshConfigError(
      'UNSUPPORTED_ROUTING',
      `SSH config ProxyJump is not supported (${computed.proxyJump}). Direct connect was not attempted.`,
    );
  }
  if (computed.proxyUseFdpass && computed.proxyUseFdpass.toLowerCase() !== 'no') {
    throw new SshConfigError(
      'UNSUPPORTED_ROUTING',
      'SSH config ProxyUseFdpass is not supported. Direct connect was not attempted.',
    );
  }
  if (computed.proxyCommand && computed.proxyCommand.toLowerCase() !== 'none') {
    return parseSupportedProxyCommand(computed.proxyCommand);
  }
  return undefined;
}

function resolveAgent(forwardAgent: boolean, env: NodeJS.ProcessEnv): string | undefined {
  if (!forwardAgent) return undefined;
  const sock = env.SSH_AUTH_SOCK;
  if (!sock) return undefined;
  try {
    if (!fs.existsSync(sock)) return undefined;
  } catch {
    return undefined;
  }
  return sock;
}

function resolveAuth(args: {
  username: string;
  cred: CredentialData | null;
  sshAuthMethod?: string | null;
  identityFiles: string[];
  systemMode: boolean;
  homedir: string;
}): SshAuth {
  const method = args.sshAuthMethod ?? args.cred?.ssh_auth_method ?? null;
  const hasExplicitKey = !!args.cred?.private_key;
  const hasExplicitPassword = !!args.cred?.password;

  if (hasExplicitKey || hasExplicitPassword) {
    return resolveSshAuth(
      {
        username: args.username ?? null,
        password: args.cred?.password ?? null,
        private_key: args.cred?.private_key ?? null,
        ssh_auth_method: args.cred?.ssh_auth_method,
      },
      args.sshAuthMethod,
    );
  }

  // Explicit password mode must not be switched to IdentityFile / publickey.
  if (method === 'password') {
    return { type: 'password', username: args.username ?? null, password: '' };
  }

  if (args.identityFiles.length > 0) {
    const keyPath = firstReadable(args.identityFiles);
    if (!keyPath) {
      throw new SshConfigError(
        'IDENTITY_FILE',
        `SSH config IdentityFile is not readable: ${args.identityFiles.join(', ')}`,
      );
    }
    return { type: 'public_key', username: args.username ?? null, keyPath };
  }

  if (args.systemMode) {
    return resolveSshAuthSystem({ username: args.username ?? null, homedir: args.homedir });
  }

  return { type: 'password', username: args.username ?? null, password: '' };
}

function firstReadable(paths: string[]): string | undefined {
  for (const p of paths) {
    try {
      fs.accessSync(p, fs.constants.R_OK);
      return p;
    } catch {
      continue;
    }
  }
  return undefined;
}

function explicitPortNumber(port: number | null | undefined): number | undefined {
  if (port == null) return undefined;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SshConfigError('CONFIG_PARSE', 'Explicit SSH port must be between 1 and 65535');
  }
  return port;
}

function nonEmpty(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

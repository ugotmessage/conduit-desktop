// Per-entry RDP SOCKS5 contract shared by the renderer, main process, MCP and the FreeRDP helper.
// Electron-free so the renderer can re-export it. Passwords are never stored on the entry.

import { gatewayIdOf, validPort } from './gateway-config.js';

export const RDP_PROXY_TYPE_SOCKS5 = 'socks5' as const;
export type RdpProxyType = typeof RDP_PROXY_TYPE_SOCKS5;
export const RDP_PROXY_DEFAULT_PORT = 1080;

export const PROXY_HOST_MESSAGE = 'Enter a SOCKS5 proxy address.';
export const PROXY_PORT_MESSAGE = 'The SOCKS5 proxy port must be a number from 1 to 65535.';
export const PROXY_TYPE_MESSAGE = 'Only SOCKS5 proxies are supported.';
export const PROXY_GATEWAY_MESSAGE =
  'SOCKS5 proxy and RD Gateway cannot be used together. Turn one of them off.';
export const PROXY_CREDENTIAL_MESSAGE =
  'The SOCKS5 proxy credential was not found. Pick another credential, or clear it.';
export const PROXY_MALFORMED_MESSAGE = 'The RDP proxy settings are invalid.';

/** Config keys on an RDP entry. The optional credential is a vault login; its password is resolved at connect. */
export interface RdpEntryProxyFields {
  proxyEnabled?: boolean;
  proxyType?: RdpProxyType;
  proxyHost?: string;
  proxyPort?: number;
  proxyCredentialId?: string;
}

/** What the RDP engine and helper receive. Password is memory-only. */
export interface RdpProxyEngineConfig {
  type: RdpProxyType;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export class ProxyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxyConfigError';
  }
}

export interface ParsedRdpProxy {
  enabled: boolean;
  type: RdpProxyType | undefined;
  host: string;
  port: number;
  credentialId: string | undefined;
  typeInvalid: boolean;
  enabledInvalid: boolean;
  credentialInvalid: boolean;
  portInvalid: boolean;
}

function asRecord(config: unknown): Record<string, unknown> {
  return typeof config === 'object' && config !== null ? (config as Record<string, unknown>) : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function proxyEnabledOf(config: unknown): boolean {
  return asRecord(config).proxyEnabled === true;
}

export function proxyCredentialIdOf(config: unknown): string | undefined {
  return nonEmptyString(asRecord(config).proxyCredentialId);
}

/** Secret-free view of an RDP entry's SOCKS5 fields. Junk from other clients is tolerated. */
export function readProxyFields(config: unknown): ParsedRdpProxy {
  const c = asRecord(config);
  const type = c.proxyType;
  const typeInvalid = type !== undefined && type !== RDP_PROXY_TYPE_SOCKS5;
  const rawPort = c.proxyPort;
  const portInvalid = rawPort !== undefined && validPort(rawPort) === undefined;
  return {
    enabled: c.proxyEnabled === true,
    enabledInvalid: c.proxyEnabled !== undefined && typeof c.proxyEnabled !== 'boolean',
    credentialInvalid: c.proxyCredentialId != null && typeof c.proxyCredentialId !== 'string',
    type: type === RDP_PROXY_TYPE_SOCKS5 ? RDP_PROXY_TYPE_SOCKS5 : undefined,
    host: typeof c.proxyHost === 'string' ? c.proxyHost.trim() : '',
    port: validPort(c.proxyPort) ?? RDP_PROXY_DEFAULT_PORT,
    credentialId: nonEmptyString(c.proxyCredentialId),
    typeInvalid,
    portInvalid,
  };
}

/** Why an enabled SOCKS5 setup cannot be saved or opened, or null. */
export function rdpProxyValidationError(config: unknown): string | null {
  const p = readProxyFields(config);
  if (p.enabledInvalid) return PROXY_MALFORMED_MESSAGE;
  if (!p.enabled) return null;
  if (p.credentialInvalid) return PROXY_MALFORMED_MESSAGE;
  if (gatewayIdOf(config)) return PROXY_GATEWAY_MESSAGE;
  if (p.typeInvalid) return PROXY_TYPE_MESSAGE;
  if (!p.host || /[\s\x00-\x1f/\\@?#]/.test(p.host)) return PROXY_HOST_MESSAGE;
  if (p.portInvalid) return PROXY_PORT_MESSAGE;
  return null;
}

/** Persist host/port/credential for the form; `proxyEnabled` only when the hop is on. Never a password. */
export function rdpProxyConfigForSave<T extends RdpEntryProxyFields>(config: T): T {
  const result = { ...config } as T & RdpEntryProxyFields;
  const p = readProxyFields(config);
  delete result.proxyEnabled;
  delete result.proxyType;
  delete (result as Record<string, unknown>).proxyUsername;
  delete (result as Record<string, unknown>).proxyPassword;
  if (p.host) result.proxyHost = p.host;
  else delete result.proxyHost;
  if (config.proxyPort !== undefined) {
    result.proxyPort = p.portInvalid ? config.proxyPort : p.port;
  } else if (p.enabled) {
    result.proxyPort = p.port;
  } else {
    delete result.proxyPort;
  }
  if (p.credentialId) result.proxyCredentialId = p.credentialId;
  else delete result.proxyCredentialId;
  if (p.enabled) {
    result.proxyEnabled = true;
    result.proxyType = RDP_PROXY_TYPE_SOCKS5;
  }
  return result;
}

export interface ProxyLogin {
  username: string;
  password: string;
}

/**
 * Engine config for an enabled SOCKS5 hop. `login` is required when a credential id is set.
 * Throws ProxyConfigError instead of falling back to a direct connect.
 */
export function resolveProxyEngineConfig(
  fields: unknown,
  login: ProxyLogin | undefined,
  opts?: { gatewayEnabled?: boolean },
): RdpProxyEngineConfig | undefined {
  const p = readProxyFields(fields);
  const error = rdpProxyValidationError(fields);
  if (error) throw new ProxyConfigError(error);
  if (!p.enabled) return undefined;
  if (opts?.gatewayEnabled || gatewayIdOf(fields)) {
    throw new ProxyConfigError(PROXY_GATEWAY_MESSAGE);
  }
  if (p.typeInvalid) throw new ProxyConfigError(PROXY_TYPE_MESSAGE);
  if (!p.host) throw new ProxyConfigError(PROXY_HOST_MESSAGE);
  if (p.portInvalid) throw new ProxyConfigError(PROXY_PORT_MESSAGE);
  if (p.credentialId && !login) throw new ProxyConfigError(PROXY_CREDENTIAL_MESSAGE);
  if (login) {
    const encoder = new TextEncoder();
    if (!login.username || !login.password || login.username.includes('\0') || login.password.includes('\0') ||
        encoder.encode(login.username).length > 255 || encoder.encode(login.password).length > 255) {
      throw new ProxyConfigError('SOCKS5 authentication requires a username and password of 1–255 UTF-8 bytes.');
    }
    return {
      type: RDP_PROXY_TYPE_SOCKS5,
      host: p.host,
      port: p.port,
      username: login.username,
      password: login.password,
    };
  }
  return { type: RDP_PROXY_TYPE_SOCKS5, host: p.host, port: p.port };
}

/** One log-safe line; never includes the password. */
export function describeProxy(px: RdpProxyEngineConfig): string {
  return `proxy=socks5 ${px.host}:${px.port} auth=${px.username ? 'set' : 'none'}`;
}

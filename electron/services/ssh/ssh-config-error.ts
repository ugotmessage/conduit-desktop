/**
 * Errors from SSH config / routing that must surface to the user.
 * Unsupported ProxyCommand / ProxyJump never fall back to a direct TCP connect.
 */
export type SshConfigErrorCode =
  | 'UNSUPPORTED_ROUTING'
  | 'IDENTITY_FILE'
  | 'SOCKS5'
  | 'CONFIG_PARSE';

export class SshConfigError extends Error {
  readonly code: SshConfigErrorCode;

  constructor(code: SshConfigErrorCode, message: string) {
    super(message);
    this.name = 'SshConfigError';
    this.code = code;
  }
}

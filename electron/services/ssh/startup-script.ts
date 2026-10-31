/**
 * Per-entry SSH login startup steps.
 *
 * After an interactive shell is open, each step waits a fixed delay (relative
 * to the previous step), then types into the existing SSH channel and sends
 * Enter. There is no prompt detection. Steps never run in a local shell.
 */

export const SSH_STARTUP_MAX_STEPS = 20;
export const SSH_STARTUP_MAX_DELAY_SECONDS = 120;
export const SSH_STARTUP_MAX_INPUT_LENGTH = 2048;
export const SSH_STARTUP_ENTER = '\r';

export type SshStartupInputMode = 'text' | 'credential_password';

export interface SshStartupStep {
  delaySeconds: number;
  inputMode: SshStartupInputMode;
  /** Typed text. Omitted for `credential_password` so the secret is never stored here. */
  text?: string;
}

export interface SshStartupScript {
  enabled: boolean;
  steps: SshStartupStep[];
}

export const DEFAULT_SSH_STARTUP: SshStartupScript = {
  enabled: false,
  steps: [],
};

export function blankSshStartupStep(): SshStartupStep {
  return { delaySeconds: 2, inputMode: 'text', text: '' };
}

export class SshStartupError extends Error {
  readonly code = 'SSH_STARTUP';

  constructor(message: string) {
    super(message);
    this.name = 'SshStartupError';
  }
}

export interface SshStartupPreparedStep {
  delayMs: number;
  kind: SshStartupInputMode;
  text: string;
}

export interface PreparedSshStartup {
  steps: SshStartupPreparedStep[];
  /** In-memory only. Present when a step uses the connection password. */
  password?: string;
}

export function usableConnectionPassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return value;
}

/** Password from the same resolved credential used to open the session. Linked credential wins. */
export function passwordFromConnectionSecrets(
  credential: { password?: string | null } | null | undefined,
  inlinePassword?: string | null,
): string | null {
  if (credential) return usableConnectionPassword(credential.password);
  return usableConnectionPassword(inlinePassword);
}

export function sshStartupNeedsPassword(script: SshStartupScript): boolean {
  return script.steps.some((step) => step.inputMode === 'credential_password');
}

/** Strict parse of the `startup` object stored on an SSH entry config. */
export function parseSshStartupConfig(raw: unknown): SshStartupScript {
  if (raw == null) return { ...DEFAULT_SSH_STARTUP, steps: [] };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SshStartupError('SSH startup config must be an object.');
  }
  const obj = raw as Record<string, unknown>;
  const enabled = obj.enabled === true;
  const steps = parseSteps(obj.steps, enabled);
  return { enabled, steps };
}

/** Read `entry.config.startup` without throwing; missing or corrupt data is disabled. */
export function loadSshStartupConfig(entryConfig: unknown): SshStartupScript {
  const raw = startupField(entryConfig);
  if (raw == null) return { ...DEFAULT_SSH_STARTUP, steps: [] };
  try {
    return parseSshStartupConfig(raw);
  } catch {
    return { enabled: false, steps: parseSteps(isRecord(raw) ? raw.steps : undefined, false) };
  }
}

export function startupFromEntryConfig(entryConfig: unknown): SshStartupScript {
  const raw = startupField(entryConfig);
  if (raw == null) return { ...DEFAULT_SSH_STARTUP, steps: [] };
  return parseSshStartupConfig(raw);
}

/**
 * Persistable form. Password-mode steps never include text. Disabled + empty
 * omits the key entirely so existing entries stay unchanged.
 */
export function serializeSshStartupConfig(script: SshStartupScript): SshStartupScript | undefined {
  if (!script.enabled && script.steps.length === 0) return undefined;
  return {
    enabled: script.enabled === true,
    steps: script.steps.map((step) => {
      if (step.inputMode === 'credential_password') {
        return { delaySeconds: step.delaySeconds, inputMode: 'credential_password' as const };
      }
      return {
        delaySeconds: step.delaySeconds,
        inputMode: 'text' as const,
        text: step.text ?? '',
      };
    }),
  };
}

export function sshStartupSaveError(
  script: SshStartupScript,
  opts: { hasInlinePassword: boolean; hasLinkedCredential: boolean; allowRuntimePasswordLookup?: boolean },
): string | null {
  if (script.steps.length > SSH_STARTUP_MAX_STEPS) {
    return `Startup scripts can have at most ${SSH_STARTUP_MAX_STEPS} steps.`;
  }
  try {
    parseSteps(script.steps, true);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  if (script.enabled && sshStartupNeedsPassword(script) && !opts.hasInlinePassword && !opts.hasLinkedCredential && !opts.allowRuntimePasswordLookup) {
    return 'This startup script uses the connection password, but this entry has no password or linked credential.';
  }
  return null;
}

export function prepareSshStartup(
  entryConfig: unknown,
  password: string | null | undefined,
): PreparedSshStartup | undefined {
  const script = startupFromEntryConfig(entryConfig);
  if (!script.enabled || script.steps.length === 0) return undefined;

  const needsPassword = sshStartupNeedsPassword(script);
  const usable = usableConnectionPassword(password);
  if (needsPassword && usable === null) {
    throw new SshStartupError(
      'This SSH startup script uses the connection password, but no password is available on the credential.',
    );
  }

  return {
    steps: script.steps.map((step) => ({
      delayMs: Math.round(step.delaySeconds * 1000),
      kind: step.inputMode,
      text: step.inputMode === 'text' ? (step.text ?? '') : '',
    })),
    ...(needsPassword && usable !== null ? { password: usable } : {}),
  };
}

export class SshStartupRunner {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private index = 0;
  private started = false;
  private cancelled = false;

  constructor(
    private readonly script: PreparedSshStartup,
    private readonly hooks: {
      write: (data: Uint8Array) => void;
      isActive: () => boolean;
    },
  ) {}

  start(): void {
    if (this.started || this.cancelled) return;
    this.started = true;
    this.arm();
  }

  cancel(): void {
    this.cancelled = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get hasStarted(): boolean {
    return this.started;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  private arm(): void {
    if (this.cancelled || this.index >= this.script.steps.length) return;
    const delayMs = this.script.steps[this.index].delayMs;
    this.timer = setTimeout(() => this.fire(), delayMs);
  }

  private fire(): void {
    this.timer = null;
    if (this.cancelled || !this.hooks.isActive()) {
      this.cancel();
      return;
    }
    const step = this.script.steps[this.index];
    let payload: string;
    if (step.kind === 'credential_password') {
      const password = this.script.password;
      if (!password) {
        this.cancel();
        return;
      }
      payload = password;
    } else {
      payload = step.text;
    }
    try {
      this.hooks.write(Buffer.from(payload + SSH_STARTUP_ENTER, 'utf8'));
    } catch {
      this.cancel();
      return;
    }
    this.index += 1;
    this.arm();
  }
}

function startupField(entryConfig: unknown): unknown {
  if (!isRecord(entryConfig)) return undefined;
  return entryConfig.startup;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSteps(raw: unknown, strict: boolean): SshStartupStep[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    if (strict) throw new SshStartupError('SSH startup steps must be an array.');
    return [];
  }
  if (strict && raw.length > SSH_STARTUP_MAX_STEPS) {
    throw new SshStartupError(`Startup scripts can have at most ${SSH_STARTUP_MAX_STEPS} steps.`);
  }
  const steps: SshStartupStep[] = [];
  const limit = Math.min(raw.length, SSH_STARTUP_MAX_STEPS);
  for (let i = 0; i < limit; i += 1) {
    const step = parseStep(raw[i], i, strict);
    if (step) steps.push(step);
  }
  if (strict && raw.length > limit) {
    throw new SshStartupError(`Startup scripts can have at most ${SSH_STARTUP_MAX_STEPS} steps.`);
  }
  return steps;
}

function parseStep(raw: unknown, index: number, strict: boolean): SshStartupStep | null {
  if (!isRecord(raw)) {
    if (strict) throw new SshStartupError(`Startup step ${index + 1} is invalid.`);
    return null;
  }
  let delaySeconds: number;
  try {
    delaySeconds = parseDelaySeconds(raw.delaySeconds);
  } catch (err) {
    if (strict) throw err;
    return null;
  }

  const modeRaw = raw.inputMode;
  if (modeRaw != null && modeRaw !== 'text' && modeRaw !== 'credential_password') {
    if (strict) throw new SshStartupError(`Startup step ${index + 1} has an unknown input mode.`);
    return null;
  }
  const inputMode: SshStartupInputMode = modeRaw === 'credential_password' ? 'credential_password' : 'text';

  if (inputMode === 'credential_password') {
    return { delaySeconds, inputMode };
  }

  if (raw.text == null) {
    return { delaySeconds, inputMode: 'text', text: '' };
  }
  if (typeof raw.text !== 'string') {
    if (strict) throw new SshStartupError(`Startup step ${index + 1} text must be a string.`);
    return null;
  }
  if (raw.text.length > SSH_STARTUP_MAX_INPUT_LENGTH) {
    if (strict) {
      throw new SshStartupError(
        `Startup step ${index + 1} text is too long (max ${SSH_STARTUP_MAX_INPUT_LENGTH} characters).`,
      );
    }
    return null;
  }
  return { delaySeconds, inputMode: 'text', text: raw.text };
}

function parseDelaySeconds(value: unknown): number {
  if (typeof value === 'string' && value.trim() !== '') {
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new SshStartupError('Each startup step needs a wait of 0 seconds or more (no negative, NaN, or Infinity).');
  }
  if (value > SSH_STARTUP_MAX_DELAY_SECONDS) {
    throw new SshStartupError(`Each startup step can wait at most ${SSH_STARTUP_MAX_DELAY_SECONDS} seconds.`);
  }
  return value;
}

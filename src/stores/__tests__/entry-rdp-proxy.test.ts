import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryMeta } from "../../types/entry";
import { HARDCODED_RDP_DEFAULTS } from "../../types/entry";

const invoke = vi.fn();
vi.mock("../../lib/electron", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("../../components/common/Toast", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("../../components/sessions/TerminalView", () => ({ disposeTerminalEntry: vi.fn() }));

const { useEntryStore } = await import("../entryStore");
const { useSessionStore } = await import("../sessionStore");
const { useSettingsStore } = await import("../settingsStore");
const { useTierStore } = await import("../tierStore");

function rdpEntry(config: Record<string, unknown>): EntryMeta {
  return {
    id: "e1",
    name: "app-01",
    entry_type: "rdp",
    host: "app-01.corp.local",
    port: 3390,
    username: "alice",
    domain: null,
    credential_type: null,
    config,
  } as unknown as EntryMeta;
}

function rdpConnectArgs(): Record<string, unknown> {
  const call = invoke.mock.calls.find((c) => c[0] === "rdp_connect");
  if (!call) throw new Error("rdp_connect was not called");
  return call[1] as Record<string, unknown>;
}

async function open(config: Record<string, unknown>) {
  useEntryStore.setState({ entries: [rdpEntry(config)] } as never);
  await useEntryStore.getState().openEntry("e1");
}

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation(async (cmd: string) => {
    if (cmd === "entry_resolve_credential") return { source: "inline", username: "alice", password: "pw", domain: null };
    if (cmd === "rdp_connect") return { sessionId: "e1", width: 1920, height: 1080, mode: "gfx" };
    return null;
  });
  useSessionStore.setState({ sessions: [], activeSessionId: null });
  useSettingsStore.setState({ sessionDefaultsRdp: { ...HARDCODED_RDP_DEFAULTS } });
  useTierStore.setState({ isEntryLocked: () => false } as never);
});

describe("connectEntry RDP SOCKS5", () => {
  it("sends no proxy fields when the hop is off", async () => {
    await open({});
    const args = rdpConnectArgs();
    expect(args.proxyEnabled).toBeUndefined();
    expect(args).not.toHaveProperty("proxy");
    expect(args.host).toBe("app-01.corp.local");
    expect(args.port).toBe(3390);
  });

  it("sends host, port and credential id, never a proxy password", async () => {
    await open({
      proxyEnabled: true,
      proxyHost: "127.0.0.1",
      proxyPort: 1080,
      proxyCredentialId: "c1",
    });
    const args = rdpConnectArgs();
    expect(args.proxyEnabled).toBe(true);
    expect(args.proxyType).toBe("socks5");
    expect(args.proxyHost).toBe("127.0.0.1");
    expect(args.proxyPort).toBe(1080);
    expect(args.proxyCredentialId).toBe("c1");
    expect(JSON.stringify(args)).not.toMatch(/proxy-pw|secret/);
    expect(args).not.toHaveProperty("proxyPassword");
  });
});

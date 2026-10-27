import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryMeta } from "../../types/entry";

const invoke = vi.fn();
vi.mock("../../lib/electron", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("../../components/common/Toast", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("../../components/sessions/TerminalView", () => ({ disposeTerminalEntry: vi.fn() }));

const { useEntryStore } = await import("../entryStore");
const { useSessionStore } = await import("../sessionStore");
const { useTierStore } = await import("../tierStore");

function sshEntry(config: Record<string, unknown> = {}): EntryMeta {
  return {
    id: "e-ssh",
    name: "lab",
    entry_type: "ssh",
    host: "lab.example",
    port: 22,
    username: "alice",
    domain: null,
    credential_id: null,
    credential_type: null,
    config,
  } as unknown as EntryMeta;
}

function sshCreateArgs(): Record<string, unknown> {
  const call = invoke.mock.calls.find((c) => c[0] === "ssh_session_create");
  if (!call) throw new Error("ssh_session_create was not called");
  return call[1] as Record<string, unknown>;
}

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation(async (cmd: string) => {
    if (cmd === "entry_resolve_credential") {
      return { source: "inline", username: "alice", password: "pw", domain: null, private_key: null };
    }
    if (cmd === "ssh_session_create") return "sess-1";
    return null;
  });
  useSessionStore.setState({ sessions: [], activeSessionId: null });
  useTierStore.setState({ isEntryLocked: () => false } as never);
});

describe("connectEntry SSH startup config", () => {
  it("passes the saved entry config so main can run the same startup script", async () => {
    const config = {
      ssh_auth_method: "key",
      startup: {
        enabled: true,
        steps: [
          { delaySeconds: 1, inputMode: "text", text: "sudo -i" },
          { delaySeconds: 2, inputMode: "credential_password" },
        ],
      },
    };
    useEntryStore.setState({ entries: [sshEntry(config)] } as never);
    await useEntryStore.getState().openEntry("e-ssh");
    expect(sshCreateArgs().entryConfig).toEqual(config);
    expect(JSON.stringify(sshCreateArgs().entryConfig)).not.toMatch(/pw|secret/);
  });

  it("still opens entries with no startup key", async () => {
    useEntryStore.setState({ entries: [sshEntry({})] } as never);
    await useEntryStore.getState().openEntry("e-ssh");
    expect(sshCreateArgs().entryConfig).toEqual({});
  });
});

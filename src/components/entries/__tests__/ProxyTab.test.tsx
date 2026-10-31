import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import ProxyTab from "../tabs/ProxyTab";
import { useVaultStore } from "../../../stores/vaultStore";
import type { RdpEntryConfig } from "../../../types/entry";

vi.hoisted(() => {
  Object.assign(globalThis, { electron: { invoke: async () => null, on: () => () => undefined } });
});

let latest: Partial<RdpEntryConfig> = {};

function Harness({ initial = {} }: { initial?: Partial<RdpEntryConfig> }) {
  const [config, setConfig] = useState<Partial<RdpEntryConfig>>(initial);
  latest = config;
  return <ProxyTab config={config} onChange={setConfig} />;
}

beforeEach(() => {
  latest = {};
  useVaultStore.setState({
    credentials: [
      { id: "c1", name: "Proxy login", username: "alice", domain: null, tags: [], credential_type: "generic", created_at: "" },
    ],
  } as never);
});

describe("ProxyTab", () => {
  it("starts disabled and does not show host fields", () => {
    render(<Harness />);
    expect(screen.getByRole("checkbox", { name: "Use a SOCKS5 proxy" })).not.toBeChecked();
    expect(screen.queryByLabelText("Proxy host")).toBeNull();
  });

  it("enables SOCKS5 with a default port of 1080 and stores the host", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Use a SOCKS5 proxy" }));
    expect(latest.proxyEnabled).toBe(true);
    expect(latest.proxyType).toBe("socks5");
    fireEvent.change(screen.getByLabelText("Proxy host"), { target: { value: "127.0.0.1" } });
    expect(latest.proxyHost).toBe("127.0.0.1");
    expect((screen.getByLabelText("Port") as HTMLInputElement).value).toBe("1080");
  });

  it("warns when a gateway is also on", () => {
    render(<Harness initial={{ proxyEnabled: true, proxyHost: "127.0.0.1", gatewayId: "g1" }} />);
    expect(screen.getByText(/cannot be used together/)).toBeTruthy();
  });

  it("picks and clears an optional vault login", async () => {
    render(<Harness initial={{ proxyEnabled: true, proxyHost: "127.0.0.1" }} />);
    fireEvent.click(screen.getByRole("button", { name: "No authentication" }));
    fireEvent.click(await screen.findByText("Proxy login"));
    expect(latest.proxyCredentialId).toBe("c1");
    fireEvent.click(screen.getByRole("button", { name: "Clear proxy credential" }));
    expect(latest.proxyCredentialId).toBeUndefined();
  });
});

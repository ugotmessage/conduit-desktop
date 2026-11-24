import { describe, expect, it } from "vitest";
import { resolveRdpConfig } from "../resolveConfig";
import { HARDCODED_RDP_DEFAULTS, type RdpEntryConfig } from "../../types/entry";

describe("resolveRdpConfig gateway", () => {
  it("carries the entry's gateway id", () => {
    expect(resolveRdpConfig({ gatewayId: "g1" }, HARDCODED_RDP_DEFAULTS).gatewayId).toBe("g1");
  });

  it("has no gateway id when the entry picks none", () => {
    expect(resolveRdpConfig({}, HARDCODED_RDP_DEFAULTS).gatewayId).toBeUndefined();
    expect(resolveRdpConfig({ gatewayId: " " }, HARDCODED_RDP_DEFAULTS).gatewayId).toBeUndefined();
  });

  it("ignores the old per-entry gateway keys", () => {
    const old = { gatewayMode: "custom", gatewayHostname: "gw.example.com", gatewayCredentialId: "c1" } as Partial<RdpEntryConfig>;
    const resolved = resolveRdpConfig(old, HARDCODED_RDP_DEFAULTS) as unknown as Record<string, unknown>;
    expect(Object.keys(resolved).filter((k) => k.startsWith("gateway"))).toEqual(["gatewayId"]);
    expect(resolved.gatewayId).toBeUndefined();
  });
});

describe("resolveRdpConfig SOCKS5", () => {
  it("carries an enabled hop and leaves it off by default", () => {
    expect(resolveRdpConfig({}, HARDCODED_RDP_DEFAULTS).proxyEnabled).toBeUndefined();
    const resolved = resolveRdpConfig(
      { proxyEnabled: true, proxyHost: "127.0.0.1", proxyPort: 1080, proxyCredentialId: "c1" },
      HARDCODED_RDP_DEFAULTS,
    );
    expect(resolved.proxyEnabled).toBe(true);
    expect(resolved.proxyType).toBe("socks5");
    expect(resolved.proxyHost).toBe("127.0.0.1");
    expect(resolved.proxyPort).toBe(1080);
    expect(resolved.proxyCredentialId).toBe("c1");
  });
});

it("preserves malformed routing metadata for main-process rejection", () => {
  const raw = { proxyEnabled: 'true', proxyType: 'http' } as unknown as Partial<RdpEntryConfig>;
  expect(resolveRdpConfig(raw, HARDCODED_RDP_DEFAULTS)).toMatchObject(raw);
});

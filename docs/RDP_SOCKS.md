# RDP SOCKS5 proxy

An RDP entry can reach the computer through a SOCKS5 TCP `CONNECT` hop. This is **not** an RD Gateway. SSH SOCKS5 (`ProxyCommand nc -X 5 -x …` in `~/.ssh/config`) is a separate path and is never read for RDP.

Default is off. A typical unauthenticated local proxy is `127.0.0.1:1080` (or any host and port you run). `127.0.0.1:1086` is only a usage example.

## For users

Open an RDP entry and pick the **Proxy** tab.

- **Use a SOCKS5 proxy**: off by default.
- **Proxy host** and **Port** (1080 when left at the default).
- **Authentication**: optional. Pick a saved vault login when the proxy requires a username and password. Leave it empty for a local SOCKS5 that does not authenticate.

The computer's hostname stays as typed (for NLA / TLS / SNI). The proxy does the DNS lookup. Conduit does not resolve the target first and does not connect around a failed SOCKS hop.

SOCKS5 and **RD Gateway** cannot be on together. The editor and the connect path both refuse that mix.

Quick Connect and a manual MCP `connection_open` (no saved entry) stay a direct connect.

## For contributors

### Data

Stored on the RDP entry's `config`, never a password:

| Key | Meaning |
|---|---|
| `proxyEnabled` | `true` turns the hop on. Absent or false is off; malformed values are rejected. |
| `proxyType` | Only `socks5` when enabled. |
| `proxyHost` | Proxy address. |
| `proxyPort` | Integer 1–65535; default 1080. |
| `proxyCredentialId` | Optional vault login. Its password is resolved at connect and passed to the helper in memory. |

### Connect flow

1. Renderer (`src/stores/entryStore.ts`): sends `proxyEnabled`, host, port, `proxyCredentialId`. No proxy password crosses IPC.
2. `rdp_connect` and MCP `connection_open_entry` (`buildRdpEngineConfigFromEntry`) validate and resolve the credential, then put a `proxy` object on `RdpEngineConfig`.
3. `buildHelperConnectConfig` maps that to helper JSON `config.proxy`.
4. The helper sets FreeRDP `ProxyType=PROXY_TYPE_SOCKS`, `ProxyHostname`, `ProxyPort`, and optional `ProxyUsername` / `ProxyPassword`.
5. The helper child is spawned with `no_proxy` / `NO_PROXY` removed so FreeRDP's `proxy_prepare` cannot match the target and drop an explicit SOCKS hop.
6. Target DNS is not done in Electron when a proxy or gateway is set.

Malformed or unknown helper `proxy` objects are rejected. The helper does not drop them and connect directly.

`WITH_PROXY=OFF` in `freerdp-helper/build-freerdp.sh` is FreeRDP's **server** proxy component. Client SOCKS lives in libfreerdp core and does not need that flag.

### Untested / out of scope

- A live login through a real RDP server, NLA, or TLS certificate after the SOCKS `CONNECT` (native smoke stops at the SOCKS handshake).
- SOCKS5 and RD Gateway chained together (explicitly refused).
- HTTP, SOCKS4, or other proxy types.
- UDP / RDP multitransport around the proxy (Network Auto-Detect is turned off for a SOCKS hop).
- Reading `~/.ssh/config` for RDP.
- iOS.
- Authenticated SOCKS against a proxy that is not a vault login credential.

Native validation also disables SupportMultitransport and MultitransportFlags (UDP), uses the UINT16 ProxyPort API, and clears proxy bypass variables inside the helper. CI tests both no-auth and username/password SOCKS5 with loopback fixtures and does not log into an RDP server.

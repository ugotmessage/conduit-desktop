# SSH config

Conduit uses `ssh2`, not the OpenSSH CLI. SSH sessions from the app and from MCP now read the user config at `~/.ssh/config` (and top-level `Include` files) in the connection core, then fill in values the session did not set.

This is not full OpenSSH compatibility.

## What is supported

| Directive | Behaviour |
|---|---|
| `Host` | Wildcards (`*`, `?`) and negation (`!`). First matching value wins (file order). |
| `HostName` | Connect address. `~` and `%h` / `%n` / `%p` / `%r` / `%u` / `%d` / `%l` / `%%` are expanded. |
| `User` | Used when the session has no username. |
| `Port` | Used when the session has no port. |
| `IdentityFile` | Used when the session has no password and no private key (including system / Quick Connect with a blank login). `~` and the tokens above are expanded. Several `IdentityFile` lines are tried in order; the first readable path is used. |
| `ServerAliveInterval` | Maps to ssh2 `keepaliveInterval` (seconds → ms). |
| `ForwardAgent` | Enabled only when `ForwardAgent yes` **and** `SSH_AUTH_SOCK` is set and exists. Otherwise it is skipped. |
| `ProxyCommand` | Only the SOCKS5 `nc`/`ncat` form: `nc -X 5 -x 127.0.0.1:1086 %h %p` (optional `-n`, optional path to `nc`). Conduit opens a SOCKS5 `CONNECT` itself and hands the socket to ssh2. Destination DNS is done by the proxy. |
| `Include` | Top-level files and simple `*` / `?` globs, with `~` expansion. Relative paths are relative to `~/.ssh`, following OpenSSH. Included content keeps its position in the file. |

Missing `~/.ssh/config` keeps the previous behaviour (OS user, default `id_ed25519` / `id_rsa` in system mode, port 22).

## Precedence

Values typed on the entry, Quick Connect, or MCP request win.

- An explicit username / port (including port **22**) is not replaced by config.
- An empty SSH port field, or a saved entry with no port, can take `Port` from config, then 22.
- Vault or inline password / private key is not replaced by `IdentityFile`.
- An explicit `ssh_auth_method` of `password` stays password auth even when `IdentityFile` is set.
- MCP `connection_open` omits the SSH port unless the agent passed one, so config can fill it. RDP still defaults to 3389 and VNC to 5900.

## What fails closed

Matching non-`none` `ProxyJump`, `ProxyUseFdpass yes`, or a `ProxyCommand` that is not the SOCKS5 `nc` form **fails**. Conduit does not fall back to a direct TCP connect and does not run a shell.

`Match` blocks that set those routing options also fail (Match itself is not evaluated). `Include` inside a named `Host` / `Match` block is rejected.

A configured `IdentityFile` that cannot be read fails instead of silently switching to a password.

## What is not supported

- System `/etc/ssh/ssh_config`
- `Match` (except failing closed when it would change routing)
- `Include` inside a Host block; nested Include deeper than 16
- Arbitrary `ProxyCommand` (pipes, `ssh -W`, HTTP CONNECT, …)
- `ProxyJump` / jump hosts
- `IdentityFile none` (rejected), and encrypted IdentityFile passphrases (no prompt)
- `CanonicalizeHostname`, `IdentitiesOnly` as distinct behaviour (when `IdentityFile` is set, only those keys are used)
- Local/Remote/Dynamic forwards

## Platform notes

- **macOS / Linux:** the supported subset reads `~/.ssh/config` and uses `SSH_AUTH_SOCK`. The SOCKS5 path does not execute `nc`; it only parses that command shape, so it still works if `nc` is present only as a config spelling.
- **Windows:** OpenSSH user config at `%USERPROFILE%\.ssh\config` is read when present. `SSH_AUTH_SOCK` is often unset, so agent forwarding stays off. The SOCKS5 `nc -X 5 -x …` form is still honoured without running `nc`.

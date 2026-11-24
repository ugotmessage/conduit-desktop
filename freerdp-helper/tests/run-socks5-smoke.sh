#!/bin/bash
# Native SOCKS5 smoke: fake loopback proxy + conduit-freerdp. See socks5-smoke.mjs.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/socks5-smoke.mjs"

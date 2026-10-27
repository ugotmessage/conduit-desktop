# SSH login startup steps

An SSH vault entry can type a short, ordered list of lines after login. This is for fixed waits such as `sudo -i` followed by the connection password. Conduit does **not** read the remote prompt.

## Where it lives

Edit the SSH entry → **Startup**.

- Off by default. Existing entries keep their previous behaviour.
- Enable **Run steps after login**, then add steps. Each step has a wait in seconds and either typed text or **Connection password**.
- Reorder with Up / Down. The wait is relative to the previous step (or to the shell opening, for step 1).
- Typed text is stored on the entry. **Connection password** is not: at connect time the already-resolved credential password is used in memory and sent to the SSH channel only.

Limits: 20 steps, 120 seconds per wait, 2048 characters per typed line. Negative, `NaN`, and infinite waits are rejected.

## When it runs

The script starts only after SSH authentication succeeds **and** the interactive shell is open. It does not block the connection tab.

It runs once per new SSH session. Switching tabs or calling `terminal_start` / `startReading` again does not replay it.

Disconnect, close, or an SSH error cancels any step that has not been sent. Writes always go to that session’s channel, never a local shell or another session.

## Who uses the saved script

| Open path | Uses the entry’s startup steps? |
|---|---|
| UI: open the saved SSH entry | Yes |
| MCP `connection_open_entry` | Yes |
| Quick Connect | No |
| MCP `connection_open` (host/port, no entry) | No |

OpenSSH user config (`HostName`, `ProxyCommand` SOCKS5, explicit credentials, and so on) is unchanged. See `docs/SSH_CONFIG.md`.

## Connection password

Use **Connection password** when a step should type the same password already stored on the entry or its linked credential (including key login when that credential also has a password).

If the script is enabled with a password step and no usable password is available at connect time, the connection is rejected with a visible error before opening the session. Conduit does not silently skip the script or type an empty password or a placeholder such as `credential_password`.

A folder-inherited password is resolved at connection time too. Fixed timers do not detect prompts: if sudo uses cached authorization or passwordless rules, it may not ask for a password. Only configure a password step for a login flow that will actually request it.

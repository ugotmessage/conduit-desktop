# Self-hosted unlimited personal vault devices (experimental)

This fork adds an **opt-in seed-time setting** to allow concurrent opening of a personal vault on multiple devices in a private Appwrite deployment.

## Scope

- Only applies to a **private Appwrite stack** provisioned with `CONDUIT_SELF_HOSTED=1`.
- Sets the **Free** tier's `vault_max_open_devices` to `-1`. Pro/Team remain unchanged.
- Does not remove the account-level device cap (currently five), ownership rules, minimum-version checks, or the existing synchronization safety protocol.
- Does not enable paid cloud backup, team vaults, or paid chat sync.
- Does **not** change the official Conduit backend or unlock an existing official account.
- Signed-out or local-only mode may still enforce the original single-device claim through the vault file; this change is for signed-in clients using your private backend.

## Initial setup

1. Set up a private Appwrite following [LOCAL_APPWRITE.md](LOCAL_APPWRITE.md) or [APPWRITE.md](APPWRITE.md). Never point this workflow at the vendor's production backend.
2. Set `CONDUIT_SELF_HOSTED=1` **only on your private deployment** and run the existing deployment command with `--seed`, or run the local Appwrite setup that invokes it.
3. Configure the desktop app's Appwrite endpoint/project to your private instance using the existing development configuration (see `electron/services/env-config.ts`). Do **not** use the production build unchanged: it targets the vendor service.
4. Verify on the server that the Free tier's `features.vault_max_open_devices` is `-1` before testing two signed-in clients.
5. Place the same `.conduit` vault file in a shared/synced location accessible to both clients and verify changes merge; backing up the vault before tests is strongly recommended.

**Existing private installations:** Running the deployment with `CONDUIT_SELF_HOSTED=1` and `--seed` also updates the existing Free tier row. Back up the tier configuration first. This is deliberately opt-in and does not modify an official service.

## Verification checklist

- Free tier queried from private Appwrite returns `vault_max_open_devices = -1`.
- Two signed-in clients can open the same vault without displacement.
- Each client sees the other client's changes after sync; test concurrent field edits and conflicts.
- Verify offline/reconnect behavior, passwords, and access permissions.
- On the official backend or without the environment opt-in, the Free tier remains limited.

This patch has **not** been validated end-to-end against a running Appwrite instance or a packaged macOS/Windows build. It changes the private backend's seed configuration only.

## VNC cursor fallback

The VNC renderer now sets noVNC `showDotCursor = true`, enabling its fallback dot when a VNC server supplies a hidden/empty cursor. This does not modify the remote machine's pointer, and does not guarantee repair if a server incorrectly sends an opaque but invisible-looking cursor bitmap. Verify against the affected VNC server and check cursor visibility, movement, and input alignment at multiple display scales.

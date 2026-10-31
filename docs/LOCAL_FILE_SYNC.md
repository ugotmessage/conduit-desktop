# Local file sync (Synology Drive, iCloud Drive, OneDrive, Dropbox)

This fork supports an **explicit opt-in** to concurrently open the same personal `.conduit` vault in **signed-out Local Mode** without running a website, Appwrite, or any account server.

## Enable it (on each computer)

1. Install this fork's build on both machines. Open the application and select **Continue without signing in / Local Mode**.
2. In **Settings → Sync**, switch on **Allow concurrent access in Local Mode**, then click **Save**.
3. Lock/close the personal vault if already open, then **reopen it**. Changes do not apply to already-open runtimes.
4. Make a **separate backup** of the original vault before moving it.
5. Use the app's vault picker to create or open **one personal vault** at a path *outside* its private app-data directory, **inside a properly syncing folder**. For example:
   - macOS: `~/SynologyDrive/Conduit/Vault.conduit`
   - Windows: `C:\\Users\\<you>\\SynologyDrive\\Conduit\\Vault.conduit`
   Cloud providers vary in folder naming; the real local file matters, not the example path.
6. Wait for the provider's sync app to finish uploading on the first device. On the second device, wait for the download, then open that same local file with its master password. **Do not create a second independent vault.**
7. Add an SSH entry on A, wait until Drive has uploaded it, run **Sync now** on B (Settings → Sync), and check the entry. Reverse the direction and repeat. Also test simultaneous edits to separate fields and review conflicts.

### Important data-layout rules

- **Only** the shared `.conduit` file goes into the cloud-synced folder.
- Each device keeps its own working copy (`w.conduit`), `local.json`, caches and backups under its **own local app data**. Never point the sync root or entire application data directory at the NAS/cloud folder.
- The sync engine uses independent working copies and field-level merge, not two SQLite processes writing directly to the same database at the same time.
- The cloud-sync client transports files asynchronously. Two devices can be open concurrently, but **changes are not instant**; verify provider state and use **Sync now**.
- On provider conflicts, keep both copies, use Conduit's **Other copies** and **Review changes**, and *never* delete a conflicting copy before inspecting it. The scanner checks all sibling `.conduit` files. Unrecognized names (including NAS/client-specific conflict names) require review rather than automatic merge.
- Maintain versioned backups and test restore on a separate copy. Do not assume all metadata in the vault file is encrypted; credentials are encrypted, but some connection labels, hosts, user names and notes may be stored in readable columns depending on vault version.
- Prefer local Synology Drive clients or an established cloud desktop-sync client rather than opening a SQLite file over a live SMB share. SMB paths can be used, but disconnects and concurrent renames require special testing.
- Use this with vaults you own; enabling local mode skips the upstream account ownership tag check, while your master password remains necessary to unlock data.
- This does not provide team authorization, cross-user permissions, remote account login, cloud backups or a hosted management website.

## How the opt-in is enforced

`settings.local_file_sync_unlimited === true` **and** `account.userId() === null`:

- The open path skips the remote `vault_session_peek` call and ignores account ownership tags for this local open.
- The open's effective per-vault device limit becomes `-1`, so no `_sync/owner/owner` exclusive claim is written/evaluated, and an older claim does not displace this local-mode session.
- The existing independent working copies, publish/merge engine, conflict queue and lock behavior remain unchanged.
- A signed-in session uses original server-enforced limits, regardless of the setting. Signing in while a Local Mode vault is open locks it; reopen to acquire an authenticated lease. The toggle is captured at unlock; changing it requires locking and reopening.
- The feature is opt-in; default (false) retains upstream Free behavior.

**Existing official-build users:** Do not install a fork build over the official build without first exporting/backing up your vault. Fork updates must not silently replace the app with an upstream release.

## Validation and installers

`npm run build` compiles the renderer, Electron main process and MCP server. The PR installer workflow builds the branch head on macOS arm64 and Windows x64, runs focused core tests, builds FreeRDP (plus WebView2 on Windows) and uploads DMG/NSIS EXE artifacts. Artifacts are available on the corresponding **PR installers** Actions run for 14 days; they are not releases or updates. Test installers are not notarized with an Apple developer identity or signed with a Windows publisher certificate.

Core tests exercise real SQLite files, two independent replica engines, concurrent publish recovery, shared-file regression, conflict-copy review, owner/claim gates, the signed-out runtime, clipboard focus routing and async echo suppression. The VNC renderer test confirms fallback configuration; it does **not** prove an actual Mac server renders a visible pointer.

Physical Mac/Windows interoperability through an actual Synology Drive/cloud client, provider-created conflict copies, offline rejoin, master-password changes across devices, VNC pointer visibility and RDP clipboard text/file roundtrips still require hands-on verification. Test with disposable vaults; never use production credentials in CI.

The packaged update feed points to `ugotmessage/conduit-desktop`, including before opt-in, so this fork does not silently install an upstream vendor build. The opt-in also suppresses automatic updates.

## VNC cursor fix

The renderer additionally enables noVNC's `showDotCursor` fallback when the server supplies no visible cursor. Test with the affected VNC target; an incorrectly rendered bitmap may require a separate fix.

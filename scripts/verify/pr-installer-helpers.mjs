// Load the bundled RDP helper with stdin closed; no remote connection or credentials.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const helper = process.argv[2] ?? path.resolve('freerdp-helper', 'bundle', process.platform,
  process.platform === 'win32' ? 'conduit-freerdp.exe' : 'conduit-freerdp');
const result = spawnSync(helper, [], { input: '', encoding: 'utf8', timeout: 15_000, windowsHide: true });
if (result.error || result.status !== 0 || !result.stderr?.includes('Ready, waiting for commands')) {
  throw new Error(`Bundled FreeRDP helper did not start: ${result.error?.message ?? result.stderr ?? result.status}`);
}
console.log('Bundled FreeRDP loader/startup and clean EOF exit passed (no remote session).');
if (process.platform === 'win32') {
  for (const file of ['ConduitWebView2.exe', 'coreclr.dll', 'System.Windows.Forms.dll']) {
    if (!existsSync(path.join('webview2-helper', 'bundle', 'win-x64', file))) {
      throw new Error(`Self-contained WebView2 runtime is missing ${file}`);
    }
  }
  console.log('Self-contained Windows WebView2 runtime is present.');
}

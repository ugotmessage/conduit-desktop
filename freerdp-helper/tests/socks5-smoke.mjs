#!/usr/bin/env node
// Only loopback SOCKS5 fixtures; deliberately reject CONNECT before any RDP login.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.platform === 'win32' ? 'win32' : process.platform === 'linux' ? 'linux' : 'darwin';
const binary = resolve(process.env.CONDUIT_FREERDP ?? join(root, 'bundle', platform,
  process.platform === 'win32' ? 'conduit-freerdp.exe' : 'conduit-freerdp'));
if (!existsSync(binary)) {
  if (process.env.CONDUIT_FREERDP_REQUIRED === '1') throw new Error('Required FreeRDP helper is missing');
  console.log('SKIP: FreeRDP helper has not been built');
  process.exit(0);
}
const target = 'rdp.fixture.test';
const port = 3390;
const user = 'fixture-proxy-user';
const password = 'fixture-proxy-password';

async function check(auth) {
  const peers = new Set();
  let seen = false;
  let problem;
  const server = createServer(socket => {
    peers.add(socket);
    socket.on('close', () => peers.delete(socket));
    socket.on('error', () => {});
    let buffer = Buffer.alloc(0);
    let phase = 'greeting';
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        while (phase !== 'done') {
          if (phase === 'greeting') {
            if (buffer.length < 2 || buffer.length < 2 + buffer[1]) return;
            const method = auth ? 2 : 0;
            if (buffer[0] !== 5 || !buffer.subarray(2, 2 + buffer[1]).includes(method)) {
              throw new Error('SOCKS authentication method was not offered');
            }
            buffer = buffer.subarray(2 + buffer[1]);
            socket.write(Buffer.from([5, method]));
            phase = auth ? 'auth' : 'connect';
          } else if (phase === 'auth') {
            if (buffer.length < 2 || buffer.length < 3 + buffer[1]) return;
            const plenOffset = 2 + buffer[1];
            const end = plenOffset + 1 + buffer[plenOffset];
            if (buffer.length < end) return;
            if (buffer[0] !== 1 || buffer.subarray(2, plenOffset).toString() !== user ||
                buffer.subarray(plenOffset + 1, end).toString() !== password) {
              throw new Error('SOCKS credential packet does not match fixture');
            }
            buffer = buffer.subarray(end);
            socket.write(Buffer.from([1, 0]));
            phase = 'connect';
          } else {
            if (buffer.length < 5) return;
            if (buffer[0] !== 5 || buffer[1] !== 1 || buffer[2] !== 0 || buffer[3] !== 3) {
              throw new Error('Expected SOCKS5 domain CONNECT');
            }
            const end = 5 + buffer[4] + 2;
            if (buffer.length < end) return;
            if (buffer.subarray(5, end - 2).toString() !== target || buffer.readUInt16BE(end - 2) !== port) {
              throw new Error('SOCKS destination or port was changed');
            }
            seen = true;
            phase = 'done';
            // Refuse the synthetic destination. Never connect to a real RDP server.
            socket.end(Buffer.from([5, 5, 0, 1, 0, 0, 0, 0, 0, 0]));
          }
        }
      } catch (error) { problem = error; socket.destroy(); }
    });
  });
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'], env: {
    ...process.env, OPENSSL_MODULES: join(dirname(binary), 'ossl-modules'),
    // The native helper must keep explicit SOCKS enabled despite both bypass variables.
    no_proxy: target, NO_PROXY: '*',
  } });
  let exited = false;
  const closed = new Promise(resolveClose => {
    child.once('error', error => { problem = error; exited = true; resolveClose(); });
    child.once('close', () => { exited = true; resolveClose(); });
  });
  child.stdin.on('error', () => {});
  child.stdout.resume();
  let diagnostics = '';
  child.stderr.on('data', data => { diagnostics = (diagnostics + data.toString()).slice(-4000); });
  try {
    child.stdin.write(JSON.stringify({ type: 'connect', config: {
      host: target, port, username: 'fixture', password: 'fixture', width: 800, height: 600,
      enableNla: true, skipCertVerification: true,
      proxy: { type: 'socks5', host: '127.0.0.1', port: server.address().port,
        ...(auth ? { username: user, password } : {}) },
    } }) + '\n');
    const deadline = Date.now() + 8000;
    while (!seen && !problem && !exited && Date.now() < deadline) await new Promise(r => setTimeout(r, 25));
    if (problem) throw problem;
    if (!seen) throw new Error(`No SOCKS CONNECT observed (${auth ? 'authenticated' : 'unauthenticated'}): ${diagnostics.replaceAll(password, '[redacted]')}`);
    console.log(`PASS: native SOCKS5 ${auth ? 'username/password' : 'no-auth'} domain CONNECT, original port, NO_PROXY ignored (no RDP login)`);
  } finally {
    child.stdin.end();
    if (!exited) child.kill();
    const force = setTimeout(() => child.kill('SIGKILL'), 1500);
    force.unref();
    await closed;
    clearTimeout(force);
    for (const peer of peers) peer.destroy();
    await new Promise(r => server.close(r));
  }
}
await check(false);
await check(true);

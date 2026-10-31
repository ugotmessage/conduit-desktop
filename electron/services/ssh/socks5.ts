/**
 * Minimal SOCKS5 CONNECT client.
 *
 * Destination hostnames are sent as SOCKS ATYP=domain so the proxy does DNS.
 * Local DNS is never consulted for the SSH target. Failures destroy the
 * socket and do not fall back to a direct connection.
 */

import net from 'node:net';
import { isIPv4, isIPv6 } from 'node:net';
import { SshConfigError } from './ssh-config-error.js';

export interface Socks5ConnectOptions {
  proxyHost: string;
  proxyPort: number;
  destinationHost: string;
  destinationPort: number;
  timeoutMs: number;
}

export async function connectSocks5(opts: Socks5ConnectOptions): Promise<net.Socket> {
  const socket = net.connect({ host: opts.proxyHost, port: opts.proxyPort });
  const reader = attachReader(socket);
  let handedOff = false;

  const timer = setTimeout(() => {
    const err = new SshConfigError(
      'SOCKS5',
      `SOCKS5 proxy ${opts.proxyHost}:${opts.proxyPort} timed out after ${opts.timeoutMs}ms`,
    );
    reader.rejectPending(err);
    destroySocket(socket);
  }, opts.timeoutMs);

  try {
    await reader.connected;
    socket.write(Buffer.from([0x05, 0x01, 0x00]));
    const greet = await reader.readExact(2);
    if (greet[0] !== 0x05 || greet[1] !== 0x00) {
      throw new SshConfigError(
        'SOCKS5',
        `SOCKS5 proxy ${opts.proxyHost}:${opts.proxyPort} rejected greeting (VER=${greet[0]} METHOD=${greet[1]})`,
      );
    }

    socket.write(buildConnectRequest(opts.destinationHost, opts.destinationPort));
    const head = await reader.readExact(4);
    if (head[0] !== 0x05 || head[2] !== 0x00) {
      throw new SshConfigError('SOCKS5', `SOCKS5 proxy returned unexpected version ${head[0]}`);
    }
    await readBindAddress(reader, head[3]);

    if (head[1] !== 0x00) {
      throw new SshConfigError(
        'SOCKS5',
        `SOCKS5 CONNECT to ${opts.destinationHost}:${opts.destinationPort} failed (REP=${head[1]})`,
      );
    }

    handedOff = true;
    reader.detach(true);
    clearTimeout(timer);
    return socket;
  } catch (err) {
    clearTimeout(timer);
    reader.detach();
    if (!handedOff) destroySocket(socket);
    if (err instanceof SshConfigError) throw err;
    throw new SshConfigError(
      'SOCKS5',
      `SOCKS5 proxy ${opts.proxyHost}:${opts.proxyPort} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function readBindAddress(reader: Reader, atyp: number): Promise<void> {
  if (atyp === 0x01) {
    await reader.readExact(4 + 2);
    return;
  }
  if (atyp === 0x04) {
    await reader.readExact(16 + 2);
    return;
  }
  if (atyp === 0x03) {
    const lenBuf = await reader.readExact(1);
    await reader.readExact(lenBuf[0] + 2);
    return;
  }
  throw new SshConfigError('SOCKS5', `SOCKS5 proxy returned unknown address type ${atyp}`);
}

function buildConnectRequest(host: string, port: number): Buffer {
  const portBuf = Buffer.from([(port >> 8) & 0xff, port & 0xff]);
  if (isIPv4(host)) {
    const addr = Buffer.from(host.split('.').map((o) => Number(o)));
    return Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x01]), addr, portBuf]);
  }
  if (isIPv6(host)) {
    return Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x04]), ipv6ToBuffer(host), portBuf]);
  }
  const name = Buffer.from(host, 'utf8');
  if (name.length > 255) {
    throw new SshConfigError('SOCKS5', `SOCKS5 destination hostname is too long: ${host}`);
  }
  return Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, name.length]), name, portBuf]);
}

function ipv6ToBuffer(host: string): Buffer {
  const buf = Buffer.alloc(16);
  const groups = expandIPv6(host);
  for (let i = 0; i < 8; i++) buf.writeUInt16BE(groups[i], i * 2);
  return buf;
}

function expandIPv6(host: string): number[] {
  const dotted = host.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const octets = dotted[1].split('.').map(Number);
    host = host.slice(0, -dotted[1].length) +
      ((octets[0] << 8) | octets[1]).toString(16) + ':' +
      ((octets[2] << 8) | octets[3]).toString(16);
  }
  const skip = host.includes('::');
  const [head, tail] = host.split('::');
  const parse = (s: string | undefined) =>
    (s ? s.split(':').filter(Boolean) : []).map((g) => parseInt(g, 16) || 0);
  const left = parse(head);
  const right = skip ? parse(tail) : [];
  const fill = 8 - left.length - right.length;
  return [...left, ...Array(Math.max(0, fill)).fill(0), ...right].slice(0, 8);
}

function destroySocket(socket: net.Socket): void {
  socket.on('error', () => {});
  if (!socket.destroyed) socket.destroy();
}

interface Reader {
  connected: Promise<void>;
  readExact(n: number): Promise<Buffer>;
  rejectPending(err: Error): void;
  detach(preserveData?: boolean): void;
}

function attachReader(socket: net.Socket): Reader {
  let buf = Buffer.alloc(0);
  let waiter: { n: number; resolve: (b: Buffer) => void; reject: (e: Error) => void } | null = null;
  let failure: Error | undefined;
  let connectResolve!: () => void;
  let connectReject!: (err: Error) => void;
  const connected = new Promise<void>((resolve, reject) => {
    connectResolve = resolve;
    connectReject = reject;
  });
  const onConnect = () => connectResolve();

  const failWaiter = (err: Error) => {
    failure ??= err;
    connectReject(err);
    if (!waiter) return;
    const w = waiter;
    waiter = null;
    w.reject(err);
  };

  const tryFulfill = () => {
    if (!waiter || buf.length < waiter.n) return;
    const n = waiter.n;
    const out = buf.subarray(0, n);
    buf = buf.subarray(n);
    const w = waiter;
    waiter = null;
    w.resolve(Buffer.from(out));
  };

  const onData = (chunk: Buffer | string) => {
    buf = Buffer.concat([buf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    tryFulfill();
  };
  const onClose = () => failWaiter(new SshConfigError('SOCKS5', 'SOCKS5 proxy closed the connection'));
  const onError = (err: Error) => failWaiter(err);

  socket.on('data', onData);
  socket.once('close', onClose);
  socket.once('error', onError);

  socket.once('connect', onConnect);

  return {
    connected,
    readExact(n: number): Promise<Buffer> {
      if (failure) return Promise.reject(failure);
      return new Promise<Buffer>((resolve, reject) => {
        waiter = { n, resolve, reject };
        tryFulfill();
      });
    },
    rejectPending: failWaiter,
    detach(preserveData = false) {
      if (preserveData) socket.pause();
      socket.removeListener('connect', onConnect);
      socket.removeListener('data', onData);
      socket.removeListener('close', onClose);
      socket.removeListener('error', onError);
      if (preserveData && buf.length) {
        socket.unshift(buf);
        buf = Buffer.alloc(0);
      }
    },
  };
}

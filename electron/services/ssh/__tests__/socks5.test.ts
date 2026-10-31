// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import net from 'node:net';
import { connectSocks5 } from '../socks5.js';
import { SshConfigError } from '../ssh-config-error.js';

const servers: net.Server[] = [];
const connections: net.Socket[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const sock of connections.splice(0)) {
    sock.resume();
    sock.destroy();
  }
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
        }),
    ),
  );
});

function listen(handler: (sock: net.Socket) => void): Promise<{ host: string; port: number; server: net.Server }> {
  const server = net.createServer((sock) => {
    connections.push(sock);
    handler(sock);
  });
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('expected tcp address');
      resolve({ host: '127.0.0.1', port: addr.port, server });
    });
  });
}

function sendChunks(sock: net.Socket, chunks: Buffer[], gapMs = 5): void {
  let i = 0;
  const next = () => {
    if (i >= chunks.length || sock.destroyed) return;
    sock.write(chunks[i]);
    i += 1;
    setTimeout(next, gapMs);
  };
  next();
}

function runSocks5Server(
  sock: net.Socket,
  onConnect: (req: Buffer) => void,
): void {
  let buf = Buffer.alloc(0);
  let greeted = false;
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    if (!greeted) {
      if (buf.length < 3) return;
      greeted = true;
      buf = buf.subarray(3);
      sock.write(Buffer.from([0x05, 0x00]));
    }
    if (buf.length >= 5 && buf[3] === 0x03) {
      const need = 5 + buf[4] + 2;
      if (buf.length >= need) onConnect(buf.subarray(0, need));
    }
  });
}

describe('connectSocks5', () => {
  it('preserves an SSH banner coalesced with the SOCKS reply for the caller', async () => {
    const banner = 'SSH-2.0-fixture\r\n';
    const proxy = await listen((sock) => {
      runSocks5Server(sock, () => {
        sock.write(Buffer.concat([
          Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 22]), Buffer.from(banner),
        ]));
      });
    });
    const tunnel = await connectSocks5({ proxyHost: proxy.host, proxyPort: proxy.port,
      destinationHost: 'banner.test', destinationPort: 22, timeoutMs: 1000 });
    try {
      const received = new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SSH banner was lost')), 500);
        tunnel.once('data', (chunk) => { clearTimeout(timer); resolve(chunk.toString()); });
        tunnel.resume();
      });
      expect(await received).toBe(banner);
    } finally { tunnel.destroy(); }
  });

  it('also times out before the TCP connection event', async () => {
    const socket = new net.Socket();
    vi.spyOn(net, 'connect').mockReturnValue(socket);
    await expect(connectSocks5({ proxyHost: 'pending.test', proxyPort: 1080,
      destinationHost: 'target.test', destinationPort: 22, timeoutMs: 20 }))
      .rejects.toThrow(/timed out/);
    expect(socket.destroyed).toBe(true);
  });

  it('sends the destination as a domain name and accepts a fragmented reply', async () => {
    let request: Buffer | null = null;
    const proxy = await listen((sock) => {
      runSocks5Server(sock, (req) => {
        request = req;
        sendChunks(sock, [
          Buffer.from([0x05]),
          Buffer.from([0x00]),
          Buffer.from([0x00, 0x01]),
          Buffer.from([127, 0, 0, 1, 0, 22]),
        ]);
      });
    });

    const tunnel = await connectSocks5({
      proxyHost: proxy.host,
      proxyPort: proxy.port,
      destinationHost: 'db.lab.test',
      destinationPort: 2222,
      timeoutMs: 2000,
    });

    try {
      expect(request).not.toBeNull();
      expect(request![3]).toBe(0x03);
      expect(request!.subarray(5, 5 + request![4]).toString()).toBe('db.lab.test');
      expect(request!.readUInt16BE(5 + request![4])).toBe(2222);
      expect(tunnel.destroyed).toBe(false);
    } finally {
      tunnel.destroy();
    }
  });

  it('destroys the socket and does not leave it connected when CONNECT fails', async () => {
    const sockets: net.Socket[] = [];
    const proxy = await listen((sock) => {
      sockets.push(sock);
      runSocks5Server(sock, () => {
        sock.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
      });
    });

    await expect(
      connectSocks5({
        proxyHost: proxy.host,
        proxyPort: proxy.port,
        destinationHost: 'db.lab.test',
        destinationPort: 22,
        timeoutMs: 2000,
      }),
    ).rejects.toThrow(SshConfigError);

    await closed(sockets[0]);
  });

  it('times out and destroys the client socket when the proxy never replies', async () => {
    const sockets: net.Socket[] = [];
    const proxy = await listen((sock) => {
      sockets.push(sock);
      sock.resume();
    });

    await expect(
      connectSocks5({
        proxyHost: proxy.host,
        proxyPort: proxy.port,
        destinationHost: 'db.lab.test',
        destinationPort: 22,
        timeoutMs: 80,
      }),
    ).rejects.toThrow(/timed out/);

    await closed(sockets[0]);
  });
});

function closed(sock: net.Socket | undefined): Promise<void> {
  if (!sock || sock.destroyed) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('proxy socket was not cleaned up')), 1000);
    sock.once('close', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

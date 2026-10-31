// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeSshConfig, loadSshConfigFile, parseSshConfigText } from '../ssh-config-file.js';
import { SshConfigError } from '../ssh-config-error.js';

const LAB = `
Host lab-bastion *.lab.test !secret.lab.test
  HostName %h.internal.example
  User labuser
  Port 2222
  IdentityFile ~/.ssh/lab_ed25519
  ForwardAgent yes
  ServerAliveInterval 30

Host lab-bastion
  HostName 203.0.113.10
  IdentityFile ~/.ssh/lab_ed25519_extra

Host secret.lab.test
  User secret-user
  Port 22

Host *
  User wildcard-user
  Port 22
  IdentityFile ~/.ssh/id_ed25519
`;

describe('SSH config Host matching', () => {
  it('applies first-value-wins and additive IdentityFile across matching Host lines', () => {
    const computed = computeSshConfig({ blocks: parseSshConfigText(LAB) }, 'lab-bastion');
    expect(computed.hostName).toBe('%h.internal.example');
    expect(computed.user).toBe('labuser');
    expect(computed.port).toBe(2222);
    expect(computed.forwardAgent).toBe(true);
    expect(computed.serverAliveInterval).toBe(30);
    expect(computed.identityFiles).toEqual([
      '~/.ssh/lab_ed25519',
      '~/.ssh/lab_ed25519_extra',
      '~/.ssh/id_ed25519',
    ]);
  });

  it('honours wildcard plus negation so a more specific later Host still cannot override earlier values', () => {
    const wildcard = computeSshConfig({ blocks: parseSshConfigText(LAB) }, 'db.lab.test');
    expect(wildcard.user).toBe('labuser');
    expect(wildcard.port).toBe(2222);
    expect(wildcard.hostName).toBe('%h.internal.example');

    const negated = computeSshConfig({ blocks: parseSshConfigText(LAB) }, 'secret.lab.test');
    expect(negated.user).toBe('secret-user');
    expect(negated.port).toBe(22);
    expect(negated.hostName).toBeUndefined();
  });

  it('leaves unmatched hosts on the Host * defaults', () => {
    const computed = computeSshConfig({ blocks: parseSshConfigText(LAB) }, 'other.example');
    expect(computed.user).toBe('wildcard-user');
    expect(computed.port).toBe(22);
    expect(computed.identityFiles).toEqual(['~/.ssh/id_ed25519']);
  });
});

describe('SSH config Include', () => {
  it('keeps Include in place and resolves nested relative paths from ~/.ssh', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'conduit-include-'));
    const dir = path.join(home, '.ssh');
    fs.mkdirSync(path.join(dir, 'parts'), { recursive: true });
    try {
      fs.writeFileSync(path.join(dir, 'config'), 'Include parts/a.conf\nUser later-user\n');
      fs.writeFileSync(path.join(dir, 'parts/a.conf'), 'Include b.conf\nPort 2222\n');
      fs.writeFileSync(path.join(dir, 'b.conf'), 'User included-user\n');
      const c = computeSshConfig(loadSshConfigFile(path.join(dir, 'config'), { homedir: home }), 'fixture');
      expect(c.user).toBe('included-user');
      expect(c.port).toBe(2222);
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
  });

  it('inlines top-level Include files in order', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conduit-ssh-config-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'extra.conf'),
        'Host include.test\n  User from-include\n  Port 2201\n',
      );
      fs.writeFileSync(
        path.join(dir, 'config'),
        `Include ${path.join(dir, 'extra.conf')}\nHost include.test\n  User from-main\n`,
      );
      const loaded = loadSshConfigFile(path.join(dir, 'config'), { homedir: path.dirname(dir) });
      const computed = computeSshConfig(loaded, 'include.test');
      expect(computed.user).toBe('from-include');
      expect(computed.port).toBe(2201);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('SSH config routing Match', () => {
  it('fails closed when a Match block sets ProxyJump', () => {
    const loaded = {
      blocks: parseSshConfigText(`
Match host *.lab.test
  ProxyJump bastion.test
Host lab-bastion
  User labuser
`),
    };
    expect(() => computeSshConfig(loaded, 'lab-bastion')).toThrow(SshConfigError);
    expect(() => computeSshConfig(loaded, 'lab-bastion')).toThrow(/ProxyJump/);
  });
});

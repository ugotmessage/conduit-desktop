import { t as __tr } from "../../lib/i18n";
import { useState } from "react";
import type { SshKeyGenResult } from "../../utils/sshKeyTypes";
import { Button, IconButton } from "../ui";

interface SshKeyOutputProps {
  result: SshKeyGenResult;
  onCopyPublic: () => void;
  onCopyPrivate: () => void;
}

const CODE_BOX = "w-full rounded border border-input-border bg-code px-2 py-1.5 font-mono text-meta text-ink-secondary";
const FIELD_LABEL = "text-label font-semibold text-ink-secondary";

/** The generated key pair, right of the settings in the SSH Key Generator. */
export default function SshKeyOutput({ result, onCopyPublic, onCopyPrivate }: SshKeyOutputProps) {
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  return (
    <div className="w-1/2 shrink-0 space-y-4 border-l border-divider pl-4">
      <div>
        <label className={`mb-1.5 block ${FIELD_LABEL}`}>{__tr("Fingerprint")}</label>
        <code className={`block break-all ${CODE_BOX}`}>{result.fingerprint}</code>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className={FIELD_LABEL}>{__tr("Public Key")}</label>
          <Button variant="ghost" size="sm" icon="copy" onClick={onCopyPublic} title={__tr("Copy public key")}>
            {__tr("Copy")}</Button>
        </div>
        <textarea readOnly value={result.publicKey} rows={3} className={`resize-none ${CODE_BOX}`} />
        <p className="mt-1.5 text-meta text-ink-faint">
          {__tr("Add this to the server's")} <code className="text-ink-muted">~/.ssh/authorized_keys</code>
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className={FIELD_LABEL}>{__tr("Private Key")}</label>
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              icon={showPrivateKey ? "eyeOff" : "eye"}
              label={showPrivateKey ? __tr("Hide") : __tr("Show")}
              onClick={() => setShowPrivateKey(!showPrivateKey)}
            />
            <Button variant="ghost" size="sm" icon="copy" onClick={onCopyPrivate} title={__tr("Copy private key")}>
              {__tr("Copy")}</Button>
          </div>
        </div>
        <textarea
          readOnly
          value={result.privateKey}
          rows={6}
          className={`resize-none ${CODE_BOX}`}
          style={!showPrivateKey ? { color: "transparent", textShadow: "0 0 8px var(--color-ink-muted)" } : undefined}
        />
      </div>
    </div>
  );
}

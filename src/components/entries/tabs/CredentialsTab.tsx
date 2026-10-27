import { t as __tr } from "../../../lib/i18n";
import { useId, useState } from "react";
import type { EntryType } from "../../../types/entry";
import type { CredentialType } from "../../../types/credential";
import Field from "../Field";
import PasswordGenerateButton from "../../tools/PasswordGenerateButton";
import SshKeyGenerateButton from "../../tools/SshKeyGenerateButton";
import { toast } from "../../common/Toast";
import PasswordHistoryDialog from "../../vault/PasswordHistoryDialog";
import { Card, IconButton, SegmentedControl, TextInput, Textarea } from "../../ui";
import TotpSection, { type TotpSectionProps } from "./TotpSection";

interface CredentialsTabProps extends TotpSectionProps {
  entryType: EntryType;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  domain: string;
  setDomain: (v: string) => void;
  privateKey: string;
  setPrivateKey: (v: string) => void;
  credentialId: string | null;
  credentialName: string | null;
  onShowCredentialPicker: () => void;
  isConnection: boolean;
  isEditing: boolean;
  entryId?: string | null;
  entryName?: string;
  // Credential sub-type props (for entry_type === "credential")
  credentialType?: CredentialType | null;
  publicKey?: string;
  setPublicKey?: (v: string) => void;
  fingerprint?: string;
  setFingerprint?: (v: string) => void;
  onCredentialTypeChange?: (type: CredentialType) => void;
  // SSH auth method (for SSH entries or credentials with both key+password)
  sshAuthMethod?: string | null;
  onSshAuthMethodChange?: (method: string | null) => void;
  // Validation
  usernameRequired?: boolean;
}


/** Room for the buttons inside the field's right edge. */
const TRAILING_PADDING = 80;

const DEFAULT_AUTH = "default";

const SSH_AUTH_OPTIONS = [
  { value: DEFAULT_AUTH, label: __tr("Default") },
  { value: "key", label: __tr("SSH Key") },
  { value: "password", label: __tr("Password") },
];

export default function CredentialsTab({
  entryType,
  username,
  setUsername,
  password,
  setPassword,
  domain,
  setDomain,
  privateKey,
  setPrivateKey,
  credentialId,
  credentialName,
  onShowCredentialPicker,
  isConnection,
  isEditing,
  entryId,
  entryName,
  credentialType,
  publicKey,
  setPublicKey,
  fingerprint,
  setFingerprint,
  onCredentialTypeChange,
  sshAuthMethod,
  onSshAuthMethodChange,
  usernameRequired,
  ...totp
}: CredentialsTabProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordHistory, setShowPasswordHistory] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const passwordId = useId();
  const privateKeyId = useId();
  const publicKeyId = useId();

  const isSshKey = entryType === "credential" && credentialType === "ssh_key";
  const showTotpSection = !isSshKey && !!totp.setTotpSecret;
  const showUsername = entryType !== "vnc";
  const showPrivateKeyField = entryType === "ssh" || entryType === "credential";
  const showDomain = entryType === "credential";

  const handleCopyPublicKey = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      toast.success(__tr("Public key copied to clipboard"));
    } catch (err) {
      console.error("Failed to copy the public key:", err);
      toast.error(__tr("Could not copy the public key"));
    }
  };

  return (
    <div className="space-y-4">
      {showUsername && !isSshKey && (
        <Field label={usernameRequired ? __tr("Username *") : __tr("Username")}>
          <TextInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            invalid={Boolean(usernameRequired && !username.trim())}
          />
        </Field>
      )}

      {!isSshKey && (
        <Field label={__tr("Password")} group htmlFor={passwordId}>
          <div className="relative">
            <TextInput
              id={passwordId}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: TRAILING_PADDING }}
            />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <PasswordGenerateButton onPasswordGenerated={setPassword} />
              {isEditing && entryId && (
                <IconButton size="sm" icon="history" label={__tr("Password history")} onClick={() => setShowPasswordHistory(true)} />
              )}
              <IconButton
                size="sm"
                icon={showPassword ? "eyeOff" : "eye"}
                label={showPassword ? __tr("Hide password") : __tr("Show password")}
                onClick={() => setShowPassword(!showPassword)}
              />
            </div>
          </div>
        </Field>
      )}

      {showDomain && !isSshKey && (
        <Field label={__tr("Domain")}>
          <TextInput value={domain} onChange={(e) => setDomain(e.target.value)} />
        </Field>
      )}

      {showTotpSection && <TotpSection {...totp} />}

      {showPrivateKeyField && (
        <Field label={__tr("Private Key")} group htmlFor={privateKeyId}>
          <div className="relative">
            <Textarea
              id={privateKeyId}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={3}
              className={`font-mono ${!showPrivateKey && privateKey ? "blur-sm select-none focus:blur-none focus:select-auto" : ""}`}
              style={{ resize: "none", paddingRight: TRAILING_PADDING }}
            />
            <div className="absolute right-1 top-1 flex items-center gap-1">
              <SshKeyGenerateButton
                onKeyGenerated={setPrivateKey}
                onFullKeyGenerated={(result) => {
                  setPrivateKey(result.privateKey);
                  setPublicKey?.(result.publicKey);
                  setFingerprint?.(result.fingerprint);
                  onCredentialTypeChange?.("ssh_key");
                }}
              />
              <IconButton
                size="sm"
                icon={showPrivateKey ? "eyeOff" : "eye"}
                label={showPrivateKey ? __tr("Hide private key") : __tr("Show private key")}
                onClick={() => setShowPrivateKey(!showPrivateKey)}
              />
            </div>
          </div>
        </Field>
      )}

      {/* Shown for SSH entries when both a key and a password are present */}
      {(entryType === "ssh" || entryType === "credential") && privateKey.trim() && password.trim() && onSshAuthMethodChange && (
        <Card className="space-y-3">
          <p className="text-meta font-semibold text-ink-muted">{__tr("SSH Authentication")}</p>
          <SegmentedControl
            options={SSH_AUTH_OPTIONS}
            value={sshAuthMethod ?? DEFAULT_AUTH}
            onChange={(v) => onSshAuthMethodChange(v === DEFAULT_AUTH ? null : v)}
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
          />
          <p className="text-meta text-ink-muted">
            {__tr("Choose which method to use when connecting. “Default” uses the global setting from Settings.")}</p>
        </Card>
      )}

      {isSshKey && setPublicKey && (
        <Card className="space-y-3">
          <p className="text-meta font-semibold text-ink-muted">{__tr("SSH Key Metadata")}</p>
          <Field label={__tr("Public Key")} group htmlFor={publicKeyId}>
            <div className="relative">
              <Textarea
                id={publicKeyId}
                value={publicKey ?? ""}
                onChange={(e) => setPublicKey(e.target.value)}
                rows={2}
                className="font-mono"
                style={{ resize: "none", paddingRight: 32 }}
              />
              {publicKey && (
                <IconButton size="sm" icon="copy" label={__tr("Copy public key")} onClick={handleCopyPublicKey} className="absolute right-1 top-1" />
              )}
            </div>
          </Field>
          <Field label={__tr("Fingerprint")}>
            <TextInput value={fingerprint ?? ""} readOnly className="cursor-default font-mono" />
          </Field>
        </Card>
      )}

      {isConnection && (
        <Field label={__tr("Linked Credential")} group>
          <button
            type="button"
            onClick={onShowCredentialPicker}
            className="h-control w-full rounded border border-input-border bg-input px-1.5 text-left text-body text-(--c-input-fg) hover:border-(--c-control-border)"
          >
            {credentialId
              ? credentialName ?? __tr("Unknown credential")
              : <span className="text-(--c-input-placeholder)">{__tr("None (use inline credentials)")}</span>}
          </button>
        </Field>
      )}
      {showPasswordHistory && entryId && (
        <PasswordHistoryDialog
          entryId={entryId}
          entryName={entryName ?? "Entry"}
          onClose={() => setShowPasswordHistory(false)}
        />
      )}
    </div>
  );
}

import { t as __tr } from "../../lib/i18n";
import { useState, useEffect } from "react";
import { useVaultStore } from "../../stores/vaultStore";
import PasswordGenerateButton from "../tools/PasswordGenerateButton";
import SshKeyGenerateButton from "../tools/SshKeyGenerateButton";
import type { CredentialDto } from "../../types/credential";
import { CREDENTIAL_TYPES, resolveCredentialType, type CredentialType } from "../../types/credential";
import { toast } from "../common/Toast";
import { invoke } from "../../lib/electron";
import { generateTotpCode } from "../../lib/totp";
import { CloseIcon, ShieldLockIcon, TagIcon, TrashIcon } from "../../lib/icons";
import { Button, Callout, Card, Dialog, FormField, IconButton, SegmentedControl, TextInput, Textarea, cx } from "../ui";
import { errorText } from "../../lib/errorText";

const DEFAULT_AUTH = "default";
const SSH_AUTH_OPTIONS = [
  { value: DEFAULT_AUTH, label: __tr("Default") },
  { value: "key", label: __tr("SSH Key") },
  { value: "password", label: __tr("Password") },
];

interface CredentialFormProps {
  editId?: string;
  presetType?: CredentialType;
  onClose: () => void;
  onSaved: () => void;
}

export default function CredentialForm({
  editId,
  presetType,
  onClose,
  onSaved,
}: CredentialFormProps) {
  const { createCredential, updateCredential, getCredential } = useVaultStore();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Credential type fields
  const [credentialType, setCredentialType] = useState<CredentialType>(presetType ?? "generic");
  const [publicKey, setPublicKey] = useState("");
  const [fingerprint, setFingerprint] = useState("");

  // SSH auth method preference
  const [sshAuthMethod, setSshAuthMethod] = useState<string | null>(null);

  // TOTP fields
  const [totpSecret, setTotpSecret] = useState("");
  const [totpIssuer, setTotpIssuer] = useState("");
  const [totpLabel, setTotpLabel] = useState("");
  const [totpAlgorithm, setTotpAlgorithm] = useState("SHA1");
  const [totpDigits, setTotpDigits] = useState(6);
  const [totpPeriod, setTotpPeriod] = useState(30);
  const [showTotpManual, setShowTotpManual] = useState(false);
  const [totpPreview, setTotpPreview] = useState<string | null>(null);

  const isEditing = !!editId;

  // Update TOTP preview when secret is configured
  useEffect(() => {
    if (!totpSecret) {
      setTotpPreview(null);
      return;
    }
    const update = () => {
      try {
        const result = generateTotpCode({
          secret: totpSecret,
          algorithm: totpAlgorithm,
          digits: totpDigits,
          period: totpPeriod,
        });
        setTotpPreview(result.code);
      } catch {
        setTotpPreview(null);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [totpSecret, totpAlgorithm, totpDigits, totpPeriod]);

  useEffect(() => {
    if (editId) {
      setIsFetching(true);
      getCredential(editId)
        .then((cred: CredentialDto) => {
          setName(cred.name);
          setUsername(cred.username || "");
          setPassword(cred.password || "");
          setDomain(cred.domain || "");
          setPrivateKey(cred.private_key || "");
          setTags(cred.tags);
          setCredentialType(resolveCredentialType(cred.credential_type));
          setPublicKey(cred.public_key || "");
          setFingerprint(cred.fingerprint || "");
          setTotpSecret(cred.totp_secret || "");
          setTotpIssuer(cred.totp_issuer || "");
          setTotpLabel(cred.totp_label || "");
          setTotpAlgorithm(cred.totp_algorithm || "SHA1");
          setTotpDigits(cred.totp_digits || 6);
          setTotpPeriod(cred.totp_period || 30);
          setSshAuthMethod(cred.ssh_auth_method ?? null);
        })
        .catch((err: unknown) => {
          setError(
            errorText(err, __tr("Failed to load credential"))
          );
        })
        .finally(() => setIsFetching(false));
    }
  }, [editId, getCredential]);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      if (isEditing) {
        await updateCredential(editId, {
          name: name.trim(),
          username: username.trim() || null,
          password: password || null,
          domain: domain.trim() || null,
          privateKey: privateKey || null,
          totpSecret: totpSecret || null,
          tags,
          credentialType: credentialType === "generic" ? undefined : credentialType,
          publicKey: publicKey || undefined,
          fingerprint: fingerprint || undefined,
          totpIssuer: totpSecret ? (totpIssuer || null) : null,
          totpLabel: totpSecret ? (totpLabel || null) : null,
          totpAlgorithm: totpSecret ? totpAlgorithm : null,
          totpDigits: totpSecret ? totpDigits : null,
          totpPeriod: totpSecret ? totpPeriod : null,
          sshAuthMethod: sshAuthMethod,
        });
      } else {
        await createCredential({
          name: name.trim(),
          username: username.trim() || undefined,
          password: password || undefined,
          domain: domain.trim() || undefined,
          privateKey: privateKey || undefined,
          totpSecret: totpSecret || undefined,
          tags,
          credentialType: credentialType === "generic" ? undefined : credentialType,
          publicKey: publicKey || undefined,
          fingerprint: fingerprint || undefined,
          totpIssuer: totpSecret ? (totpIssuer || null) : undefined,
          totpLabel: totpSecret ? (totpLabel || null) : undefined,
          totpAlgorithm: totpSecret ? totpAlgorithm : undefined,
          totpDigits: totpSecret ? totpDigits : undefined,
          totpPeriod: totpSecret ? totpPeriod : undefined,
          sshAuthMethod: sshAuthMethod || undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(
        errorText(err, __tr("Failed to save credential"))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  const handleImportQr = async () => {
    try {
      const filePath = await invoke<string | null>("totp_pick_qr_image");
      if (!filePath) return;
      const result = await invoke<{
        secret: string;
        issuer: string | null;
        label: string | null;
        algorithm: string;
        digits: number;
        period: number;
      }>("totp_decode_qr", { filePath });
      setTotpSecret(result.secret);
      setTotpIssuer(result.issuer ?? "");
      setTotpLabel(result.label ?? "");
      setTotpAlgorithm(result.algorithm);
      setTotpDigits(result.digits);
      setTotpPeriod(result.period);
      setShowTotpManual(false);
      toast.success(__tr("QR code imported successfully"));
    } catch (err) {
      toast.error(errorText(err, __tr("Failed to decode QR code")));
    }
  };

  const handleRemoveTotp = () => {
    setTotpSecret("");
    setTotpIssuer("");
    setTotpLabel("");
    setTotpAlgorithm("SHA1");
    setTotpDigits(6);
    setTotpPeriod(30);
    setShowTotpManual(false);
  };

  const handleCopyPublicKey = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey);
      toast.success(__tr("Public key copied to clipboard"));
    }
  };

  const credentialTypeEntries = Object.entries(CREDENTIAL_TYPES) as [CredentialType, { label: string; description: string }][];

  const title = isEditing
    ? __tr("Edit Credential")
    : presetType && presetType !== "generic"
      ? __tr("New {v0} Credential", { v0: (CREDENTIAL_TYPES[presetType].label) })
      : __tr("New Credential");

  const footer = isFetching ? undefined : (
    <>
      <Button onClick={onClose}>{__tr("Cancel")}</Button>
      <Button type="submit" variant="primary" disabled={!name.trim() || isLoading}>
        {isLoading ? __tr("Saving...") : isEditing ? __tr("Save Changes") : __tr("Create")}
      </Button>
    </>
  );

  return (
    <Dialog
      open
      title={title}
      width={448}
      style={{ maxHeight: "90vh" }}
      onClose={onClose}
      onSubmit={() => void handleSubmit()}
      footer={footer}
    >
      {isFetching ? (
        <div className="p-4 text-center text-ink-muted">{__tr("Loading...")}</div>
      ) : (
        <>
          <FormField
            label={
              <>
                {__tr("Name")} <span className="text-danger">*</span>
              </>
            }
          >
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="" autoFocus />
          </FormField>

          <div>
            <span className="mb-1 block text-label font-semibold text-ink-secondary">{__tr("Type")}</span>
            <SegmentedControl
              aria-label={__tr("Type")}
              options={credentialTypeEntries.map(([key, meta]) => ({
                value: key,
                label: <span title={meta.description}>{meta.label}</span>,
              }))}
              value={credentialType}
              onChange={setCredentialType}
            />
          </div>

          <FormField label={__tr("Username")}>
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="" />
          </FormField>

          <FormField label={__tr("Password")}>
            <div className="relative">
              <TextInput
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=""
                style={{ paddingRight: 56 }}
              />
              <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                <PasswordGenerateButton onPasswordGenerated={setPassword} />
                <IconButton
                  size="sm"
                  icon={showPassword ? "eyeOff" : "eye"}
                  label={showPassword ? __tr("Hide password") : __tr("Show password")}
                  onClick={() => setShowPassword(!showPassword)}
                />
              </div>
            </div>
          </FormField>

          <FormField label={__tr("Domain")}>
            <TextInput value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="" />
          </FormField>

          {credentialType !== "ssh_key" && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldLockIcon size={16} className="text-ink-muted" />
                  <p className="text-meta font-semibold text-ink-muted">{__tr("One-Time Password (TOTP)")}</p>
                </div>
                {totpSecret && (
                  <button
                    type="button"
                    onClick={handleRemoveTotp}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-label text-danger transition-colors hover:bg-hover"
                  >
                    <TrashIcon size={12} compact />
                    {__tr("Remove")}</button>
                )}
              </div>

              {!totpSecret ? (
                <div className="flex gap-2">
                  <Button icon="qrcode" onClick={handleImportQr} className="flex-1">
                    {__tr("Import QR Code")}</Button>
                  <Button icon="keyboard" onClick={() => setShowTotpManual(!showTotpManual)} className="flex-1">
                    {__tr("Enter Secret Key")}</Button>
                </div>
              ) : (
                <>
                  {totpIssuer && (
                    <div className="text-label text-ink-secondary">
                      <span className="text-ink-faint">{__tr("Issuer:")}</span> {totpIssuer}
                      {totpLabel && <> &middot; <span className="text-ink-faint">{__tr("Account:")}</span> {totpLabel}</>}
                    </div>
                  )}
                  <div className="text-label text-ink-faint">
                    {totpAlgorithm} &middot; {totpDigits} {__tr("digits ·")} {totpPeriod}{__tr("s period")}</div>
                  {totpPreview && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-title text-link">
                        {totpPreview.slice(0, Math.ceil(totpPreview.length / 2))}{" "}
                        {totpPreview.slice(Math.ceil(totpPreview.length / 2))}
                      </span>
                      <span className="text-label text-success">{__tr("Preview")}</span>
                    </div>
                  )}
                </>
              )}

              {showTotpManual && !totpSecret && (
                <div className="space-y-2">
                  <FormField label={__tr("Secret Key (Base32)")}>
                    <TextInput
                      value={totpSecret}
                      onChange={(e) => setTotpSecret(e.target.value.toUpperCase().replace(/\s/g, ""))}
                      placeholder=""
                      className="font-mono"
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <FormField label={__tr("Issuer")} className="flex-1">
                      <TextInput value={totpIssuer} onChange={(e) => setTotpIssuer(e.target.value)} placeholder="" />
                    </FormField>
                    <FormField label={__tr("Account")} className="flex-1">
                      <TextInput value={totpLabel} onChange={(e) => setTotpLabel(e.target.value)} placeholder="" />
                    </FormField>
                  </div>
                </div>
              )}
            </Card>
          )}

          <FormField label={__tr("Private Key")}>
            <div className="relative">
              <Textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder=""
                rows={3}
                style={{ paddingRight: 56 }}
                className={cx("font-mono", !showPrivateKey && privateKey && "blur-sm select-none focus:blur-none focus:select-auto")}
              />
              <div className="absolute right-1 top-1 flex items-center gap-0.5">
                <SshKeyGenerateButton
                  onKeyGenerated={setPrivateKey}
                  onFullKeyGenerated={(result) => {
                    setPrivateKey(result.privateKey);
                    setPublicKey(result.publicKey);
                    setFingerprint(result.fingerprint);
                    setCredentialType("ssh_key");
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
          </FormField>

          {privateKey.trim() && password.trim() && (
            <Card className="space-y-3">
              <p className="text-meta font-semibold text-ink-muted">{__tr("SSH Authentication")}</p>
              <SegmentedControl
                aria-label={__tr("SSH Authentication")}
                options={SSH_AUTH_OPTIONS}
                value={sshAuthMethod ?? DEFAULT_AUTH}
                onChange={(value) => setSshAuthMethod(value === DEFAULT_AUTH ? null : value)}
              />
              <p className="text-label text-ink-muted">
                {__tr("Choose which method to use when connecting. “Default” uses the global setting from Settings.")}</p>
            </Card>
          )}

          {credentialType === "ssh_key" && (
            <Card className="space-y-3">
              <p className="text-meta font-semibold text-ink-muted">{__tr("SSH Key Metadata")}</p>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-label font-semibold text-ink-secondary">{__tr("Public Key")}</span>
                  {publicKey && (
                    <Button size="sm" variant="ghost" icon="copy" onClick={handleCopyPublicKey}>
                      {__tr("Copy")}</Button>
                  )}
                </div>
                <Textarea
                  aria-label={__tr("Public Key")}
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder=""
                  rows={2}
                  className="font-mono"
                />
              </div>
              <FormField label={__tr("Fingerprint")}>
                <TextInput value={fingerprint} readOnly placeholder="" className="cursor-default font-mono" />
              </FormField>
            </Card>
          )}

          <div>
            <span className="mb-1 block text-label font-semibold text-ink-secondary">{__tr("Tags")}</span>
            <div className="flex gap-2">
              <TextInput
                aria-label={__tr("Tags")}
                leading={<TagIcon size={16} />}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder=""
              />
              <Button icon="plus" aria-label={__tr("Add tag")} title={__tr("Add tag")} onClick={addTag} disabled={!tagInput.trim()} />
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded bg-selected px-2 py-0.5 text-label text-ink">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={__tr("Remove {v0}", { v0: (tag) })}
                      title={__tr("Remove {v0}", { v0: (tag) })}
                      className="text-ink-muted hover:text-danger"
                    >
                      <CloseIcon size={12} compact />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <Callout tone="danger">{error}</Callout>}
        </>
      )}
    </Dialog>
  );
}

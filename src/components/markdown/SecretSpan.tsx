import { t as __tr } from "../../lib/i18n";
import { useState } from "react";
import { CopyIcon, EyeIcon, EyeOffIcon } from "../../lib/icons";
import { toast } from "../common/Toast";

interface SecretSpanProps {
  secret: string;
}

export default function SecretSpan({ secret }: SecretSpanProps) {
  const [revealed, setRevealed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success(__tr("Secret copied"));
    } catch {
      toast.error(__tr("Failed to copy secret"));
    }
  };

  return (
    <span className="inline-flex items-center gap-0.5">
      <span
        className={
          revealed
            ? "text-link font-mono text-label allow-select"
            : "text-link font-mono text-label blur-sm select-none"
        }
      >
        {secret}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="inline-flex items-center p-0 border-0 bg-transparent text-ink-muted hover:text-ink cursor-pointer"
        title={revealed ? __tr("Hide secret") : __tr("Reveal secret")}
      >
        {revealed ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}
      </button>
      {revealed && (
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center p-0 border-0 bg-transparent text-ink-muted hover:text-ink cursor-pointer"
          title={__tr("Copy secret")}
        >
          <CopyIcon size={12} />
        </button>
      )}
    </span>
  );
}

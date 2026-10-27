import { t as __tr } from "../../lib/i18n";
import { useRef, useState } from "react";
import { invoke } from "../../lib/electron";
import { errorText } from "../../lib/errorText";
import { useEntryStore } from "../../stores/entryStore";
import { toast } from "../common/Toast";
import { Button, FormField, IconButton, PasswordInput, Popover, TextInput } from "../ui";

interface AddSecretPopoverProps {
  ownerId: string;
  /** Inserts the new ref at the cursor; `inTable` callers drop the label (docs/KNOWLEDGE_BASE.md 3.1). */
  onInsert: (ref: { id: string; label: string }) => void;
}

/** Toolbar button that stores a new encrypted secret right away and inserts its chip. */
export default function AddSecretPopover({ ownerId, onInsert }: AddSecretPopoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const loadAll = useEntryStore((s) => s.loadAll);

  const close = () => {
    setOpen(false);
    setLabel("");
    setValue("");
  };

  const save = async (generate: boolean) => {
    setBusy(true);
    try {
      const created = await invoke<{ id: string; ref: string }>("secret_create", {
        owner_id: ownerId,
        label: label.trim() || "Secret",
        ...(generate ? { generate: { length: 24 } } : { value }),
      });
      await loadAll();
      onInsert({ id: created.id, label: label.trim() || "Secret" });
      toast.success(generate ? __tr("Secret generated and encrypted") : __tr("Secret encrypted"));
      close();
    } catch (err) {
      toast.error(errorText(err, __tr("Couldn't save the secret")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span ref={anchorRef} className="inline-flex">
      <IconButton size="sm" icon="key" label={__tr("Add encrypted secret")} onClick={() => setOpen((o) => !o)} />
      <Popover anchorRef={anchorRef} open={open} onClose={close} placement="bottom-start">
        <form
          className="w-72 space-y-2 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            // React bubbles events through the portal; without this the entry dialog's form submits too.
            e.stopPropagation();
            if (value) void save(false);
          }}
        >
          <FormField label={__tr("Label")}>
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={__tr("Local admin")} autoFocus maxLength={80} />
          </FormField>
          <FormField label={__tr("Value")}>
            <PasswordInput value={value} onChange={(e) => setValue(e.target.value)} placeholder={__tr("Leave empty to generate")} />
          </FormField>
          <p className="text-label text-ink-faint">{__tr("Stored encrypted. The notes keep only a link to it.")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => void save(true)} disabled={busy || value.length > 0}>
              {__tr("Generate")}</Button>
            <Button type="submit" variant="primary" disabled={busy || value.length === 0} loading={busy && value.length > 0}>
              {__tr("Add")}</Button>
          </div>
        </form>
      </Popover>
    </span>
  );
}

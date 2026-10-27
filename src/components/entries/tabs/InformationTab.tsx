import { t as __tr } from "../../../lib/i18n";
import Field from "../Field";
import MarkdownEditor from "../../markdown/MarkdownEditor";
import { TextInput } from "../../ui";

interface InformationTabProps {
  tags: string;
  setTags: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  /** Set when editing a saved entry, so a secret can be stored right away. */
  entryId?: string;
}

export default function InformationTab({ tags, setTags, notes, setNotes, entryId }: InformationTabProps) {
  return (
    <div className="space-y-4">
      <Field label={__tr("Tags")}>
        <TextInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder={__tr("production, linux (comma-separated)")} />
      </Field>

      <Field label={__tr("Notes")} group>
        <MarkdownEditor
          value={notes}
          onChange={setNotes}
          placeholder={__tr("Optional notes... (supports Markdown; !!secret!! is stored encrypted when you save)")}
          minRows={8}
          ownerId={entryId}
        />
      </Field>
    </div>
  );
}

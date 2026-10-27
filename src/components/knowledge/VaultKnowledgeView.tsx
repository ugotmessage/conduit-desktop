import { t as __tr } from "../../lib/i18n";
import { useMemo, useState } from "react";
import { hasUnseenAgentEdit, isStale, readKb, type KbKind } from "../../lib/kb";
import { useEntryStore } from "../../stores/entryStore";
import { Button, SearchInput, Select } from "../ui";
import ArticleRow from "./ArticleRow";
import { KNOWLEDGE_SESSION_ID } from "../../lib/dashboardSessions";
import NewArticleDialog from "./NewArticleDialog";
import { contentOf, KIND_META, type ArticleItem } from "./kbUi";
import { CONTENT_WIDTH, splitGrid } from "../dashboard/pageLayout";

type ScopeFilter = "all" | "asset" | "folder" | "vault";
type StateFilter = "all" | "review" | "stale" | "archived";
type AuthorFilter = "all" | "agent" | "user";

/** Every article in the vault: search, filters, and the queue of agent edits to review. */
export default function VaultKnowledgeView() {
  const entries = useEntryStore((s) => s.entries);
  const hiddenEntries = useEntryStore((s) => s.hiddenEntries);
  const folders = useEntryStore((s) => s.folders);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KbKind | "all">("all");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [author, setAuthor] = useState<AuthorFilter>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [creating, setCreating] = useState(false);

  const articles: ArticleItem[] = useMemo(
    () => hiddenEntries.flatMap((entry) => {
      const kb = entry.entry_type === "document" ? readKb(entry.config) : null;
      return kb ? [{ entry, kb }] : [];
    }),
    [hiddenEntries],
  );
  const now = new Date().toISOString();
  const needsReview = articles.filter((a) => a.kb.status !== "archived" && a.kb.kind !== "changelog" && (hasUnseenAgentEdit(a.kb) || a.kb.status === "needs_review"));
  const showReview = needsReview.length > 0 && state === "all";

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const listed = articles
    .filter((a) => (state === "archived" ? a.kb.status === "archived" : a.kb.status !== "archived"))
    .filter((a) => state !== "review" || needsReview.includes(a))
    .filter((a) => state !== "stale" || isStale(a.kb, a.entry.updated_at, now))
    .filter((a) => kind === "all" || a.kb.kind === kind)
    .filter((a) => scope === "all" || a.kb.scope === scope)
    .filter((a) => author === "all" || (a.kb.last_editor ?? a.kb.author).kind === author)
    .filter((a) => {
      if (terms.length === 0) return true;
      const hay = `${a.entry.name}\n${a.kb.summary}\n${a.entry.tags.join(" ")}\n${contentOf(a.entry)}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    })
    .sort((a, b) => (a.entry.updated_at < b.entry.updated_at ? 1 : -1));

  const contextOf = (a: ArticleItem) =>
    a.kb.scope === "asset"
      ? (entries.find((e) => e.id === a.entry.parent_entry_id)?.name ?? "Asset")
      : a.kb.scope === "folder"
        ? (folders.find((f) => f.id === a.entry.folder_id)?.name ?? "Folder")
        : "Vault";

  return (
    <div className="@container flex h-full flex-1 flex-col overflow-y-auto bg-editor" data-cv-knowledge-view="">
      <div className="border-b border-divider py-6">
        <div className={`${CONTENT_WIDTH} flex items-center gap-3 px-6`}>
          <div className="min-w-0 flex-1">
            <h2 className="text-title font-semibold text-ink">{__tr("Knowledge")}</h2>
            <p className="text-body text-ink-muted">
              {articles.length} {articles.length === 1 ? __tr("article") : __tr("articles")} {__tr("that agents and you keep about this vault")}</p>
          </div>
          <Button icon="plus" onClick={() => setCreating(true)}>
            {__tr("Vault playbook")}</Button>
        </div>
      </div>

      <div className={`${CONTENT_WIDTH} ${splitGrid(showReview ? "sidebar" : null)} px-6 py-4`}>
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder={__tr("Search knowledge...")} aria-label={__tr("Search knowledge")} wrapperClassName="max-w-xs flex-1" />
            <span className="w-40 shrink-0">
              <Select value={kind} onChange={(e) => setKind(e.target.value as KbKind | "all")} aria-label={__tr("Kind")}>
                <option value="all">{__tr("All kinds")}</option>
                {(Object.keys(KIND_META) as KbKind[]).map((k) => (
                  <option key={k} value={k}>{KIND_META[k].label}</option>
                ))}
              </Select>
            </span>
            <span className="w-36 shrink-0">
              <Select value={scope} onChange={(e) => setScope(e.target.value as ScopeFilter)} aria-label={__tr("Where")}>
                <option value="all">{__tr("Everywhere")}</option>
                <option value="asset">{__tr("Assets")}</option>
                <option value="folder">{__tr("Folders")}</option>
                <option value="vault">{__tr("Vault")}</option>
              </Select>
            </span>
            <span className="w-36 shrink-0">
              <Select value={author} onChange={(e) => setAuthor(e.target.value as AuthorFilter)} aria-label={__tr("Edited by")}>
                <option value="all">{__tr("Anyone")}</option>
                <option value="agent">{__tr("Agents")}</option>
                <option value="user">{__tr("You")}</option>
              </Select>
            </span>
            <span className="w-48 shrink-0">
              <Select value={state} onChange={(e) => setState(e.target.value as StateFilter)} aria-label={__tr("State")}>
                <option value="all">{__tr("Active")}</option>
                <option value="review">{__tr("Needs review")}</option>
                <option value="stale">{__tr("Not checked in 90 days")}</option>
                <option value="archived">{__tr("Archived")}</option>
              </Select>
            </span>
          </div>

          {listed.length === 0 ? (
            <p className="py-8 text-center text-body text-ink-muted">
              {articles.length === 0 ? __tr("No knowledge yet. Agents add articles as they work on your assets.") : __tr("No articles match.")}
            </p>
          ) : (
            listed.map((a) => <ArticleRow key={a.entry.id} entry={a.entry} kb={a.kb} context={contextOf(a)} host={KNOWLEDGE_SESSION_ID} />)
          )}
        </div>

        {showReview && (
          <section className="mt-5 self-start rounded border border-card-border bg-card p-3 @5xl:mt-0">
            <h3 className="mb-1 text-body font-semibold text-ink">{__tr("Needs review (")}{needsReview.length})</h3>
            <p className="mb-2 text-label text-ink-muted">{__tr("Agent edits you have not looked at, and articles flagged as out of date.")}</p>
            {needsReview.slice(0, 8).map((a) => (
              <ArticleRow key={a.entry.id} entry={a.entry} kb={a.kb} context={contextOf(a)} host={KNOWLEDGE_SESSION_ID} />
            ))}
            {needsReview.length > 8 && (
              <Button variant="link" onClick={() => setState("review")}>
                {__tr("Show all")} {needsReview.length}
              </Button>
            )}
          </section>
        )}
      </div>

      {creating && <NewArticleDialog scope="vault" initialKind="playbook" host={KNOWLEDGE_SESSION_ID} onClose={() => setCreating(false)} />}
    </div>
  );
}

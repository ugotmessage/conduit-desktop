import { t as __tr } from "../../../lib/i18n";
import { useRef, useState } from "react";
import {
  BACKUP_STALE_OPTIONS,
  HOME_SECTION_IDS,
  HOME_SECTION_LABELS,
  PASSWORD_AGE_OPTIONS,
  type HomeSectionId,
} from "../../../types/dashboard";
import { dashboardApi } from "../../../lib/dashboardApi";
import ConfirmDialog from "../../common/ConfirmDialog";
import { toast } from "../../common/Toast";
import { Button, Checkbox, FormField, Popover, Select } from "../../ui";
import { passwordPeriodText } from "./attention";
import { useHomeSettings } from "./useHomeSettings";

const NEVER = "never";

function GroupLabel({ children }: { children: string }) {
  return <p className="text-meta font-semibold text-ink-muted">{children}</p>;
}

/** Customize (docs/DASHBOARD.md 4.9). `onHistoryCleared` runs after Clear connection history succeeds. */
export default function CustomizeMenu({ onHistoryCleared }: { onHistoryCleared: () => void }) {
  const { settings, update } = useHomeSettings();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const setShown = (id: HomeSectionId, shown: boolean) => {
    const hidden = new Set(settings.hidden);
    if (shown) hidden.delete(id);
    else hidden.add(id);
    update({ hidden: HOME_SECTION_IDS.filter((x) => hidden.has(x)) });
  };

  const clearHistory = async () => {
    setConfirming(false);
    try {
      await dashboardApi.historyClear();
      toast.success(__tr("Connection history cleared"));
      onHistoryCleared();
    } catch (err) {
      console.warn("[home] connection_history_clear failed:", err);
      toast.error(__tr("Couldn't clear the connection history"));
    }
  };

  return (
    <>
      <Button ref={anchorRef} variant="ghost" size="sm" icon="settings" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {__tr("Customize")}</Button>
      <Popover anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} placement="bottom-end" className="w-72" aria-label={__tr("Customize Home")}>
        <div className="space-y-3 p-2">
          <p className="text-label font-semibold text-ink">{__tr("Customize Home")}</p>
          <div className="space-y-2">
            <GroupLabel>{__tr("Show on Home")}</GroupLabel>
            <div className="flex flex-col gap-1.5">
              {HOME_SECTION_IDS.map((id) => (
                <Checkbox key={id} checked={!settings.hidden.includes(id)} onChange={(on) => setShown(id, on)}>
                  {HOME_SECTION_LABELS[id]}
                </Checkbox>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <GroupLabel>{__tr("Needs attention")}</GroupLabel>
            <FormField label={__tr("Warn about passwords older than")}>
              <Select
                value={settings.passwordAgeDays === null ? NEVER : String(settings.passwordAgeDays)}
                onChange={(e) => update({ passwordAgeDays: e.target.value === NEVER ? null : Number(e.target.value) })}
              >
                {PASSWORD_AGE_OPTIONS.map((days) =>
                  days === null ? (
                    <option key={NEVER} value={NEVER}>
                      {__tr("Never")}</option>
                  ) : (
                    <option key={days} value={String(days)}>
                      {passwordPeriodText(days)}
                    </option>
                  ),
                )}
              </Select>
            </FormField>
            <FormField label={__tr("Warn about backups older than")}>
              <Select value={String(settings.backupStaleDays)} onChange={(e) => update({ backupStaleDays: Number(e.target.value) })}>
                {BACKUP_STALE_OPTIONS.map((days) => (
                  <option key={days} value={String(days)}>
                    {days} {__tr("days")}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="border-t border-divider pt-3">
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
            >
              {__tr("Clear connection history...")}</Button>
          </div>
        </div>
      </Popover>
      {confirming && (
        <ConfirmDialog
          title={__tr("Clear connection history?")}
          message={__tr("This removes the list of past connections for this vault on this device. Your entries do not change.")}
          confirmLabel={__tr("Clear history")}
          variant="danger"
          onConfirm={() => void clearHistory()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

import { t } from "../../../lib/i18n";
import { Select, SettingsRow, SectionHeader } from "../../ui";
import type { TabProps } from "../SettingsHelpers";
import StartupVaultSetting from "./StartupVaultSetting";
import UpdatesSetting from "./UpdatesSetting";

export default function GeneralTab({ onNavigate, settings, setSettings }: TabProps) {
  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title={t("Language")} />
        <SettingsRow title={t("Interface language")} description={t("The language changes the next time you open Conduit. Active connections stay open.")}>
          <Select aria-label={t("Interface language")} value={settings.ui_language ?? "system"} onChange={(event) => {
            const value = event.currentTarget.value as "system" | "en" | "zh-TW";
            setSettings((current) => ({ ...current, ui_language: value }));
          }}>
            <option value="system">{t("Follow system language")}</option>
            <option value="en">English</option>
            <option value="zh-TW">繁體中文（台灣）</option>
          </Select>
        </SettingsRow>
      </div>
      <StartupVaultSetting onOpenSecurity={() => onNavigate?.("security")} />
      <UpdatesSetting />
    </div>
  );
}

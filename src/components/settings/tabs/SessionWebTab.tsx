import { t as __tr } from "../../../lib/i18n";
import type { TabProps } from "../SettingsHelpers";
import type { WebGlobalDefaults, WebEngineType } from "../../../types/entry";
import { HARDCODED_WEB_DEFAULTS } from "../../../types/entry";
import { WEB_ENGINE_OPTIONS } from "../../../lib/sessionOptions";
import { Checkbox, FormField, Select } from "../../ui";
import { HINT } from "../settings-styles";

export default function SessionWebTab({ settings, setSettings }: TabProps) {
  const isWindows = navigator.userAgent.includes("Windows");
  const defaults = settings.session_defaults_web ?? { ...HARDCODED_WEB_DEFAULTS };

  const update = (partial: Partial<WebGlobalDefaults>) => {
    const next = { ...defaults, ...partial };
    setSettings({
      ...settings,
      session_defaults_web: next,
      // Keep legacy field in sync for one release
      default_web_engine: partial.engine ?? settings.default_web_engine,
    });
  };

  return (
    <div className="space-y-4">
      <p className={HINT}>
        {__tr("Default settings for all web sessions. Individual entries can override these.")}</p>

      <div>
        <Checkbox checked={defaults.autofillEnabled} onChange={(autofillEnabled) => update({ autofillEnabled })}>
          {__tr("Enable Autofill")}</Checkbox>
        <p className={`ml-[26px] mt-0.5 ${HINT}`}>
          {__tr("Show an autofill button in web sessions to fill login forms with entry credentials.")}</p>
      </div>

      <div>
        <Checkbox checked={defaults.ignoreCertErrors} onChange={(ignoreCertErrors) => update({ ignoreCertErrors })}>
          {__tr("Ignore Certificate Errors")}</Checkbox>
        <p className={`ml-[26px] mt-0.5 ${HINT}`}>
          {__tr("Trust self-signed or expired SSL certificates for all web sessions by default.")}</p>
      </div>

      {/* Browser Engine: Windows only */}
      {isWindows && (
        <FormField
          label={__tr("Browser Engine")}
          description={__tr("Edge engine enables Windows integrated authentication for Microsoft 365 and domain SSO. Individual connections can override this in their Security settings.")}
        >
          <Select value={defaults.engine} onChange={(e) => update({ engine: e.target.value as WebEngineType })}>
            {WEB_ENGINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </FormField>
      )}
    </div>
  );
}

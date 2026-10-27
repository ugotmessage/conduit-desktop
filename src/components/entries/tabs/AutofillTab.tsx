import { t as __tr } from "../../../lib/i18n";
import type { WebAutofillConfig, WebGlobalDefaults } from "../../../types/entry";
import DefaultableCheckbox from "../DefaultableCheckbox";
import Field from "../Field";
import { Checkbox, TextInput } from "../../ui";

interface AutofillTabProps {
  config: Partial<WebAutofillConfig>;
  onChange: (config: Partial<WebAutofillConfig>) => void;
  globalDefaults: WebGlobalDefaults;
}

const CODE = "rounded bg-code px-1 py-0.5 font-mono text-ink-secondary";

export default function AutofillTab({ config, onChange, globalDefaults }: AutofillTabProps) {
  const update = (partial: Partial<WebAutofillConfig>) => {
    onChange({ ...config, ...partial });
  };

  // Effective enabled: per-entry override or global default
  const effectiveEnabled = config.enabled ?? globalDefaults.autofillEnabled;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <DefaultableCheckbox
          value={config.enabled}
          defaultValue={globalDefaults.autofillEnabled}
          label={__tr("Enable Autofill")}
          onChange={(v) => update({ enabled: v })}
        />
        <p className="text-meta text-ink-muted">
          {__tr("Show an autofill button in web sessions to fill login forms with entry credentials.")}</p>
      </div>

      {effectiveEnabled && (
        <>
          <Field
            label={__tr("Login URL Pattern")}
            description={__tr("Optional regex pattern. Autofill button only activates when the page URL matches. Leave empty to allow on any page.")}
          >
            <TextInput
              value={config.loginUrlPattern ?? ""}
              onChange={(e) => update({ loginUrlPattern: e.target.value || undefined })}
              placeholder="e.g., /login|signin|auth/"
            />
          </Field>

          <Checkbox
            checked={config.multiStepLogin ?? false}
            onChange={(checked) => update({ multiStepLogin: checked })}
            description={__tr("Enable for sites that split login across multiple pages (Microsoft, Google, Okta). Username is filled and submitted first, then password is filled on the next page.")}
          >
            {__tr("Multi-step Login")}</Checkbox>

          <div className="border-t border-divider pt-4">
            <h4 className="mb-3 text-label font-semibold text-ink-secondary">{__tr("Selector Overrides")}</h4>
            <p className="mb-3 text-meta text-ink-muted">
              {__tr("CSS selectors like")} <code className={CODE}>#email</code>,{" "}
              <code className={CODE}>.login-form input[name='user']</code>{__tr(". Leave empty for automatic detection.")}</p>
            <div className="space-y-3">
              <Field label={__tr("Username Field")}>
                <TextInput
                  value={config.usernameSelector ?? ""}
                  onChange={(e) => update({ usernameSelector: e.target.value || undefined })}
                  placeholder={__tr("Auto-detect")}
                />
              </Field>
              <Field label={__tr("Password Field")}>
                <TextInput
                  value={config.passwordSelector ?? ""}
                  onChange={(e) => update({ passwordSelector: e.target.value || undefined })}
                  placeholder={__tr("Auto-detect")}
                />
              </Field>
              <Field label={__tr("Submit / Next Button")}>
                <TextInput
                  value={config.submitSelector ?? ""}
                  onChange={(e) => update({ submitSelector: e.target.value || undefined })}
                  placeholder={__tr("Auto-detect")}
                />
              </Field>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

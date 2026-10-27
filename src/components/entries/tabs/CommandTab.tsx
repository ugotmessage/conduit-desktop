import { t as __tr } from "../../../lib/i18n";
import type { CommandEntryConfig } from "../../../types/entry";
import Field from "../Field";
import { Callout, Checkbox, Radio, RadioGroup, Select, TextInput } from "../../ui";

interface CommandTabProps {
  config: CommandEntryConfig;
  onChange: (config: CommandEntryConfig) => void;
}

const SHELL_OPTIONS = [
  { value: "", label: __tr("Default") },
  { value: "bash", label: "bash" },
  { value: "zsh", label: "zsh" },
  { value: "sh", label: "sh" },
  ...(navigator.platform.startsWith("Win")
    ? [
        { value: "pwsh", label: "PowerShell" },
        { value: "cmd", label: "cmd" },
      ]
    : []),
];

export default function CommandTab({ config, onChange }: CommandTabProps) {
  const update = (partial: Partial<CommandEntryConfig>) => {
    onChange({ ...config, ...partial });
  };

  const isWayland =
    !navigator.platform.startsWith("Win") &&
    !navigator.platform.startsWith("Mac");

  return (
    <div className="space-y-4">
      <Field label={__tr("Command")} required>
        <TextInput
          value={config.command}
          onChange={(e) => update({ command: e.target.value })}
          placeholder={__tr("/usr/bin/code, whoami, etc.")}
          className="font-mono"
        />
      </Field>

      <Field label={__tr("Arguments")}>
        <TextInput
          value={config.args ?? ""}
          onChange={(e) => update({ args: e.target.value })}
          placeholder="--new-window /path/to/project"
          className="font-mono"
        />
      </Field>

      <Field label={__tr("Working Directory")}>
        <TextInput
          value={config.workingDir ?? ""}
          onChange={(e) => update({ workingDir: e.target.value })}
          placeholder={__tr("Leave empty for home directory")}
          className="font-mono"
        />
      </Field>

      <Field label={__tr("Shell")} description={__tr("Shell used to wrap the command. Default uses the system shell.")}>
        <Select value={config.shell ?? ""} onChange={(e) => update({ shell: e.target.value })}>
          {SHELL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={__tr("Run As")} group>
        <RadioGroup
          name="runAsMode"
          value={config.runAsMode}
          onChange={(runAsMode) => update({ runAsMode })}
          className="mt-1"
        >
          <Radio value="credential">{__tr("Credential user")}</Radio>
          <p className="-mt-1 ml-6 text-meta text-ink-muted">
            {__tr("Uses the credential from the Credentials tab to run as that user")}</p>
          <Radio value="current">{__tr("Current user")}</Radio>
          <p className="-mt-1 ml-6 text-meta text-ink-muted">
            {__tr("No credential needed — runs as the logged-in user")}</p>
        </RadioGroup>
      </Field>

      <div className="space-y-2">
        <Checkbox checked={config.guiApp ?? false} onChange={(guiApp) => update({ guiApp })}>
          {__tr("GUI Application")}</Checkbox>
        {config.guiApp && (
          <Callout tone="warning" size="sm">
            {navigator.platform.startsWith("Mac") ? (
              <span>{__tr("Target user must have an active login session (Fast User Switching).")}</span>
            ) : navigator.platform.startsWith("Win") ? (
              <span>{__tr("Windows handles GUI app permissions automatically.")}</span>
            ) : isWayland ? (
              <span>{__tr("Cross-user GUI launch is not supported on Wayland.")}</span>
            ) : (
              <span>{__tr("Requires display access for the target user (xhost will be configured automatically).")}</span>
            )}
          </Callout>
        )}
      </div>

      <Field label={__tr("Timeout (seconds)")} description={__tr("0 = no timeout. The process will run until it exits or is manually stopped.")}>
        <TextInput
          type="number"
          value={config.timeout ?? 0}
          onChange={(e) => update({ timeout: parseInt(e.target.value, 10) || 0 })}
          min={0}
          className="max-w-32"
        />
      </Field>
    </div>
  );
}

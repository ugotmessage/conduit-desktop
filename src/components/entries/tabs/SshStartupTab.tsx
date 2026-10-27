import {
  SSH_STARTUP_MAX_DELAY_SECONDS,
  SSH_STARTUP_MAX_INPUT_LENGTH,
  SSH_STARTUP_MAX_STEPS,
  blankSshStartupStep,
  type SshStartupScript,
  type SshStartupStep,
} from "../../../lib/sshStartup";
import Field from "../Field";
import { Button, Callout, Checkbox, Select, TextInput } from "../../ui";

interface SshStartupTabProps {
  config: SshStartupScript;
  onChange: (config: SshStartupScript) => void;
}

const INPUT_MODE_OPTIONS: { value: SshStartupStep["inputMode"]; label: string }[] = [
  { value: "text", label: "Typed text" },
  { value: "credential_password", label: "Connection password" },
];

export default function SshStartupTab({ config, onChange }: SshStartupTabProps) {
  const update = (partial: Partial<SshStartupScript>) => {
    onChange({ ...config, ...partial });
  };

  const setEnabled = (enabled: boolean) => {
    const steps = enabled && config.steps.length === 0 ? [blankSshStartupStep()] : config.steps;
    update({ enabled, steps });
  };

  const updateStep = (index: number, partial: Partial<SshStartupStep>) => {
    const steps = config.steps.map((step, i) => {
      if (i !== index) return step;
      const next = { ...step, ...partial };
      if (next.inputMode === "credential_password") {
        return { delaySeconds: next.delaySeconds, inputMode: "credential_password" as const };
      }
      return { ...next, text: next.text ?? "" };
    });
    update({ steps });
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= config.steps.length) return;
    const steps = [...config.steps];
    const [removed] = steps.splice(index, 1);
    steps.splice(target, 0, removed);
    update({ steps });
  };

  const removeStep = (index: number) => {
    update({ steps: config.steps.filter((_, i) => i !== index) });
  };

  const addStep = () => {
    if (config.steps.length >= SSH_STARTUP_MAX_STEPS) return;
    update({ steps: [...config.steps, blankSshStartupStep()] });
  };

  return (
    <div className="space-y-4">
      <Checkbox
        checked={config.enabled}
        onChange={setEnabled}
        description="After SSH login, wait a fixed number of seconds and type each step into the remote shell. Waits are relative to the previous step. Prompts are not read — size the delay for sudo and similar prompts."
      >
        Run steps after login
      </Checkbox>

      {config.enabled && (
        <>
          <Callout tone="info" title="Fixed waits, no prompt detection">
            These steps start once the interactive shell is open. Each wait is a timer, not expect-style matching.
            Use Connection password for sudo so the secret stays on the credential instead of in this list.
          </Callout>

          <div className="space-y-3">
            {config.steps.map((step, index) => (
              <div key={index} className="space-y-3 rounded border border-divider p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-label font-semibold text-ink-secondary">Step {index + 1}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                      Up
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveStep(index, 1)}
                      disabled={index === config.steps.length - 1}
                    >
                      Down
                    </Button>
                    <Button size="sm" variant="ghost-danger" onClick={() => removeStep(index)}>
                      Remove
                    </Button>
                  </div>
                </div>

                <Field
                  label="Wait (seconds)"
                  description={`Time to wait after the previous step (or after the shell opens for step 1). 0–${SSH_STARTUP_MAX_DELAY_SECONDS}.`}
                >
                  <TextInput
                    type="number"
                    min={0}
                    max={SSH_STARTUP_MAX_DELAY_SECONDS}
                    step={0.1}
                    value={String(step.delaySeconds)}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      updateStep(index, { delaySeconds: Number.isFinite(n) ? n : 0 });
                    }}
                  />
                </Field>

                <Field label="Input">
                  <Select
                    value={step.inputMode}
                    onChange={(e) =>
                      updateStep(index, { inputMode: e.target.value as SshStartupStep["inputMode"] })
                    }
                    aria-label={`Step ${index + 1} input`}
                  >
                    {INPUT_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                {step.inputMode === "credential_password" ? (
                  <p className="text-meta text-ink-muted">
                    Types the password from this connection’s credential (including a key login that also has a
                    password). It is not saved in these steps.
                  </p>
                ) : (
                  <Field label="Text" description={`Sent followed by Enter. Max ${SSH_STARTUP_MAX_INPUT_LENGTH} characters.`}>
                    <TextInput
                      value={step.text ?? ""}
                      maxLength={SSH_STARTUP_MAX_INPUT_LENGTH}
                      onChange={(e) => updateStep(index, { text: e.target.value })}
                      placeholder="sudo -i"
                      className="font-mono"
                    />
                  </Field>
                )}
              </div>
            ))}
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={addStep}
            disabled={config.steps.length >= SSH_STARTUP_MAX_STEPS}
          >
            Add step
          </Button>
        </>
      )}
    </div>
  );
}

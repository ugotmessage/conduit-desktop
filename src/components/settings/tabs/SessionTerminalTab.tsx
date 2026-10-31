import { useState, useEffect } from "react";
import type { TabProps } from "../SettingsHelpers";
import { useLayoutStore, findLeaf } from "../../../stores/layoutStore";
import { useSessionStore } from "../../../stores/sessionStore";
import { getTerminalRendererMode, setTerminalRendererMode, TERMINAL_RENDERER_EVENT, type TerminalRendererMode } from "../../../lib/terminalRenderer";
import type { TerminalGlobalDefaults } from "../../../types/entry";
import { HARDCODED_TERMINAL_DEFAULTS } from "../../../types/entry";
import { Checkbox, FormField, Select, Slider, TextInput } from "../../ui";
import { HINT, SECTION_LABEL } from "../settings-styles";
import TerminalFontField from "./TerminalFontField";

export default function SessionTerminalTab({ settings, setSettings }: TabProps) {
  const focusedPaneId = useLayoutStore((state) => state.focusedPaneId);
  const activeSessionId = useLayoutStore((state) => {
    const pane = state.focusedPaneId ? findLeaf(state.root, state.focusedPaneId) : null;
    return pane?.activeSessionId ?? null;
  });
  const activeType = useSessionStore((state) => state.sessions.find((session) => session.id === activeSessionId)?.type);
  const isTerminal = activeType === "ssh" || activeType === "local_shell";
  const [mode, setMode] = useState<TerminalRendererMode>("dom");
  useEffect(() => {
    setMode(activeSessionId ? getTerminalRendererMode(activeSessionId) : "dom");
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string; mode: TerminalRendererMode }>).detail;
      if (detail?.sessionId === activeSessionId) setMode(detail.mode);
    };
    document.addEventListener(TERMINAL_RENDERER_EVENT, update);
    return () => document.removeEventListener(TERMINAL_RENDERER_EVENT, update);
  }, [activeSessionId]);
  const defaults: TerminalGlobalDefaults = { ...HARDCODED_TERMINAL_DEFAULTS, ...settings.session_defaults_terminal };

  const updateTerminal = (partial: Partial<TerminalGlobalDefaults>) => {
    setSettings({
      ...settings,
      session_defaults_terminal: { ...defaults, ...partial },
    });
  };

  return (
    <div className="space-y-4">
      <FormField label="Default Shell" description="Shell used when opening new local terminal sessions.">
        <Select value={settings.default_shell} onChange={(e) => setSettings({ ...settings, default_shell: e.target.value })}>
          <option value="default">System Default</option>
          <option value="bash">Bash</option>
          <option value="zsh">Zsh</option>
          <option value="powershell">PowerShell</option>
        </Select>
      </FormField>

      <div className="space-y-3 border-t border-divider pt-4">
        <FormField label="Current SSH tab renderer" description="Apply immediately to the selected SSH or local terminal in the focused pane. This does not restart the session or erase scrollback.">
          <Select
            value={mode}
            disabled={!isTerminal || !focusedPaneId}
            onChange={(event) => {
              if (!activeSessionId || !isTerminal) return;
              setTerminalRendererMode(activeSessionId, event.target.value as TerminalRendererMode);
            }}
          >
            <option value="auto">Auto — WebGL with DOM fallback</option>
            <option value="dom">DOM — compatibility (default)</option>
            <option value="webgl">WebGL — accelerated</option>
          </Select>
        </FormField>
        {!isTerminal && <p className={HINT}>Select an SSH or local terminal tab to enable this control.</p>}
        <p className={HINT}>Auto falls back to DOM on detected WebGL context loss. If text is black but no context-loss event occurs, manually switch to DOM. The choice lasts for the life of this tab.</p>
      </div>
      <div className="space-y-4 border-t border-divider pt-4">
        <p className={HINT}>
          Default settings for all terminal sessions. SSH sessions inherit these values.
        </p>

        <TerminalFontField value={defaults.fontFamily} onChange={(fontFamily) => updateTerminal({ fontFamily })} />

        <div>
          <label htmlFor="terminal-font-size" className={`${SECTION_LABEL} mb-1`}>
            Font Size <span className="font-normal text-ink-muted">({defaults.fontSize}px)</span>
          </label>
          <Slider
            id="terminal-font-size"
            min={8}
            max={32}
            step={1}
            value={defaults.fontSize}
            onChange={(e) => updateTerminal({ fontSize: parseInt(e.target.value) })}
            marks={["8px", "", "32px"]}
          />
        </div>

        <FormField label="Scrollback Buffer" description="Number of lines to keep in the scroll history (100 – 100,000).">
          <TextInput
            type="number"
            min={100}
            max={100000}
            step={100}
            value={defaults.scrollback}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                updateTerminal({ scrollback: Math.max(100, Math.min(100000, val)) });
              }
            }}
          />
        </FormField>

        <Checkbox checked={defaults.cursorBlink} onChange={(cursorBlink) => updateTerminal({ cursorBlink })}>
          Cursor Blink
        </Checkbox>
      </div>
    </div>
  );
}

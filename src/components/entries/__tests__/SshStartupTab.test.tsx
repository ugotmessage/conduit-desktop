import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SshStartupTab from "../tabs/SshStartupTab";
import { DEFAULT_SSH_STARTUP, type SshStartupScript } from "../../../lib/sshStartup";

function Harness({ onUpdate }: { onUpdate: (script: SshStartupScript) => void }) {
  const [config, setConfig] = useState<SshStartupScript>({ ...DEFAULT_SSH_STARTUP, steps: [] });
  return (
    <SshStartupTab
      config={config}
      onChange={(next) => {
        setConfig(next);
        onUpdate(next);
      }}
    />
  );
}

describe("SshStartupTab", () => {
  it("stays off until checked, then can add, reorder, and switch to connection password", () => {
    const latest: { current: SshStartupScript | null } = { current: null };
    render(<Harness onUpdate={(script) => { latest.current = script; }} />);
    expect(screen.getByRole("checkbox", { name: /Run steps after login/ })).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Add step" })).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: /Run steps after login/ }));
    expect(latest.current?.enabled).toBe(true);
    expect(latest.current?.steps).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText("sudo -i"), { target: { value: "sudo -i" } });
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    const inputs = screen.getAllByPlaceholderText("sudo -i");
    fireEvent.change(inputs[1], { target: { value: "whoami" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Up" })[1]);
    expect(latest.current?.steps.map((s) => s.text)).toEqual(["whoami", "sudo -i"]);

    fireEvent.change(screen.getAllByRole("combobox", { name: /input/ })[0], {
      target: { value: "credential_password" },
    });
    expect(latest.current?.steps[0]).toEqual({ delaySeconds: 2, inputMode: "credential_password" });
    expect(JSON.stringify(latest.current)).not.toMatch(/secret|password-value/);
    expect(screen.getByText(/Types the password from this connection/)).toBeTruthy();
  });
});

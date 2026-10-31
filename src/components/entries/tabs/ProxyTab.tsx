import { useId, useState } from "react";
import type { RdpEntryConfig } from "../../../types/entry";
import { gatewayIdOf } from "../../../lib/rdpGateway";
import {
  PROXY_GATEWAY_MESSAGE,
  PROXY_HOST_MESSAGE,
  PROXY_PORT_MESSAGE,
  RDP_PROXY_DEFAULT_PORT,
  proxyCredentialIdOf,
  readProxyFields,
} from "../../../lib/rdpProxy";
import { useVaultStore } from "../../../stores/vaultStore";
import CredentialPicker from "../../vault/CredentialPicker";
import Field from "../Field";
import { Callout, Checkbox, IconButton, TextInput } from "../../ui";

const HINT = "text-meta text-ink-muted";
const PICKER_BUTTON =
  "h-control w-full rounded border border-input-border bg-input px-1.5 text-left text-body text-(--c-input-fg) hover:border-(--c-control-border)";

interface ProxyTabProps {
  config: Partial<RdpEntryConfig>;
  onChange: (config: Partial<RdpEntryConfig>) => void;
  showErrors?: boolean;
}

/** An RDP entry's optional SOCKS5 hop. Not an RD Gateway. */
export default function ProxyTab({ config, onChange, showErrors = false }: ProxyTabProps) {
  const credentials = useVaultStore((s) => s.credentials);
  const [showPicker, setShowPicker] = useState(false);
  const hostId = useId();
  const portId = useId();
  const pickerId = useId();

  const parsed = readProxyFields(config);
  const enabled = parsed.enabled;
  const gatewayOn = gatewayIdOf(config) !== undefined;
  const credentialId = proxyCredentialIdOf(config) ?? null;
  const credentialName = credentialId
    ? credentials.find((c) => c.id === credentialId)?.name ?? "Unknown credential"
    : null;
  const missingCredential = Boolean(credentialId && !credentials.some((c) => c.id === credentialId));

  const patch = (next: Partial<RdpEntryConfig>) => onChange({ ...config, ...next });

  return (
    <div className="space-y-4">
      <p className={HINT}>
        A SOCKS5 proxy is a TCP hop in front of this computer. Destination DNS is done by the proxy.
        This is not a Remote Desktop Gateway.
      </p>

      <Checkbox
        checked={enabled}
        onChange={(checked) => patch({ proxyEnabled: checked || undefined, proxyType: checked ? "socks5" : undefined })}
      >
        Use a SOCKS5 proxy
      </Checkbox>

      {enabled && gatewayOn && (
        <Callout tone="warning" size="sm">
          {PROXY_GATEWAY_MESSAGE}
        </Callout>
      )}

      {enabled && (
        <>
          <Field label="Proxy host">
            <TextInput
              id={hostId}
              value={config.proxyHost ?? ""}
              onChange={(e) => patch({ proxyHost: e.target.value })}
              placeholder="127.0.0.1"
              invalid={showErrors && !parsed.host}
            />
            {showErrors && !parsed.host && (
              <p data-cv-error="" className="mt-1 text-meta text-danger">
                {PROXY_HOST_MESSAGE}
              </p>
            )}
          </Field>

          <Field label="Port" htmlFor={portId}>
            <TextInput
              id={portId}
              inputMode="numeric"
              value={config.proxyPort !== undefined ? String(config.proxyPort) : String(RDP_PROXY_DEFAULT_PORT)}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") {
                  patch({ proxyPort: RDP_PROXY_DEFAULT_PORT });
                  return;
                }
                const n = Number(raw);
                patch({ proxyPort: Number.isFinite(n) ? n : (config.proxyPort ?? RDP_PROXY_DEFAULT_PORT) });
              }}
              invalid={showErrors && parsed.portInvalid}
            />
            {showErrors && parsed.portInvalid && (
              <p data-cv-error="" className="mt-1 text-meta text-danger">
                {PROXY_PORT_MESSAGE}
              </p>
            )}
          </Field>

          <Field label="Authentication" group htmlFor={pickerId}>
            <p className={`${HINT} mb-2`}>
              Optional. Use a saved vault login when the proxy requires a username and password. Leave empty
              for a local unauthenticated SOCKS5.
            </p>
            <div className="flex items-center gap-1">
              <button
                id={pickerId}
                type="button"
                aria-label={credentialName ?? "No authentication"}
                onClick={() => setShowPicker(true)}
                className={PICKER_BUTTON}
              >
                {credentialName ?? <span className="text-(--c-input-placeholder)">No authentication</span>}
              </button>
              {credentialId && (
                <IconButton
                  size="sm"
                  icon="close"
                  label="Clear proxy credential"
                  onClick={() => patch({ proxyCredentialId: undefined })}
                />
              )}
            </div>
            {missingCredential && (
              <Callout tone="warning" size="sm">
                The credential this proxy used was deleted. Pick another one, or choose no authentication.
              </Callout>
            )}
          </Field>
        </>
      )}

      {showPicker && (
        <CredentialPicker
          selectedId={credentialId}
          onSelect={(id) => patch({ proxyCredentialId: id ?? undefined })}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

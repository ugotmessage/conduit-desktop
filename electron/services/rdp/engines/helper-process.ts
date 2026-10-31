// Pure spawn helpers for the FreeRDP child: skip target DNS behind a hop, and
// strip ambient no_proxy so FreeRDP's proxy_prepare cannot cancel an explicit SOCKS.

import type { RdpEngineConfig } from '../engine.js';

/** Electron must not resolve the RDP target when a gateway or SOCKS hop will do DNS. */
export function shouldPreResolveRdpTarget(config: Pick<RdpEngineConfig, 'gateway' | 'proxy'>): boolean {
  return !config.gateway && !config.proxy;
}

export function helperChildEnv(
  base: NodeJS.ProcessEnv,
  opts: { osslModulesDir: string; clearProxyBypass: boolean },
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, OPENSSL_MODULES: opts.osslModulesDir };
  if (opts.clearProxyBypass) {
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === 'no_proxy') delete env[key];
    }
  }
  return env;
}

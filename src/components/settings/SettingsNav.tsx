import { t as __tr } from "../../lib/i18n";
import {
  KeyboardIcon, PaletteIcon, RobotIcon, FloppyIcon, UsersIcon, UserIcon,
  TerminalIcon, DesktopIcon, EyeIcon, GlobeIcon,
  KeyIcon, FingerprintIcon, DeviceMobileIcon, CloudSyncIcon,
} from "../../lib/icons";
import { NavList, type NavEntry } from "../ui";
import type { SettingsTab } from "./SettingsHelpers";

export const SETTINGS_NAV: ReadonlyArray<NavEntry> = [
  { id: "general", icon: KeyboardIcon, label: __tr("General") },
  { id: "appearance", icon: PaletteIcon, label: __tr("Appearance") },
  { id: "security", icon: FingerprintIcon, label: __tr("Security") },
  {
    kind: "group",
    id: "sessions",
    icon: TerminalIcon,
    label: __tr("Sessions"),
    children: [
      { id: "sessions/terminal", icon: TerminalIcon, label: __tr("Terminal") },
      { id: "sessions/ssh", icon: KeyIcon, label: "SSH" },
      { id: "sessions/rdp", icon: DesktopIcon, label: "RDP" },
      { id: "sessions/vnc", icon: EyeIcon, label: "VNC" },
      { id: "sessions/web", icon: GlobeIcon, label: __tr("Web") },
    ],
  },
  { id: "ai/agent", icon: RobotIcon, label: "AI" },
  { id: "backup", icon: FloppyIcon, label: __tr("Backup") },
  { id: "sync", icon: CloudSyncIcon, label: __tr("Sync") },
  { id: "mobile", icon: DeviceMobileIcon, label: __tr("Mobile") },
  { id: "team", icon: UsersIcon, label: __tr("Team") },
  { id: "account", icon: UserIcon, label: __tr("Account") },
];

interface SettingsNavProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

/** The harness finds the nav by `data-cv-settings-nav` (B2) and, until wave 4, by `w-52`. */
export default function SettingsNav({ activeTab, onTabChange }: SettingsNavProps) {
  return (
    <NavList
      data-cv-settings-nav=""
      items={SETTINGS_NAV}
      value={activeTab}
      onChange={(id) => onTabChange(id as SettingsTab)}
      className="w-52 shrink-0 overflow-y-auto border-r border-divider p-2"
    />
  );
}

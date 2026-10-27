import { t as __tr } from "../../lib/i18n";
import type { EntryType } from "../../types/entry";
import {
  DesktopIcon, DevicesIcon, InfoCircleIcon, KeyIcon, PlayerPlayIcon, RobotIcon, SettingsIcon, ShieldLockIcon
} from "../../lib/icons";
import type { IconComponent } from "../../lib/icons";

export type EntryTabId = "general" | "credentials" | "display" | "resources" | "security" | "autofill" | "command" | "information";

export interface EntryTab {
  id: EntryTabId;
  label: string;
  icon: IconComponent;
}

export interface EntryTabCategory {
  label: string;
  tabs: EntryTab[];
}

export function getTabCategories(entryType: EntryType): EntryTabCategory[] {
  const categories: EntryTabCategory[] = [];

  // Common category
  const commonTabs: EntryTab[] = [
    { id: "general", label: __tr("General"), icon: SettingsIcon },
  ];

  if (entryType !== "document") {
    commonTabs.push({ id: "credentials", label: __tr("Credentials"), icon: KeyIcon });
  }

  commonTabs.push({ id: "information", label: __tr("Information"), icon: InfoCircleIcon });
  categories.push({ label: __tr("Common"), tabs: commonTabs });

  // Connection category
  if (entryType === "rdp") {
    categories.push({
      label: __tr("Connection"),
      tabs: [
        { id: "display", label: __tr("Display"), icon: DesktopIcon },
        { id: "resources", label: __tr("Resources"), icon: DevicesIcon },
        { id: "security", label: __tr("Security"), icon: ShieldLockIcon },
      ],
    });
  } else if (entryType === "web") {
    categories.push({
      label: __tr("Connection"),
      tabs: [
        { id: "autofill", label: __tr("Autofill"), icon: RobotIcon },
        { id: "security", label: __tr("Security"), icon: ShieldLockIcon },
      ],
    });
  } else if (entryType === "command") {
    categories.push({
      label: __tr("Execution"),
      tabs: [
        { id: "command", label: __tr("Command"), icon: PlayerPlayIcon },
      ],
    });
  }

  return categories;
}

export function getDefaultTabId(): EntryTabId {
  return "general";
}

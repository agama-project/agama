/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

/*
 * PLAYGROUND: switches for the storage page, from the browser console.
 *
 * Whether the devices sit in a bordered box or right on the page:
 *
 *   agamaDevicesBox(false)  // right on the page (default)
 *   agamaDevicesBox(true)   // in a bordered box
 *
 * Whether the devices table groups them by kind, each group sorted on its
 * own:
 *
 *   agamaGroupedTable(false)  // one flat list
 *   agamaGroupedTable(true)   // volume groups, RAID devices and disks apart (default)
 *
 * How the title row of each group looks in the grouped table:
 *
 *   agamaGroupTitleStyle("band")   // band fading down behind each title (default)
 *   agamaGroupTitleStyle("flat")   // flat faint band behind each title
 *   agamaGroupTitleStyle("plain")  // small capitals on the page, as before
 *
 * Which set of words the "Existing data" column uses:
 *
 *   agamaExistingDataWording("verbose")  // Current partitions kept, Partitions may be shrunk, ... (default)
 *   agamaExistingDataWording("short")    // Kept, May be shrunk, All deleted
 *   agamaExistingDataWording("blunt")    // No changes, May shrink, Wiped
 *   agamaExistingDataWording("loss")     // All kept, Possible data loss, Data loss
 *
 * How names (mount points, volume groups) read in the "Used for" column:
 *
 *   agamaNamesStyle("mono")   // in monospace, apart from the words around them (default)
 *   agamaNamesStyle("plain")  // in the same face as the rest
 *
 * How the summary at the top of the page is worded:
 *
 *   agamaSummaryWording("single") // what applying takes, then a quieter note; details below (default)
 *   agamaSummaryWording("when")   // "When the installation starts, ..."
 *   agamaSummaryWording("until")  // "Nothing is changed until ...", in two lines
 *
 * What holds the summary:
 *
 *   agamaSummaryStyle("plain")  // a line on the page (default)
 *   agamaSummaryStyle("hint")   // a PatternFly hint box
 *
 * What the summary counts:
 *
 *   agamaActionCount("all")           // every action, as "N actions" (default)
 *   agamaActionCount("noSubvolumes")  // without Btrfs subvolumes, as "N actions"
 *   agamaActionCount("changes")       // without Btrfs subvolumes, as "N changes"
 *
 * How a setup that cannot be applied offers its suggestions:
 *
 *   agamaFailedDetails("popup")       // in a popup (default)
 *   agamaFailedDetails("expandable")  // in place, under the alert
 *
 * The result preview, docked beside the page or only in its popup, until
 * there is a control for it (kept for the session, not across sessions):
 *
 *   agamaPinnedResult(false)  // only in the popup, as before (default)
 *   agamaPinnedResult(true)   // docked beside the page
 *
 * How a row's menu offers the choices for the partitions already on a device:
 *
 *   agamaSpacePolicyMenu("flyout")     // in a menu to the side of the item (default)
 *   agamaSpacePolicyMenu("drilldown")  // replacing the menu, with a way back
 *
 * Choices survive reloads. To be dropped once the design is settled.
 */

import React from "react";

type DevicesBox = "off" | "on";
type GroupedTable = "off" | "on";
type ExistingDataWording = "short" | "verbose" | "blunt" | "loss";
type GroupTitleStyle = "band" | "flat" | "plain";
type NamesStyle = "mono" | "plain";
type SummaryStyle = "plain" | "hint";
type FailedDetails = "popup" | "expandable";
type SummaryWording = "when" | "until" | "single";
type ActionCount = "all" | "noSubvolumes" | "changes";
type SpacePolicyMenu = "flyout" | "drilldown";

type SwitchName =
  | "agamaDevicesBox"
  | "agamaGroupedTable"
  | "agamaExistingDataWording"
  | "agamaNamesStyle"
  | "agamaGroupTitleStyle"
  | "agamaFailedDetails"
  | "agamaSummaryStyle"
  | "agamaSummaryWording"
  | "agamaActionCount"
  | "agamaSpacePolicyMenu";

declare global {
  interface Window {
    agamaDevicesBox?: (value: boolean) => void;
    agamaGroupedTable?: (value: boolean) => void;
    agamaExistingDataWording?: (value: ExistingDataWording) => void;
    agamaGroupTitleStyle?: (value: GroupTitleStyle) => void;
    agamaNamesStyle?: (value: NamesStyle) => void;
    agamaSummaryStyle?: (value: SummaryStyle) => void;
    agamaFailedDetails?: (value: FailedDetails) => void;
    agamaSummaryWording?: (value: SummaryWording) => void;
    agamaActionCount?: (value: ActionCount) => void;
    agamaSpacePolicyMenu?: (value: SpacePolicyMenu) => void;
    agamaPinnedResult?: (value: boolean) => void;
  }
}

/** A value picked from the console, kept in local storage, read as a hook. */
function consoleSwitch<T extends string>(
  name: SwitchName,
  values: T[],
  /** Turns what is typed in the console into one of the values. */
  fromInput: (input: unknown) => T = (input) => input as T,
): () => T {
  const key = `agama.storage.${name.replace(/^agama(.)/, (_m, c: string) => c.toLowerCase())}`;
  const event = `${name}-changed`;
  const fallback = values[0];

  const read = (): T => {
    try {
      const stored = localStorage.getItem(key) as T;
      return values.includes(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  };

  const subscribe = (onChange: () => void) => {
    window.addEventListener(event, onChange);
    return () => window.removeEventListener(event, onChange);
  };

  (window as unknown as Record<SwitchName, (input: unknown) => void>)[name] = (input) => {
    const value = fromInput(input);
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn(`Cannot keep ${name}: no local storage`);
    }
    window.dispatchEvent(new Event(event));
  };

  return () => React.useSyncExternalStore(subscribe, read);
}

const useDevicesBox = consoleSwitch<DevicesBox>("agamaDevicesBox", ["off", "on"], (input) =>
  input ? "on" : "off",
);

const useGroupedTable = consoleSwitch<GroupedTable>("agamaGroupedTable", ["on", "off"], (input) =>
  input ? "on" : "off",
);

const useExistingDataWording = consoleSwitch<ExistingDataWording>("agamaExistingDataWording", [
  "verbose",
  "short",
  "blunt",
  "loss",
]);

const useGroupTitleStyle = consoleSwitch<GroupTitleStyle>("agamaGroupTitleStyle", [
  "band",
  "flat",
  "plain",
]);

const useNamesStyle = consoleSwitch<NamesStyle>("agamaNamesStyle", ["mono", "plain"]);

const useSummaryStyle = consoleSwitch<SummaryStyle>("agamaSummaryStyle", ["plain", "hint"]);

const useFailedDetails = consoleSwitch<FailedDetails>("agamaFailedDetails", [
  "popup",
  "expandable",
]);

const useSummaryWording = consoleSwitch<SummaryWording>("agamaSummaryWording", [
  "single",
  "when",
  "until",
]);

const useActionCount = consoleSwitch<ActionCount>("agamaActionCount", [
  "all",
  "noSubvolumes",
  "changes",
]);

const useSpacePolicyMenu = consoleSwitch<SpacePolicyMenu>("agamaSpacePolicyMenu", [
  "flyout",
  "drilldown",
]);

export {
  useSpacePolicyMenu,
  useDevicesBox,
  useGroupedTable,
  useExistingDataWording,
  useNamesStyle,
  useGroupTitleStyle,
  useSummaryWording,
  useActionCount,
  useFailedDetails,
  useSummaryStyle,
};
export type { ExistingDataWording, NamesStyle };

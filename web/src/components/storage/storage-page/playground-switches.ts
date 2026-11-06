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
 * Which set of words the "Existing data" column uses:
 *
 *   agamaExistingDataWording("short")    // Kept, May be shrunk, All deleted (default)
 *   agamaExistingDataWording("verbose")  // Current partitions kept, Partitions may be shrunk, ...
 *   agamaExistingDataWording("blunt")    // No changes, May shrink, Wiped
 *   agamaExistingDataWording("loss")     // All kept, Possible data loss, Data loss
 *
 * Choices survive reloads. To be dropped once the design is settled.
 */

import React from "react";

type DevicesBox = "off" | "on";
type GroupedTable = "off" | "on";
type ExistingDataWording = "short" | "verbose" | "blunt" | "loss";

type SwitchName = "agamaDevicesBox" | "agamaGroupedTable" | "agamaExistingDataWording";

declare global {
  interface Window {
    agamaDevicesBox?: (value: boolean) => void;
    agamaGroupedTable?: (value: boolean) => void;
    agamaExistingDataWording?: (value: ExistingDataWording) => void;
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
  "short",
  "verbose",
  "blunt",
  "loss",
]);

export { useDevicesBox, useGroupedTable, useExistingDataWording };
export type { ExistingDataWording };

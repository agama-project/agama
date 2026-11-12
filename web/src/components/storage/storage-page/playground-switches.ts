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
 * How names (mount points, volume groups) read in the "Used for" column:
 *
 *   agamaNamesStyle("mono")   // in monospace, apart from the words around them (default)
 *   agamaNamesStyle("plain")  // in the same face as the rest
 *
 * Where the buttons opening the details and the suggestions sit:
 *
 *   agamaDetailsButton("inline")  // fitted at the end of their sentence (default)
 *   agamaDetailsButton("end")     // Details at its regular size, at the right end of the summary line
 *
 * How big the buttons opening the details and the suggestions are, wherever
 * they sit:
 *
 *   agamaDetailsSize("compact")  // fitted to a line of text (default)
 *   agamaDetailsSize("regular")  // PatternFly's small button, as elsewhere
 *
 * How a device panel's section title stands apart from what it holds:
 *
 *   agamaSectionTitle("plain")   // nothing more than the indent under it (default)
 *   agamaSectionTitle("spaced")  // more room under the title
 *   agamaSectionTitle("rule")    // a line under the title
 *   agamaSectionTitle("both")    // a line under the title, and more room under it
 *   agamaSectionTitle("grouped")    // no line: close to its content, far from the next section
 *   agamaSectionTitle("separated")  // a line between sections rather than under titles
 *   agamaSectionTitle("smallcaps")  // spaced as "grouped", titles as the table's group titles
 *
 * How far a device panel's section content is indented under its title, with
 * any title style:
 *
 *   agamaSectionIndent("medium")  // 16 px (default)
 *   agamaSectionIndent("small")   // 8 px
 *   agamaSectionIndent("none")    // in line with the title
 *
 * Whether a device panel's section title sits on a band, with any title style:
 *
 *   agamaSectionBand("none")    // no band (default)
 *   agamaSectionBand("fading")  // the band fading down, as behind the table's group titles
 *   agamaSectionBand("flat")    // an even band
 *
 * Whether the titles of the devices table's groups carry an icon:
 *
 *   agamaGroupTitleIcons("off")  // words only, as every icon left does something (default)
 *   agamaGroupTitleIcons("on")   // an icon before each title, as before
 *
 * Choices survive reloads. To be dropped once the design is settled.
 */

import React from "react";

type GroupedTable = "off" | "on";
type GroupTitleStyle = "band" | "flat" | "plain";
type NamesStyle = "mono" | "plain";
type DetailsButton = "inline" | "end";
type DetailsSize = "compact" | "regular";
type GroupTitleIcons = "off" | "on";
type SectionBand = "none" | "fading" | "flat";
type SectionIndent = "medium" | "small" | "none";
type SectionTitle = "plain" | "spaced" | "rule" | "both" | "grouped" | "separated" | "smallcaps";

type SwitchName =
  | "agamaGroupedTable"
  | "agamaNamesStyle"
  | "agamaGroupTitleStyle"
  | "agamaDetailsButton"
  | "agamaDetailsSize"
  | "agamaSectionTitle"
  | "agamaGroupTitleIcons"
  | "agamaSectionBand"
  | "agamaSectionIndent";

declare global {
  interface Window {
    agamaGroupedTable?: (value: boolean) => void;
    agamaGroupTitleStyle?: (value: GroupTitleStyle) => void;
    agamaNamesStyle?: (value: NamesStyle) => void;
    agamaDetailsButton?: (value: DetailsButton) => void;
    agamaDetailsSize?: (value: DetailsSize) => void;
    agamaSectionTitle?: (value: SectionTitle) => void;
    agamaGroupTitleIcons?: (value: GroupTitleIcons) => void;
    agamaSectionBand?: (value: SectionBand) => void;
    agamaSectionIndent?: (value: SectionIndent) => void;
  }
}

/** A switch as the playground overlay lists it. */
export type PlaygroundSwitch = {
  name: SwitchName;
  values: string[];
  read: () => string;
  write: (value: string) => void;
  subscribe: (onChange: () => void) => () => void;
};

/** Every switch, in the order they are made, for the playground overlay. */
const registry: PlaygroundSwitch[] = [];

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

  const write = (value: T) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn(`Cannot keep ${name}: no local storage`);
    }
    window.dispatchEvent(new Event(event));
  };

  (window as unknown as Record<SwitchName, (input: unknown) => void>)[name] = (input) =>
    write(fromInput(input));

  registry.push({ name, values, read, write: (value) => write(value as T), subscribe });

  return () => React.useSyncExternalStore(subscribe, read);
}

const useGroupedTable = consoleSwitch<GroupedTable>("agamaGroupedTable", ["on", "off"], (input) =>
  input ? "on" : "off",
);

const useGroupTitleStyle = consoleSwitch<GroupTitleStyle>("agamaGroupTitleStyle", [
  "band",
  "flat",
  "plain",
]);

const useNamesStyle = consoleSwitch<NamesStyle>("agamaNamesStyle", ["mono", "plain"]);

const useDetailsButton = consoleSwitch<DetailsButton>("agamaDetailsButton", ["inline", "end"]);
const useDetailsSize = consoleSwitch<DetailsSize>("agamaDetailsSize", ["compact", "regular"]);
const useSectionTitle = consoleSwitch<SectionTitle>("agamaSectionTitle", [
  "plain",
  "spaced",
  "rule",
  "both",
  "grouped",
  "separated",
  "smallcaps",
]);
const useGroupTitleIcons = consoleSwitch<GroupTitleIcons>("agamaGroupTitleIcons", ["off", "on"]);
const useSectionBand = consoleSwitch<SectionBand>("agamaSectionBand", ["none", "fading", "flat"]);
const useSectionIndent = consoleSwitch<SectionIndent>("agamaSectionIndent", [
  "medium",
  "small",
  "none",
]);

export { registry as playgroundSwitches };
export {
  useDetailsButton,
  useDetailsSize,
  useSectionTitle,
  useGroupTitleIcons,
  useSectionBand,
  useSectionIndent,
  useGroupedTable,
  useNamesStyle,
  useGroupTitleStyle,
};
export type { NamesStyle };

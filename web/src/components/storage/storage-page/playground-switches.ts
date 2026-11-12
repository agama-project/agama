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
 * How names (mount points, volume groups) read in the "Used for" column:
 *
 *   agamaNamesStyle("mono")   // in monospace, apart from the words around them (default)
 *   agamaNamesStyle("plain")  // in the same face as the rest
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
 * Choices survive reloads. To be dropped once the design is settled.
 */

import React from "react";

type NamesStyle = "mono" | "plain";
type SectionBand = "none" | "fading" | "flat";
type SectionIndent = "medium" | "small" | "none";
type SectionTitle = "plain" | "spaced" | "rule" | "both" | "grouped" | "separated" | "smallcaps";
type SwitchName =
  "agamaNamesStyle" | "agamaSectionTitle" | "agamaSectionBand" | "agamaSectionIndent";

declare global {
  interface Window {
    agamaNamesStyle?: (value: NamesStyle) => void;
    agamaSectionTitle?: (value: SectionTitle) => void;
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

const useNamesStyle = consoleSwitch<NamesStyle>("agamaNamesStyle", ["mono", "plain"]);

const useSectionTitle = consoleSwitch<SectionTitle>("agamaSectionTitle", [
  "plain",
  "spaced",
  "rule",
  "both",
  "grouped",
  "separated",
  "smallcaps",
]);
const useSectionBand = consoleSwitch<SectionBand>("agamaSectionBand", ["none", "fading", "flat"]);
const useSectionIndent = consoleSwitch<SectionIndent>("agamaSectionIndent", [
  "medium",
  "small",
  "none",
]);

export { registry as playgroundSwitches };
export { useSectionTitle, useSectionBand, useSectionIndent, useNamesStyle };
export type { NamesStyle };

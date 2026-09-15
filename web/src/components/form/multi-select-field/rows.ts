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

/**
 * What a multi select field offers to the keyboard, as plain data.
 *
 * The field has two sequences the user can walk: the rows of the open list,
 * and the stops among the committed values. Both are built here, so the
 * component renders a list it does not have to reason about and the keyboard
 * hook moves along positions without knowing what sits at each one.
 */

import { filterOptions, sanitizeForSearch } from "~/components/form/primitives/option-filter";

import type { ReactNode } from "react";
import type { SearchableOption } from "~/components/form/primitives/option-filter";

/** One of the values the field offers. */
type MultiSelectOption = SearchableOption & {
  /** Shown under the label in the list. Never searched. */
  description?: ReactNode;
  /** Whether the value is offered but cannot be chosen right now. */
  isDisabled?: boolean;
};

/**
 * A row of the open list.
 *
 * `custom` is the row that commits the text as typed, offered when the field
 * accepts values it does not know about. `footer` is the entry that leads
 * somewhere else instead of committing a value.
 */
type OptionRow =
  | { kind: "custom"; text: string }
  | { kind: "option"; option: MultiSelectOption }
  | { kind: "footer" };

/**
 * A stop among the committed values.
 *
 * `index` points into the field value, so a stop survives the values around it
 * being summarized away.
 */
type EntryStop = { kind: "value"; index: number } | { kind: "toggle" };

/** Which values are shown in the control, and how many are summarized away. */
type EntriesLayout = {
  /** Indices into the field value, in the order they are shown. */
  shown: number[];
  /** How many values the summary stands for. Zero means nothing is summarized. */
  hiddenCount: number;
};

type OptionRowsInput = {
  options: MultiSelectOption[];
  /** What the user typed, used both to filter and to offer committing it. */
  text: string;
  /** Match text of the options, from `buildHaystacks`. */
  haystacks: Map<string, string>;
  /** Whether the field accepts a value that is not among the options. */
  allowCustomEntries: boolean;
  /** Whether the list ends with an entry leading somewhere else. */
  hasFooterEntry: boolean;
};

type EntriesLayoutInput = {
  /** The committed values, in order. */
  values: string[];
  /** How many values fit before the rest are summarized. Zero never summarizes. */
  threshold: number;
  /** Whether the user asked for, or is in a position to see, every value. */
  isExpanded: boolean;
  /** Whether a value is one of the options, and so can be found again. */
  isKnown: (value: string) => boolean;
};

/**
 * The option whose label or stored value is exactly `text`, if any.
 *
 * The comparison forgives accents, punctuation and casing, the same way the
 * filter does, so committing the text the user typed picks the option they
 * were looking at rather than adding a near duplicate next to it.
 */
export function findExactOption(
  options: MultiSelectOption[],
  text: string,
): MultiSelectOption | undefined {
  const wanted = sanitizeForSearch(text).trim();
  if (wanted === "") return undefined;

  return options.find(
    (o) =>
      sanitizeForSearch(o.label).trim() === wanted || sanitizeForSearch(o.value).trim() === wanted,
  );
}

/**
 * The rows of the open list for the current text, in the order they are shown.
 *
 * The row committing the text comes first, and only while the text names no
 * option already: offering both would be two rows doing the same thing. The
 * entry leading somewhere else always comes last, so a user who finds nothing
 * still reaches it.
 */
export function buildOptionRows({
  options,
  text,
  haystacks,
  allowCustomEntries,
  hasFooterEntry,
}: OptionRowsInput): OptionRow[] {
  const trimmed = text.trim();
  const rows: OptionRow[] = [];

  if (allowCustomEntries && trimmed !== "" && !findExactOption(options, trimmed)) {
    rows.push({ kind: "custom", text: trimmed });
  }

  for (const option of filterOptions(options, text, haystacks)) {
    rows.push({ kind: "option", option });
  }

  if (hasFooterEntry) rows.push({ kind: "footer" });

  return rows;
}

/** Whether the list would show nothing but the rows that are always there. */
export function hasNoMatches(rows: OptionRow[]): boolean {
  return rows.every((row) => row.kind !== "option");
}

/**
 * Which values the control shows, and how many it summarizes as "N more".
 *
 * Values the field does not know about are never summarized: they exist
 * nowhere else, so a user who loses sight of one cannot get it back from the
 * list. They take their room first, and the known values share what is left,
 * in order.
 */
export function layoutEntries({
  values,
  threshold,
  isExpanded,
  isKnown,
}: EntriesLayoutInput): EntriesLayout {
  const everything = { shown: values.map((_v, index) => index), hiddenCount: 0 };
  if (isExpanded || threshold <= 0 || values.length <= threshold) return everything;

  const typedInCount = values.filter((value) => !isKnown(value)).length;
  let roomForKnown = Math.max(0, threshold - typedInCount);

  const shown = values.reduce<number[]>((kept, value, index) => {
    if (!isKnown(value)) return [...kept, index];
    if (roomForKnown === 0) return kept;
    roomForKnown -= 1;
    return [...kept, index];
  }, []);

  return { shown, hiddenCount: values.length - shown.length };
}

/**
 * The stops among the committed values, in the order the keyboard reaches
 * them: every shown value, then the summary toggle when there is one.
 */
export function buildEntryStops(layout: EntriesLayout, hasToggle: boolean): EntryStop[] {
  const stops: EntryStop[] = layout.shown.map((index) => ({ kind: "value", index }));
  if (hasToggle) stops.push({ kind: "toggle" });
  return stops;
}

export type { EntriesLayout, EntryStop, MultiSelectOption, OptionRow };

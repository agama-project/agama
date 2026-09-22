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
 * Helpers shared by the fields that hold a list of committed values.
 *
 * A value travels the same way in all of them: it arrives as typed or pasted
 * text, gets trimmed and normalized, is checked against what is already there,
 * and ends up as an entry the user can navigate to. These functions cover that
 * journey and the naming of the list the entries live in.
 */

import { fork, sift, unique } from "radashi";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import type { TranslatedString } from "~/i18n";

/**
 * Keys owned by the entry navigation handler when an entry is active.
 *
 * Space is included alongside Enter to match the ARIA listbox pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/listbox/), where both keys
 * activate the focused option. Any key outside this set exits navigation
 * without consuming the event, so Tab moves focus away and regular characters
 * land in the draft input normally.
 */
export const NAVIGATION_KEYS = new Set([
  " ",
  "ArrowLeft",
  "ArrowUp",
  "ArrowRight",
  "ArrowDown",
  "Home",
  "End",
  "Enter",
  "Delete",
  "Backspace",
]);

/** Applies `normalize` to `value` if provided; otherwise returns `value` unchanged. */
export function normalizeValue(value: string, normalize?: (v: string) => string): string {
  return normalize ? normalize(value) : value;
}

/**
 * Names the entries list. An explicit `ariaLabelledBy` replaces the name
 * entirely, same as for the input, and wins over `labelPrefixedBy`. Otherwise
 * the name comes from the hidden phrase referenced by `listboxNameId`, with
 * `labelPrefixedBy` prepending its referenced context, so input and list read
 * consistently.
 */
export function resolveListboxNameProps(
  listboxNameId: string,
  ariaLabelledBy: string | undefined,
  labelPrefixedBy: string | undefined,
): { "aria-labelledby": string } {
  if (ariaLabelledBy) return { "aria-labelledby": ariaLabelledBy };
  return { "aria-labelledby": sift([labelPrefixedBy, listboxNameId]).join(" ") };
}

/**
 * Trims, normalizes, and optionally validates a raw draft string.
 *
 * Returns `null` for empty or whitespace-only input so callers can skip
 * adding an empty entry. Otherwise returns the normalized value and any
 * validation error.
 */
export function processDraft(
  raw: string,
  normalize?: (v: string) => string,
  validate?: (v: string) => string | undefined,
): { normalized: string; error: string | undefined } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = normalizeValue(trimmed, normalize);
  return { normalized, error: validate?.(normalized) };
}

/**
 * The entries a paste brought in that the field would not take as they were.
 *
 * The two fields turn entries down for reasons that do not mean the same
 * thing, so each says so in its own words. `invalid` counts entries that went
 * in and are showing an error; `unavailable` counts entries that never went
 * in, because the field does not offer them. The counts are therefore not
 * comparable, and nothing here adds them up.
 */
type PasteRejection = {
  count: number;
  kind: "invalid" | "unavailable";
};

/**
 * Builds the screen-reader announcement for a multi-entry paste. Pure function.
 *
 * Shared so that the fields holding several values sound like one thing to
 * someone listening: the same sentence for the same outcome, and a sentence of
 * their own only where they really differ.
 */
export function pasteAnnouncement(
  added: number,
  skipped: number,
  rejection: PasteRejection,
): TranslatedString {
  // Only while it is true: an empty paste may have brought nothing in because
  // nothing was on offer, and no duplicate was skipped then.
  if (added === 0 && rejection.count === 0)
    // TRANSLATORS: %d will be replaced with a number of duplicate entries skipped.
    return sprintf(_("%d duplicates skipped."), skipped);

  if (skipped === 0 && rejection.count === 0)
    // TRANSLATORS: %d will be replaced with a number of added entries.
    return sprintf(_("%d entries added."), added);

  if (rejection.count === 0)
    // TRANSLATORS: first %d is the number of added entries, second %d is the number of duplicate entries skipped.
    return sprintf(_("%d entries added, %d duplicates skipped."), added, skipped);

  if (skipped === 0) {
    return rejection.kind === "invalid"
      ? // TRANSLATORS: first %d is the number of added entries, second %d is
        // the number of invalid entries.
        sprintf(_("%d entries added, %d invalid."), added, rejection.count)
      : // TRANSLATORS: first %d is the number of added entries, second %d is
        // how many the field does not offer and left out.
        sprintf(_("%d entries added, %d not available."), added, rejection.count);
  }

  return rejection.kind === "invalid"
    ? // TRANSLATORS: first %d is the number of added entries, second %d is the number of invalid entries, third %d is the number of duplicates skipped.
      sprintf(
        _("%d entries added, %d invalid, %d duplicates skipped."),
        added,
        rejection.count,
        skipped,
      )
    : // TRANSLATORS: first %d is the number of added entries, second %d is how
      // many the field does not offer and left out, third %d is the number of
      // duplicate entries skipped.
      sprintf(
        _("%d entries added, %d not available, %d duplicates skipped."),
        added,
        rejection.count,
        skipped,
      );
}

/**
 * Keeps the entries that pass validation and says how many went.
 *
 * A field can end up holding several entries in error at once, from a paste or
 * from a rule that only speaks up on submit, and taking them out one by one to
 * try again is work the field can do itself. Pure, so each field is left to
 * store the entries it keeps and to announce the sentence its own way.
 *
 * Shared for the same reason as {@link pasteAnnouncement}: the outcome is the
 * same in every field holding a list, so it is worded the same.
 */
export function clearInvalid(
  entries: string[],
  errorFor: (entry: string) => string | undefined,
): { kept: string[]; announcement: TranslatedString } {
  const [kept, removed] = fork(entries, (entry) => !errorFor(entry));

  return {
    kept,
    // TRANSLATORS: screen reader announcement when all invalid entries are
    // cleared at once. %d is the number of removed entries.
    announcement: sprintf(_("%d invalid entries removed."), removed.length),
  };
}

/**
 * Splits pasted text into non-empty entries using the given pattern.
 *
 * Defaults to splitting on whitespace and commas. Blank entries produced
 * by the split are always filtered out.
 */
export function parsePasteEntries(text: string, splitPasteOn?: RegExp | string): string[] {
  return sift(text.split(splitPasteOn ?? /[\s,]+/).map((t) => t.trim()));
}

/**
 * Returns entries from `normalized` not already in `existing`,
 * also deduplicating within `normalized` itself.
 *
 * Prepends `existing` before deduplication so `unique` sees existing entries
 * first and drops any later occurrence of the same value. Slicing off the
 * first `existing.length` elements then yields only the genuinely new entries.
 */
export function filterNew(existing: string[], normalized: string[]): string[] {
  return unique([...existing, ...normalized]).slice(existing.length);
}

export type { PasteRejection };

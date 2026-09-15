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
 * Narrowing a list of options down to what the user typed, for the fields that
 * offer a list to search.
 *
 * The query and the option text are sanitized the same way before they meet,
 * so the comparison is forgiving about accents and punctuation. A field
 * prepares the match text of its options once and reuses it on every keystroke.
 */

/** The parts of an option this module reads. Fields add whatever else they show. */
type SearchableOption = {
  value: string;
  label: string;
  /**
   * The complete text to search for this option, the label included, plus any
   * term that is not visible in it (a code, a territory). Defaults to `label`.
   */
  filterText?: string;
};

/**
 * Rewrites text into the form used for comparison.
 *
 * Accents are dropped so a query without them still matches accented text
 * (typing "ingles" matches "Inglés"), and brackets and list punctuation become
 * spaces so a wrapping character does not glue onto a term and stop it
 * matching. This matters when the committed selection is fed back as the query
 * (browser autocomplete, for one), where "Spanish (Spain)" must still match a
 * match text of "Spanish Spain es_ES". Symbols that carry meaning for the
 * search, such as the +/- of a UTC offset, are left untouched.
 */
export function sanitizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[()[\]{},]+/g, " ");
}

/**
 * Prepares the text each option is matched against, keyed by option value.
 *
 * Built once per list of options so a burst of keystrokes compares against a
 * ready string instead of rebuilding it per option per render.
 */
export function buildHaystacks(options: SearchableOption[]): Map<string, string> {
  return new Map(options.map((o) => [o.value, sanitizeForSearch(o.filterText ?? o.label)]));
}

/**
 * Returns the options matching `query`, or all of them when it holds no terms.
 *
 * Every whitespace-separated term of the query has to appear in the option,
 * in any order, so a query spanning several pieces ("Spanish Argentina") still
 * matches. Pass the map from {@link buildHaystacks} for the same options.
 */
export function filterOptions<T extends SearchableOption>(
  options: T[],
  query: string,
  haystacks: Map<string, string>,
): T[] {
  const terms = sanitizeForSearch(query).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return options;

  return options.filter((o) => {
    const haystack = haystacks.get(o.value) ?? "";
    return terms.every((term) => haystack.includes(term));
  });
}

export type { SearchableOption };

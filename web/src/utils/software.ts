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

import { group, sort } from "radashi";
import type { Pattern } from "~/model/system/software";
import type { PatternsSelection } from "~/model/proposal/software";
import { SelectedBy } from "~/model/proposal/software";

/** PatternGroups mapping "group name" => list of patterns */
type PatternsGroups = { [key: string]: Pattern[] };

/**
 * Groups patterns by category and sorts them by order within each group.
 *
 * @param patterns - Array of patterns to group
 * @returns Object mapping category names to sorted pattern arrays
 */
function groupPatterns(patterns: Pattern[]): PatternsGroups {
  const groups = group(patterns, (p) => p.category);

  // Sort patterns within each group by order, then by name
  Object.keys(groups).forEach((category) => {
    groups[category].sort((p1, p2) => {
      if (p1.order !== p2.order) return p1.order - p2.order;
      return p1.name.localeCompare(p2.name);
    });
  });

  return groups;
}

/**
 * Sorts group names based on the order of their first pattern.
 *
 * @param groups - Pattern groups to sort
 * @returns Array of sorted group names
 */
function sortGroupNames(groups: PatternsGroups): string[] {
  return sort(Object.keys(groups), (groupName) => groups[groupName][0].order);
}

/**
 * Filters patterns by search value (case-insensitive).
 * Searches in both pattern name and description.
 *
 * @param patterns - Array of patterns to filter
 * @param searchValue - Search string to filter by
 * @returns Filtered array of patterns
 */
function filterPatterns(patterns: Pattern[], searchValue = ""): Pattern[] {
  if (searchValue.trim() === "") return patterns;

  const searchData = searchValue.toUpperCase();
  return patterns.filter(
    (p) =>
      p.name.toUpperCase().includes(searchData) || p.description.toUpperCase().includes(searchData),
  );
}

/**
 * Checks if a pattern is selected (either by USER or AUTO).
 *
 * @param selection - Pattern selection state
 * @param patternName - Name of the pattern to check
 * @returns True if the pattern is selected by USER or AUTO
 */
function isPatternSelected(selection: PatternsSelection, patternName: string): boolean {
  const status = selection[patternName];
  return status === SelectedBy.USER || status === SelectedBy.AUTO;
}

export type { PatternsGroups };
export { groupPatterns, sortGroupNames, filterPatterns, isPatternSelected };

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

import { useSearchParamState } from "~/hooks/use-search-param-state";

import type { SelectableDataTableColumn, SortedBy } from "~/components/core/SelectableDataTable";

/** Direction written to the URL only when it is not the one sorting starts at. */
const DEFAULT_DIRECTION = "asc";

/** Separates the column identifier from the direction, as in `channel:desc`. */
const SEPARATOR = ":";

/**
 * Options for `useSortedByParam`.
 */
type SortedByParamOptions = {
  /**
   * Name of the search param holding the sorting.
   *
   * Every table brings its own, from the module where it keeps its param names.
   * Two tables sharing a name would sort each other.
   */
  param: string;
  /** Sorting to use when the param is absent or cannot be understood. */
  defaultValue: SortedBy;
};

/**
 * Identifier of a column for the purpose of addressing it in the URL.
 *
 * A string `sortingKey` already names a field and needs nothing else. A
 * function has no name, so those columns declare a `sortingId`.
 */
function columnId(column: SelectableDataTableColumn): string | undefined {
  if (column.sortingId) return column.sortingId;
  if (typeof column.sortingKey === "string") return column.sortingKey;

  return undefined;
}

/**
 * Keeps the sorting of a table in a URL search param, addressing columns by
 * name instead of by position.
 *
 * A position would be wrong the day a column is inserted, so the param holds
 * the column identifier and, when descending, the direction:
 * `?s=channel:desc`. Ascending is what sorting starts at, so it is left out,
 * and sorting that matches `defaultValue` removes the param altogether.
 *
 * A param naming a column that does not exist, or one that is malformed, reads
 * as `defaultValue`. That way an outdated or hand-edited link still opens the
 * table.
 *
 * Returns what the table already had in its state, so the `SelectableDataTable`
 * call site does not change.
 *
 * @example
 * const [sortedBy, updateSorting] = useSortedByParam(columns, {
 *   param: SORT,
 *   defaultValue: { index: 0, direction: "asc" },
 * });
 *
 * <SelectableDataTable columns={columns} sortedBy={sortedBy} updateSorting={updateSorting} />
 */
function useSortedByParam(
  columns: SelectableDataTableColumn[],
  { param, defaultValue }: SortedByParamOptions,
) {
  const [value, setValue] = useSearchParamState(param);

  const read = (): SortedBy => {
    if (!value) return defaultValue;

    const [id, direction = DEFAULT_DIRECTION] = value.split(SEPARATOR);
    const index = columns.findIndex((column) => columnId(column) === id);

    if (index === -1) return defaultValue;
    if (direction !== "asc" && direction !== "desc") return defaultValue;

    return { index, direction };
  };

  const write = (sortedBy: SortedBy) => {
    const id = columnId(columns[sortedBy.index]);
    const isDefault =
      sortedBy.index === defaultValue.index && sortedBy.direction === defaultValue.direction;

    if (!id || isDefault) {
      setValue(undefined);
      return;
    }

    const direction =
      sortedBy.direction === DEFAULT_DIRECTION ? "" : SEPARATOR + sortedBy.direction;
    setValue(id + direction);
  };

  return [read(), write] as const;
}

export default useSortedByParam;

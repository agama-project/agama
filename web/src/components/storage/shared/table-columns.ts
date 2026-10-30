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

import { css } from "@patternfly/react-styles";
import alignmentStyles from "@patternfly/react-styles/css/utilities/Alignment/alignment";
import type { TdProps } from "@patternfly/react-table";

/**
 * How one column of a storage table looks, said once for the header cell and
 * every cell under it.
 */
export type ColumnLook = {
  /**
   * A rule on the column's starting side, from the header down, setting it
   * apart from the columns before it. Drawn by PatternFly on the inline start,
   * so it stays on the correct side in right-to-left languages.
   */
  hasBorderBefore?: boolean;
  /** Whether the content sits at the end of the cell, as sizes do. */
  isEndAligned?: boolean;
  /**
   * How the column takes its width and wraps, as PatternFly's table cells
   * understand it: `fitContent` for a column as narrow as its content and kept
   * on one line, `nowrap` for one kept on one line at any width.
   */
  modifier?: TdProps["modifier"];
};

/** How a storage table looks as a whole. */
export type TableLook = {
  /** A rule under the header row, setting the column names apart from the rows. */
  hasHeaderRule?: boolean;
  /**
   * Whether the cells of every row are centered vertically in it, rather than
   * placed at its top, for rows where some cells hold more than one line.
   */
  hasVerticallyCenteredRows?: boolean;
};

/**
 * The props that give a storage table its look: no rule under its last row,
 * since whatever follows the table already sets it apart, and, where asked for,
 * a rule under its header row and cells centered vertically in their rows.
 *
 * @example
 * <Table variant="compact" {...tableProps({ hasHeaderRule: true })}>
 */
export function tableProps({
  hasHeaderRule = false,
  hasVerticallyCenteredRows = false,
}: TableLook = {}) {
  return {
    className: css(
      "agm-storage-table",
      hasHeaderRule && "agm-storage-table--header-rule",
      hasVerticallyCenteredRows && "agm-table--vertically-centered-rows",
    ),
  };
}

/**
 * The props that give a header cell or a body cell its column's look.
 *
 * A table defines its columns' looks in one place and spreads these on its
 * `Th` and `Td` cells, so a border, an alignment or a width rule is declared
 * once per column rather than repeated, and forgotten, on some of its cells.
 *
 * @example
 * const COLUMNS = {
 *   size: { isEndAligned: true, modifier: "fitContent" },
 *   action: { hasBorderBefore: true },
 * } satisfies Record<string, ColumnLook>;
 *
 * <Th {...columnProps(COLUMNS.action)}>{_("Action")}</Th>
 * <Td {...columnProps(COLUMNS.action)}>{action}</Td>
 */
export function columnProps({ hasBorderBefore, isEndAligned, modifier }: ColumnLook) {
  return {
    hasLeftBorder: hasBorderBefore || undefined,
    className: isEndAligned ? alignmentStyles.textAlignEnd : undefined,
    modifier,
  };
}

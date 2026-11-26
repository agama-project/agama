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

/** The look of a storage table column, for its header and body cells. */
export type ColumnLook = {
  /** Whether a rule separates the column from the previous one. */
  hasBorderBefore?: boolean;
  /** Whether the content is end aligned, as for sizes. */
  isEndAligned?: boolean;
  /**
   * How the column takes its width: `fitContent` for as narrow as its content,
   * on one line, and `nowrap` for one line at any width.
   */
  modifier?: TdProps["modifier"];
};

/** The look of a storage table. */
export type TableLook = {
  /** Whether a rule separates the header row from the body. */
  hasHeaderRule?: boolean;
  /** Whether row cells are centered vertically, for rows with multi-line cells. */
  hasVerticallyCenteredRows?: boolean;
};

/**
 * The props of a storage table: no rule under its last row, and optionally a
 * rule under the header and vertically centered cells.
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
 * The props of a header or body cell, from the look of its column, so each
 * column look is declared once.
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

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

import React from "react";
import { sprintf } from "sprintf-js";
import { Menu, MenuContent, Popper, SelectList, SelectOption } from "@patternfly/react-core";
import FooterEntryOption, { FOOTER_ENTRY_VALUE } from "~/components/form/FooterEntryOption";
import { hasNoMatches } from "~/components/form/multi-select-rows";
import { _ } from "~/i18n";

import type { FooterEntry } from "~/components/form/FooterEntryOption";
import type { OptionRow } from "~/components/form/multi-select-rows";
import type { TranslatedString } from "~/i18n";

/**
 * Value carried by the row that commits the text as typed. Like the footer
 * entry's, it tells that row apart from the options in the single callback the
 * menu reports activations through, and is never committed to the field.
 */
const CUSTOM_ROW_VALUE = "multi-select-field/custom-row";

function rowValue(row: OptionRow): string {
  if (row.kind === "option") return row.option.value;
  if (row.kind === "custom") return CUSTOM_ROW_VALUE;
  return FOOTER_ENTRY_VALUE;
}

type MultiSelectOptionListProps = {
  /** Element the list hangs from and takes its widest measure from. */
  triggerRef: React.RefObject<HTMLElement>;
  /** Whether the list is on screen. */
  isOpen: boolean;
  /** The rows to show, in order. */
  rows: OptionRow[];
  /** Id of the list itself, which the input points at with `aria-controls`. */
  listboxId: string;
  /** Ids of the elements naming the list, usually the field label. */
  "aria-labelledby": string;
  /** Stable DOM id of the row at a position, for `aria-activedescendant`. */
  rowId: (index: number) => string;
  /** Position of the row the keyboard is on, if any. */
  activeIndex?: number;
  /** The committed values, which the list marks as selected. */
  selected: string[];
  /** Run when a row is activated, by pressing it or with the keyboard. */
  onSelectRow: (row: OptionRow) => void;
  footerEntry?: FooterEntry;
  /** Shown when no option matches. Without it the list hides instead. */
  noResultsText?: TranslatedString;
  /** Tallest the list grows before it scrolls. */
  maxHeight?: string;
};

/**
 * The list of options of a multi select field, floating over the page.
 *
 * It is a listbox taking several values at once: every option says whether it
 * is one of the committed values, and the row the keyboard is on is drawn
 * picked out, since real focus stays in the field's text input.
 *
 * The list hangs from the start of the control rather than from the input, so
 * it stays put as values are added, and it is only as wide as its options
 * need, up to the width of the control. It renders at the end of the document,
 * so whatever follows the field cannot paint over it.
 */
export default function MultiSelectOptionList({
  triggerRef,
  isOpen,
  rows,
  listboxId,
  "aria-labelledby": ariaLabelledBy,
  rowId,
  activeIndex,
  selected,
  onSelectRow,
  footerEntry,
  noResultsText,
  maxHeight = "20rem",
}: MultiSelectOptionListProps) {
  const handleSelect = (value: string) => {
    const row = rows.find((r) => rowValue(r) === value);
    if (row) onSelectRow(row);
  };

  const renderRow = (row: OptionRow, index: number) => {
    const id = rowId(index);
    const isFocused = index === activeIndex;

    if (row.kind === "footer") {
      return (
        <FooterEntryOption
          key="footer"
          entry={footerEntry}
          id={id}
          isFocused={isFocused}
          hasDivider={rows.length > 1}
        />
      );
    }

    if (row.kind === "custom") {
      return (
        <SelectOption key="custom" id={id} value={CUSTOM_ROW_VALUE} isFocused={isFocused}>
          {
            // TRANSLATORS: row that takes the text as typed as one of the
            // field's values, for text naming nothing on offer. %s is that
            // text, and the quotation marks set it apart from the rest.
            sprintf(_('Use "%s"'), row.text)
          }
        </SelectOption>
      );
    }

    return (
      <SelectOption
        key={row.option.value}
        id={id}
        value={row.option.value}
        description={row.option.description}
        isDisabled={row.option.isDisabled}
        isFocused={isFocused}
      >
        {row.option.label}
      </SelectOption>
    );
  };

  const list = (
    // A press anywhere in the list would otherwise take focus off the input,
    // which drives the whole field.
    <div onMouseDown={(e: React.MouseEvent) => e.preventDefault()}>
      <Menu
        role="listbox"
        selected={selected}
        onSelect={(_e, value) => typeof value === "string" && handleSelect(value)}
        isScrollable
      >
        <MenuContent maxMenuHeight={maxHeight}>
          <SelectList id={listboxId} aria-labelledby={ariaLabelledBy} isAriaMultiselectable>
            {noResultsText && hasNoMatches(rows) && (
              <SelectOption isDisabled key="no-results">
                {noResultsText}
              </SelectOption>
            )}
            {rows.map(renderRow)}
          </SelectList>
        </MenuContent>
      </Menu>
    </div>
  );

  return (
    <Popper
      triggerRef={triggerRef}
      popper={list}
      isVisible={isOpen}
      // The list is as wide as its options need, and no wider than the control.
      // PatternFly would otherwise stretch it to the control's width.
      minWidth="auto"
      maxWidth="trigger"
    />
  );
}

export type { MultiSelectOptionListProps };

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
import { Label } from "@patternfly/react-core";
import EntriesListbox from "~/components/form/EntriesListbox";
import FieldEntry from "~/components/form/FieldEntry";
import { _ } from "~/i18n";

import type { EntriesLayout, EntryStop } from "~/components/form/multi-select-rows";
import type { TranslatedString } from "~/i18n";

/** The label standing for the values the control does not show. */
type EntriesSummary = {
  id: string;
  /** How many values it stands for. */
  hiddenCount: number;
  /**
   * Whether every value is shown. Given only when the user can flip the
   * summary, which is also what makes it operable.
   */
  isExpanded?: boolean;
  /** Run when the summary is pressed. */
  onPress: () => void;
  /** Whether the keyboard is on the summary. */
  isActive: boolean;
};

type MultiSelectEntriesProps = {
  /** The field label, which names the list of values as "<label> entries". */
  label: TranslatedString | Exclude<React.ReactNode, string>;
  /** Id of the hidden phrase naming the list. */
  nameId: string;
  "aria-labelledby"?: string;
  labelPrefixedBy?: string;
  /** The committed values, in order. */
  values: string[];
  /** Which values the control shows, and how many it summarizes. */
  layout: EntriesLayout;
  /** Whether a value is one the field offers, drawn filled rather than outlined. */
  isKnown: (value: string) => boolean;
  /** Formats a value for display and for its accessible name. */
  toLabel: (value: string) => string;
  /** The validation error of a value, if it has one. */
  errorFor: (value: string) => string | undefined;
  /** The stop the keyboard is on, if it is among the values. */
  activeStop?: EntryStop;
  /** Stable DOM id of the value at a position, for `aria-activedescendant`. */
  entryId: (index: number) => string;
  /** Run when a value is chosen, by pressing it or with the keyboard. */
  onActivate: (index: number) => void;
  /** Run when a value is removed. */
  onRemove: (index: number) => void;
  /** Widest a value is drawn, in "ch". Longer ones are shortened in the middle. */
  maxEntryWidth?: number;
  /** Stands for the values not shown. Left out when every value is shown. */
  summary?: EntriesSummary;
};

/**
 * The committed values of a multi select field, sitting inside the control
 * before the text input.
 *
 * A value the field offers is drawn filled, one the user typed in is
 * outlined: the second cannot be found again in the list, so it is worth
 * telling apart. Values that do not fit the field's threshold are replaced by
 * a summary, which is the last thing in the row.
 *
 * Only the values form the list; the summary sits beside it, since it is not
 * a value. The list itself lays nothing out, so both share the row the
 * control gives them.
 */
export default function MultiSelectEntries({
  label,
  nameId,
  "aria-labelledby": ariaLabelledBy,
  labelPrefixedBy,
  values,
  layout,
  isKnown,
  toLabel,
  errorFor,
  activeStop,
  entryId,
  onActivate,
  onRemove,
  maxEntryWidth,
  summary,
}: MultiSelectEntriesProps) {
  const activeValueIndex = activeStop?.kind === "value" ? activeStop.index : -1;

  const summaryText = () => {
    if (summary.isExpanded) {
      // TRANSLATORS: press that brings a field back to showing only some of
      // the values it holds.
      return _("Show less");
    }
    // TRANSLATORS: stands for the values a field holds but does not show. %d
    // is how many of them there are.
    return sprintf(_("%d more"), summary.hiddenCount);
  };

  return (
    <div className="agm-field-entries">
      <EntriesListbox
        label={label}
        nameId={nameId}
        aria-labelledby={ariaLabelledBy}
        labelPrefixedBy={labelPrefixedBy}
        className="agm-field-entries__listbox"
      >
        {layout.shown.map((index) => (
          <FieldEntry
            key={index}
            index={index}
            item={values[index]}
            isActive={index === activeValueIndex}
            error={errorFor(values[index])}
            toLabel={toLabel}
            onEdit={onActivate}
            onRemove={onRemove}
            valueId={entryId}
            maxWidth={maxEntryWidth}
            variant={isKnown(values[index]) ? "filled" : "outline"}
          />
        ))}
      </EntriesListbox>
      {summary && (
        <Label
          id={summary.id}
          variant="overflow"
          className={summary.isActive ? "agm-field-focus-ring" : undefined}
          // Not a tab stop: the keyboard reaches it among the values, or never
          // meets it at all when the field expands on focus.
          tabIndex={-1}
          aria-expanded={summary.isExpanded}
          // preventDefault keeps focus in the text input, which drives the
          // whole field.
          onMouseDown={(e: React.MouseEvent) => {
            e.preventDefault();
            summary.onPress();
          }}
        >
          {summaryText()}
        </Label>
      )}
    </div>
  );
}

export type { EntriesSummary, MultiSelectEntriesProps };

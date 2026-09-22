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
import { Label, Truncate } from "@patternfly/react-core";
import { _ } from "~/i18n";

type FieldEntryProps = {
  /** Raw stored value, not necessarily the display form. */
  item: string;
  index: number;
  /** Whether this entry is currently focused during keyboard navigation. */
  isActive: boolean;
  /** Validation error message; undefined means the entry is valid. */
  error?: string;
  /** Formats the raw value for display and aria labels. */
  toLabel: (v: string) => string;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  /** Returns a stable DOM id used for aria-activedescendant. */
  valueId: (index: number) => string;
  /** Maximum width for entries in "ch" units. When undefined, no truncation is applied. */
  maxWidth?: number;
  /**
   * How the entry is drawn. Use "outline" for a value the field cannot offer
   * again, so it reads as something the user brought in themselves. Defaults
   * to "filled", and an entry in error is filled whatever this says.
   */
  variant?: "filled" | "outline";
};

/**
 * A single committed entry, rendered as a listbox option.
 *
 * Both the visual color and the aria-label carry validation state, so
 * sighted and assistive-technology users receive the same information.
 *
 * An entry in error is always filled, so a validation error looks the same
 * wherever it turns up. Outlined only says the field cannot offer the value
 * again, which is the lesser thing to know about a value that is wrong.
 *
 * Belongs inside an {@link EntriesListbox}, which gives the group of entries
 * its role and its name.
 */
export default function FieldEntry({
  item,
  index,
  isActive,
  error,
  toLabel,
  onEdit,
  onRemove,
  valueId,
  maxWidth,
  variant = "filled",
}: FieldEntryProps) {
  // preventDefault keeps focus on the input; the edit moves the value back to draft.
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onEdit(index);
  };

  // preventDefault avoids blur; stopPropagation prevents the span from triggering edit.
  const handleCloseMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(index);
  };

  const labelText = toLabel(item);

  let labelContent: React.ReactNode = labelText;
  if (maxWidth !== undefined) {
    const trailingNumChars = Math.floor(maxWidth / 2);
    labelContent = (
      <Truncate
        content={labelText}
        position="middle"
        trailingNumChars={trailingNumChars}
        maxCharsDisplayed={maxWidth}
      />
    );
  }

  return (
    <span className="agm-field-entry" onMouseDown={handleMouseDown}>
      <Label
        id={valueId(index)}
        className={isActive ? "agm-field-focus-ring" : undefined}
        role="option"
        aria-selected={isActive}
        // TRANSLATORS: accessible label for an invalid entry. First %s is the entry value, second %s is the validation error.
        aria-label={error ? sprintf(_("%s is invalid: %s"), labelText, error) : labelText}
        color={error ? "red" : undefined}
        variant={error ? "filled" : variant}
        closeBtnProps={{
          tabIndex: -1,
          onMouseDown: handleCloseMouseDown,
        }}
        onClose={handleRemove}
        // TRANSLATORS: accessible label for the remove button of an entry. %s is the entry value.
        closeBtnAriaLabel={sprintf(_("Remove %s"), labelText)}
      >
        {labelContent}
      </Label>
    </span>
  );
}

export type { FieldEntryProps };

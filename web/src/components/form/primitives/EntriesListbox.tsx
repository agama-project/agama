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
import Interpolate from "~/components/core/Interpolate";
import { resolveListboxNameProps } from "~/components/form/primitives/entry-helpers";
import { _ } from "~/i18n";
import type { TranslatedString } from "~/i18n";

type EntriesListboxProps = {
  /**
   * The field label, used to name the list as "<label> entries".
   *
   * Takes the same shapes the field label does, so a label built from several
   * nodes still names the list.
   */
  label: TranslatedString | Exclude<React.ReactNode, string>;

  /** Id given to the hidden phrase that names the list. */
  nameId: string;

  /**
   * One or more element IDs whose text replaces the list name entirely, for
   * fields whose input is named that way too, so both read consistently.
   */
  "aria-labelledby"?: string;

  /**
   * One or more element IDs whose text prefixes the list name, for fields
   * whose input is named that way too.
   */
  labelPrefixedBy?: string;

  /** Layout class for the list. Defaults to entries wrapping in rows. */
  className?: string;

  children: React.ReactNode;
};

/**
 * The list of committed values of a field, as an accessible listbox.
 *
 * It carries the name and the role; the entries themselves come from the
 * caller, one {@link FieldEntry} per value. The name is a full phrase built
 * from the field label ("DNS servers entries"), kept in a hidden element so
 * it can be assembled from a label of any shape and still be referenced.
 *
 * The list holds no focus of its own: the field's text input keeps it and
 * points at the active entry through `aria-activedescendant`.
 */
export default function EntriesListbox({
  label,
  nameId,
  "aria-labelledby": ariaLabelledBy,
  labelPrefixedBy,
  className = "agm-field-entries",
  children,
}: EntriesListboxProps) {
  const nameProps = resolveListboxNameProps(nameId, ariaLabelledBy, labelPrefixedBy);

  return (
    <>
      {/* Holds the list name as a full translated phrase built from the
          label, whatever its shape. Hidden: referenced only, never shown. */}
      <span id={nameId} hidden>
        <Interpolate
          // TRANSLATORS: accessible name for the entries list. %s is
          // the field label (e.g. "DNS servers").
          sentence={_("%s entries")}
        >
          {() => label}
        </Interpolate>
      </span>
      <div role="listbox" {...nameProps} className={className}>
        {children}
      </div>
    </>
  );
}

export type { EntriesListboxProps };

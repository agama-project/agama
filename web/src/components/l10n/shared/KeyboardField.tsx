/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import Text from "~/components/core/Text";
import SearchableSelectField from "~/components/form/SearchableSelectField";
import { _ } from "~/i18n";

import type { Keymap } from "~/model/system/l10n";

type KeyboardFieldProps = {
  keymaps: Keymap[];
  /** Help or notice shown below the field. */
  helperText?: React.ReactNode;
  /** Icon leading the helper text, e.g. to mark it as information. */
  helperTextIcon?: React.ReactNode;
};

/**
 * Keyboard layout selector. Each option shows the layout description, with the
 * keymap code below; both are searchable.
 *
 * Holds the keymap id of the field it is rendered for, so it must be used
 * inside a `form.AppField` render prop, whatever the field is called.
 *
 * @example
 * <form.AppField name="keymap">{() => <KeyboardField keymaps={keymaps} />}</form.AppField>
 */
export default function KeyboardField({ keymaps, helperText, helperTextIcon }: KeyboardFieldProps) {
  const options = keymaps.map((keymap) => ({
    value: keymap.id,
    label: keymap.description,
    description: (
      <Text textStyle={["fontSizeXs", "textColorDisabled", "fontFamilyMonospace"]}>
        {keymap.id}
      </Text>
    ),
    filterText: `${keymap.description} ${keymap.id}`,
  }));

  return (
    <SearchableSelectField
      // TRANSLATORS: label for the keyboard layout selector
      label={_("Keyboard")}
      // TRANSLATORS: hint for the keyboard filter input
      placeholder={_("Filter by description or keymap code")}
      // TRANSLATORS: shown when no keyboard layout matches the filter
      noResultsText={_("None of the keymaps match the filter.")}
      clearable
      options={options}
      helperText={helperText}
      helperTextIcon={helperTextIcon}
    />
  );
}

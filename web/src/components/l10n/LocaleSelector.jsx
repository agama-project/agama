/*
 * Copyright (c) [2023-2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { useState } from "react";

import { _ } from "~/i18n";
import { ListSearch, Selector } from "~/components/core";
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/l10n").Locale} Locale
 */

const renderLocaleOption = (locale) => (
  <div data-items-type="agama/locales">
    <div>{locale.name}</div>
    <div>{locale.territory}</div>
    <div>{locale.id}</div>
  </div>
);

/**
 * Component for selecting a locale.
 * @component
 *
 * @param {Object} props
 * @param {string} [props.value] - Id of the currently selected locale.
 * @param {Locale[]} [props.locales] - Locales for selection.
 * @param {(id: string) => void} [props.onChange] - Callback to be called when the selected locale
 *  changes.
 */
export default function LocaleSelector({ value, locales = [], onChange = noop }) {
  const [filteredLocales, setFilteredLocales] = useState(locales);

  const searchHelp = _("Filter by language, territory or locale code");
  const onSelectionChange = (selection) => onChange(selection[0]);

  return (
    <>
      <div className="sticky-top-0">
        <ListSearch placeholder={searchHelp} elements={locales} onChange={setFilteredLocales} />
      </div>
      <Selector
        // FIXME: when filtering, these are not the available locales but the
        // filtered ones.
        aria-label={_("Available locales")}
        selectedIds={value}
        options={filteredLocales}
        renderOption={renderLocaleOption}
        onSelectionChange={onSelectionChange}
      />
    </>
  );
}

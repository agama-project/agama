/*
 * Copyright (c) [2023] SUSE LLC
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
import { ListSearch } from "~/components/core";
import { noop } from "~/utils";

/**
 * @typedef {import ("~/clients/l10n").Locale} Locale
 */

const ListBox = ({ children, ...props }) => <ul role="listbox" {...props}>{children}</ul>;

const ListBoxItem = ({ isSelected, children, onClick, ...props }) => {
  if (isSelected) props['aria-selected'] = true;

  return (
    <li
      role="option"
      onClick={onClick}
      { ...props }
    >
      {children}
    </li>
  );
};

/**
 * Content for a locale item.
 * @component
 *
 * @param {Object} props
 * @param {Locale} props.locale
 */
const LocaleItem = ({ locale }) => {
  return (
    <>
      <div>{locale.name}</div>
      <div>{locale.territory}</div>
      <div data-type="details">{locale.id}</div>
    </>
  );
};

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

  return (
    <>
      <div className="sticky-top-0">
        <ListSearch placeholder={searchHelp} elements={locales} onChange={setFilteredLocales} />
      </div>
      <ListBox aria-label={_("Available locales")} className="stack item-list">
        { filteredLocales.map((locale, index) => (
          <ListBoxItem
            key={`locale-${index}`}
            onClick={() => onChange(locale.id)}
            isSelected={locale.id === value}
            className="cursor-pointer"
            data-type="locale"
          >
            <LocaleItem locale={locale} />
          </ListBoxItem>
        ))}
      </ListBox>
    </>
  );
}

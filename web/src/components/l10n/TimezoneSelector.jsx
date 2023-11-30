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
import { noop, timezoneTime } from "~/utils";

/**
 * @typedef {import ("~/clients/l10n").Timezone} Timezone
 */

const ListBox = ({ children, ...props }) => {
  return (
    <ul data-type="agama/list" data-of="agama/timezones" {...props}>{children}</ul>
  );
};

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

const timezoneDetails = (timezone) => {
  const offset = timezone.utcOffset;

  if (offset === undefined) return timezone.id;

  let utc = "UTC";
  if (offset > 0) utc += `+${offset}`;
  if (offset < 0) utc += `${offset}`;

  return `${timezone.id} ${utc}`;
};

/**
 * Content for a timezone item
 * @component
 *
 * @param {Object} props
 * @param {Timezone} props.timezone
 * @param {Date} props.date - Date to show a time.
 */
const TimezoneItem = ({ timezone, date }) => {
  const [part1, ...restParts] = timezone.parts;
  const time = timezoneTime(timezone.id, { date }) || "";

  return (
    <>
      <div>{part1}</div>
      <div>{restParts.join('-')}</div>
      <div>{time || ""}</div>
      <div>{timezone.details}</div>
    </>
  );
};

/**
 * Component for selecting a timezone.
 * @component
 *
 * @param {Object} props
 * @param {string} [props.value] - Id of the currently selected timezone.
 * @param {Locale[]} [props.timezones] - Timezones for selection.
 * @param {(id: string) => void} [props.onChange] - Callback to be called when the selected timezone
 *  changes.
 */
export default function TimezoneSelector({ value, timezones = [], onChange = noop }) {
  const displayTimezones = timezones.map(t => ({ ...t, details: timezoneDetails(t) }));
  const [filteredTimezones, setFilteredTimezones] = useState(displayTimezones);
  const date = new Date();

  // TRANSLATORS: placeholder text for search input in the timezone selector.
  const helpSearch = _("Filter by territory, time zone code or UTC offset");

  return (
    <>
      <div className="sticky-top-0">
        <ListSearch placeholder={helpSearch} elements={displayTimezones} onChange={setFilteredTimezones} />
      </div>
      <ListBox aria-label={_("Available time zones")} role="listbox">
        { filteredTimezones.map((timezone, index) => (
          <ListBoxItem
            key={`timezone-${index}`}
            onClick={() => onChange(timezone.id)}
            isSelected={timezone.id === value}
            className="cursor-pointer"
          >
            <TimezoneItem timezone={timezone} date={date} />
          </ListBoxItem>
        ))}
      </ListBox>
    </>
  );
}

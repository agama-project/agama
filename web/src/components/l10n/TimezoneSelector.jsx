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
import { noop, timezoneTime } from "~/utils";

/**
 * @typedef {import ("~/client/l10n").Timezone} Timezone
 */

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
  const time = timezoneTime(timezone.id, { date }) || "";

  return (
    <div data-items-type="agama/timezones">
      <div>{timezone.parts.join('-')}</div>
      <div>{timezone.country}</div>
      <div>{time || ""}</div>
      <div>{timezone.details}</div>
    </div>
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
  const onSelectionChange = (selection) => onChange(selection[0]);

  return (
    <>
      <div className="sticky-top-0">
        <ListSearch placeholder={helpSearch} elements={displayTimezones} onChange={setFilteredTimezones} />
      </div>
      <Selector
        // FIXME: when filtering, these are not the available time zones but the
        // filtered ones.
        aria-label={_("Available time zones")}
        selectedIds={[value]}
        onSelectionChange={onSelectionChange}
      >
        { filteredTimezones.map((timezone, index) => (
          <Selector.Option id={timezone.id} key={`timezone-${index}`}>
            <TimezoneItem timezone={timezone} date={date} />
          </Selector.Option>
        ))}
      </Selector>
    </>
  );
}

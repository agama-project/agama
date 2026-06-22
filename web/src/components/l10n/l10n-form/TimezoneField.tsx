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
import { withForm } from "~/hooks/form";
import { defaultOptions } from "./fields";
import { timezoneUtcOffset } from "./transformations";
import { timezoneTime } from "~/utils";
import { _ } from "~/i18n";

import type { Timezone } from "~/model/system/l10n";

type TimezoneFieldProps = { timezones: Timezone[] };

/**
 * Time zone selector for the localization form. Each option shows the time zone
 * territory, with the country, the UTC offset and the current local time below.
 * The territory, country, time zone code and offset are all searchable.
 */
const TimezoneField = withForm({
  ...defaultOptions,
  props: { timezones: [] } as TimezoneFieldProps,
  render: function Render({ form, timezones }) {
    const now = new Date();
    const options = timezones.map((timezone) => {
      const offset = timezoneUtcOffset(timezone.id, now);
      // UTC offset followed by the current local time in the zone. The zone id is
      // not shown (it already reads as the option title) but stays in filterText
      // so it remains searchable.
      const detail = [offset, timezoneTime(timezone.id, now)].filter(Boolean).join(" ");
      // The displayed offset keeps the "UTC" prefix (e.g. "UTC+1") so it reads
      // clearly, but the filter uses only the numeric part (e.g. "+1"). Otherwise
      // every zone would carry "UTC" and typing "UTC" would match them all, hiding
      // the actual UTC zone (still findable here via its id and parts). Filtering
      // by offset, e.g. "+1", keeps working.
      const offsetFilter = offset.replace("UTC", "");

      return {
        value: timezone.id,
        label: timezone.parts.join(" / "),
        description: (
          <>
            {timezone.country}{" "}
            <Text textStyle={["fontSizeXs", "fontFamilyMonospace"]}>{detail}</Text>
          </>
        ),
        filterText: `${timezone.parts.join(" ")} ${timezone.country} ${timezone.id} ${offsetFilter}`,
      };
    });

    return (
      <form.AppField name="timezone">
        {(field) => (
          <field.SearchableSelectField
            // TRANSLATORS: label for the time zone selector
            label={_("Time zone")}
            // TRANSLATORS: hint for the time zone filter input
            placeholder={_("Filter by territory, time zone code or UTC offset")}
            // TRANSLATORS: shown when no time zone matches the filter
            noResultsText={_("None of the time zones match the filter.")}
            clearable
            options={options}
          />
        )}
      </form.AppField>
    );
  },
});

export default TimezoneField;

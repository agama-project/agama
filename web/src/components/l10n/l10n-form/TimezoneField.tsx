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
import { formatUtcOffset } from "./transformations";
import { _ } from "~/i18n";

import type { Timezone } from "~/model/system/l10n";

type TimezoneFieldProps = { timezones: Timezone[] };

/**
 * Time zone selector for the localization form. Each option shows the time zone
 * territory, with the country, time zone code and UTC offset below; all are
 * searchable.
 */
const TimezoneField = withForm({
  ...defaultOptions,
  props: { timezones: [] } as TimezoneFieldProps,
  render: function Render({ form, timezones }) {
    const options = timezones.map((timezone) => {
      const offset = formatUtcOffset(timezone.utcOffset);
      const code = offset ? `${timezone.id} ${offset}` : timezone.id;

      return {
        value: timezone.id,
        label: timezone.parts.join(" / "),
        description: (
          <>
            <Text textStyle="textColorRegular">{timezone.country}</Text>{" "}
            <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{code}</Text>
          </>
        ),
        filterText: `${timezone.parts.join(" ")} ${timezone.country} ${code}`,
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

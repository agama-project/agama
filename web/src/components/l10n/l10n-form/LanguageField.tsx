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
import { _ } from "~/i18n";

import type { Locale } from "~/model/system/l10n";

type LanguageFieldProps = { locales: Locale[] };

/**
 * Language selector for the localization form. Each option shows the language
 * name, with the territory and locale code below; all three are searchable.
 */
const LanguageField = withForm({
  ...defaultOptions,
  props: { locales: [] } as LanguageFieldProps,
  render: function Render({ form, locales }) {
    const options = locales.map((locale) => ({
      value: locale.id,
      label: locale.language,
      description: (
        <>
          <Text textStyle="textColorRegular">{locale.territory}</Text>{" "}
          <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{locale.id}</Text>
        </>
      ),
      filterText: `${locale.language} ${locale.territory} ${locale.id}`,
    }));

    return (
      <form.AppField name="language">
        {(field) => (
          <field.SearchableSelectField
            // TRANSLATORS: label for the system language selector
            label={_("Language")}
            // TRANSLATORS: hint for the language filter input
            placeholder={_("Filter by language, territory or locale code")}
            // TRANSLATORS: shown when no language matches the filter
            noResultsText={_("None of the locales match the filter.")}
            clearable
            selectedLabel={(option) => {
              const locale = locales.find((l) => l.id === option.value);
              return locale ? `${locale.language} (${locale.territory})` : option.label;
            }}
            options={options}
          />
        )}
      </form.AppField>
    );
  },
});

export default LanguageField;

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

import React, { useMemo } from "react";
import { NestedContent } from "~/components/core";
import { systemFormOptions } from "~/components/system/SystemPage";
import { withForm } from "~/hooks/form";
import { useSystem } from "~/hooks/model/system/l10n";
import { _ } from "~/i18n";

/**
 * Language and region configuration section for the system settings form.
 *
 * Allows choosing language (locale), keyboard layout (keymap), and timezone.
 *
 * Receives a typed form instance via `withForm`.
 */
const L10nSettings = withForm({
  ...systemFormOptions,
  render: function Render({ form }) {
    const l10nSystem = useSystem();

    const localeOptions = useMemo(
      () =>
        (l10nSystem?.locales || []).map((locale) => ({
          value: locale.id,
          label: locale.language,
          description: locale.territory,
        })),
      [l10nSystem?.locales],
    );

    const keymapOptions = useMemo(
      () =>
        (l10nSystem?.keymaps || []).map((keymap) => ({
          value: keymap.id,
          label: keymap.description,
        })),
      [l10nSystem?.keymaps],
    );

    const timezoneOptions = useMemo(
      () =>
        (l10nSystem?.timezones || []).map((timezone) => ({
          value: timezone.id,
          label: timezone.parts.join(" / "),
          description: timezone.country,
        })),
      [l10nSystem?.timezones],
    );

    return (
      <fieldset>
        <legend>
          {
            // TRANSLATORS: fieldset legend for language and region configuration
            _("Language and Region")
          }
        </legend>
        <NestedContent margin="mxLg">
          <form.AppField name="locale">
            {(field) => (
              <field.SearchableSelectField
                // TRANSLATORS: label for language selector
                label={_("Language")}
                options={localeOptions}
              />
            )}
          </form.AppField>

          <form.AppField name="keymap">
            {(field) => (
              <field.SearchableSelectField
                // TRANSLATORS: label for keyboard layout selector
                label={_("Keyboard")}
                options={keymapOptions}
              />
            )}
          </form.AppField>

          <form.AppField name="timezone">
            {(field) => (
              <field.SearchableSelectField
                // TRANSLATORS: label for timezone selector
                label={_("Time zone")}
                options={timezoneOptions}
              />
            )}
          </form.AppField>
        </NestedContent>
      </fieldset>
    );
  },
});

export default L10nSettings;

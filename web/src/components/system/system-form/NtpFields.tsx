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
import { Fieldset } from "~/components/form/Fieldset";
import { defaultOptions, NTP_MODE, isValidNtpServer } from "./fields";
import { withForm } from "~/hooks/form";
import { _ } from "~/i18n";

/**
 * NTP configuration section for the system settings form.
 *
 * Allows choosing between default NTP servers (product defaults) or custom
 * servers specified by the user.
 *
 * Receives a typed form instance via `withForm`.
 */
const NtpFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <Fieldset
        legend={
          // TRANSLATORS: fieldset legend for NTP configuration
          _("Time Synchronization Servers")
        }
        description={
          // TRANSLATORS: explanatory text for NTP configuration
          _(
            "Configure the Network Time Protocol (NTP) servers used to set the system date and time.",
          )
        }
      >
        <form.AppField name="ntpMode">
          {(field) => (
            <field.DropdownField
              // TRANSLATORS: label for NTP mode selector
              label={_("Mode")}
              options={[
                {
                  value: NTP_MODE.DEFAULT,
                  // TRANSLATORS: NTP mode option
                  label: _("Default"),
                  // TRANSLATORS: description for default NTP mode
                  description: _("Use product's default NTP servers"),
                },
                {
                  value: NTP_MODE.CUSTOM,
                  // TRANSLATORS: NTP mode option
                  label: _("Custom"),
                  // TRANSLATORS: description for custom NTP mode
                  description: _("Set NTP servers manually"),
                },
              ]}
            />
          )}
        </form.AppField>

        <form.Subscribe selector={(s) => s.values.ntpMode}>
          {(ntpMode) =>
            ntpMode === NTP_MODE.CUSTOM && (
              <form.AppField name="ntpServers">
                {(field) => (
                  <field.ArrayField
                    // TRANSLATORS: label for NTP servers input field
                    label={_("Server addresses")}
                    // TRANSLATORS: helper text for NTP servers input field
                    helperText={_(
                      "Hostnames, IP addresses, or fully qualified domain names (FQDNs). E.g., pool.ntp.org",
                    )}
                    skipDuplicates
                    validateOnSubmit={(v) =>
                      // TRANSLATORS: validation error for an invalid NTP server address entry
                      isValidNtpServer(v) ? undefined : _("Invalid NTP server address")
                    }
                  />
                )}
              </form.AppField>
            )
          }
        </form.Subscribe>
      </Fieldset>
    );
  },
});

export default NtpFields;

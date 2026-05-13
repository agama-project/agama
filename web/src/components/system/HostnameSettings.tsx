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
import { Alert, Content, Flex } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import { Fieldset } from "~/components/form/Fieldset";
import { systemFormOptions } from "~/components/system/SystemPage";
import { withForm } from "~/hooks/form";
import { useSystem } from "~/hooks/model/system";
import { _ } from "~/i18n";

const HOSTNAME_MODE = {
  TRANSIENT: "transient",
  STATIC: "static",
} as const;

/**
 * Displays helper text explaining transient hostname behavior.
 */
function TransientModeHelperText() {
  return (
    <Content>
      <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
        <Icon name="emergency" />
        <Interpolate
          sentence={
            // TRANSLATORS: explanation of transient hostname behavior.
            // Text in square brackets will be displayed in bold.
            _("Hostname is dynamic and [may change after a reboot or network update].")
          }
        >
          {(text) => (
            <Text component="strong" isBold>
              {text}
            </Text>
          )}
        </Interpolate>
      </Flex>
    </Content>
  );
}

/**
 * Displays helper text explaining that a static hostname will persist across
 * reboots and network changes.
 */
function StaticModeHelperText() {
  return (
    <Content>
      <Interpolate
        sentence={
          // TRANSLATORS: helper text for static hostname input.
          // Text in square brackets will be displayed in bold.
          _("Hostname [will remain unchanged] across reboots and network changes.")
        }
      >
        {(text) => (
          <Text component="strong" isBold>
            {text}
          </Text>
        )}
      </Interpolate>
    </Content>
  );
}

/**
 * Hostname configuration section for the system settings form.
 *
 * Allows choosing between transient (network-provided) and static
 * (user-defined) hostname modes.
 *
 * Receives a typed form instance via `withForm`.
 */
const HostnameSettings = withForm({
  ...systemFormOptions,
  render: function Render({ form }) {
    const { software } = useSystem();

    return (
      <Fieldset
        legend={
          // TRANSLATORS: fieldset legend for hostname configuration
          _("Hostname")
        }
      >
        <Flex alignItems={{ default: "alignItemsFlexStart" }} gap={{ default: "gapMd" }}>
          <form.AppField name="hostnameMode">
            {(field) => (
              <field.DropdownField
                // TRANSLATORS: label for hostname mode selector
                label={_("Mode")}
                options={[
                  {
                    value: HOSTNAME_MODE.TRANSIENT,
                    // TRANSLATORS: hostname mode option
                    label: _("Transient"),
                    // TRANSLATORS: description for transient hostname mode
                    description: _("Provided by the network"),
                  },
                  {
                    value: HOSTNAME_MODE.STATIC,
                    // TRANSLATORS: hostname mode option
                    label: _("Static"),
                    // TRANSLATORS: description for static hostname mode
                    description: _("Set manually"),
                  },
                ]}
              />
            )}
          </form.AppField>

          <form.Subscribe selector={(s) => s.values.hostnameMode}>
            {(mode) =>
              mode === HOSTNAME_MODE.TRANSIENT ? (
                <form.AppField name="hostnameValue">
                  {(field) => (
                    <field.ReadOnlyField
                      // TRANSLATORS: label for hostname value display
                      label={_("Name")}
                    />
                  )}
                </form.AppField>
              ) : (
                <form.AppField name="hostnameValue">
                  {(field) => (
                    <field.TextField
                      // TRANSLATORS: label for hostname input
                      label={_("Name")}
                    />
                  )}
                </form.AppField>
              )
            }
          </form.Subscribe>
        </Flex>

        {/* TODO: Move this to a global ARIA live region once the application-wide
            announcement mechanism is implemented. This local aria-live works but
            a centralized approach would be more maintainable and consistent. */}
        <form.Subscribe selector={(s) => s.values.hostnameMode}>
          {(mode) => (
            <div aria-live="polite">
              {mode === HOSTNAME_MODE.TRANSIENT ? (
                <TransientModeHelperText />
              ) : (
                <StaticModeHelperText />
              )}
            </div>
          )}
        </form.Subscribe>

        {software?.registration && (
          <Alert
            isInline
            variant="info"
            // TRANSLATORS: alert title warning about registered hostname not changing
            title={_("Registered hostname will not change")}
          >
            {
              // TRANSLATORS: explanation why registered hostname cannot be changed
              _(
                "The product is already registered. Hostname changes will not affect the hostname stored at the registration server.",
              )
            }
          </Alert>
        )}
      </Fieldset>
    );
  },
});

export default HostnameSettings;

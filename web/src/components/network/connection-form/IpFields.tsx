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
import NestedContent from "~/components/core/NestedContent";
import LabelText from "~/components/form/LabelText";
import { defaultOptions, FormIpMode, ADDRESS_REQUIRED_MODES } from "./fields";
import { withForm } from "~/hooks/form";
import { ensureIPPrefix, isValidIPv4Address, isValidIPv6Address } from "~/utils/network";
import { _, N_ } from "~/i18n";

/**
 * Mode options shared by both IPv4 and IPv6 settings.
 *
 * - AUTO: method set to auto; the network handles IP configuration
 *   automatically. No address/gateway fields shown.
 * - ADVANCED_AUTO: method set to auto with required static addresses and
 *   optional gateway, combining automatic and manual addressing.
 * - MANUAL: method set to manual, with required addresses and required gateway.
 *
 * Labels and descriptions use `N_()` for extraction and `_()` at render time.
 */
const modeOptions = () => [
  {
    value: FormIpMode.AUTO,
    // TRANSLATORS: option label for automatic IP configuration.
    label: N_("Automatic"),
    // TRANSLATORS: description for automatic IP configuration mode.
    description: N_("Address and gateway assigned from the network"),
  },
  {
    value: FormIpMode.ADVANCED_AUTO,
    // TRANSLATORS: option label for advanced automatic IP configuration with static addresses.
    label: N_("Automatic + manual"),
    // TRANSLATORS: description for advanced automatic mode with static addresses.
    description: N_("Configuration from the network plus static addresses and gateway"),
  },
  {
    value: FormIpMode.MANUAL,
    // TRANSLATORS: option label for manual IP configuration
    label: N_("Manual"),
    // TRANSLATORS: description for manual IP configuration mode.
    description: N_("Static addresses and gateway"),
  },
];

type IpFieldsProps = {
  protocol: "ipv4" | "ipv6";
};

/**
 * Protocol-specific IP fields for a connection form.
 *
 * Shows a selector with three options: Automatic, Manual, and Advanced.
 *
 * Receives a typed form instance via `withForm`.
 *
 * @remarks
 * Field labels are prefixed with the protocol name (e.g. "IPv4 Gateway"
 * instead of "Gateway") because both protocols can be visible at the same
 * time. Without the prefix, a screen reader navigating between controls loses
 * the context that sighted users get from the visual grouping. Prefixing makes
 * each label self-sufficient for both audiences, as recommended by WCAG 2.4.6.
 * @see https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html
 */
const IpFields = withForm({
  ...defaultOptions,
  props: {
    protocol: "ipv4",
  } as IpFieldsProps,
  render: function Render({ form, protocol }) {
    const isIPv4 = protocol === "ipv4";
    // TRANSLATORS: label for the IPv4 or IPv6 settings dropdown.
    const label = isIPv4 ? _("IPv4 Settings") : _("IPv6 Settings");
    // TRANSLATORS: label for the IP addresses field.
    const addressesLabel = isIPv4 ? _("IPv4 Addresses") : _("IPv6 Addresses");
    // TRANSLATORS: label for the IP gateway field.
    const gatewayLabel = isIPv4 ? _("IPv4 Gateway") : _("IPv6 Gateway");
    const modeField = isIPv4 ? "ipv4Mode" : "ipv6Mode";
    const addressesField = isIPv4 ? "addresses4" : "addresses6";
    const gatewayField = isIPv4 ? "gateway4" : "gateway6";

    return (
      <>
        <form.AppField name={modeField}>
          {(field) => (
            <field.DropdownField
              label={label}
              options={modeOptions().map(({ value, label, description }) => ({
                value,
                // eslint-disable-next-line agama-i18n/string-literals
                label: _(label),
                // eslint-disable-next-line agama-i18n/string-literals
                description: _(description),
              }))}
            />
          )}
        </form.AppField>

        <form.Subscribe selector={(s) => s.values[modeField]}>
          {(mode) =>
            ADDRESS_REQUIRED_MODES.includes(mode) && (
              <NestedContent margin="mxLg">
                <form.AppField name={addressesField}>
                  {(field) => (
                    <field.ArrayField
                      label={addressesLabel}
                      inputAriaLabel={addressesLabel}
                      skipDuplicates
                      normalize={ensureIPPrefix}
                      helperText={
                        isIPv4
                          ? // TRANSLATORS: helper text for IPv4 addresses field. Explains format and that prefix is auto-added.
                            _("E.g., 192.168.1.1 or 192.168.1.1/24. Prefix auto-added if omitted.")
                          : // TRANSLATORS: helper text for IPv6 addresses field. Explains format and that prefix is auto-added.
                            _("E.g., 2001:db8::1 or 2001:db8::1/64. Prefix auto-added if omitted.")
                      }
                      validateOnSubmit={(v) => {
                        if (isIPv4 ? isValidIPv4Address(v) : isValidIPv6Address(v))
                          return undefined;
                        // TRANSLATORS: validation error for an invalid IP address entry.
                        return isIPv4 ? _("Invalid IPv4 address") : _("Invalid IPv6 address");
                      }}
                    />
                  )}
                </form.AppField>

                <form.AppField name={gatewayField}>
                  {(field) => (
                    <field.TextField
                      label={
                        mode === FormIpMode.ADVANCED_AUTO ? (
                          // TRANSLATORS: label suffix indicating an optional field.
                          <LabelText suffix={_("(optional)")}>{gatewayLabel}</LabelText>
                        ) : (
                          gatewayLabel
                        )
                      }
                      helperText={
                        isIPv4
                          ? // TRANSLATORS: helper text for IPv4 gateway field explaining the format.
                            _("E.g., 192.168.1.1")
                          : // TRANSLATORS: helper text for IPv6 gateway field explaining the format.
                            _("E.g., 2001:db8::1")
                      }
                    />
                  )}
                </form.AppField>
              </NestedContent>
            )
          }
        </form.Subscribe>
      </>
    );
  },
});

export default IpFields;

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

/**
 * Form IP mode values.
 *
 * These control UI behavior (which fields are shown) and map to ConnectionMethod:
 * - AUTO: no address/gateway fields shown → ConnectionMethod.AUTO
 * - ADVANCED_AUTO: addresses required, gateway optional → ConnectionMethod.AUTO
 * - MANUAL: addresses and gateway required → ConnectionMethod.MANUAL
 */
export const FormIpMode = {
  AUTO: "auto",
  ADVANCED_AUTO: "advanced-auto",
  MANUAL: "manual",
} as const;

export type FormIpMode = (typeof FormIpMode)[keyof typeof FormIpMode];

/**
 * Modes that require at least one address to be provided.
 */
export const ADDRESS_REQUIRED_MODES: readonly FormIpMode[] = [
  FormIpMode.MANUAL,
  FormIpMode.ADVANCED_AUTO,
];

/**
 * Default values for IP settings fields.
 */
export const ipDefaults = {
  ipv4Mode: FormIpMode.AUTO as FormIpMode,
  addresses4: [] as string[],
  gateway4: "",
  ipv6Mode: FormIpMode.AUTO as FormIpMode,
  addresses6: [] as string[],
  gateway6: "",
  nameservers: [] as string[],
  dnsSearchList: [] as string[],
  customDns: false,
  customDnsSearch: false,
};

import * as v from "valibot";
import {
  isValidIPv4Address,
  isValidIPv6Address,
  isValidIPv4,
  isValidIPv6,
  isValidNameserver,
  isValidDNSSearchDomain,
} from "~/utils/network";
import { _ } from "~/i18n";

/**
 * Validation schema for IP settings fields with cross-field validation.
 *
 * Returns a function to defer i18n initialization.
 */
export const ipSchema = () =>
  v.pipe(
    v.object({
      ipv4Mode: v.string(),
      addresses4: v.array(v.string()),
      gateway4: v.string(),
      ipv6Mode: v.string(),
      addresses6: v.array(v.string()),
      gateway6: v.string(),
      nameservers: v.array(v.string()),
      dnsSearchList: v.array(v.string()),
      customDns: v.boolean(),
      customDnsSearch: v.boolean(),
    }),
    v.forward(
      v.check(
        ({ ipv4Mode, addresses4 }) => {
          const required = ADDRESS_REQUIRED_MODES.includes(ipv4Mode as FormIpMode);
          return !required || addresses4.length > 0;
        },
        // TRANSLATORS: validation error for the IPv4 addresses field.
        _("At least one IPv4 address is required"),
      ),
      ["addresses4"],
    ),
    v.forward(
      v.check(
        ({ ipv4Mode, addresses4 }) => {
          const required = ADDRESS_REQUIRED_MODES.includes(ipv4Mode as FormIpMode);
          const active = required || addresses4.length > 0;
          return !active || addresses4.every((a) => isValidIPv4Address(a));
        },
        // TRANSLATORS: validation error for the IPv4 addresses field.
        _("Some IPv4 addresses are invalid"),
      ),
      ["addresses4"],
    ),
    v.forward(
      v.check(
        ({ ipv4Mode, gateway4 }) => {
          return ipv4Mode !== FormIpMode.MANUAL || gateway4.length > 0;
        },
        // TRANSLATORS: validation error for the IPv4 gateway field.
        _("IPv4 gateway is required"),
      ),
      ["gateway4"],
    ),
    v.forward(
      v.check(
        ({ ipv4Mode, gateway4 }) => {
          const mode = ipv4Mode as FormIpMode;
          return (
            !gateway4 ||
            (mode !== FormIpMode.MANUAL && mode !== FormIpMode.ADVANCED_AUTO) ||
            isValidIPv4(gateway4)
          );
        },
        // TRANSLATORS: validation error for the IPv4 gateway field.
        _("Invalid IPv4 gateway"),
      ),
      ["gateway4"],
    ),
    v.forward(
      v.check(
        ({ ipv6Mode, addresses6 }) => {
          const required = ADDRESS_REQUIRED_MODES.includes(ipv6Mode as FormIpMode);
          return !required || addresses6.length > 0;
        },
        // TRANSLATORS: validation error for the IPv6 addresses field.
        _("At least one IPv6 address is required"),
      ),
      ["addresses6"],
    ),
    v.forward(
      v.check(
        ({ ipv6Mode, addresses6 }) => {
          const required = ADDRESS_REQUIRED_MODES.includes(ipv6Mode as FormIpMode);
          const active = required || addresses6.length > 0;
          return !active || addresses6.every((a) => isValidIPv6Address(a));
        },
        // TRANSLATORS: validation error for the IPv6 addresses field.
        _("Some IPv6 addresses are invalid"),
      ),
      ["addresses6"],
    ),
    v.forward(
      v.check(
        ({ ipv6Mode, gateway6 }) => {
          return ipv6Mode !== FormIpMode.MANUAL || gateway6.length > 0;
        },
        // TRANSLATORS: validation error for the IPv6 gateway field.
        _("IPv6 gateway is required"),
      ),
      ["gateway6"],
    ),
    v.forward(
      v.check(
        ({ ipv6Mode, gateway6 }) => {
          const mode = ipv6Mode as FormIpMode;
          return (
            !gateway6 ||
            (mode !== FormIpMode.MANUAL && mode !== FormIpMode.ADVANCED_AUTO) ||
            isValidIPv6(gateway6)
          );
        },
        // TRANSLATORS: validation error for the IPv6 gateway field.
        _("Invalid IPv6 gateway"),
      ),
      ["gateway6"],
    ),
    v.forward(
      v.check(
        ({ customDns, nameservers }) => !customDns || nameservers.length > 0,
        // TRANSLATORS: validation error for the DNS servers field.
        _("At least one DNS server is required"),
      ),
      ["nameservers"],
    ),
    v.forward(
      v.check(
        ({ customDns, nameservers }) =>
          !customDns || nameservers.every((s) => isValidNameserver(s)),
        // TRANSLATORS: validation error for the DNS servers field.
        _("Some DNS server addresses are invalid"),
      ),
      ["nameservers"],
    ),
    v.forward(
      v.check(
        ({ customDnsSearch, dnsSearchList }) => !customDnsSearch || dnsSearchList.length > 0,
        // TRANSLATORS: validation error for the DNS search domains field.
        _("At least one DNS search domain is required"),
      ),
      ["dnsSearchList"],
    ),
    v.forward(
      v.check(
        ({ customDnsSearch, dnsSearchList }) =>
          !customDnsSearch || dnsSearchList.every((d) => isValidDNSSearchDomain(d)),
        // TRANSLATORS: validation error for the DNS search domains field.
        _("Some DNS search domains are invalid"),
      ),
      ["dnsSearchList"],
    ),
  );

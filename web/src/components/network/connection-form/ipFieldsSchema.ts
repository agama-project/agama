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

import { _ } from "~/i18n";
import {
  isValidIPv4Address,
  isValidIPv6Address,
  isValidIPv4,
  isValidIPv6,
  isValidNameserver,
  isValidDNSSearchDomain,
} from "~/utils/network";
import {
  requiredValidArray,
  optionalValidArray,
  requiredValidString,
  optionalValidString,
  string,
  boolean,
  stringArray,
} from "~/components/form/validation-helpers";

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

type IpSchemaInput = {
  ipv4Mode: FormIpMode;
  ipv6Mode: FormIpMode;
  customDns: boolean;
  customDnsSearch: boolean;
};

/**
 * Validation schema entries for IP settings fields.
 *
 * All conditionality — address requirements, gateway optionality, DNS
 * activation — is resolved at construction time based on the current form
 * state, not encoded as cross-field rules at validation time. This keeps
 * the schema readable and avoids partialCheck for cases that are not
 * genuinely cross-field.
 *
 * Factory function accepts current form values to derive the correct
 * validation rules for the active modes.
 */
export const IpSchema = ({ ipv4Mode, ipv6Mode, customDns, customDnsSearch }: IpSchemaInput) => {
  const addressSchema = (
    mode: FormIpMode,
    isValid: (s: string) => boolean,
    emptyMessage: string,
    invalidMessage: string,
  ) =>
    ADDRESS_REQUIRED_MODES.includes(mode)
      ? requiredValidArray(isValid, emptyMessage, invalidMessage)
      : optionalValidArray(isValid, invalidMessage);

  const gatewaySchema = (
    mode: FormIpMode,
    isValid: (s: string) => boolean,
    emptyMessage: string,
    invalidMessage: string,
  ) => {
    if (mode === FormIpMode.MANUAL)
      return requiredValidString(isValid, emptyMessage, invalidMessage);
    if (mode === FormIpMode.ADVANCED_AUTO) return optionalValidString(isValid, invalidMessage);
    return string(); // AUTO — not validated
  };

  return {
    ipv4Mode: string(),
    // TRANSLATORS: validation error for the IPv4 addresses field.
    addresses4: addressSchema(
      ipv4Mode,
      isValidIPv4Address,
      _("At least one IPv4 address is required"),
      _("Some IPv4 addresses are invalid"),
    ),
    // TRANSLATORS: validation error for the IPv4 gateway field.
    gateway4: gatewaySchema(
      ipv4Mode,
      isValidIPv4,
      _("IPv4 gateway is required"),
      _("Invalid IPv4 gateway"),
    ),
    ipv6Mode: string(),
    // TRANSLATORS: validation error for the IPv6 addresses field.
    addresses6: addressSchema(
      ipv6Mode,
      isValidIPv6Address,
      _("At least one IPv6 address is required"),
      _("Some IPv6 addresses are invalid"),
    ),
    // TRANSLATORS: validation error for the IPv6 gateway field.
    gateway6: gatewaySchema(
      ipv6Mode,
      isValidIPv6,
      _("IPv6 gateway is required"),
      _("Invalid IPv6 gateway"),
    ),
    // DNS fields: only validated when the corresponding toggle is on.
    // Resolved at construction time — no cross-field rule needed.
    nameservers: customDns
      ? // TRANSLATORS: validation error for the DNS servers field.
        requiredValidArray(
          isValidNameserver,
          _("At least one DNS server is required"),
          _("Some DNS server addresses are invalid"),
        )
      : stringArray(),
    dnsSearchList: customDnsSearch
      ? // TRANSLATORS: validation error for the DNS search domains field.
        requiredValidArray(
          isValidDNSSearchDomain,
          _("At least one DNS search domain is required"),
          _("Some DNS search domains are invalid"),
        )
      : stringArray(),
    customDns: boolean(),
    customDnsSearch: boolean(),
  };
};

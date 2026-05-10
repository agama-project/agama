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
  requiredValidList,
  optionalValidList,
  requiredValidString,
  optionalValidString,
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

type IpFields = {
  ipv4Mode: FormIpMode;
  addresses4: string[];
  gateway4: string;
  ipv6Mode: FormIpMode;
  addresses6: string[];
  gateway6: string;
  nameservers: string[];
  dnsSearchList: string[];
  customDns: boolean;
  customDnsSearch: boolean;
};

/**
 * Helper for mode-dependent address validation.
 *
 * In MANUAL and ADVANCED_AUTO modes, at least one address is required.
 * In AUTO mode, addresses are optional (system handles them).
 */
const validateAddresses = (
  mode: FormIpMode,
  addresses: string[],
  isValid: (s: string) => boolean,
  emptyMessage: string,
  invalidMessage: string,
) =>
  ADDRESS_REQUIRED_MODES.includes(mode)
    ? requiredValidList(addresses, isValid, emptyMessage, invalidMessage)
    : optionalValidList(addresses, isValid, invalidMessage);

/**
 * Helper for mode-dependent gateway validation.
 *
 * In MANUAL mode, gateway is required.
 * In ADVANCED_AUTO mode, gateway is optional.
 * In AUTO mode, gateway is not validated (system handles it).
 */
const validateGateway = (
  mode: FormIpMode,
  gateway: string,
  isValid: (s: string) => boolean,
  emptyMessage: string,
  invalidMessage: string,
) => {
  if (mode === FormIpMode.MANUAL)
    return requiredValidString(gateway, isValid, emptyMessage, invalidMessage);
  if (mode === FormIpMode.ADVANCED_AUTO)
    return optionalValidString(gateway, isValid, invalidMessage);
  return undefined;
};

/**
 * Default values for IP settings fields.
 */
export const defaultValues = {
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

/**
 * Validation for IP settings fields.
 *
 * All conditionality — address requirements, gateway optionality, DNS
 * activation — is resolved at call time based on the current form
 * state, not encoded as cross-field rules at validation time.
 *
 * Uses module-level helpers (validateAddresses, validateGateway) to
 * encapsulate mode-dependent logic, keeping the main function readable
 * as a declaration of what gets validated rather than how.
 *
 * Returns a record of field errors, where each key is a field name and each
 * value is an error message or undefined.
 */
export const validate = (fields: IpFields): Record<string, string | undefined> => {
  return {
    // TRANSLATORS: validation error for the IPv4 addresses field.
    addresses4: validateAddresses(
      fields.ipv4Mode,
      fields.addresses4,
      isValidIPv4Address,
      _("At least one IPv4 address is required"),
      _("Some IPv4 addresses are invalid"),
    ),
    // TRANSLATORS: validation error for the IPv4 gateway field.
    gateway4: validateGateway(
      fields.ipv4Mode,
      fields.gateway4,
      isValidIPv4,
      _("IPv4 gateway is required"),
      _("Invalid IPv4 gateway"),
    ),
    // TRANSLATORS: validation error for the IPv6 addresses field.
    addresses6: validateAddresses(
      fields.ipv6Mode,
      fields.addresses6,
      isValidIPv6Address,
      _("At least one IPv6 address is required"),
      _("Some IPv6 addresses are invalid"),
    ),
    // TRANSLATORS: validation error for the IPv6 gateway field.
    gateway6: validateGateway(
      fields.ipv6Mode,
      fields.gateway6,
      isValidIPv6,
      _("IPv6 gateway is required"),
      _("Invalid IPv6 gateway"),
    ),
    // DNS fields: only validated when the corresponding toggle is on.
    nameservers: fields.customDns
      ? // TRANSLATORS: validation error for the DNS servers field.
        requiredValidList(
          fields.nameservers,
          isValidNameserver,
          _("At least one DNS server is required"),
          _("Some DNS server addresses are invalid"),
        )
      : undefined,
    dnsSearchList: fields.customDnsSearch
      ? // TRANSLATORS: validation error for the DNS search domains field.
        requiredValidList(
          fields.dnsSearchList,
          isValidDNSSearchDomain,
          _("At least one DNS search domain is required"),
          _("Some DNS search domains are invalid"),
        )
      : undefined,
  };
};

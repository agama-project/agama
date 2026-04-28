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
 * Validation logic for ConnectionForm.
 *
 * This module centralizes all validation functions for network connection
 * form, organized by connection type (common fields, bond-specific,
 * bridge-specific, etc.).
 *
 * Keeping validation here ensures ConnectionForm.tsx remains focused on UI
 * concerns and provides a single location to add type-specific validators as
 * new connection types (e.g., Bridge, VLAN) are introduced.
 *
 * Validators are tested indirectly through ConnectionForm integration tests,
 * rather than as standalone unit tests.
 */

import { sprintf } from "sprintf-js";
import { isEmpty, shake } from "radashi";
import { BondMode } from "~/types/network";
import {
  CONNECTION_TYPE,
  isValidIPv4,
  isValidIPv6,
  isValidIPv4Address,
  isValidIPv6Address,
  isValidNameserver,
  isValidDNSSearchDomain,
} from "~/utils/network";
import { _, formatList } from "~/i18n";
import { connectionFormOptions, FormIpMode, ADDRESS_REQUIRED_MODES } from "./ConnectionForm";

type FormValues = typeof connectionFormOptions.defaultValues;
type FormFieldErrors = Partial<Record<keyof FormValues, string>>;

/**
 * Bond modes that support the "primary" bond option.
 */
const PRIMARY_BOND_OPTION_MODES: readonly BondMode[] = [
  BondMode.ACTIVE_BACKUP,
  BondMode.BALANCE_TLB,
  BondMode.BALANCE_ALB,
];

/**
 * Returns an error when the given list is active and has invalid or missing entries.
 * Returns undefined when inactive or when all entries are valid.
 *
 * @param active - Whether the list should be validated at all.
 * @param emptyMsg - Error to return when the list is empty. Omit for optional
 *   lists where entries are not required but must be valid when provided.
 */
function validateActiveList(
  active: boolean,
  values: string[],
  isValid: (v: string) => boolean,
  emptyMsg: string | undefined,
  invalidMsg: string,
): string | undefined {
  if (!active) return undefined;
  if (emptyMsg !== undefined && values.length === 0) return emptyMsg;
  if (values.some((v) => !isValid(v))) return invalidMsg;
}

/**
 * Returns an error for an IP addresses list based on the current IP mode.
 *
 * - MANUAL: addresses are required and must be valid.
 * - ADVANCED_AUTO: addresses are required and must be valid.
 * - AUTO: no validation.
 */
function validateIpAddresses(
  mode: FormIpMode,
  addresses: string[],
  isValid: (v: string) => boolean,
  emptyMsg: string,
  invalidMsg: string,
): string | undefined {
  const required = ADDRESS_REQUIRED_MODES.includes(mode);
  const active = required || addresses.length > 0;
  return validateActiveList(
    active,
    addresses,
    isValid,
    required ? emptyMsg : undefined,
    invalidMsg,
  );
}

/**
 * Returns an error for a gateway value under its protocol mode.
 *
 * - MANUAL: gateway is required and must be valid.
 * - ADVANCED_AUTO: gateway is optional but must be valid when provided.
 * - AUTO: no validation.
 */
function validateGateway(
  mode: FormIpMode,
  gateway: string,
  validAddresses: string[],
  isValid: (v: string) => boolean,
  emptyMsg: string,
  invalidMsg: string,
): string | undefined {
  if (mode === FormIpMode.MANUAL) {
    if (!gateway) return emptyMsg;
    return isValid(gateway) ? undefined : invalidMsg;
  }
  if (mode === FormIpMode.ADVANCED_AUTO && gateway) {
    return isValid(gateway) ? undefined : invalidMsg;
  }
}

/**
 * Validates bond options for the given mode.
 */
function validateBondOptions(mode: BondMode, options: string[]): string | undefined {
  const hasPrimaryOption = options.some((o) => o.startsWith("primary="));
  if (!hasPrimaryOption) return undefined;

  if (PRIMARY_BOND_OPTION_MODES.includes(mode)) return undefined;

  const modeNames = PRIMARY_BOND_OPTION_MODES.map((m) => `'${m}'`);
  // TRANSLATORS: validation error for the bond options field when the 'primary' option is used in an invalid mode.
  // %s is replaced with a list of valid mode names.
  return sprintf(_("The 'primary' option is only valid for %s modes"), formatList(modeNames));
}

/**
 * Validates common fields (name, addresses, gateways, DNS) for all connection types.
 */
function validateCommonFields(formValues: FormValues): Partial<FormFieldErrors> {
  const validAddresses4 = formValues.addresses4.filter(isValidIPv4Address);
  const validAddresses6 = formValues.addresses6.filter(isValidIPv6Address);

  return {
    // TRANSLATORS: validation error for the connection name field.
    name: !formValues.name.trim() ? _("Name is required") : undefined,
    addresses4: validateIpAddresses(
      formValues.ipv4Mode,
      formValues.addresses4,
      isValidIPv4Address,
      // TRANSLATORS: validation error for the IPv4 addresses field.
      _("At least one IPv4 address is required"),
      // TRANSLATORS: validation error for the IPv4 addresses field.
      _("Some IPv4 addresses are invalid"),
    ),
    addresses6: validateIpAddresses(
      formValues.ipv6Mode,
      formValues.addresses6,
      isValidIPv6Address,
      // TRANSLATORS: validation error for the IPv6 addresses field.
      _("At least one IPv6 address is required"),
      // TRANSLATORS: validation error for the IPv6 addresses field.
      _("Some IPv6 addresses are invalid"),
    ),
    gateway4: validateGateway(
      formValues.ipv4Mode,
      formValues.gateway4,
      validAddresses4,
      isValidIPv4,
      // TRANSLATORS: validation error for the IPv4 gateway field.
      _("IPv4 gateway is required"),
      // TRANSLATORS: validation error for the IPv4 gateway field.
      _("Invalid IPv4 gateway"),
    ),
    gateway6: validateGateway(
      formValues.ipv6Mode,
      formValues.gateway6,
      validAddresses6,
      isValidIPv6,
      // TRANSLATORS: validation error for the IPv6 gateway field.
      _("IPv6 gateway is required"),
      // TRANSLATORS: validation error for the IPv6 gateway field.
      _("Invalid IPv6 gateway"),
    ),
    nameservers: validateActiveList(
      formValues.customDns,
      formValues.nameservers,
      isValidNameserver,
      // TRANSLATORS: validation error for the DNS servers field.
      _("At least one DNS server is required"),
      // TRANSLATORS: validation error for the DNS servers field.
      _("Some DNS server addresses are invalid"),
    ),
    dnsSearchList: validateActiveList(
      formValues.customDnsSearch,
      formValues.dnsSearchList,
      isValidDNSSearchDomain,
      // TRANSLATORS: validation error for the DNS search domains field.
      _("At least one DNS search domain is required"),
      // TRANSLATORS: validation error for the DNS search domains field.
      _("Some DNS search domains are invalid"),
    ),
  };
}

/**
 * Validates bond-specific fields.
 */
function validateBondFields(formValues: FormValues): Partial<FormFieldErrors> {
  if (formValues.type !== CONNECTION_TYPE.BOND) return {};

  return {
    // TRANSLATORS: validation error for the bond device name field.
    bondIface: !formValues.bondIface.trim() ? _("Device name is required") : undefined,
    // TRANSLATORS: validation error for the bond mode field.
    bondMode: !formValues.bondMode.trim() ? _("Bond mode is required") : undefined,
    bondPorts:
      formValues.bondPorts.length === 0
        ? // TRANSLATORS: validation error for the bond ports field.
          _("At least one bond port is required")
        : undefined,
    bondOptions: validateBondOptions(formValues.bondMode, formValues.bondOptions),
  };
}

/**
 * Validates the connection form values.
 *
 * Returns a map of field errors when validation fails, or undefined when all
 * values are valid.
 */
export function validateConnectionForm(formValues: FormValues): FormFieldErrors | undefined {
  const fieldErrors = shake({
    ...validateCommonFields(formValues),
    ...validateBondFields(formValues),
  });

  if (!isEmpty(fieldErrors)) return fieldErrors;
}

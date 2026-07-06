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
 * Validation for the connection form.
 *
 * Builds on the field definitions from fields.ts and the reusable rules from
 * form/validation-helpers.ts. The exported validate function is wired into the
 * form's onSubmitAsync validator, following the submit-only validation
 * convention.
 */

import { shake } from "radashi";
import { sprintf } from "sprintf-js";

import { BondMode } from "~/types/network";
import {
  CONNECTION_TYPE,
  isValidIPv4Address,
  isValidIPv6Address,
  isValidIPv4,
  isValidIPv6,
  isValidNameserver,
  isValidDNSSearchDomain,
} from "~/utils/network";
import {
  requiredString,
  requiredIntRange,
  optionalIntRange,
  requiredValidList,
  optionalValidList,
  requiredValidString,
  optionalValidString,
} from "~/components/form/validation-helpers";
import { ADDRESS_REQUIRED_MODES, BridgeStpMode, FormIpMode } from "./fields";
import { _, formatList } from "~/i18n";

import type { TranslatedString } from "~/i18n";

import type {
  ValidationResult,
  FieldsValidationResult,
} from "~/components/form/validation-helpers";
import type {
  CommonFormFields,
  IpFormFields,
  BondFormFields,
  BridgeFormFields,
  VlanFormFields,
  FormFields,
  FormIpMode as FormIpModeType,
} from "./fields";

/**
 * Bond modes that support the "primary" bond option.
 */
const PRIMARY_BOND_OPTION_MODES: readonly BondMode[] = [
  BondMode.ACTIVE_BACKUP,
  BondMode.BALANCE_TLB,
  BondMode.BALANCE_ALB,
];

/**
 * Helper for mode-dependent address validation.
 *
 * In MANUAL and ADVANCED_AUTO modes, at least one address is required.
 * In AUTO mode, addresses are optional (system handles them).
 */
const validateAddresses = (
  mode: FormIpModeType,
  addresses: string[],
  isValid: (s: string) => boolean,
  emptyMessage: TranslatedString,
  invalidMessage: TranslatedString,
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
  mode: FormIpModeType,
  gateway: string,
  isValid: (s: string) => boolean,
  emptyMessage: TranslatedString,
  invalidMessage: TranslatedString,
) => {
  if (mode === FormIpMode.MANUAL)
    return requiredValidString(gateway, isValid, emptyMessage, invalidMessage);
  if (mode === FormIpMode.ADVANCED_AUTO)
    return optionalValidString(gateway, isValid, invalidMessage);
  return undefined;
};

/**
 * Validates common connection fields.
 *
 * Only the name field requires validation. The other common fields (type,
 * iface, ifaceMac, bindingMode) are either guaranteed valid by the UI
 * (type is a dropdown) or validated elsewhere (iface/ifaceMac are device
 * properties, bindingMode is a controlled enum).
 */
const validateCommonFields = (
  fields: CommonFormFields,
): FieldsValidationResult<CommonFormFields> => ({
  // TRANSLATORS: validation error for the connection name field.
  name: requiredString(fields.name, _("Name is required")),
});

/**
 * Validates IP settings fields.
 *
 * All conditionality — address requirements, gateway optionality, DNS
 * activation — is resolved at call time based on the current form
 * state, not encoded as cross-field rules at validation time.
 */
const validateIpFields = (fields: IpFormFields): FieldsValidationResult<IpFormFields> => ({
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
});

/**
 * Validates bond-specific fields.
 *
 * Includes cross-field validation for the "primary" bond option, which is
 * only valid in certain modes (ACTIVE_BACKUP, BALANCE_TLB, BALANCE_ALB).
 * This rule depends on both bondMode and bondOptions, so it's evaluated
 * at validation time and returned as a field error on bondOptions.
 */
const validateBondFields = (fields: BondFormFields): FieldsValidationResult<BondFormFields> => {
  const { bondMode, bondOptions, bondPorts, bondIface } = fields;

  const hasPrimaryOption = bondOptions.some((o) => o.startsWith("primary="));

  const bondOptionsError = (() => {
    if (!hasPrimaryOption) return undefined;
    if (PRIMARY_BOND_OPTION_MODES.includes(bondMode)) return undefined;

    const modeNames = PRIMARY_BOND_OPTION_MODES.map((m) => `'${m}'`);
    // TRANSLATORS: validation error for the bond options field when the 'primary' option is used in an invalid mode.
    // %s is replaced with a list of valid mode names.
    return sprintf(_("The 'primary' option is only valid for %s modes"), formatList(modeNames));
  })();

  return {
    // TRANSLATORS: validation error for the bond device name field.
    bondIface: requiredString(bondIface, _("Device name is required")),
    // TRANSLATORS: validation error for the bond mode name field.
    bondMode: requiredString(bondMode, _("Bond mode is required")),
    // TRANSLATORS: validation error for the bond ports field.
    bondPorts: bondPorts.length === 0 ? _("At least one bond port is required") : undefined,
    bondOptions: bondOptionsError,
  };
};

/**
 * Validates bridge-specific fields.
 *
 * STP fields are conditionally validated based on whether STP is enabled.
 * When STP is disabled, those fields are not validated at all.
 */
const validateBridgeFields = (
  fields: BridgeFormFields,
): FieldsValidationResult<BridgeFormFields> => {
  const stpEnabled = fields.bridgeStp === BridgeStpMode.ENABLED;

  return {
    // TRANSLATORS: validation error for the bridge device name field.
    bridgeIface: requiredString(fields.bridgeIface, _("Device name is required")),
    // TRANSLATORS: validation error for the bridge ports field.
    bridgePorts:
      fields.bridgePorts.length === 0 ? _("At least one bridge port is required") : undefined,
    // STP fields only validated when STP is enabled.
    ...(stpEnabled && {
      // TRANSLATORS: validation error for the bridge priority field.
      bridgePriority: optionalIntRange(
        fields.bridgePriority,
        0,
        61440,
        _("Priority must be between 0 and 61440"),
      ),
      // TRANSLATORS: validation error for the bridge forward delay field.
      bridgeForwardDelay: optionalIntRange(
        fields.bridgeForwardDelay,
        4,
        30,
        _("Forward delay must be between 4 and 30 seconds"),
      ),
      // TRANSLATORS: validation error for the bridge hello time field.
      bridgeHelloTime: optionalIntRange(
        fields.bridgeHelloTime,
        1,
        10,
        _("Hello time must be between 1 and 10 seconds"),
      ),
      // TRANSLATORS: validation error for the bridge max message age field.
      bridgeMaxAge: optionalIntRange(
        fields.bridgeMaxAge,
        6,
        40,
        _("Max message age must be between 6 and 40 seconds"),
      ),
    }),
  };
};

/**
 * Validates VLAN-specific fields.
 */
const validateVlanFields = (fields: VlanFormFields): FieldsValidationResult<VlanFormFields> => {
  return {
    // TRANSLATORS: validation error for the VLAN device name field.
    vlanIface: requiredString(fields.vlanIface, _("Device name is required")),
    // TRANSLATORS: validation error for the VLAN ID field.
    vlanId: requiredIntRange(
      fields.vlanId,
      0,
      4094,
      _("VLAN ID is required"),
      _("VLAN ID must be between 0 and 4094"),
    ),
  };
};

/**
 * Dispatches to the appropriate type-specific validator based on connection type.
 * Returns an empty object for types with no extra validation (e.g. Ethernet).
 */
const validateTypeFields = (fields: FormFields): FieldsValidationResult<FormFields> => {
  switch (fields.type) {
    case CONNECTION_TYPE.BOND:
      return validateBondFields(fields);
    case CONNECTION_TYPE.BRIDGE:
      return validateBridgeFields(fields);
    case CONNECTION_TYPE.VLAN:
      return validateVlanFields(fields);
    default:
      return {};
  }
};

/**
 * Validates the form values for the active connection type.
 *
 * Designed for TanStack Form's validators. Returns undefined when valid
 * (TanStack Form convention), or a field-error map on failure.
 *
 * Composition:
 * - Common and IP validators run for all connection types
 * - Bond/Bridge validators run only for their respective types
 * - Cross-field validation (e.g., bond primary option) is handled within
 *   the type-specific validators and returned as field errors
 *
 * Field errors are collected by merging all validator outputs and
 * stripping undefined values.
 */
export const validate = (fields: FormFields): ValidationResult<FormFields> => {
  const fieldErrors = shake({
    ...validateCommonFields(fields),
    ...validateIpFields(fields),
    ...validateTypeFields(fields),
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
};

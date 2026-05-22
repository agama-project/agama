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
 * System form fields: types, defaults, and validation.
 *
 * Consolidates all system form concerns (hostname and NTP settings) in a
 * single module following the connection-form pattern.
 */

import ipaddr from "ipaddr.js";
import { formOptions } from "@tanstack/react-form";
import { isEmpty, shake } from "radashi";
import { requiredValidList, requiredValidString } from "~/components/form/validation-helpers";
import { _ } from "~/i18n";

import type {
  ValidationResult,
  FieldsValidationResult,
} from "~/components/form/validation-helpers";

/** Constants */

export const HOSTNAME_MODE = {
  TRANSIENT: "transient",
  STATIC: "static",
} as const;

export const NTP_MODE = {
  DEFAULT: "default",
  CUSTOM: "custom",
} as const;

/** Types */

type HostnameMode = "transient" | "static";
type NtpMode = "default" | "custom";

type HostnameFormFields = {
  hostnameMode: HostnameMode;
  hostnameValue: string;
};

type NtpFormFields = {
  ntpMode: NtpMode;
  ntpServers: string[];
};

type FormFields = HostnameFormFields & NtpFormFields;

/** Defaults */

const defaultValues: FormFields = {
  hostnameMode: HOSTNAME_MODE.TRANSIENT as HostnameMode,
  hostnameValue: "",
  ntpMode: NTP_MODE.DEFAULT as NtpMode,
  ntpServers: [] as string[],
};

export const defaultOptions = formOptions({
  defaultValues,
});

/** Validation */

/**
 * Matches a valid DNS hostname or FQDN per RFC 952 / RFC 1123.
 *
 * Rules:
 * - Each value starts and ends with an alphanumeric character.
 * - Values may contain hyphens but not as the first or last character.
 * - Values are 1-63 characters long.
 * - Values are separated by dots.
 * - No trailing dot.
 *
 * Examples: `local`, `example.com`, `pool.ntp.org`.
 *
 * Note: Single-label hostnames like "asdf" are technically valid per RFC,
 * even though they may look like typos. They could be used in local network
 * configurations where such names are resolvable.
 */
const HOSTNAME_RE =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

/**
 * Returns true if the value is a valid NTP server address.
 *
 * NTP servers can be:
 * - IPv4 addresses (e.g., 192.168.1.1)
 * - IPv6 addresses (e.g., 2001:db8::1)
 * - Hostnames or FQDNs (e.g., pool.ntp.org, asdf)
 */
export const isValidNtpServer = (value: string): boolean => {
  return (
    ipaddr.IPv4.isValidFourPartDecimal(value) ||
    ipaddr.IPv6.isValid(value) ||
    HOSTNAME_RE.test(value)
  );
};

/**
 * Validates hostname fields.
 */
function validateHostnameFields(
  formValues: FormFields,
): FieldsValidationResult<HostnameFormFields> {
  return {
    hostnameValue:
      formValues.hostnameMode === HOSTNAME_MODE.STATIC
        ? // TRANSLATORS: validation error when static hostname value is empty
          requiredValidString(
            formValues.hostnameValue,
            (value) => HOSTNAME_RE.test(value),
            _("Enter a hostname value."),
            _("Invalid hostname value."),
          )
        : undefined,
  };
}

/**
 * Validates NTP fields.
 */
function validateNtpFields(formValues: FormFields): FieldsValidationResult<NtpFormFields> {
  if (formValues.ntpMode !== NTP_MODE.CUSTOM) return {};

  return {
    ntpServers: requiredValidList(
      formValues.ntpServers,
      isValidNtpServer,
      // TRANSLATORS: validation error when no NTP servers are provided in custom mode
      _("At least one NTP server is required"),
      // TRANSLATORS: validation error when some NTP server addresses are invalid
      _("Some NTP server addresses are invalid"),
    ),
  };
}

/**
 * Validates the system form fields.
 *
 * Returns a map of field errors when validation fails, or undefined when all
 * values are valid.
 */
export function validate(formFields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({
    ...validateHostnameFields(formFields),
    ...validateNtpFields(formFields),
  });

  if (!isEmpty(fieldErrors)) return { fields: fieldErrors };
}

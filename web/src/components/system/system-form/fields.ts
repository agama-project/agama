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
import { sprintf } from "sprintf-js";
import { formOptions } from "@tanstack/react-form";
import { isEmpty, shake } from "radashi";
import { requiredString, requiredValidList } from "~/components/form/validation-helpers";
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

/** Characters a static hostname can have. */
const HOSTNAME_CHARS_RE = /^[a-zA-Z0-9.-]+$/;

/** Longest static hostname the system accepts (the kernel limit, see hostname(5)). */
const HOSTNAME_MAX_LENGTH = 64;

/** Longest part between dots (a DNS label). */
const HOSTNAME_PART_MAX_LENGTH = 63;

/**
 * Checks a static hostname, returning the message of the first rule it
 * breaks, or undefined when it is valid.
 */
function hostnameError(value: string): string | undefined {
  // TRANSLATORS: validation error when static hostname value is empty
  const required = requiredString(value, _("Enter a hostname value."));
  if (required) return required;

  if (!HOSTNAME_CHARS_RE.test(value)) {
    // TRANSLATORS: validation error for the static hostname
    return _("The name has characters that are not allowed.");
  }

  if (value.length > HOSTNAME_MAX_LENGTH) {
    // TRANSLATORS: validation error, %d is replaced with the maximum number of characters
    return sprintf(_("The name cannot be longer than %d characters."), HOSTNAME_MAX_LENGTH);
  }

  const parts = value.split(".");
  if (parts.some((part) => part === "")) {
    // TRANSLATORS: validation error for the static hostname
    return _("The name cannot begin or end with a dot, or have two dots in a row.");
  }

  if (parts.some((part) => part.startsWith("-") || part.endsWith("-"))) {
    // TRANSLATORS: validation error for the static hostname
    return _("Each part of the name must begin and end with a letter or a digit.");
  }

  if (parts.some((part) => part.length > HOSTNAME_PART_MAX_LENGTH)) {
    // TRANSLATORS: validation error, %d is replaced with the maximum number of characters
    return sprintf(
      _("Each part of the name between dots cannot be longer than %d characters."),
      HOSTNAME_PART_MAX_LENGTH,
    );
  }
}

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
        ? hostnameError(formValues.hostnameValue)
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

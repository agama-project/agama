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
 * Validation logic for SystemPage form.
 *
 * This module centralizes all validation functions for the system settings
 * form (hostname and NTP configuration).
 *
 * Keeping validation here ensures SystemPage.tsx remains focused on UI
 * concerns and provides a single location for all validation logic.
 */

import ipaddr from "ipaddr.js";
import { isEmpty, shake } from "radashi";
import { _ } from "~/i18n";
import { systemFormOptions } from "./SystemPage";

type FormValues = typeof systemFormOptions.defaultValues;
type FormFieldErrors = Partial<Record<keyof FormValues, string>>;

const HOSTNAME_MODE = {
  TRANSIENT: "transient",
  STATIC: "static",
} as const;

const NTP_MODE = {
  DEFAULT: "default",
  CUSTOM: "custom",
} as const;

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
function validateHostnameFields(formValues: FormValues): Partial<FormFieldErrors> {
  return {
    hostnameValue:
      formValues.hostnameMode === HOSTNAME_MODE.STATIC && isEmpty(formValues.hostnameValue)
        ? // TRANSLATORS: validation error when static hostname value is empty
          _("Enter a hostname value.")
        : undefined,
  };
}

/**
 * Validates NTP fields.
 */
function validateNtpFields(formValues: FormValues): Partial<FormFieldErrors> {
  if (formValues.ntpMode !== NTP_MODE.CUSTOM) return {};

  if (formValues.ntpServers.length === 0) {
    return {
      // TRANSLATORS: validation error when no NTP servers are provided in custom mode
      ntpServers: _("At least one NTP server is required"),
    };
  }

  if (formValues.ntpServers.some((server) => !isValidNtpServer(server))) {
    return {
      // TRANSLATORS: validation error when some NTP server addresses are invalid
      ntpServers: _("Some NTP server addresses are invalid"),
    };
  }

  return {};
}

/**
 * Validates the system form values.
 *
 * Returns a map of field errors when validation fails, or undefined when all
 * values are valid.
 */
export function validateSystemForm(formValues: FormValues): FormFieldErrors | undefined {
  const fieldErrors = shake({
    ...validateHostnameFields(formValues),
    ...validateNtpFields(formValues),
  });

  if (!isEmpty(fieldErrors)) return fieldErrors;
}

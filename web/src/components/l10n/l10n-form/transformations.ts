/*
 * Copyright (c) [2023-2026] SUSE LLC
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
 * Pure transformations between the localization form values, the backend config
 * patch and the displayed option data. Kept free of JSX so it stays easy to
 * unit test; the field components handle the visual rendering.
 */

import { isEmpty, shake } from "radashi";
import { anyFieldChanged } from "~/hooks/form";
import { dateTimeFormat } from "~/utils";

import type { Config } from "~/model/config/l10n";
import type { FormFields } from "./fields";

type CurrentSelection = {
  locale?: string;
  keymap?: string;
  timezone?: string;
};

type L10nFieldMeta = Partial<Record<keyof FormFields, { isDefaultValue?: boolean }>>;

/**
 * Builds the form's initial values from the currently selected ids, using an
 * empty string for anything not selected yet.
 */
export function toFormValues({ locale, keymap, timezone }: CurrentSelection): FormFields {
  return {
    language: locale ?? "",
    keymap: keymap ?? "",
    timezone: timezone ?? "",
  };
}

/**
 * Builds the l10n config patch from the changed fields only, so the request
 * carries just what the user actually touched. Returns undefined when nothing
 * changed, letting the caller report a no-op submit.
 */
export function buildL10nConfig(
  formValues: FormFields,
  fieldMeta: L10nFieldMeta,
): Config | undefined {
  const patch = shake({
    locale: anyFieldChanged(fieldMeta, "language") ? formValues.language : undefined,
    keymap: anyFieldChanged(fieldMeta, "keymap") ? formValues.keymap : undefined,
    timezone: anyFieldChanged(fieldMeta, "timezone") ? formValues.timezone : undefined,
  });

  if (isEmpty(patch)) return undefined;

  return patch;
}

/**
 * Current UTC offset of a time zone as a label like "UTC+1" or "UTC-3:30",
 * derived from the zone id. The backend does not send the offset, so it is read
 * from the same Intl machinery used for the local time, which means it reflects
 * DST. Returns an empty string for an unknown zone.
 */
export function timezoneUtcOffset(timezone: string, date: Date = new Date()): string {
  try {
    const parts = dateTimeFormat(timezone, { timeZoneName: "shortOffset" }).formatToParts(date);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    // Intl yields a "GMT±H[:MM]" label (just "GMT" at zero); present it as "UTC".
    return name.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

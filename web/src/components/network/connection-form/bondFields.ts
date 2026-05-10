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

import { sprintf } from "sprintf-js";
import { BondMode } from "~/types/network";
import { requiredString } from "~/components/form/validation-helpers";
import { _, formatList } from "~/i18n";

type BondFields = {
  bondIface: string;
  bondMode: BondMode;
  bondOptions: string[];
  bondPorts: string[];
};

/**
 * Bond modes that support the "primary" bond option.
 *
 * Co-located with the rule that uses it.
 */
const PRIMARY_BOND_OPTION_MODES: readonly BondMode[] = [
  BondMode.ACTIVE_BACKUP,
  BondMode.BALANCE_TLB,
  BondMode.BALANCE_ALB,
];

/**
 * Default values for bond-specific fields.
 */
export const defaultValues = {
  bondIface: "",
  bondMode: BondMode.BALANCE_ROUND_ROBIN as BondMode,
  bondOptions: [] as string[],
  bondPorts: [] as string[],
};

/**
 * Validation for bond-specific fields.
 *
 * Includes cross-field validation for the "primary" bond option, which is
 * only valid in certain modes (ACTIVE_BACKUP, BALANCE_TLB, BALANCE_ALB).
 * This rule depends on both bondMode and bondOptions, so it's evaluated
 * at validation time and returned as a field error on bondOptions.
 *
 * Returns a record of field errors, where each key is a field name and each
 * value is an error message or undefined.
 */
export const validate = (fields: BondFields): Record<string, string | undefined> => {
  const bondOptionsError = (() => {
    if (!fields.bondOptions.some((o) => o.startsWith("primary="))) return undefined;
    if (PRIMARY_BOND_OPTION_MODES.includes(fields.bondMode)) return undefined;

    const modeNames = PRIMARY_BOND_OPTION_MODES.map((m) => `'${m}'`);
    // TRANSLATORS: validation error for the bond options field when the 'primary' option is used in an invalid mode.
    // %s is replaced with a list of valid mode names.
    return sprintf(_("The 'primary' option is only valid for %s modes"), formatList(modeNames));
  })();

  return {
    // TRANSLATORS: validation error for the bond device name field.
    bondIface: requiredString(fields.bondIface, _("Device name is required")),
    // TRANSLATORS: validation error for the bond ports field.
    bondPorts: fields.bondPorts.length === 0 ? _("At least one bond port is required") : undefined,
    bondOptions: bondOptionsError,
  };
};

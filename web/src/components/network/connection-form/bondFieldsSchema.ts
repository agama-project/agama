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
import { _, formatList } from "~/i18n";
import {
  requiredString,
  requiredStringArray,
  stringArray,
} from "~/components/form/validation-helpers";

/**
 * Default values for bond-specific fields.
 */
export const bondDefaults = {
  bondIface: "",
  bondMode: BondMode.BALANCE_ROUND_ROBIN as BondMode,
  bondOptions: [] as string[],
  bondPorts: [] as string[],
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
 * Validation schema entries for bond-specific fields.
 *
 * Returns entry objects that can be spread into the parent schema.
 * Factory function defers i18n string resolution until after initialization.
 */
export const BondSchema = () => ({
  // TRANSLATORS: validation error for the bond device name field.
  bondIface: requiredString(_("Device name is required")),
  // TRANSLATORS: validation error for the bond mode field.
  bondMode: requiredString(_("Bond mode is required")),
  // TRANSLATORS: validation error for the bond ports field.
  bondPorts: requiredStringArray(_("At least one bond port is required")),
  bondOptions: stringArray(),
});

/**
 * Validation message for the bond cross-field rule.
 *
 * The "primary" bond option is only valid in certain modes. This is a
 * genuinely cross-field rule — it cannot be resolved at schema construction
 * time because it depends on two sibling fields evaluated together at
 * validation time.
 *
 * Exported as a getter so it can be used inline in connectionSchema where
 * TypeScript can properly infer the object type.
 */
export const bondCrossFieldErrorMessage = () => {
  const modeNames = PRIMARY_BOND_OPTION_MODES.map((m) => `'${m}'`);
  // TRANSLATORS: validation error for the bond options field when the 'primary' option is used in an invalid mode.
  // %s is replaced with a list of valid mode names.
  return sprintf(_("The 'primary' option is only valid for %s modes"), formatList(modeNames));
};

/**
 * Predicate for the bond cross-field validation.
 *
 * Returns true if the bondOptions/bondMode combination is valid.
 */
export const isBondConfigValid = (bondOptions: string[], bondMode: BondMode) =>
  !bondOptions.some((o) => o.startsWith("primary=")) ||
  PRIMARY_BOND_OPTION_MODES.includes(bondMode);

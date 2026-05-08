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

import * as v from "valibot";
import { sprintf } from "sprintf-js";
import { BondMode } from "~/types/network";
import { _, formatList } from "~/i18n";

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
 */
const PRIMARY_BOND_OPTION_MODES: readonly BondMode[] = [
  BondMode.ACTIVE_BACKUP,
  BondMode.BALANCE_TLB,
  BondMode.BALANCE_ALB,
];

/**
 * Validation schema for bond-specific fields.
 *
 * Returns a function to defer i18n initialization.
 */
export const bondSchema = () =>
  v.pipe(
    v.object({
      bondIface: v.pipe(v.string(), v.minLength(1, _("Device name is required"))),
      bondMode: v.pipe(v.string(), v.minLength(1, _("Bond mode is required"))),
      bondPorts: v.pipe(
        v.array(v.string()),
        v.minLength(1, _("At least one bond port is required")),
      ),
      bondOptions: v.array(v.string()),
    }),
    v.forward(
      v.check(
        ({ bondOptions, bondMode }) => {
          const hasPrimaryOption = bondOptions.some((o) => o.startsWith("primary="));
          if (!hasPrimaryOption) return true;
          return PRIMARY_BOND_OPTION_MODES.includes(bondMode as BondMode);
        },
        (() => {
          const modeNames = PRIMARY_BOND_OPTION_MODES.map((m) => `'${m}'`);
          // TRANSLATORS: validation error for the bond options field when the 'primary' option is used in an invalid mode.
          // %s is replaced with a list of valid mode names.
          return sprintf(
            _("The 'primary' option is only valid for %s modes"),
            formatList(modeNames),
          );
        })(),
      ),
      ["bondOptions"],
    ),
  );

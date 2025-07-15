/*
 * Copyright (c) [2025] SUSE LLC
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
 * Utility type that enforces at least one property from a given type `T` to be
 * present.
 *
 * Borrowed from
 *   - https://github.com/ts-essentials/ts-essentials/issues/157#issuecomment-1477046564
 *   - https://learn.microsoft.com/en-us/javascript/api/@azure/keyvault-certificates/requireatleastone
 *
 * @template T - The object type to apply the constraint to.
 *
 * This type transforms `T` into a union of types where each key in `T` becomes
 * the required one, and all others remain optional. The result is that at least
 * one key from `T` must be present in any object of this type.
 *
 * @example
 * type Settings = {
 *   darkMode?: boolean;
 *   highContrast?: boolean;
 * };
 *
 * const a: RequireAtLeastOne<Settings> = { darkMode: true };      // OK
 * const b: RequireAtLeastOne<Settings> = { highContrast: true };  // OK
 * const c: RequireAtLeastOne<Settings> = {};                      // Error: at least one required
 */
type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];

export type { RequireAtLeastOne };

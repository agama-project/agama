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

import { isEmpty } from "radashi";

import type { License, Product } from "~/model/system";

/**
 * Returns the licenses the user must accept to install the given product.
 *
 * Names come from the licenses known by the system. A license the system does
 * not know, or reports without a name, is named after the product.
 */
export const productLicenses = (
  product: Product | undefined,
  licenses: License[] = [],
): License[] =>
  (product?.licenses || []).map((id) => {
    const name = licenses.find((l) => l.id === id)?.name;
    return { id, name: name || product.name };
  });

/**
 * Whether the system knows the given license by name.
 */
export const hasKnownName = (license: License, licenses: License[] = []): boolean =>
  licenses.some((l) => l.id === license.id && !isEmpty(l.name));

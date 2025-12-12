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

import type * as l10n from "~/model/system/l10n";
import type * as network from "~/model/system/network";
import type * as software from "~/model/system/software";
import type { storage } from "~/model/system/storage";

type System = {
  l10n?: l10n.System;
  network: network.System;
  products?: Product[];
  software?: software.System;
  storage?: storage.System;
};

type Product = {
  /** Product ID (e.g., "Leap") */
  id: string;
  /** Product name (e.g., "openSUSE Leap 15.4") */
  name: string;
  /** Product description */
  description?: string;
  /** Product icon (e.g., "default.svg") */
  icon?: string;
  /** If product is registrable or not */
  registration: boolean;
  /** The product license id, if any */
  license?: string;
  /** Translations */
  translations?: {
    /** The key is the locale (e.g., "en", "pt_BR") */
    description: Record<string, string>;
  };
};

export type { System, Product, l10n, network, software, storage };

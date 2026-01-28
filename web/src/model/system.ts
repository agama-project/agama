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

import type * as Hardware from "~/model/system/hardware";
import type * as Hostname from "~/model/system/hostname";
import type * as L10n from "~/model/system/l10n";
import type * as Network from "~/model/system/network";
import type * as Software from "~/model/system/software";
import type * as Storage from "~/model/system/storage";

type System = {
  hardware?: Hardware.System;
  hostname?: Hostname.System;
  l10n?: L10n.System;
  network?: Network.System;
  products?: Product[];
  software?: Software.System;
  storage?: Storage.System;
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
  modes: Mode[];
};

type Mode = {
  /** Mode ID (e.g., "traditional") */
  id: string;
  /** Mode name (e.g., "Traditional") */
  name: string;
  /** Mode description (e.g., "Traditional system") */
  description: string;
};

export type { System, Product, L10n, Hardware, Hostname, Mode, Network, Software, Storage };

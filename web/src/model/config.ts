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

import type * as L10n from "~/model/config/l10n";
import type * as Network from "~/model/config/network";
import type * as Software from "~/model/config/software";
import type * as Storage from "~/model/config/storage";

type Config = {
  l10n?: L10n.Config;
  network?: Network.Config;
  product?: Product;
  storage?: Storage.Config;
  software?: Software.Config;
};

type Product = {
  id?: string;
};

export type { Config, Product, L10n, Network, Storage };

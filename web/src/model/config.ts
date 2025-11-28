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

import type * as network from "~/model/config/network";
import type * as l10n from "~/model/config/l10n";
import type * as storage from "~/model/config/storage";

type Config = {
  l10n?: l10n.Config;
  network?: network.Config;
  product?: Product;
  storage?: storage.Config;
};

type Product = {
  id?: string;
};

export type { Config, Product, l10n, network, storage };

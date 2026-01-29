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

import type * as Hostname from "~/model/config/hostname";
import type * as L10n from "~/model/config/l10n";
import type * as Network from "~/model/config/network";
import type * as Product from "~/model/config/product";
import type * as Software from "~/openapi/config/software";
import type * as User from "~/model/config/user";
import type * as Root from "~/model/config/root";
import type * as Storage from "~/openapi/config/storage";

type Config = {
  hostname?: Hostname.Config;
  l10n?: L10n.Config;
  network?: Network.Config;
  product?: Product.Config;
  storage?: Storage.Config;
  software?: Software.Config;
  user?: User.Config;
  root?: Root.Config;
};

export type { Config, Hostname, Product, L10n, Network, Storage, User, Root };

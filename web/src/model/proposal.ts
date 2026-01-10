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

import type * as Hostname from "~/model/proposal/hostname";
import type * as L10n from "~/model/proposal/l10n";
import type * as Network from "~/model/proposal/network";
import type * as Software from "~/model/proposal/software";
import type * as Storage from "~/model/proposal/storage";

type Proposal = {
  hostname?: Hostname.Proposal;
  l10n?: L10n.Proposal;
  network: Network.Proposal;
  software?: Software.Proposal;
  storage?: Storage.Proposal;
};

export type { Hostname, Proposal, L10n, Network, Software, Storage };

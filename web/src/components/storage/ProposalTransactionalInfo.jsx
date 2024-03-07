/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React from "react";

import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { Reminder } from "~/components/core";
import { isTransactionalSystem } from "~/components/storage/utils";
import { useProduct } from "~/context/product";

/**
 * @typedef {import ("~/client/storage").ProposalManager.ProposalSettings} ProposalSettings
 */

/**
 * Information about the system being transactional, if needed
 * @component
 *
 * @param {object} props
 * @param {ProposalSettings} props.settings - Settings used for calculating a proposal.
 */
export default function ProposalTransactionalInfo({ settings }) {
  const { selectedProduct } = useProduct();

  if (!isTransactionalSystem(settings?.volumes)) return;

  const title = _("Transactional root file system");
  /* TRANSLATORS: %s is replaced by a product name (e.g., openSUSE Tumbleweed) */
  const description = sprintf(
    _("%s is an immutable system with atomic updates. It uses a read-only Btrfs file system updated via snapshots."),
    selectedProduct.name
  );

  return <Reminder title={title}>{description}</Reminder>;
}

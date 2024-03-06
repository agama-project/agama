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
import { Alert } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { If, Section } from "~/components/core";
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
 * @param {object} settings
 */
export default function ProposalTransactionalInfo({ settings }) {
  const transactional = isTransactionalSystem(settings?.volumes || []);
  const { selectedProduct } = useProduct();

  /* TRANSLATORS: %s is replaced by a product name (e.g., openSUSE Tumbleweed) */
  const description = sprintf(
    _("%s is an immutable system with atomic updates. It uses a read-only Btrfs file system updated via snapshots."),
    selectedProduct.name
  );
  const title = _("Transactional root file system");

  return (
    <If
      condition={transactional}
      then={
        <Section>
          <Alert isInline variant="info" title={title}>
            {description}
          </Alert>
        </Section>
      }
    />
  );
}

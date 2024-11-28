/*
 * Copyright (c) [2024] SUSE LLC
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

import React from "react";
import { Alert } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { useProduct } from "~/queries/software";
import { useVolumeTemplates } from "~/queries/storage";
import { isTransactionalSystem } from "~/components/storage/utils";

/**
 * Information about the system being transactional, if needed
 * @component
 *
 * @param props
 * @param props.settings - Settings used for calculating a proposal.
 */
export default function ProposalTransactionalInfo() {
  const { selectedProduct } = useProduct({ suspense: true });
  const volumes = useVolumeTemplates({ suspense: true });

  if (!isTransactionalSystem(volumes)) return;

  const title = _("Transactional root file system");
  /* TRANSLATORS: %s is replaced by a product name (e.g., openSUSE Tumbleweed) */
  const description = sprintf(
    _(
      "%s is an immutable system with atomic updates. It uses a read-only Btrfs file system updated via snapshots.",
    ),
    selectedProduct.name,
  );

  return (
    <Alert isInline title={title}>
      {description}
    </Alert>
  );
}

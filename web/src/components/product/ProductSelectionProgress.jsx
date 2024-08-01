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

import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { _ } from "~/i18n";
import { useProduct } from "~/queries/software";
import { Page, ProgressReport } from "~/components/core";
import { IDLE } from "~/client/status";
import { useInstallerClient } from "~/context/installer";
import { PATHS } from "~/router";
import { useInstallerStatus } from "~/queries/status";

/**
 * @component
 *
 * Shows progress steps when a product is selected.
 */
function ProductSelectionProgress() {
  const { selectedProduct } = useProduct({ suspense: true });
  const { isBusy } = useInstallerStatus({ suspense: true });

  if (!isBusy) return <Navigate to={PATHS.root} replace />;

  return (
    <Page>
      <ProgressReport
        title={_("Configuring the product, please wait ...")}
        firstStep={selectedProduct.name}
      />
    </Page>
  );
}

export default ProductSelectionProgress;

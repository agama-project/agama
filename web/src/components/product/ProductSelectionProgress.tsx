/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { Navigate } from "react-router-dom";
import { Page, ProgressReport } from "~/components/core";
import { useProduct } from "~/queries/software";
import { useInstallerStatus } from "~/queries/status";
import { ROOT as PATHS } from "~/routes/paths";
import { _ } from "~/i18n";

/**
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

/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { Navigate } from "react-router";
import { Grid, GridItem } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { useProductInfo } from "~/hooks/model/config/product";
import { PRODUCT } from "~/routes/paths";
import { _ } from "~/i18n";
import SystemInformationSection from "./SystemInformationSection";
import InstallationSummarySection from "./InstallationSummarySection";

export default function OverviewPage() {
  const product = useProductInfo();

  if (!product) {
    return <Navigate to={PRODUCT.root} />;
  }

  return (
    <Page breadcrumbs={[{ label: _("Overview") }]}>
      <Page.Content>
        <Grid hasGutter>
          <GridItem sm={6}>
            <SystemInformationSection />
          </GridItem>
          <GridItem sm={6}>
            <InstallationSummarySection />
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}

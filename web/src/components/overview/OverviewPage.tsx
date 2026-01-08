/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { Content, Grid, GridItem, Stack } from "@patternfly/react-core";
import { Page } from "~/components/core";
import L10nSection from "./L10nSection";
import StorageSection from "./StorageSection";
import SoftwareSection from "./SoftwareSection";
import { _ } from "~/i18n";
import { PRODUCT } from "~/routes/paths";
import { useProductInfo } from "~/hooks/model/config/product";
import { Navigate } from "react-router";

export default function OverviewPage() {
  const product = useProductInfo();

  if (!product) {
    return <Navigate to={PRODUCT.root} />;
  }

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Overview")}</Content>
      </Page.Header>

      <Page.Content>
        <Grid hasGutter>
          <GridItem sm={12}>
            <Stack hasGutter>
              <Content>
                {_(
                  "These are the most relevant installation settings. Feel free to browse the sections in the menu for further details.",
                )}
              </Content>
              <L10nSection />
              <StorageSection />
              <SoftwareSection />
            </Stack>
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}

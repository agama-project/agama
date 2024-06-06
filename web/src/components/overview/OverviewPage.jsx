/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import {
  CardBody,
  Grid, GridItem,
  Hint, HintBody,
  Stack
} from "@patternfly/react-core";
import { useProduct } from "~/context/product";
import { Navigate } from "react-router-dom";
import { CardField, Page, InstallButton } from "~/components/core";
import { _ } from "~/i18n";

export default function OverviewPage() {
  const { selectedProduct } = useProduct();

  // FIXME: this check could be no longer needed
  if (selectedProduct === null) {
    return <Navigate to="/products" />;
  }

  return (
    <Page title={_("Installation Summary")}>
      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12}>
            <Hint>
              <HintBody>{_("A brief summary about this page")}</HintBody>
            </Hint>
          </GridItem>
          <GridItem sm={12} xl={6}>
            <CardField label="Overview" description={_("Lorem ipsum dolor")}>
              <CardBody>
                <p>{_("Content")}</p>
              </CardBody>
            </CardField>
          </GridItem>
          <GridItem sm={12} xl={6}>
            <CardField label="Result" description={_("Lorem ipsum")}>
              <CardBody>
                <Stack hasGutter>
                  <p>{_("The idea is to show here a list of blocking issues and warnings if any to let the user know why the installation cannot be performed yet.")}</p>
                  <p>{_("Once the installation is possible, we're going to use an empty state with a check mark and an informative message along the Install button as primary action")}</p>
                  <InstallButton />
                </Stack>
              </CardBody>
            </CardField>
          </GridItem>
        </Grid>
      </Page.MainContent>
    </Page>
  );
}

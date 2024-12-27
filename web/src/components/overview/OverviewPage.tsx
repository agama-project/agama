/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { Grid, GridItem, Hint, HintBody, Stack } from "@patternfly/react-core";
import { Page } from "~/components/core";
import L10nSection from "./L10nSection";
import StorageSection from "./StorageSection";
import SoftwareSection from "./SoftwareSection";
import { _ } from "~/i18n";

const OverviewSection = () => (
  <Page.Section
    title={_("Overview")}
    description={_(
      "These are the most relevant installation settings. Feel free to browse the sections in the menu for further details.",
    )}
  >
    <Stack hasGutter>
      <L10nSection />
      <StorageSection />
      <SoftwareSection />
    </Stack>
  </Page.Section>
);

export default function OverviewPage() {
  return (
    <Page>
      <Page.Content>
        <Grid hasGutter>
          <GridItem sm={12}>
            <Hint>
              <HintBody>
                {_(
                  "Take your time to check your configuration before starting the installation process.",
                )}
              </HintBody>
            </Hint>
          </GridItem>
          <GridItem sm={12}>
            <OverviewSection />
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}

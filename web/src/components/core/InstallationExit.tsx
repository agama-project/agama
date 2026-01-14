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

import React from "react";
import {
  Bullseye,
  Card,
  CardBody,
  Content,
  EmptyState,
  EmptyStateBody,
  Grid,
  GridItem,
} from "@patternfly/react-core";
import { _ } from "~/i18n";
import Page from "./Page";

export default function InstallationExit() {
  return (
    <Page variant="minimal">
      <Bullseye>
        <Grid hasGutter>
          <GridItem sm={8} smOffset={2}>
            <Card>
              <CardBody>
                <EmptyState
                  variant="xl"
                  titleText={_("Your system is rebooting")}
                  headingLevel="h1"
                >
                  <EmptyStateBody>
                    <Content component="p">
                      {_(
                        "The installer interface is no longer available, so you can safely close this window.",
                      )}
                    </Content>
                  </EmptyStateBody>
                </EmptyState>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </Bullseye>
    </Page>
  );
}

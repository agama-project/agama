/*
 * Copyright (c) [2022] SUSE LLC
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
import { Card, CardBody, Grid, GridItem } from "@patternfly/react-core";
import SimpleLayout from "~/SimpleLayout";
import ProgressReport from "./ProgressReport";
import { Center } from "~/components/layout";
import { _ } from "~/i18n";

function InstallationProgress() {
  return (
    <SimpleLayout showOutlet={false}>
      <Center>
        <Grid hasGutter>
          <GridItem sm={8} smOffset={2}>
            <Card>
              <CardBody>
                <ProgressReport />
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </Center>
    </SimpleLayout>
  );
}

export default InstallationProgress;

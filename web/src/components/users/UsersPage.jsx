/*
 * Copyright (c) [2023] SUSE LLC
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

import { _ } from "~/i18n";
import { CardField, IssuesHint, Page } from "~/components/core";
import { FirstUser, RootAuthMethods } from "~/components/users";
import { CardBody, Grid, GridItem } from "@patternfly/react-core";
import { useIssues } from "~/context/issues";

export default function UsersPage() {
  const { users: issues } = useIssues();

  return (
    <>
      <Page.Header>
        <h2>{_("Users")}</h2>
      </Page.Header>

      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12}>
            <IssuesHint issues={issues} />
          </GridItem>
          <GridItem sm={12} xl={6}>
            <CardField label={_("First user")}>
              <CardBody>
                <FirstUser />
              </CardBody>
            </CardField>
          </GridItem>
          <GridItem sm={12} xl={6}>
            <CardField label={_("Root authentication")}>
              <CardBody>
                <RootAuthMethods />
              </CardBody>
            </CardField>
          </GridItem>
        </Grid>
      </Page.MainContent>
    </>
  );
}

/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { Grid, GridItem } from "@patternfly/react-core";
import { IssuesHint, Page } from "~/components/core";
import { FirstUser, RootAuthMethods } from "~/components/users";
import { useIssues } from "~/queries/issues";
import { _ } from "~/i18n";

export default function UsersPage() {
  const issues = useIssues("users");

  return (
    <Page>
      <Page.Header>
        <h2>{_("Users")}</h2>
      </Page.Header>

      <Page.Content editorSections={["user", "root"]}>
        <Grid hasGutter>
          <GridItem sm={12}>
            <IssuesHint issues={issues} />
          </GridItem>
          <GridItem sm={12} xl={6}>
            <FirstUser />
          </GridItem>
          <GridItem sm={12} xl={6}>
            <RootAuthMethods />
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}

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

import React, { useEffect, useState } from "react";
import {
  CardBody,
  EmptyState,
  EmptyStateHeader,
  EmptyStateBody,
  Grid,
  GridItem,
  Hint,
  HintBody,
  Icon,
  List,
  ListItem,
  Stack
} from "@patternfly/react-core";
import { useProduct } from "~/context/product";
import { useInstallerClient } from "~/context/installer";
import { Navigate, Link } from "react-router-dom";
import { CardField, Page, InstallButton } from "~/components/core";
import { _ } from "~/i18n";

const ReadyForInstallation = () => (
  <EmptyState variant="lg">
    <EmptyStateHeader
      headingLevel="h4"
      color="green"
      titleText={_("Ready for installation")}
      icon={<Icon name="error" size="xxl" />}
    />

    <EmptyStateBody>
      <InstallButton />
    </EmptyStateBody>
  </EmptyState>
);

const IssuesList = ({ issues }) => {
  const { isEmpty, ...scopes } = issues;
  const list = [];
  Object.entries(scopes).forEach(([scope, issues]) => {
    issues.forEach((issue, idx) => {
      const link = (
        <ListItem key={idx}>
          <Link to={scope}>{issue.description}</Link>
        </ListItem>
      );
      list.push(link);
    });
  });

  return (
    <>
      <p>{_("Before installing the system, you may need to solve the following issues:")}</p>
      <List>{list}</List>
    </>
  );
};

export default function OverviewPage() {
  const { selectedProduct } = useProduct();
  const [issues, setIssues] = useState([]);
  const client = useInstallerClient();

  useEffect(() => {
    client.issues().then(setIssues);
  }, [client]);

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
                  {issues.isEmpty ? <ReadyForInstallation /> : <IssuesList issues={issues} />}
                </Stack>
              </CardBody>
            </CardField>
          </GridItem>
        </Grid>
      </Page.MainContent>
    </Page>
  );
}

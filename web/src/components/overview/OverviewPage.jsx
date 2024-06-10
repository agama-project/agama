/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { useAtom } from "jotai";
import {
  CardBody,
  Grid,
  GridItem,
  Hint,
  HintBody,
  List,
  ListItem,
  Stack,
  Text,
  TextVariants,
  TextContent
} from "@patternfly/react-core";
import { useProduct } from "~/context/product";
import { useInstallerClient } from "~/context/installer";
import { Navigate, Link } from "react-router-dom";
import { CardField, EmptyState, Page, InstallButton } from "~/components/core";
import L10nSection from "./L10nSection";
import { fetchLocalesAtom, localesEffectAtom } from "~/atoms";
import { _ } from "~/i18n";

const ReadyForInstallation = () => (
  <EmptyState
    title={_("Ready for installation")}
    icon="check_circle"
    color="success-color-100"
  >
    <InstallButton />
  </EmptyState>
);

// FIXME: improve
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
    <EmptyState
      title={_("Before installing the system, you need to pay attention to the following tasks:")}
      icon="error"
      color="danger-color-100"
    >
      <List isPlain>
        {list}
      </List>
    </EmptyState>
  );
};

const SoftwareSummary = () => (
  <TextContent>
    <Text component={TextVariants.h3}>{_("Software")}</Text>
    <Text>{_("The installation will take 5 GiB including:")}</Text>
    <List>
      <ListItem>{_("GNOME Desktop")}</ListItem>
      <ListItem>{_("YaST Basic")}</ListItem>
    </List>
  </TextContent>
);

const StorageSummary = () => (
  <TextContent>
    <Text component={TextVariants.h3}>{_("Storage")}</Text>
    <Text>{_("The system will be installed on /dev/vda deleting all its content.")}</Text>
  </TextContent>
);

export default function OverviewPage() {
  const { selectedProduct } = useProduct();
  const [issues, setIssues] = useState([]);
  const client = useInstallerClient();
  const [, fetchLocales] = useAtom(fetchLocalesAtom);
  useAtom(localesEffectAtom);

  useEffect(() => {
    client.issues().then(setIssues);
    fetchLocales();
  }, [client, fetchLocales]);

  // FIXME: this check could be no longer needed
  if (selectedProduct === null) {
    return <Navigate to="/products" />;
  }

  return (
    <>
      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12}>
            <Hint>
              <HintBody>
                {_(
                  "Take your time to check your configuration before starting the installation process."
                )}
              </HintBody>
            </Hint>
          </GridItem>
          <GridItem sm={12} xl={6}>
            <CardField
              label="Overview"
              description={_(
                "These are the most relevant installation settings. Fell free to browse the sections in the menu for further details."
              )}
            >
              <CardBody>
                <Stack hasGutter>
                  <L10nSection />
                  <StorageSummary />
                  <SoftwareSummary />
                </Stack>
              </CardBody>
            </CardField>
          </GridItem>
          <GridItem sm={12} xl={6}>
            <CardField label="Installation">
              <CardBody>
                <Stack hasGutter>
                  {issues.isEmpty ? <ReadyForInstallation /> : <IssuesList issues={issues} />}
                </Stack>
              </CardBody>
            </CardField>
          </GridItem>
        </Grid>
      </Page.MainContent>
    </>
  );
}

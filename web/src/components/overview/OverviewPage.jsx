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
import {
  CardBody,
  Grid,
  GridItem,
  Hint,
  HintBody,
  NotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemBody,
  NotificationDrawerListItemHeader,
  Stack,
} from "@patternfly/react-core";
import { useInstallerClient } from "~/context/installer";
import { Link } from "react-router-dom";
import { Center } from "~/components/layout";
import { CardField, EmptyState, Page, InstallButton } from "~/components/core";
import L10nSection from "./L10nSection";
import StorageSection from "./StorageSection";
import SoftwareSection from "./SoftwareSection";
import { _ } from "~/i18n";
import { useAllIssues } from "~/queries/issues";
import { IssueSeverity } from "~/types/issues";

const SCOPE_HEADERS = {
  users: _("Users"),
  storage: _("Storage"),
  software: _("Software"),
};

const ReadyForInstallation = () => (
  <Center>
    <EmptyState title={_("Ready for installation")} icon="check_circle" color="success-color-100">
      <InstallButton />
    </EmptyState>
  </Center>
);

// FIXME: improve
const IssuesList = ({ issues }) => {
  const { isEmpty, issues: issuesByScope } = issues;
  const list = [];
  Object.entries(issuesByScope).forEach(([scope, issues], idx) => {
    issues.forEach((issue, subIdx) => {
      const variant = issue.severity === IssueSeverity.Error ? "warning" : "info";

      const link = (
        <NotificationDrawerListItem key={`${idx}-${subIdx}`} variant={variant} isHoverable={false}>
          <NotificationDrawerListItemHeader
            title={SCOPE_HEADERS[scope]}
            variant={variant}
            headingLevel="h4"
          />
          <NotificationDrawerListItemBody>
            <Link to={`/${scope}`}>{issue.description}</Link>
          </NotificationDrawerListItemBody>
        </NotificationDrawerListItem>
      );
      list.push(link);
    });
  });

  return (
    <NotificationDrawer>
      <NotificationDrawerBody>
        <NotificationDrawerList>{list}</NotificationDrawerList>
      </NotificationDrawerBody>
    </NotificationDrawer>
  );
};

export default function OverviewPage() {
  const client = useInstallerClient();
  const issues = useAllIssues();

  const resultSectionProps = issues.isEmpty
    ? {}
    : {
        label: _("Installation"),
        description: _("Before installing, please check the following problems."),
      };

  return (
    <>
      <Page.MainContent>
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
          <GridItem sm={12} xl={6}>
            <CardField
              label="Overview"
              description={_(
                "These are the most relevant installation settings. Feel free to browse the sections in the menu for further details.",
              )}
            >
              <CardBody>
                <Stack hasGutter>
                  <L10nSection />
                  <StorageSection />
                  <SoftwareSection />
                </Stack>
              </CardBody>
            </CardField>
          </GridItem>
          <GridItem sm={12} xl={6}>
            <CardField {...resultSectionProps}>
              <CardBody>
                {issues.isEmpty ? <ReadyForInstallation /> : <IssuesList issues={issues} />}
              </CardBody>
            </CardField>
          </GridItem>
        </Grid>
      </Page.MainContent>
    </>
  );
}

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

import React from "react";
import {
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
import { Link } from "react-router-dom";
import { Center } from "~/components/layout";
import { EmptyState, InstallButton, Page } from "~/components/core";
import L10nSection from "./L10nSection";
import StorageSection from "./StorageSection";
import SoftwareSection from "./SoftwareSection";
import { _ } from "~/i18n";
import { useAllIssues } from "~/queries/issues";
import { IssuesList as IssuesListType, IssueSeverity } from "~/types/issues";

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

const IssuesList = ({ issues }: { issues: IssuesListType }) => {
  const { issues: issuesByScope } = issues;
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

const ResultSection = () => {
  const issues = useAllIssues();

  const resultSectionProps = issues.isEmpty
    ? {}
    : {
        title: _("Installation"),
        description: _("Before installing, please check the following problems."),
      };

  return (
    <Page.Section {...resultSectionProps}>
      {issues.isEmpty ? <ReadyForInstallation /> : <IssuesList issues={issues} />}
    </Page.Section>
  );
};

const OverviewSection = () => (
  <Page.Section
    title="Overview"
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
          <GridItem sm={12} xl={6}>
            <OverviewSection />
          </GridItem>
          <GridItem sm={12} xl={6}>
            <ResultSection />
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}

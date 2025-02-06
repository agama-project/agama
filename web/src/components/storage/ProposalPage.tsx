/*
 * Copyright (c) [2022-2025] SUSE LLC
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
  Alert,
  Button,
  Content,
  Grid,
  GridItem,
  Split,
  SplitItem,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { Page } from "~/components/core/";
import { Icon, Loading } from "~/components/layout";
import ProposalResultSection from "./ProposalResultSection";
import ProposalTransactionalInfo from "./ProposalTransactionalInfo";
import ConfigEditor from "./ConfigEditor";
import ConfigEditorMenu from "./ConfigEditorMenu";
import { toValidationError } from "~/utils";
import { useIssues } from "~/queries/issues";
import { IssueSeverity } from "~/types/issues";
import {
  useAvailableDevices,
  useDeprecated,
  useDeprecatedChanges,
  useReprobeMutation,
} from "~/queries/storage";
import { useConfigModel } from "~/queries/storage/config-model";
import { _ } from "~/i18n";

const ErrorIcon = () => <Icon name="error" />;

function ProposalEmptyDevicesState() {
  return (
    <Page.Section>
      <EmptyState
        // variant="xl"
        titleText={_("No devices found")}
        // headingLevel="h1"
        icon={ErrorIcon}
        status="warning"
      >
        <EmptyStateBody>{_("todo")}</EmptyStateBody>
        <EmptyStateFooter>
          <Split hasGutter>
            <SplitItem>
              <Button variant="primary" size="lg" onClick={() => console.log("reload")}>
                {_("iscsi")}
              </Button>
            </SplitItem>
            <SplitItem>
              <Button variant="primary" size="lg" onClick={() => console.log("reload")}>
                {_("dasd")}
              </Button>
            </SplitItem>
          </Split>
        </EmptyStateFooter>
      </EmptyState>
    </Page.Section>
  );
}

function ProposalEmptyState() {
  return (
    <EmptyState
      variant="xl"
      titleText={_("No proposal possible with unknown settings")}
      headingLevel="h1"
      icon={ErrorIcon}
      status="warning"
    >
      <EmptyStateBody>{_("Please, check whether it is running.")}</EmptyStateBody>
      <EmptyStateFooter>
        <Button variant="primary" size="lg" onClick={() => console.log("reload")}>
          {_("Reload")}
        </Button>
      </EmptyStateFooter>
    </EmptyState>
  );
}

function ProposalSections() {
  const model = useConfigModel();
  const issues = useIssues("storage");

  const errors = issues.filter((s) => s.severity === IssueSeverity.Error).map(toValidationError);
  const isValid = errors.length === 0;
  const isEditable = model !== undefined;

  return (
    <Grid hasGutter>
      <ProposalTransactionalInfo />
      {!isValid && (
        <Alert variant="warning" title={_("Storage proposal not possible")}>
          {errors.map((e, i) => (
            <div key={i}>{e.message}</div>
          ))}
        </Alert>
      )}
      {!isEditable && (
        <Alert variant="warning" title={_("Storage settings cannot be edited")}>
          <div>{_("Explain and button (restart)")}</div>
        </Alert>
      )}
      {isEditable && (
        <GridItem sm={12} xl={8}>
          <Page.Section
            title={_("Installation Devices")}
            description={_(
              "Structure of the new system, including disks to use and additional devices like LVM volume groups.",
            )}
            actions={
              <>
                <SplitItem isFilled> </SplitItem>
                <SplitItem>
                  <ConfigEditorMenu />
                </SplitItem>
              </>
            }
          >
            <ConfigEditor />
          </Page.Section>
        </GridItem>
      )}
      {isValid && <ProposalResultSection />}
    </Grid>
  );
}

export default function ProposalPage() {
  const isDeprecated = useDeprecated();
  const model = useConfigModel();
  const devices = useAvailableDevices();
  const issues = useIssues("storage");
  const { mutateAsync: reprobe } = useReprobeMutation();

  useDeprecatedChanges();

  React.useEffect(() => {
    if (isDeprecated) reprobe().catch(console.log);
  }, [isDeprecated, reprobe]);

  const isValid = issues.length === 0;
  const isEditable = model !== undefined;
  // const isDevicesEmpty = devices.length === 0;
  console.log(devices);
  const isDevicesEmpty = true;

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Storage")}</Content>
      </Page.Header>
      <Page.Content>
        {isDeprecated && <Loading text={_("Reloading data, please wait...")} />}
        {!isDeprecated && !isDevicesEmpty && (isEditable || isValid) && <ProposalSections />}
        {!isDeprecated && !isDevicesEmpty && !isEditable && !isValid && <ProposalEmptyState />}
        {!isDeprecated && isDevicesEmpty && <ProposalEmptyDevicesState />}
      </Page.Content>
    </Page>
  );
}

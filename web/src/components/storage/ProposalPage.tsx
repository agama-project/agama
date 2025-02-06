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
import { Page, Link } from "~/components/core/";
import { Icon, Loading } from "~/components/layout";
import ProposalResultSection from "./ProposalResultSection";
import ProposalTransactionalInfo from "./ProposalTransactionalInfo";
import ConfigEditor from "./ConfigEditor";
import ConfigEditorMenu from "./ConfigEditorMenu";
import { toValidationError } from "~/utils";
import { useZFCPSupported } from "~/queries/storage/zfcp";
import { useDASDSupported } from "~/queries/storage/dasd";
import { useIssues } from "~/queries/issues";
import { IssueSeverity } from "~/types/issues";
import {
  useAvailableDevices,
  useDeprecated,
  useDeprecatedChanges,
  useReprobeMutation,
  useConfigMutation,
} from "~/queries/storage";
import { useConfigModel } from "~/queries/storage/config-model";
import { STORAGE as PATHS } from "~/routes/paths";
import { _ } from "~/i18n";

/** @todo Call to API method to reset the config instead of setting a config. */
function useResetConfig() {
  const { mutate } = useConfigMutation();
  return () =>
    mutate({
      drives: [
        {
          partitions: [{ search: "*", delete: true }, { generate: "default" }],
        },
      ],
    });
}

function ProposalEmptyDevicesState() {
  const isZFCPSupported = useZFCPSupported();
  const isDASDSupported = useDASDSupported();

  const description = _(
    "There are not devices available for the installation. Do you want to activate devices?",
  );

  return (
    <EmptyState
      titleText={_("No devices found")}
      icon={() => <Icon name="error" />}
      status="warning"
    >
      <EmptyStateBody>{description}</EmptyStateBody>
      <EmptyStateFooter>
        <Split hasGutter>
          <SplitItem>
            <Link to={PATHS.iscsi} variant="link">
              {_("Activate iSCSI")}
            </Link>
          </SplitItem>
          {isZFCPSupported && (
            <SplitItem>
              <Link to={PATHS.zfcp.root} variant="link">
                {_("Activate zFCP")}
              </Link>
            </SplitItem>
          )}
          {isDASDSupported && (
            <SplitItem>
              <Link to={PATHS.dasd} variant="link">
                {_("Activate DASD")}
              </Link>
            </SplitItem>
          )}
        </Split>
      </EmptyStateFooter>
    </EmptyState>
  );
}

function ProposalEmptyState() {
  const reset = useResetConfig();

  const description = _(
    "The current storage config cannot be edited. Do you want to reset the default config?",
  );
  return (
    <EmptyState
      titleText={_("Unknown storage config")}
      icon={() => <Icon name="error" />}
      status="warning"
    >
      <EmptyStateBody>{description}</EmptyStateBody>
      <EmptyStateFooter>
        <Button variant="secondary" onClick={reset}>
          {_("Reset")}
        </Button>
      </EmptyStateFooter>
    </EmptyState>
  );
}

function ProposalSections({ isEditable, errors }) {
  const reset = useResetConfig();
  const isValid = !errors.length;

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
        <Alert variant="info" title={_("Unknown storage config")}>
          <>
            {_(
              "The current storage config cannot be edited. Do you want to reset the default config?",
            )}
            <Button variant="plain" isInline onClick={reset}>
              {_("Reset")}
            </Button>
          </>
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
  const model = useConfigModel({ suspense: true });
  const devices = useAvailableDevices();
  const issues = useIssues("storage");
  const { mutateAsync: reprobe } = useReprobeMutation();

  useDeprecatedChanges();

  React.useEffect(() => {
    if (isDeprecated) reprobe().catch(console.log);
  }, [isDeprecated, reprobe]);

  const errors = issues.filter((s) => s.severity === IssueSeverity.Error).map(toValidationError);
  const isValid = !issues.length;
  const isEditable = !!model;
  const isDevicesEmpty = !devices.length;

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Storage")}</Content>
      </Page.Header>
      <Page.Content>
        {isDeprecated && <Loading text={_("Reloading data, please wait...")} />}
        {!isDeprecated && !isDevicesEmpty && (isEditable || isValid) && (
          <ProposalSections isEditable={isEditable} errors={errors} />
        )}
        {!isDeprecated && !isDevicesEmpty && !isEditable && !isValid && <ProposalEmptyState />}
        {!isDeprecated && isDevicesEmpty && <ProposalEmptyDevicesState />}
      </Page.Content>
    </Page>
  );
}

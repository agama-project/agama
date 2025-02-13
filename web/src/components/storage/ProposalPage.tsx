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
  List,
  ListItem,
} from "@patternfly/react-core";
import { Page, Link } from "~/components/core/";
import { Icon, Loading } from "~/components/layout";
import ProposalResultSection from "./ProposalResultSection";
import ProposalTransactionalInfo from "./ProposalTransactionalInfo";
import ProposalFailedInfo from "./ProposalFailedInfo";
import ConfigEditor from "./ConfigEditor";
import ConfigEditorMenu from "./ConfigEditorMenu";
import AddExistingDeviceMenu from "./AddExistingDeviceMenu";
import { Issue, IssueSeverity, IssueSource } from "~/types/issues";
import {
  useAvailableDevices,
  useConfigMutation,
  useDeprecated,
  useDeprecatedChanges,
  useReprobeMutation,
} from "~/queries/storage";
import { useConfigModel } from "~/queries/storage/config-model";
import { useZFCPSupported } from "~/queries/storage/zfcp";
import { useDASDSupported } from "~/queries/storage/dasd";
import { useIssues } from "~/queries/issues";
import { STORAGE as PATHS } from "~/routes/paths";
import { _ } from "~/i18n";

/** @todo Call to an API method to reset the default config instead of setting a config. */
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

type ErrorsEmptyStateProps = {
  errors: Issue[];
};

function ErrorsEmptyState({ errors }: ErrorsEmptyStateProps) {
  const reset = useResetConfig();

  return (
    <EmptyState
      titleText={_("Invalid storage settings")}
      icon={() => <Icon name="error" />}
      status="warning"
    >
      <EmptyStateBody>
        <p>{_("The current storage settings contains the following issues:")}</p>
        <List isPlain>
          {errors.map((e, i) => (
            <ListItem key={i}>{e.description}</ListItem>
          ))}
        </List>
      </EmptyStateBody>
      <EmptyStateFooter>
        <p>{_("Do you want to reset to the default settings?")}</p>
        <Button variant="secondary" onClick={reset}>
          {_("Reset")}
        </Button>
      </EmptyStateFooter>
    </EmptyState>
  );
}

function ConfigEmptyState() {
  const reset = useResetConfig();

  return (
    <EmptyState
      titleText={_("Unknown storage settings")}
      icon={() => <Icon name="error" />}
      status="warning"
    >
      <EmptyStateBody>
        <p>{_("The current storage settings cannot be edited.")}</p>
      </EmptyStateBody>
      <EmptyStateFooter>
        <p>{_("Do you want to reset to the default settings?")}</p>
        <Button variant="secondary" onClick={reset}>
          {_("Reset")}
        </Button>
      </EmptyStateFooter>
    </EmptyState>
  );
}

function DevicesEmptyState() {
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

type ProposalSectionsProps = {
  isEditable: boolean;
  isValid: boolean;
};

function ProposalSections({ isEditable, isValid }: ProposalSectionsProps): React.ReactNode {
  const reset = useResetConfig();

  return (
    <Grid hasGutter>
      <ProposalTransactionalInfo />
      <ProposalFailedInfo />
      {!isEditable && (
        <Alert variant="info" title={_("Unknown storage settings")}>
          <>
            {_(
              "The current storage settings cannot be edited. Do you want to reset to the default settings?",
            )}
            <Button variant="plain" isInline onClick={reset}>
              {_("Reset")}
            </Button>
          </>
        </Alert>
      )}
      {isEditable && (
        <GridItem sm={12}>
          <Page.Section
            title={_("Installation Devices")}
            description={_(
              "Structure of the new system, including disks to use and additional devices like LVM volume groups.",
            )}
            actions={
              <>
                <SplitItem isFilled> </SplitItem>
                <SplitItem>
                  <AddExistingDeviceMenu />
                </SplitItem>
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

/**
 * @fixme The UI for editing a config model is not prepared yet to properly work with a model that
 *  contains errors. For that reason, a config is considered as unknown (non-editable) if there is
 *  no model and also if there is some config error. In the future, components like ConfigEditor
 *  should be extended in order to make them to work with a model containg issues.
 */
export default function ProposalPage(): React.ReactNode {
  const isDeprecated = useDeprecated();
  const model = useConfigModel({ suspense: true });
  const devices = useAvailableDevices();
  const issues = useIssues("storage");
  const { mutateAsync: reprobe } = useReprobeMutation();

  useDeprecatedChanges();

  React.useEffect(() => {
    if (isDeprecated) reprobe().catch(console.log);
  }, [isDeprecated, reprobe]);

  const systemErrors = issues
    .filter((s) => s.severity === IssueSeverity.Error)
    .filter((s) => s.source === IssueSource.System);
  const configErrors = issues
    .filter((s) => s.severity === IssueSeverity.Error)
    .filter((s) => s.source === IssueSource.Config);
  const isValid = !systemErrors.length && !configErrors.length;
  const isEditable = model && !configErrors.length;
  const isDevicesEmpty = !devices.length;

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Storage")}</Content>
      </Page.Header>
      <Page.Content>
        {isDeprecated && <Loading text={_("Reloading data, please wait...")} />}
        {!isDeprecated && isDevicesEmpty && <DevicesEmptyState />}
        {!isDeprecated && !isDevicesEmpty && !isEditable && !isValid && !model && (
          <ConfigEmptyState />
        )}
        {!isDeprecated && !isDevicesEmpty && !isEditable && !isValid && model && (
          <ErrorsEmptyState errors={configErrors} />
        )}
        {!isDeprecated && !isDevicesEmpty && (isEditable || isValid) && (
          <ProposalSections isEditable={isEditable} isValid={isValid} />
        )}
      </Page.Content>
    </Page>
  );
}

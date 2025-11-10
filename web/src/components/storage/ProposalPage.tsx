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
import { Icon } from "~/components/layout";
import ConfigEditor from "./ConfigEditor";
import ConfigEditorMenu from "./ConfigEditorMenu";
import ConfigureDeviceMenu from "./ConfigureDeviceMenu";
import EncryptionSection from "./EncryptionSection";
import FixableConfigInfo from "./FixableConfigInfo";
import ProposalFailedInfo from "./ProposalFailedInfo";
import ProposalResultSection from "./ProposalResultSection";
import ProposalTransactionalInfo from "./ProposalTransactionalInfo";
import UnsupportedModelInfo from "./UnsupportedModelInfo";
import { useAvailableDevices } from "~/hooks/storage/system";
import { useResetConfig } from "~/hooks/storage/config";
import { useConfigModel } from "~/queries/storage/config-model";
import { useZFCPSupported } from "~/queries/storage/zfcp";
import { useDASDSupported } from "~/queries/storage/dasd";
import { useSystemIssues, useConfigIssues } from "~/hooks/storage/issues";
import { STORAGE as PATHS } from "~/routes/paths";
import { _, n_ } from "~/i18n";
import { useProgress, useProgressChanges } from "~/queries/progress";
import { useNavigate } from "react-router-dom";

function InvalidConfigEmptyState(): React.ReactNode {
  const errors = useConfigIssues();
  const reset = useResetConfig();

  return (
    <EmptyState
      titleText={_("Invalid storage settings")}
      icon={() => <Icon name="error" />}
      status="warning"
    >
      <EmptyStateBody>
        <Content component="p">
          {n_(
            "The current storage configuration has the following issue:",
            "The current storage configuration has the following issues:",
            errors.length,
          )}
        </Content>
        <List isPlain>
          {errors.map((e, i) => (
            <ListItem key={i}>{e.description}</ListItem>
          ))}
        </List>
      </EmptyStateBody>
      <EmptyStateFooter>
        <Content component="p">
          {_(
            "You may want to discard those settings and start from scratch with a simple configuration.",
          )}
        </Content>
        <Button variant="secondary" onClick={() => reset()}>
          {_("Reset to the default configuration")}
        </Button>
      </EmptyStateFooter>
    </EmptyState>
  );
}

function UnknowConfigEmptyState(): React.ReactNode {
  const reset = useResetConfig();

  return (
    <EmptyState
      titleText={_("Unable to modify the settings")}
      icon={() => <Icon name="error" />}
      status="warning"
    >
      <EmptyStateBody>
        <Content component="p">
          {_("The storage configuration uses elements not supported by this interface.")}
        </Content>
      </EmptyStateBody>
      <EmptyStateFooter>
        <Content component="p">
          {_(
            "You may want to discard the current settings and start from scratch with a simple configuration.",
          )}
        </Content>
        <Button variant="secondary" onClick={() => reset()}>
          {_("Reset to the default configuration")}
        </Button>
      </EmptyStateFooter>
    </EmptyState>
  );
}

function UnavailableDevicesEmptyState(): React.ReactNode {
  const isZFCPSupported = useZFCPSupported();
  const isDASDSupported = useDASDSupported();

  const description = _(
    "There are not disks available for the installation. You may need to configure some device.",
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
              {_("Connect to iSCSI targets")}
            </Link>
          </SplitItem>
          {isZFCPSupported && (
            <SplitItem>
              <Link to={PATHS.zfcp.root} variant="link">
                {_("Activate zFCP disks")}
              </Link>
            </SplitItem>
          )}
          {isDASDSupported && (
            <SplitItem>
              <Link to={PATHS.dasd} variant="link">
                {_("Manage DASD devices")}
              </Link>
            </SplitItem>
          )}
        </Split>
      </EmptyStateFooter>
    </EmptyState>
  );
}

function ProposalEmptyState(): React.ReactNode {
  const model = useConfigModel({ suspense: true });
  const availableDevices = useAvailableDevices();

  if (!availableDevices.length) return <UnavailableDevicesEmptyState />;

  return model ? <InvalidConfigEmptyState /> : <UnknowConfigEmptyState />;
}

function ProposalSections(): React.ReactNode {
  const model = useConfigModel({ suspense: true });
  const systemErrors = useSystemIssues();
  const hasResult = !systemErrors.length;

  return (
    <Grid hasGutter>
      <ProposalTransactionalInfo />
      <ProposalFailedInfo />
      <FixableConfigInfo />
      <UnsupportedModelInfo />
      {model && (
        <>
          <GridItem sm={8}>
            <Page.Section
              title={_("Installation Devices")}
              description={_(
                "Structure of the new system, including disks to use and additional devices like LVM volume groups.",
              )}
              actions={
                <>
                  <SplitItem>
                    <ConfigureDeviceMenu />
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
          <GridItem sm={4}>
            <EncryptionSection />
          </GridItem>
        </>
      )}
      {hasResult && <ProposalResultSection />}
    </Grid>
  );
}

/**
 * @fixme Extract components like ProposalSections, UnknownConfigEmptyState, etc, to separate files
 *  and test them individually. The proposal page should simply mount all those components.
 */
export default function ProposalPage(): React.ReactNode {
  const model = useConfigModel({ suspense: true });
  const availableDevices = useAvailableDevices();
  const systemErrors = useSystemIssues();
  const configErrors = useConfigIssues();
  const progress = useProgress("storage");
  const navigate = useNavigate();

  useProgressChanges();

  React.useEffect(() => {
    if (progress && !progress.finished) navigate(PATHS.progress);
  }, [progress, navigate]);

  const fixable = ["no_root", "required_filesystems", "vg_target_devices", "reused_md_member"];
  const unfixableErrors = configErrors.filter((e) => !fixable.includes(e.kind));
  const isModelEditable = model && !unfixableErrors.length;
  const hasDevices = !!availableDevices.length;
  const hasResult = !systemErrors.length;
  const showSections = hasDevices && (isModelEditable || hasResult);

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Storage")}</Content>
      </Page.Header>
      <Page.Content>
        {!showSections && <ProposalEmptyState />}
        {showSections && <ProposalSections />}
      </Page.Content>
    </Page>
  );
}

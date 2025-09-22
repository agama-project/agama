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

import React, { useState } from "react";
import {
  Button,
  Content,
  Grid,
  GridItem,
  Split,
  SplitItem,
  Stack,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  List,
  ListItem,
  Stack,
  Flex,
  FlexItem,
  Tab,
  Tabs,
  TabTitleText,
} from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { Page, Link } from "~/components/core/";
import { Icon, Loading } from "~/components/layout";
import ConfigEditor from "./ConfigEditor";
import ConfigureDeviceMenu from "./ConfigureDeviceMenu";
import ConnectedDevicesMenu from "./ConnectedDevicesMenu";
import EncryptionSection from "./EncryptionSection";
import FixableConfigInfo from "./FixableConfigInfo";
import ProposalFailedInfo from "./ProposalFailedInfo";
import ProposalResultSection from "./ProposalResultSection";
import ProposalTransactionalInfo from "./ProposalTransactionalInfo";
import UnsupportedModelInfo from "./UnsupportedModelInfo";
import { useAvailableDevices } from "~/hooks/storage/system";
import {
  useResetConfigMutation,
  useDeprecated,
  useDeprecatedChanges,
  useReprobeMutation,
} from "~/queries/storage";
import { useConfigModel } from "~/queries/storage/config-model";
import { useZFCPSupported } from "~/queries/storage/zfcp";
import { useDASDSupported } from "~/queries/storage/dasd";
import { useSystemErrors, useConfigErrors } from "~/queries/issues";
import { STORAGE as PATHS } from "~/routes/paths";
import { _, n_ } from "~/i18n";
import { useProgress, useProgressChanges } from "~/queries/progress";
import { useNavigate } from "react-router-dom";
import MenuButton from "../core/MenuButton";

function InvalidConfigEmptyState(): React.ReactNode {
  const errors = useConfigErrors("storage");
  const { mutate: reset } = useResetConfigMutation();

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
  const { mutate: reset } = useResetConfigMutation();

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
  const systemErrors = useSystemErrors("storage");
  const hasResult = !systemErrors.length;
  const { mutate: reset } = useResetConfigMutation();
  const [active, setActive] = useState(0);
  const handleTabClick = (
    event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    tabIndex: number,
  ) => {
    setActive(tabIndex);
  };

  return (
    <Grid hasGutter>
      <ProposalTransactionalInfo />
      <ProposalFailedInfo />
      <FixableConfigInfo />
      <UnsupportedModelInfo />
      {model && (
        <>
          <GridItem>
            <Page.Section
              title={_("Settings")}
              titleActions={
                <Flex>
                  <FlexItem grow={{ default: "grow" }} />
                  <ConfigureDeviceMenu />
                  <MenuButton
                    menuProps={{
                      popperProps: {
                        position: "end",
                      },
                    }}
                    toggleProps={{
                      variant: "plain",
                    }}
                    items={[
                      <MenuButton.Item
                        key="reset-link"
                        onClick={() => reset()}
                        description={_("Start from scratch with the default configuration")}
                      >
                        {_("Reset to defaults")}
                      </MenuButton.Item>,
                    ]}
                  >
                    <Icon name="more_horiz" className="agm-strong-icon" />
                  </MenuButton>
                </Flex>
              }
              description={_(
                "Changes in these settings will immediately update the 'Result' section below.",
              )}
            >
              <Tabs activeKey={active} onSelect={handleTabClick} role="region">
                <Tab
                  key="devices"
                  eventKey={0}
                  title={<TabTitleText>{_("Installation devices")}</TabTitleText>}
                >
                  <Stack hasGutter>
                    <div className={textStyles.textColorPlaceholder}>
                      {_(
                        "Structure of the new system, including disks to use and additional devices like LVM volume groups.",
                      )}
                    </div>
                    <ConfigEditor />
                  </Stack>
                </Tab>
                <Tab
                  key="encryption"
                  eventKey={1}
                  title={<TabTitleText>{_("Encryption")}</TabTitleText>}
                >
                  <EncryptionSection />
                </Tab>
                <Tab
                  key="system"
                  eventKey={2}
                  title={<TabTitleText>{_("Boot options")}</TabTitleText>}
                >
                  <Stack hasGutter>
                    <div className={textStyles.textColorPlaceholder}>
                      {_(
                        "To ensure the new system is able to boot, the installer may need to create or configure some \
                        partitions in the appropriate disk.",
                      )}
                    </div>
                    <div>{_("Description of the status and button to edit")}</div>
                  </Stack>
                </Tab>
              </Tabs>
            </Page.Section>
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
  const isDeprecated = useDeprecated();
  const model = useConfigModel({ suspense: true });
  const availableDevices = useAvailableDevices();
  const systemErrors = useSystemErrors("storage");
  const configErrors = useConfigErrors("storage");
  const { mutateAsync: reprobe } = useReprobeMutation();
  const progress = useProgress("storage");
  const navigate = useNavigate();

  useProgressChanges();
  useDeprecatedChanges();

  React.useEffect(() => {
    if (isDeprecated) reprobe().catch(console.log);
  }, [isDeprecated, reprobe]);

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
        <Flex>
          <FlexItem>
            <Content component="h2">{_("Storage")}</Content>
          </FlexItem>
          <FlexItem grow={{ default: "grow" }} />
          <FlexItem>
            <ConnectedDevicesMenu />
          </FlexItem>
        </Flex>
      </Page.Header>
      <Page.Content>
        {isDeprecated && <Loading text={_("Reloading data, please wait...")} />}
        {!isDeprecated && !showSections && <ProposalEmptyState />}
        {!isDeprecated && showSections && <ProposalSections />}
      </Page.Content>
    </Page>
  );
}

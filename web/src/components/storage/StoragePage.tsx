/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { Grid, Stack, Tab, Tabs, TabTitleText } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { NestedContent } from "~/components/core/";
import Page from "~/components/layout/Page";
import Icon from "~/components/layout/Icon";
import MenuButton from "~/components/core/MenuButton";
import ConfigEditor from "./ConfigEditor";
import ConnectedDevicesMenu from "./ConnectedDevicesMenu";
import EncryptionSection from "./EncryptionSection";
import BootSection from "./BootSection";
import FixableConfigInfo from "./FixableConfigInfo";
import ProposalFailedInfo from "./ProposalFailedInfo";
import ProposalResultSection from "./ProposalResultSection";
import UnsupportedModelInfo from "./UnsupportedModelInfo";
import InvalidConfigMessage from "./storage-page/InvalidConfigMessage";
import NoDevicesMessage from "./storage-page/NoDevicesMessage";
import UnknownConfigMessage from "./storage-page/UnknownConfigMessage";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { useIssues } from "~/hooks/model/issue";
import { useReset } from "~/hooks/model/config/storage";
import { useProposal } from "~/hooks/model/proposal/storage";
import { STORAGE_MODEL_QUERY_KEY, useConfigModel } from "~/hooks/model/storage/config-model";
import { PROPOSAL_QUERY_KEY } from "~/hooks/model/proposal";
import { _ } from "~/i18n";
import { useSearchParamState, useClearSearchParams } from "~/hooks/use-search-param-state";
import { EXPANDED, SETTINGS_TAB } from "~/components/storage/ui-state-params";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import IssuesAlert from "~/components/core/IssuesAlert";

function ModelSection(): React.ReactNode {
  const [activeTab, setActiveTab] = useSearchParamState(SETTINGS_TAB, "0");
  const clearSearchParams = useClearSearchParams();
  const reset = useReset();
  const handleTabClick = (
    event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    tabIndex: number,
  ) => setActiveTab(tabIndex);

  const onReset = () => {
    reset();
    clearSearchParams(EXPANDED, SETTINGS_TAB);
  };

  return (
    <Page.Section
      isFullHeight
      title={_("Settings")}
      titleActions={
        <MenuButton
          menuProps={{
            popperProps: {
              position: "end",
            },
          }}
          toggleProps={{
            variant: "plain",
            className: spacingStyles.p_0,
          }}
          items={[
            <MenuButton.Item
              key="reset-link"
              onClick={onReset}
              description={_("Start from scratch with the default configuration")}
            >
              {_("Reset to defaults")}
            </MenuButton.Item>,
          ]}
        >
          <Icon name="more_horiz" className="agm-three-dots-icon" />
        </MenuButton>
      }
      description={_(
        "Changes in these settings will immediately update the 'Result' section below.",
      )}
    >
      <Tabs activeKey={activeTab} onSelect={handleTabClick} role="region">
        <Tab
          key="devices"
          eventKey={"0"}
          title={<TabTitleText>{_("Installation devices")}</TabTitleText>}
        >
          <NestedContent margin="mtSm">
            <Stack hasGutter>
              <div className={textStyles.textColorPlaceholder}>
                {_(
                  "Structure of the new system, including disks to use and additional devices like LVM volume groups.",
                )}
              </div>
              <ConfigEditor />
            </Stack>
          </NestedContent>
        </Tab>
        <Tab key="encryption" eventKey={"1"} title={<TabTitleText>{_("Encryption")}</TabTitleText>}>
          <NestedContent margin="mtSm">
            <EncryptionSection />
          </NestedContent>
        </Tab>
        <Tab key="system" eventKey={"2"} title={<TabTitleText>{_("Boot options")}</TabTitleText>}>
          <NestedContent margin="mtSm">
            <BootSection />
          </NestedContent>
        </Tab>
      </Tabs>
    </Page.Section>
  );
}

function StoragePageContent(): React.ReactNode {
  const model = useConfigModel();
  const availableDevices = useAvailableDevices();
  const proposal = useProposal();
  const issues = useIssues("storage");

  const fixable = [
    "configNoRoot",
    "configMissingPaths",
    "configOverusedPvTarget",
    "configMisusedMdMember",
    "configMisusedPv",
    "proposal",
  ];
  const configIssues = issues.filter((i) => i.class !== "proposal");
  const unfixableIssues = issues.filter((i) => !fixable.includes(i.class));
  const isModelEditable = model && !unfixableIssues.length;

  if (!availableDevices.length) return <NoDevicesMessage />;
  if (configIssues.length && !isModelEditable)
    return <InvalidConfigMessage issues={configIssues} />;
  if (!configIssues.length && !model && !proposal) return <UnknownConfigMessage />;

  return (
    <Grid hasGutter>
      {!configIssues.length && !proposal && <ProposalFailedInfo />}
      {!!configIssues.length && <FixableConfigInfo issues={configIssues} />}
      {!model && <UnsupportedModelInfo />}
      {model && <ModelSection />}
      {proposal && <ProposalResultSection />}
    </Grid>
  );
}

/**
 * @fixme Extract components like ProposalSections, ModelSection, etc, to separate files
 *  and test them individually. The storage page should simply mount all those components.
 */
export default function StoragePage(): React.ReactNode {
  const zfcpIssues = useIssues("zfcp");

  return (
    <Page
      breadcrumbs={[{ label: _("Storage") }]}
      additionalContent={<ConnectedDevicesMenu />}
      progress={{
        scope: "storage",
        awaitQueriesRefetch: [PROPOSAL_QUERY_KEY, STORAGE_MODEL_QUERY_KEY],
      }}
    >
      <Page.Content>
        <IssuesAlert issues={zfcpIssues} />
        <StoragePageContent />
      </Page.Content>
    </Page>
  );
}

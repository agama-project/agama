/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { Skeleton, Stack, Tab, Tabs, TabTitleText } from "@patternfly/react-core";
import SmallWarning from "~/components/core/SmallWarning";
import { Page, NestedContent } from "~/components/core";
import DevicesManager from "~/storage/helpers/devices-manager";
import ProposalResultTable from "~/components/storage/ProposalResultTable";
import { ProposalActionsDialog } from "~/components/storage";
import { _, n_, formatList } from "~/i18n";
import { useDevices as useSystemDevices } from "~/hooks/api/system/storage";
import { useDevices as useProposalDevices, useActions } from "~/hooks/api/proposal/storage";
import { sprintf } from "sprintf-js";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { useStorageUiState } from "~/context/storage-ui-state";

/**
 * @todo Create a component for rendering a customized skeleton
 */
const ResultSkeleton = () => (
  <Stack hasGutter>
    <Skeleton
      screenreaderText={_("Waiting for information about storage configuration")}
      width="80%"
    />
    <Skeleton width="65%" />
    <Skeleton width="70%" />
  </Stack>
);

/**
 * Renders information about delete actions
 */
const DeletionsInfo = ({ manager }: { manager: DevicesManager }) => {
  let label;
  const systems = manager.deletedSystems();
  const deleteActions = manager.actions.filter((a) => a.delete && !a.subvol).length;
  const hasDeleteActions = deleteActions !== 0;

  if (!hasDeleteActions) return;

  // FIXME: building the string by pieces like this is not i18n-friendly
  if (systems.length) {
    label = sprintf(
      // TRANSLATORS: %d will be replaced by the amount of destructive actions and %s will be replaced
      // by a formatted list of affected systems like "Windows and openSUSE Tumbleweed".
      n_(
        "There is %d destructive action planned affecting %s",
        "There are %d destructive actions planned affecting %s",
        deleteActions,
      ),
      deleteActions,
      formatList(systems),
    );
  } else {
    label = sprintf(
      // TRANSLATORS: %d will be replaced by the amount of destructive actions
      n_(
        "There is %d destructive action planned",
        "There are %d destructive actions planned",
        deleteActions,
      ),
      deleteActions,
    );
  }

  return <SmallWarning text={label} />;
};

export type ActionsListProps = {
  manager: DevicesManager;
};

function ActionsList({ manager }: ActionsListProps) {
  const actions = manager.actions;

  return (
    <Stack hasGutter>
      <DeletionsInfo manager={manager} />
      <ProposalActionsDialog actions={actions} />
    </Stack>
  );
}

export type ProposalResultSectionProps = {
  isLoading?: boolean;
};

export default function ProposalResultSection({ isLoading = false }: ProposalResultSectionProps) {
  const { uiState, setUiState } = useStorageUiState();
  const system = useSystemDevices();
  const staging = useProposalDevices();
  const actions = useActions();
  const devicesManager = new DevicesManager(system, staging, actions);
  const handleTabClick = (
    event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    tabIndex: number,
  ) => {
    setUiState((state) => {
      state.set("rt", tabIndex.toString());
      return state;
    });
  };

  if (isLoading) return <ResultSkeleton />;

  return (
    <Page.Section
      title={_("Result")}
      description={_(
        "Result of applying the configuration described at the 'Settings' section above.",
      )}
    >
      <Tabs activeKey={uiState.get("rt") || "0"} onSelect={handleTabClick} role="region">
        <Tab key="action" eventKey={"0"} title={<TabTitleText>{_("Actions")}</TabTitleText>}>
          <NestedContent margin="mtSm">
            <Stack hasGutter>
              <div className={textStyles.textColorPlaceholder}>
                {_("The following actions will be performed in the system during installation.")}
              </div>
              <ActionsList manager={devicesManager} />
            </Stack>
          </NestedContent>
        </Tab>
        <Tab key="staging" eventKey={"1"} title={<TabTitleText>{_("Final layout")}</TabTitleText>}>
          <NestedContent margin="mtSm">
            <Stack hasGutter>
              <div className={textStyles.textColorPlaceholder}>
                {_("Final structure of the system after installation.")}
              </div>
              <ProposalResultTable devicesManager={devicesManager} />
            </Stack>
          </NestedContent>
        </Tab>
      </Tabs>
    </Page.Section>
  );
}

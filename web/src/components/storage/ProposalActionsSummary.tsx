/*
 * Copyright (c) [2024] SUSE LLC
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
import { Button, Skeleton, Stack, List, ListItem } from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import DevicesManager from "~/components/storage/DevicesManager";
import { _, n_ } from "~/i18n";
import { sprintf } from "sprintf-js";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { PATHS } from "~/routes/storage";
import { Action, SpaceAction, StorageDevice } from "~/types/storage";
import { SpacePolicy } from "./utils";
import { ValidationError } from "~/client/mixins";

/**
 * Renders information about delete actions
 */
const DeletionsInfo = ({
  policy,
  manager,
  spaceActions,
}: {
  policy: SpacePolicy | undefined;
  manager: DevicesManager;
  spaceActions: SpaceAction[];
}) => {
  let label: React.ReactNode;
  let systemsLabel: React.ReactNode;
  const systems = manager.deletedSystems();
  const deleteActions = manager.actions.filter((a) => a.delete && !a.subvol).length;
  const isDeletePolicy = policy?.id === "delete";
  const hasDeleteActions = deleteActions !== 0;

  if (!isDeletePolicy && spaceActions.length === 0) {
    label = _("Destructive actions are not allowed");
  } else if ((isDeletePolicy || spaceActions.length > 0) && !hasDeleteActions) {
    label = _("Destructive actions are allowed");
  } else if (hasDeleteActions) {
    // TRANSLATORS: %d will be replaced by the amount of destructive actions
    label = (
      <strong className={textStyles.warningColor_200}>
        {sprintf(
          n_(
            "There is %d destructive action planned",
            "There are %d destructive actions planned",
            deleteActions,
          ),
          deleteActions,
        )}
      </strong>
    );
  }

  if (systems.length) {
    // FIXME: Use the Intl.ListFormat instead of the `join(", ")` used below.
    // Most probably, a `listFormat` or similar wrapper should live in src/i18n.js or so.
    // Read https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat
    systemsLabel = (
      <>
        {_("affecting")} <strong>{systems.join(", ")}</strong>
      </>
    );
  }

  return (
    <ListItem key="destructive">
      {label} {systemsLabel}
    </ListItem>
  );
};

/**
 * Renders information about resize actions
 */
const ResizesInfo = ({
  policy,
  manager,
  validProposal,
  spaceActions,
}: {
  policy: SpacePolicy | undefined;
  manager: DevicesManager;
  validProposal: boolean;
  spaceActions: SpaceAction[];
}) => {
  let label: React.ReactNode;
  let systemsLabel: React.ReactNode;
  const systems = manager.resizedSystems();
  const resizeActions = manager.actions.filter((a) => a.resize).length;
  const isResizePolicy = policy?.id === "resize";
  const hasResizeActions = resizeActions !== 0;

  if (!isResizePolicy && spaceActions.length === 0) {
    label = _("Shrinking partitions is not allowed");
  }

  if (!validProposal && (isResizePolicy || spaceActions.length > 0)) {
    label = _("Shrinking partitions is allowed");
  } else if (validProposal && (isResizePolicy || spaceActions.length > 0) && !hasResizeActions) {
    label = _("Shrinking some partitions is allowed but not needed");
  } else if (hasResizeActions) {
    label = sprintf(
      n_("%d partition will be shrunk", "%d partitions will be shrunk", resizeActions),
      resizeActions,
    );
  }

  if (systems.length) {
    // FIXME: Use the Intl.ListFormat instead of the `join(", ")` used below.
    // Most probably, a `listFormat` or similar wrapper should live in src/i18n.js or so.
    // Read https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat
    systemsLabel = (
      <>
        {_("affecting")} <strong>{systems.join(", ")}</strong>
      </>
    );
  }

  return (
    <ListItem key="resize">
      {label} {systemsLabel}
    </ListItem>
  );
};

/**
 * Renders needed UI elements to allow user check the proposal planned actions
 * @component
 */
const ActionsInfo = ({
  actions,
  validProposal,
  onClick,
}: {
  actions: Action[];
  validProposal: boolean;
  onClick: () => void;
}) => {
  let label: React.ReactNode;

  if (!validProposal) {
    label = (
      <span className={textStyles.dangerColor_200}>
        {_("Cannot accommodate the required file systems for installation")}
      </span>
    );
  } else {
    // TRANSLATORS: %d will be replaced by the number of proposal actions.
    label = (
      <Button onClick={onClick} variant="link" isInline>
        {sprintf(
          n_("Check the planned action", "Check the %d planned actions", actions.length),
          actions.length,
        )}
      </Button>
    );
  }

  return <ListItem key="actions">{label}</ListItem>;
};

const ActionsSkeleton = () => (
  <Stack hasGutter>
    <Skeleton
      fontSize="sm"
      width="65%"
      screenreaderText={_("Waiting for actions information...")}
    />
    <Skeleton fontSize="sm" width="55%" />
    <Skeleton fontSize="sm" width="75%" />
  </Stack>
);

export type ProposalActionsSummaryProps = {
  isLoading: boolean;
  errors: ValidationError[];
  policy: SpacePolicy | undefined;
  system: StorageDevice[];
  staging: StorageDevice[];
  actions: Action[];
  spaceActions: SpaceAction[];
  devices: StorageDevice[];
  onActionsClick: () => void | undefined;
};

/**
 * Allows to select the space policy.
 * @component
 *
 * @param {object} props
 */
export default function ProposalActionsSummary({
  isLoading,
  errors = [],
  policy,
  system = [],
  staging = [],
  actions = [],
  spaceActions = [],
  devices,
  onActionsClick,
}: ProposalActionsSummaryProps) {
  let value: React.ReactNode;

  if (isLoading || !policy) {
    value = <Skeleton fontSize="sm" width="65%" />;
  } else if (policy.summaryLabels.length === 1) {
    // eslint-disable-next-line agama-i18n/string-literals
    value = _(policy.summaryLabels[0]);
  } else {
    value = sprintf(
      // eslint-disable-next-line agama-i18n/string-literals
      n_(policy.summaryLabels[0], policy.summaryLabels[1], devices.length),
      devices.length,
    );
  }

  const devicesManager = new DevicesManager(system, staging, actions);

  return (
    <Page.Section
      title={_("Actions")}
      value={value}
      actions={
        isLoading ? (
          <Skeleton fontSize="sm" width="100px" />
        ) : (
          <Link to={PATHS.spacePolicy}>{_("Change")}</Link>
        )
      }
      pfCardProps={{ isFullHeight: false }}
    >
      {isLoading ? (
        <ActionsSkeleton />
      ) : (
        <List>
          <DeletionsInfo
            policy={policy}
            manager={devicesManager}
            spaceActions={spaceActions.filter((a) => a.action === "force_delete")}
          />
          <ResizesInfo
            policy={policy}
            manager={devicesManager}
            validProposal={errors.length === 0}
            spaceActions={spaceActions.filter((a) => a.action === "resize")}
          />
          <ActionsInfo
            actions={actions}
            validProposal={errors.length === 0}
            onClick={onActionsClick}
          />
        </List>
      )}
    </Page.Section>
  );
}

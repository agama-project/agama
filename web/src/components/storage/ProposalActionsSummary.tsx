/*
 * Copyright (c) [2024] SUSE LLC
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
import { Button, Skeleton, Stack, List, ListItem } from "@patternfly/react-core";
import { Page } from "~/components/core";
import DevicesManager from "~/components/storage/DevicesManager";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { Action, StorageDevice } from "~/types/storage";
import { ValidationError } from "~/types/issues";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";

/**
 * Renders information about delete actions
 */
const DeletionsInfo = ({ manager }: { manager: DevicesManager }) => {
  let label: React.ReactNode;
  let systemsLabel: React.ReactNode;
  const systems = manager.deletedSystems();
  const deleteActions = manager.actions.filter((a) => a.delete && !a.subvol).length;
  const hasDeleteActions = deleteActions !== 0;

  if (hasDeleteActions) {
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
  } else {
    label = _("No destructive actions are planned");
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
const ResizesInfo = ({ manager }: { manager: DevicesManager }) => {
  let label: React.ReactNode;
  let systemsLabel: React.ReactNode;
  const systems = manager.resizedSystems();
  const resizeActions = manager.actions.filter((a) => a.resize).length;
  const hasResizeActions = resizeActions !== 0;

  if (hasResizeActions) {
    label = sprintf(
      n_("%d partition will be shrunk", "%d partitions will be shrunk", resizeActions),
      resizeActions,
    );
  } else {
    label = _("No partitions wil be shrunk");
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
  system: StorageDevice[];
  staging: StorageDevice[];
  actions: Action[];
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
  system = [],
  staging = [],
  actions = [],
  onActionsClick,
}: ProposalActionsSummaryProps) {
  const devicesManager = new DevicesManager(system, staging, actions);

  return (
    <Page.Section title={_("Actions")} pfCardProps={{ isFullHeight: false }}>
      {isLoading ? (
        <ActionsSkeleton />
      ) : (
        <List>
          <DeletionsInfo manager={devicesManager} />
          <ResizesInfo manager={devicesManager} />
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

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

// @ts-check

import React from "react";
import { Button, Skeleton, Stack, List, ListItem } from "@patternfly/react-core";
import { CardField, Link } from "~/components/core";
import DevicesManager from "~/components/storage/DevicesManager";
import { _, n_ } from "~/i18n";
import { sprintf } from "sprintf-js";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { PATHS } from "~/routes/storage";

/**
 * @typedef {import ("~/client/storage").Action} Action
 * @typedef {import ("~/client/storage").SpaceAction} SpaceAction
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/components/storage/utils").SpacePolicy} SpacePolicy
 * @typedef {import("~/client/mixins").ValidationError} ValidationError
 */

/**
 * Renders information about delete actions
 *
 * @param {object} props
 * @param {SpacePolicy|undefined} props.policy
 * @param {DevicesManager} props.manager
 * @param {SpaceAction[]} props.spaceActions
 */
const DeletionsInfo = ({ policy, manager, spaceActions }) => {
  let label;
  let systemsLabel;
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
 *
 * @param {object} props
 * @param {SpacePolicy|undefined} props.policy
 * @param {DevicesManager} props.manager
 * @param {boolean} props.validProposal
 * @param {SpaceAction[]} props.spaceActions
 */
const ResizesInfo = ({ policy, manager, validProposal, spaceActions }) => {
  let label;
  let systemsLabel;
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
 *
 * @param {object} props
 * @param {Action[]} props.actions
 * @param {boolean} props.validProposal
 * @param {() => void} props.onClick
 */
const ActionsInfo = ({ actions, validProposal, onClick }) => {
  let label;

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

/**
 * Allows to select the space policy.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isLoading
 * @param {ValidationError[]} [props.errors=[]] - Validation errors
 * @param {SpacePolicy|undefined} props.policy
 * @param {StorageDevice[]} [props.system=[]]
 * @param {StorageDevice[]} [props.staging=[]]
 * @param {Action[]} [props.actions=[]]
 * @param {SpaceAction[]} [props.spaceActions=[]]
 * @param {StorageDevice[]} props.devices
 * @param {() => void|undefined} props.onActionsClick
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
}) {
  let value;
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
    <CardField
      label={_("Actions")}
      actions={
        isLoading ? (
          <Skeleton fontSize="sm" width="100px" />
        ) : (
          <Link to={PATHS.spacePolicy}>{_("Change")}</Link>
        )
      }
      cardProps={{ isFullHeight: false }}
    >
      <CardField.Content>
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
      </CardField.Content>
    </CardField>
  );
}

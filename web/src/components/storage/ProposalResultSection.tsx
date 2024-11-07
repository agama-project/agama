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

import React, { useState } from "react";
import { Alert, ExpandableSection, Skeleton, Stack } from "@patternfly/react-core";
import { EmptyState, Page } from "~/components/core";
import DevicesManager from "~/components/storage/DevicesManager";
import ProposalResultTable from "~/components/storage/ProposalResultTable";
import { ProposalActionsDialog } from "~/components/storage";
import { _, n_, formatList } from "~/i18n";
import { Action, StorageDevice } from "~/types/storage";
import { ValidationError } from "~/types/issues";

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

  return <Alert variant="warning" isPlain isInline title={label} />;
};

export type ActionsListProps = {
  manager: DevicesManager;
};

function ActionsList({ manager }: ActionsListProps) {
  const actions = manager.actions;
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleText = isExpanded
    ? _("Collapse the list of planned actions")
    : sprintf(_("Check the %d planned actions"), actions.length);

  return (
    <Stack>
      <DeletionsInfo manager={manager} />
      <ExpandableSection
        isIndented
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        toggleText={toggleText}
      >
        <ProposalActionsDialog actions={actions} />
      </ExpandableSection>
    </Stack>
  );
}

export type ProposalResultSectionProps = {
  system?: StorageDevice[];
  staging?: StorageDevice[];
  actions?: Action[];
  errors?: ValidationError[];
  isLoading?: boolean;
};

export default function ProposalResultSection({
  system = [],
  staging = [],
  actions = [],
  errors = [],
  isLoading = false,
}: ProposalResultSectionProps) {
  const devicesManager = new DevicesManager(system, staging, actions);

  return (
    <Page.Section
      title={_("Result")}
      description={_(
        "During installation, several actions will be performed to setup the layout shown at the table below.",
      )}
    >
      {isLoading && <ResultSkeleton />}
      {errors.length === 0 ? (
        <Stack>
          <ActionsList manager={devicesManager} />
          <ProposalResultTable devicesManager={devicesManager} />
        </Stack>
      ) : (
        <EmptyState
          icon="error"
          title={_("Storage proposal not possible")}
          color="danger-color-100"
        >
          {errors.map((e, i) => (
            <div key={i}>{e.message}</div>
          ))}
        </EmptyState>
      )}
    </Page.Section>
  );
}

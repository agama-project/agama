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

import React, { useEffect, useState } from "react";
import { Alert, ExpandableSection, Stack } from "@patternfly/react-core";
import { Page } from "~/components/core";
import DevicesManager from "~/components/storage/DevicesManager";
import ProposalResultTable from "~/components/storage/ProposalResultTable";
import { ProposalActionsDialog } from "~/components/storage";
import { _, n_, formatList } from "~/i18n";
import { useActions, useDevices } from "~/queries/storage";
import { sprintf } from "sprintf-js";
import { useInstallerClient } from "~/context/installer";
import { isNullish } from "radashi";
import { StorageDevice } from "~/types/storage";
import { Action } from "~/api/storage/types";

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

type Result = {
  system: StorageDevice[];
  staging: StorageDevice[];
  actions: Action[];
};

const useProposalResult = () => {
  const client = useInstallerClient();
  const system = useDevices("system", { suspense: true });
  const staging = useDevices("result", { suspense: true });
  const actions = useActions();
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    if (isNullish(result) && [system, staging, actions].every((e) => e)) {
      setResult({ system, staging, actions });
    }
  }, [result, system, staging, actions]);

  useEffect(() => {
    return client.onEvent((event) => {
      event.type === "StorageChanged" &&
        event.clientId === client.id &&
        setResult({ system, staging, actions });
    });
  }, [client, result, system, staging, actions]);

  return { system, staging, actions };
};

export default function ProposalResultSection() {
  const { system, staging, actions } = useProposalResult();
  const devicesManager = new DevicesManager(system, staging, actions);

  return (
    <Page.Section
      title={_("Result")}
      description={_(
        "During installation, several actions will be performed to setup the layout shown at the table below.",
      )}
    >
      <Stack>
        <ActionsList manager={devicesManager} />
        <ProposalResultTable devicesManager={devicesManager} />
      </Stack>
    </Page.Section>
  );
}

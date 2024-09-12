/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import React, { useReducer, useEffect, useRef } from "react";
import { Grid, GridItem, Stack } from "@patternfly/react-core";
import { Page, Drawer } from "~/components/core/";
import ProposalTransactionalInfo from "./ProposalTransactionalInfo";
import ProposalSettingsSection from "./ProposalSettingsSection";
import ProposalResultSection from "./ProposalResultSection";
import ProposalActionsSummary from "~/components/storage/ProposalActionsSummary";
import { ProposalActionsDialog } from "~/components/storage";
import { _ } from "~/i18n";
import { SPACE_POLICIES } from "~/components/storage/utils";
import { toValidationError } from "~/utils";
import { useIssues } from "~/queries/issues";
import { IssueSeverity } from "~/types/issues";
import {
  useAvailableDevices,
  useDeprecated,
  useDevices,
  useProductParams,
  useProposalMutation,
  useProposalResult,
  useVolumeDevices,
  useVolumeTemplates,
} from "~/queries/storage";
import { useQueryClient } from "@tanstack/react-query";
import { refresh } from "~/api/storage";

/**
 * Which UI item is being changed by user
 */
export const CHANGING = Object.freeze({
  ENCRYPTION: Symbol("encryption"),
  TARGET: Symbol("target"),
  VOLUMES: Symbol("volumes"),
  POLICY: Symbol("policy"),
  BOOT: Symbol("boot"),
});

// mapping of not affected values for settings components
// key:   component name
// value: list of items which can be changed without affecting
//        the state of the component
export const NOT_AFFECTED = {
  // the EncryptionField shows the skeleton only during initial load,
  // it does not depend on any changed item and does not show skeleton later.
  // the ProposalResultSection is refreshed always
  InstallationDeviceField: [CHANGING.ENCRYPTION, CHANGING.BOOT, CHANGING.POLICY, CHANGING.VOLUMES],
  PartitionsField: [CHANGING.ENCRYPTION, CHANGING.POLICY],
  ProposalActionsSummary: [CHANGING.ENCRYPTION, CHANGING.TARGET],
};

export default function ProposalPage() {
  const drawerRef = useRef();
  const systemDevices = useDevices("system");
  const stagingDevices = useDevices("result");
  const availableDevices = useAvailableDevices();
  const volumeDevices = useVolumeDevices();
  const volumeTemplates = useVolumeTemplates();
  const { encryptionMethods } = useProductParams({ suspense: true });
  const { actions, settings } = useProposalResult();
  const updateProposal = useProposalMutation();
  const deprecated = useDeprecated();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (deprecated) {
      refresh().then(() => {
        queryClient.invalidateQueries({ queryKey: ["storage"] });
      });
    }

  }, [deprecated]);

  const errors = useIssues("storage")
    .filter((s) => s.severity === IssueSeverity.Error)
    .map(toValidationError);

  const changeSettings = async (changing, updated: object) => {
    const newSettings = { ...settings, ...updated };
    updateProposal.mutateAsync(newSettings).catch(console.error);
  };

  const spacePolicy = SPACE_POLICIES.find((p) => p.id === settings.spacePolicy);

  return (
    <Page>
      <Page.Header>
        <h2>{_("Storage")}</h2>
      </Page.Header>
      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12}>
            <ProposalTransactionalInfo settings={settings} />
          </GridItem>
          <GridItem sm={12} xl={6}>
            <ProposalSettingsSection
              availableDevices={availableDevices}
              volumeDevices={volumeDevices}
              encryptionMethods={encryptionMethods}
              volumeTemplates={volumeTemplates}
              settings={settings}
              onChange={changeSettings}
              isLoading={false}
            />
          </GridItem>
          <GridItem sm={12} xl={6}>
            <Drawer
              ref={drawerRef}
              panelHeader={<h4>{_("Planned Actions")}</h4>}
              panelContent={<ProposalActionsDialog actions={actions} />}
            >
              <Stack hasGutter>
                <ProposalActionsSummary
                  policy={spacePolicy}
                  system={systemDevices}
                  staging={stagingDevices}
                  errors={errors}
                  actions={actions}
                  spaceActions={settings.spaceActions}
                  devices={settings.installationDevices}
                  // @ts-expect-error: we do not know how to specify the type of
                  // drawerRef properly and TS does not find the "open" property
                  onActionsClick={drawerRef.current?.open}
                  isLoading={false}
                />
                <ProposalResultSection
                  system={systemDevices}
                  staging={stagingDevices}
                  actions={actions}
                  errors={errors}
                  isLoading={false}
                />
              </Stack>
            </Drawer>
          </GridItem>
        </Grid>
      </Page.MainContent>
    </Page>
  );
}

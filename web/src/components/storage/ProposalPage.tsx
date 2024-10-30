/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import React, { useRef } from "react";
import { Grid, GridItem, Stack } from "@patternfly/react-core";
import { Page, Drawer } from "~/components/core/";
import ProposalResultSection from "./ProposalResultSection";
import ProposalActionsSummary from "~/components/storage/ProposalActionsSummary";
import { ProposalActionsDialog } from "~/components/storage";
import { _ } from "~/i18n";
import { toValidationError } from "~/utils";
import { useIssues } from "~/queries/issues";
import { IssueSeverity } from "~/types/issues";
import { useDeprecated, useDevices, useProposalResult } from "~/queries/storage";
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
  const { actions } = useProposalResult();
  const deprecated = useDeprecated();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (deprecated) {
      refresh().then(() => {
        queryClient.invalidateQueries({ queryKey: ["storage"] });
      });
    }
  }, [deprecated, queryClient]);

  const errors = useIssues("storage")
    .filter((s) => s.severity === IssueSeverity.Error)
    .map(toValidationError);

  return (
    <Page>
      <Page.Header>
        <h2>{_("Storage")}</h2>
      </Page.Header>

      <Page.Content>
        <Grid hasGutter>
          <GridItem sm={12}>
            <Drawer
              ref={drawerRef}
              panelHeader={<h4>{_("Planned Actions")}</h4>}
              panelContent={<ProposalActionsDialog actions={actions} />}
            >
              <Stack hasGutter>
                <ProposalActionsSummary
                  system={systemDevices}
                  staging={stagingDevices}
                  errors={errors}
                  actions={actions}
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
      </Page.Content>
    </Page>
  );
}

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

import React, { useCallback, useReducer, useEffect, useRef } from "react";
import { Grid, GridItem, Stack } from "@patternfly/react-core";
import { Page, Drawer } from "~/components/core/";
import ProposalTransactionalInfo from "./ProposalTransactionalInfo";
import ProposalSettingsSection from "./ProposalSettingsSection";
import ProposalResultSection from "./ProposalResultSection";
import ProposalActionsSummary from "~/components/storage/ProposalActionsSummary";
import { ProposalActionsDialog } from "~/components/storage";
import { _ } from "~/i18n";
import { IDLE } from "~/client/status";
import { SPACE_POLICIES } from "~/components/storage/utils";
import { useInstallerClient } from "~/context/installer";
import { toValidationError, useCancellablePromise } from "~/utils";
import { useIssues } from "~/queries/issues";
import { IssueSeverity } from "~/types/issues";
import { useAvailableDevices, useDevices, useProductParams, useProposalResult, useVolumeDevices, useVolumeTemplates } from "~/queries/storage";

/**
 * @typedef {import ("~/components/storage/utils").SpacePolicy} SpacePolicy
 */

const initialState = {
  loading: true,
  // which UI item is being changed by user
  changing: undefined,
  settings: {},
  actions: [],
};

const reducer = (state, action) => {
  switch (action.type) {
    case "START_LOADING": {
      return { ...state, loading: true };
    }

    case "STOP_LOADING": {
      // reset the changing value after the refresh is finished
      return { ...state, loading: false, changing: undefined };
    }

    case "UPDATE_RESULT": {
      const { settings, actions } = action.payload.result;
      return { ...state, settings, actions };
    }

    case "UPDATE_SETTINGS": {
      const { settings, changing } = action.payload;
      return { ...state, settings, changing };
    }

    default: {
      return state;
    }
  }
};

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

/**
 * A helper function to decide whether to show the progress skeletons or not
 * for the specified component
 *
 * FIXME: remove duplication
 *
 * @param {boolean} loading loading status
 * @param {string} component name of the component
 * @param {symbol} changing the item which is being changed
 * @returns {boolean} true if the skeleton should be displayed, false otherwise
 */
const showSkeleton = (loading, component, changing) => {
  return loading && !NOT_AFFECTED[component].includes(changing);
};

export default function ProposalPage() {
  const { storage: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);
  const drawerRef = useRef();
  const systemDevices = useDevices("system");
  const stagingDevices = useDevices("result");
  const availableDevices = useAvailableDevices();
  const { encryptionMethods } = useProductParams({ suspense: true });
  const volumeTemplates = useVolumeTemplates({ suspense: true });
  const volumeDevices = useVolumeDevices();
  const { actions, settings } = useProposalResult();

  const errors = useIssues("storage")
    .filter((s) => s.severity === IssueSeverity.Error)
    .map(toValidationError);

  const calculateProposal = useCallback(
    async (settings) => {
      return await cancellablePromise(client.proposal.calculate(settings));
    },
    [client, cancellablePromise],
  );

  const load = useCallback(async () => {
    dispatch({ type: "START_LOADING" });

    const isDeprecated = await cancellablePromise(client.isDeprecated());
    if (isDeprecated) {
      //const result = await loadProposalResult();
      await cancellablePromise(client.probe());
      // if (result?.settings) await calculateProposal(result.settings);
      await calculateProposal(settings);
    }

    // const result = await loadProposalResult();
    // if (result !== undefined) dispatch({ type: "UPDATE_RESULT", payload: { result } });

    dispatch({ type: "STOP_LOADING" });
  }, [
    calculateProposal,
    cancellablePromise,
    client,
  ]);

  const calculate = useCallback(
    async (settings) => {
      dispatch({ type: "START_LOADING" });

      await calculateProposal(settings);

      // const result = await loadProposalResult();
      dispatch({ type: "UPDATE_RESULT", payload: { result } });

      dispatch({ type: "STOP_LOADING" });
    },
    [calculateProposal],
  );

  useEffect(() => {
    load().catch(console.error);

    return client.onDeprecate(() => load());
  }, [client, load]);

  useEffect(() => {
    const proposalLoaded = () => state.settings.targetDevice !== undefined;

    const statusHandler = (serviceStatus) => {
      // Load the proposal if no proposal has been loaded yet. This can happen if the proposal
      // page is visited before probing has finished.
      if (serviceStatus === IDLE && !proposalLoaded()) load();
    };

    if (!proposalLoaded()) {
      return client.onStatusChange(statusHandler);
    }
  }, [client, load, state.settings]);

  const changeSettings = async (changing, settings) => {
    const newSettings = { ...state.settings, ...settings };

    dispatch({ type: "UPDATE_SETTINGS", payload: { settings: newSettings, changing } });
    calculate(newSettings).catch(console.error);
  };

  const spacePolicy = SPACE_POLICIES.find((p) => p.id === state.settings.spacePolicy);

  /**
   * @todo Enable type checking and ensure the components are called with the correct props.
   *
   * @note The default value for `settings` should be `undefined` instead of an empty object, and
   * the settings prop of the components should accept both a ProposalSettings object or undefined.
   */

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
              isLoading={state.loading}
              changing={state.changing}
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
                  isLoading={showSkeleton(state.loading, "ProposalActionsSummary", state.changing)}
                />
                <ProposalResultSection
                  system={systemDevices}
                  staging={stagingDevices}
                  actions={actions}
                  errors={state.errors}
                  isLoading={state.loading}
                />
              </Stack>
            </Drawer>
          </GridItem>
        </Grid>
      </Page.MainContent>
    </Page>
  );
}

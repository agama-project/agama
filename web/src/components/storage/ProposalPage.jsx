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

/**
 * @typedef {import ("~/components/storage/utils").SpacePolicy} SpacePolicy
 */

const initialState = {
  loading: true,
  // which UI item is being changed by user
  changing: undefined,
  availableDevices: [],
  volumeDevices: [],
  volumeTemplates: [],
  encryptionMethods: [],
  settings: {},
  system: [],
  staging: [],
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

    case "UPDATE_AVAILABLE_DEVICES": {
      const { availableDevices } = action.payload;
      return { ...state, availableDevices };
    }

    case "UPDATE_VOLUME_DEVICES": {
      const { volumeDevices } = action.payload;
      return { ...state, volumeDevices };
    }

    case "UPDATE_ENCRYPTION_METHODS": {
      const { encryptionMethods } = action.payload;
      return { ...state, encryptionMethods };
    }

    case "UPDATE_VOLUME_TEMPLATES": {
      const { volumeTemplates } = action.payload;
      return { ...state, volumeTemplates };
    }

    case "UPDATE_RESULT": {
      const { settings, actions } = action.payload.result;
      return { ...state, settings, actions };
    }

    case "UPDATE_SETTINGS": {
      const { settings, changing } = action.payload;
      return { ...state, settings, changing };
    }

    case "UPDATE_DEVICES": {
      const { system, staging } = action.payload;
      return { ...state, system, staging };
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

  const errors = useIssues("storage")
    .filter((s) => s.severity === IssueSeverity.Error)
    .map(toValidationError);

  const loadAvailableDevices = useCallback(async () => {
    return await cancellablePromise(client.proposal.getAvailableDevices());
  }, [client, cancellablePromise]);

  const loadVolumeDevices = useCallback(async () => {
    return await cancellablePromise(client.proposal.getVolumeDevices());
  }, [client, cancellablePromise]);

  const loadEncryptionMethods = useCallback(async () => {
    return await cancellablePromise(client.proposal.getEncryptionMethods());
  }, [client, cancellablePromise]);

  const loadVolumeTemplates = useCallback(async () => {
    const mountPoints = await cancellablePromise(client.proposal.getProductMountPoints());
    const volumeTemplates = [];

    for (const mountPoint of mountPoints) {
      volumeTemplates.push(await cancellablePromise(client.proposal.defaultVolume(mountPoint)));
    }

    volumeTemplates.push(await cancellablePromise(client.proposal.defaultVolume("")));
    return volumeTemplates;
  }, [client, cancellablePromise]);

  const loadProposalResult = useCallback(async () => {
    return await cancellablePromise(client.proposal.getResult());
  }, [client, cancellablePromise]);

  const loadDevices = useCallback(async () => {
    const system = (await cancellablePromise(client.system.getDevices())) || [];
    const staging = (await cancellablePromise(client.staging.getDevices())) || [];
    return { system, staging };
  }, [client, cancellablePromise]);

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
      const result = await loadProposalResult();
      await cancellablePromise(client.probe());
      if (result?.settings) await calculateProposal(result.settings);
    }

    const availableDevices = await loadAvailableDevices();
    dispatch({ type: "UPDATE_AVAILABLE_DEVICES", payload: { availableDevices } });

    const volumeDevices = await loadVolumeDevices();
    dispatch({ type: "UPDATE_VOLUME_DEVICES", payload: { volumeDevices } });

    const encryptionMethods = await loadEncryptionMethods();
    dispatch({ type: "UPDATE_ENCRYPTION_METHODS", payload: { encryptionMethods } });

    const volumeTemplates = await loadVolumeTemplates();
    dispatch({ type: "UPDATE_VOLUME_TEMPLATES", payload: { volumeTemplates } });

    const result = await loadProposalResult();
    if (result !== undefined) dispatch({ type: "UPDATE_RESULT", payload: { result } });

    const devices = await loadDevices();
    dispatch({ type: "UPDATE_DEVICES", payload: devices });

    if (result !== undefined) dispatch({ type: "STOP_LOADING" });
  }, [
    calculateProposal,
    cancellablePromise,
    client,
    loadAvailableDevices,
    loadVolumeDevices,
    loadDevices,
    loadEncryptionMethods,
    loadProposalResult,
    loadVolumeTemplates,
  ]);

  const calculate = useCallback(
    async (settings) => {
      dispatch({ type: "START_LOADING" });

      await calculateProposal(settings);

      const result = await loadProposalResult();
      dispatch({ type: "UPDATE_RESULT", payload: { result } });

      const devices = await loadDevices();
      dispatch({ type: "UPDATE_DEVICES", payload: devices });

      dispatch({ type: "STOP_LOADING" });
    },
    [calculateProposal, loadDevices, loadProposalResult],
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
            <ProposalTransactionalInfo settings={state.settings} />
          </GridItem>
          <GridItem sm={12} xl={6}>
            <ProposalSettingsSection
              availableDevices={state.availableDevices}
              volumeDevices={state.volumeDevices}
              encryptionMethods={state.encryptionMethods}
              volumeTemplates={state.volumeTemplates}
              settings={state.settings}
              onChange={changeSettings}
              isLoading={state.loading}
              changing={state.changing}
            />
          </GridItem>
          <GridItem sm={12} xl={6}>
            <Drawer
              ref={drawerRef}
              panelHeader={<h4>{_("Planned Actions")}</h4>}
              panelContent={<ProposalActionsDialog actions={state.actions} />}
            >
              <Stack hasGutter>
                <ProposalActionsSummary
                  policy={spacePolicy}
                  system={state.system}
                  staging={state.staging}
                  errors={errors}
                  actions={state.actions}
                  spaceActions={state.settings.spaceActions}
                  devices={state.settings.installationDevices}
                  onActionsClick={drawerRef.current?.open}
                  isLoading={showSkeleton(state.loading, "ProposalActionsSummary", state.changing)}
                />
                <ProposalResultSection
                  system={state.system}
                  staging={state.staging}
                  actions={state.actions}
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

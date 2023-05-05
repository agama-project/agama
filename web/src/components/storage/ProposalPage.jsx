/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import React, { useCallback, useReducer, useEffect } from "react";
import { Alert } from "@patternfly/react-core";

import { useInstallerClient } from "~/context/installer";
import { toValidationError, useCancellablePromise } from "~/utils";
import { Icon } from "~/components/layout";
import { Page } from "~/components/core";
import { ProposalActionsSection, ProposalPageOptions, ProposalSettingsSection } from "~/components/storage";
import { IDLE } from "~/client/status";

const initialState = {
  loading: true,
  availableDevices: [],
  volumeTemplates: [],
  settings: {},
  actions: [],
  errors: []
};

const reducer = (state, action) => {
  switch (action.type) {
    case "START_LOADING" : {
      return { ...state, loading: true };
    }

    case "STOP_LOADING" : {
      return { ...state, loading: false };
    }

    case "UPDATE_PROPOSAL": {
      const { proposal, errors } = action.payload;
      const { availableDevices, volumeTemplates, result = {} } = proposal;
      const { candidateDevices, lvm, encryptionPassword, volumes, actions } = result;
      return {
        ...state,
        availableDevices,
        volumeTemplates,
        settings: { candidateDevices, lvm, encryptionPassword, volumes },
        actions,
        errors
      };
    }

    case "UPDATE_SETTINGS": {
      const { settings } = action.payload;
      return { ...state, settings };
    }

    default: {
      return state;
    }
  }
};

export default function ProposalPage() {
  const { storage: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadProposal = useCallback(async () => {
    const proposal = await cancellablePromise(client.proposal.getData());
    const issues = await cancellablePromise(client.getErrors());
    const errors = issues.map(toValidationError);
    return { proposal, errors };
  }, [client, cancellablePromise]);

  const load = useCallback(async () => {
    dispatch({ type: "START_LOADING" });

    const isDeprecated = await cancellablePromise(client.isDeprecated());
    if (isDeprecated) await client.probe();

    const { proposal, errors } = await loadProposal();
    dispatch({ type: "UPDATE_PROPOSAL", payload: { proposal, errors } });
    if (proposal.result !== undefined) dispatch({ type: "STOP_LOADING" });
  }, [cancellablePromise, client, loadProposal]);

  const calculate = useCallback(async (settings) => {
    dispatch({ type: "START_LOADING" });

    await cancellablePromise(client.proposal.calculate(settings));

    const { proposal, errors } = await loadProposal();
    dispatch({ type: "UPDATE_PROPOSAL", payload: { proposal, errors } });
    dispatch({ type: "STOP_LOADING" });
  }, [cancellablePromise, client, loadProposal]);

  useEffect(() => {
    load().catch(console.error);

    return client.onDeprecate(() => load());
  }, [client, load]);

  useEffect(() => {
    const statusHandler = (serviceStatus) => {
      // Load the proposal if no proposal has been loaded yet. This can happen if the proposal
      // page is visited before probing has finished.
      if (serviceStatus === IDLE && state.settings.candidateDevices === undefined) load();
    };

    return client.onStatusChange(statusHandler);
  });

  const changeSettings = async (settings) => {
    const newSettings = { ...state.settings, ...settings };

    dispatch({ type: "UPDATE_SETTINGS", payload: { settings: newSettings } });
    calculate(newSettings).catch(console.error);
  };

  const PageContent = () => {
    // Templates for already existing mount points are filtered out
    const usefulTemplates = () => {
      const volumes = state.settings.volumes || [];
      const mountPoints = volumes.map(v => v.mountPoint);
      return state.volumeTemplates.filter(t => !mountPoints.includes(t.mountPoint));
    };

    return (
      <>
        <Alert
          isInline
          customIcon={<Icon name="info" size="16" />}
          title="Devices will not be modified until installation starts."
        />
        <ProposalSettingsSection
          availableDevices={state.availableDevices}
          volumeTemplates={usefulTemplates()}
          settings={state.settings}
          onChange={changeSettings}
          isLoading={state.loading}
        />
        <ProposalActionsSection
          actions={state.actions}
          errors={state.errors}
          isLoading={state.loading}
        />
      </>
    );
  };

  return (
    <Page title="Storage" icon="hard_drive" actionLabel="Back" actionVariant="secondary">
      <PageContent />
      <ProposalPageOptions />
    </Page>
  );
}

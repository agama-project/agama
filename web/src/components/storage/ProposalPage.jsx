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

import { _ } from "~/i18n";
import { useInstallerClient } from "~/context/installer";
import { toValidationError, useCancellablePromise } from "~/utils";
import { Icon } from "~/components/layout";
import { Page } from "~/components/core";
import { ProposalActionsSection, ProposalPageMenu, ProposalSettingsSection } from "~/components/storage";
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

    case "UPDATE_AVAILABLE_DEVICES": {
      const { availableDevices } = action.payload;
      return { ...state, availableDevices };
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
      const { settings } = action.payload;
      return { ...state, settings };
    }

    case "UPDATE_ERRORS": {
      const { errors } = action.payload;
      return { ...state, errors };
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

  const loadAvailableDevices = useCallback(async () => {
    return await cancellablePromise(client.proposal.getAvailableDevices());
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

  const loadErrors = useCallback(async () => {
    const issues = await cancellablePromise(client.getErrors());
    return issues.map(toValidationError);
  }, [client, cancellablePromise]);

  const calculateProposal = useCallback(async (settings) => {
    return await cancellablePromise(client.proposal.calculate(settings));
  }, [client, cancellablePromise]);

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

    const encryptionMethods = await loadEncryptionMethods();
    dispatch({ type: "UPDATE_ENCRYPTION_METHODS", payload: { encryptionMethods } });

    const volumeTemplates = await loadVolumeTemplates();
    dispatch({ type: "UPDATE_VOLUME_TEMPLATES", payload: { volumeTemplates } });

    const result = await loadProposalResult();
    if (result !== undefined) dispatch({ type: "UPDATE_RESULT", payload: { result } });

    const errors = await loadErrors();
    dispatch({ type: "UPDATE_ERRORS", payload: { errors } });

    if (result !== undefined) dispatch({ type: "STOP_LOADING" });
  }, [calculateProposal, cancellablePromise, client, loadAvailableDevices, loadEncryptionMethods, loadErrors, loadProposalResult, loadVolumeTemplates]);

  const calculate = useCallback(async (settings) => {
    dispatch({ type: "START_LOADING" });

    await calculateProposal(settings);

    const result = await loadProposalResult();
    dispatch({ type: "UPDATE_RESULT", payload: { result } });

    const errors = await loadErrors();
    dispatch({ type: "UPDATE_ERRORS", payload: { errors } });

    dispatch({ type: "STOP_LOADING" });
  }, [calculateProposal, loadErrors, loadProposalResult]);

  useEffect(() => {
    load().catch(console.error);

    return client.onDeprecate(() => load());
  }, [client, load]);

  useEffect(() => {
    const proposalLoaded = () => state.settings.bootDevice !== undefined;

    const statusHandler = (serviceStatus) => {
      // Load the proposal if no proposal has been loaded yet. This can happen if the proposal
      // page is visited before probing has finished.
      if (serviceStatus === IDLE && !proposalLoaded()) load();
    };

    if (!proposalLoaded()) {
      return client.onStatusChange(statusHandler);
    }
  }, [client, load, state.settings]);

  const changeSettings = async (settings) => {
    const newSettings = { ...state.settings, ...settings };

    dispatch({ type: "UPDATE_SETTINGS", payload: { settings: newSettings } });
    calculate(newSettings).catch(console.error);
  };

  const PageContent = () => {
    // Templates for already existing mount points are filtered out
    const usefulTemplates = () => {
      const volumes = state.settings.volumes || [];
      const mountPaths = volumes.map(v => v.mountPath);
      return state.volumeTemplates.filter(t => (
        t.mountPath.length > 0 && !mountPaths.includes(t.mountPath)
      ));
    };

    return (
      <>
        <Alert
          isInline
          customIcon={<Icon name="info" size="xxs" />}
          title={_("Devices will not be modified until installation starts.")}
        />
        <ProposalSettingsSection
          availableDevices={state.availableDevices}
          volumeTemplates={usefulTemplates()}
          encryptionMethods={state.encryptionMethods}
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
    // TRANSLATORS: page title
    <Page icon="hard_drive" title={_("Storage")}>
      <PageContent />
      <ProposalPageMenu />
    </Page>
  );
}

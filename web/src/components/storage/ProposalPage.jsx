/*
 * Copyright (c) [2022] SUSE LLC
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

import React, { useReducer, useEffect } from "react";
import { Alert } from "@patternfly/react-core";

import { useInstallerClient } from "~/context/installer";
import { useCancellablePromise } from "~/utils";
import { Icon } from "~/components/layout";
import { Page, SectionSkeleton } from "~/components/core";
import {
  ProposalTargetSection,
  ProposalSettingsSection,
  ProposalActionsSection
} from "~/components/storage";

const initialState = {
  busy: false,
  proposal: undefined,
  errors: []
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_BUSY" : {
      return { ...state, busy: true };
    }

    case "LOAD": {
      const { proposal, errors } = action.payload;
      return { ...state, proposal, errors, busy: false };
    }

    case "CALCULATE": {
      return initialState;
    }

    default: {
      return state;
    }
  }
};

export default function ProposalPage() {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const loadProposal = async () => {
      dispatch({ type: "SET_BUSY" });

      const proposal = await cancellablePromise(client.storage.getProposal());
      const errors = await cancellablePromise(client.storage.getValidationErrors());

      dispatch({
        type: "LOAD",
        payload: { proposal, errors }
      });
    };

    if (!state.proposal) loadProposal().catch(console.error);
  }, [client.storage, cancellablePromise, state.proposal]);

  const calculateProposal = async (settings) => {
    dispatch({ type: "SET_BUSY" });
    await client.storage.calculateProposal({ ...state.proposal, ...settings });
    dispatch({ type: "CALCULATE" });
  };

  const PageContent = () => {
    if (state.busy || !state.proposal) return <SectionSkeleton lines={3} />;

    return (
      <>
        <Alert
          isInline
          customIcon={<Icon name="info" size="16" />}
          title="Devices will not be modified until installation starts."
        />
        <ProposalTargetSection
          proposal={state.proposal}
          calculateProposal={calculateProposal}
        />
        <ProposalSettingsSection
          proposal={state.proposal}
          calculateProposal={calculateProposal}
        />
        <ProposalActionsSection
          proposal={state.proposal}
          errors={state.errors}
        />
      </>
    );
  };

  return (
    <Page title="Storage settings" icon="hard_drive">
      <PageContent />
    </Page>
  );
}

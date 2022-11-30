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
import { useNavigate } from "react-router-dom";

import { useCancellablePromise } from "@/utils";
import { useInstallerClient } from "@context/installer";
import { BUSY } from "@client/status";
import { InstallerSkeleton, Section } from "@components/core";
import { ProposalSummary } from "@components/storage";

import { EOS_VOLUME as HardDriveIcon } from "eos-icons-react";

const initialState = {
  busy: false,
  proposal: undefined,
  errors: []
};

const reducer = (state, action) => {
  switch (action.type) {
    case "UPDATE_STATUS" : {
      return { ...initialState, busy: action.payload.status === BUSY };
    }

    case "UPDATE_PROPOSAL": {
      const proposal = state.proposal || {};
      return { ...state, proposal: { ...proposal, ...action.payload.proposal } };
    }

    case "UPDATE_ERRORS": {
      return { ...state, errors: action.payload.errors };
    }

    default: {
      return state;
    }
  }
};

export default function StorageSection ({ showErrors }) {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const updateStatus = (status) => {
      dispatch({ type: "UPDATE_STATUS", payload: { status } });
    };

    cancellablePromise(client.storage.getStatus()).then(updateStatus);

    return client.storage.onStatusChange(updateStatus);
  }, [client.storage, cancellablePromise]);

  useEffect(() => {
    const updateProposal = (proposal) => {
      dispatch({ type: "UPDATE_PROPOSAL", payload: { proposal } });
    };

    if (!state.busy) cancellablePromise(client.storage.getProposal()).then(updateProposal);
  }, [client.storage, cancellablePromise, state.busy]);

  useEffect(() => {
    const updateErrors = (errors) => {
      dispatch({ type: "UPDATE_ERRORS", payload: { errors } });
    };

    if (!state.busy) cancellablePromise(client.storage.getValidationErrors()).then(updateErrors);
  }, [client.storage, cancellablePromise, state.busy]);

  const errors = showErrors ? state.errors : [];

  const SectionContent = () => {
    if (state.busy || !state.proposal) return <InstallerSkeleton lines={1} />;

    return (
      <ProposalSummary proposal={state.proposal} onClick={() => navigate("/storage")} />
    );
  };

  return (
    <Section key="users" title="Storage" icon={HardDriveIcon} errors={errors}>
      <SectionContent />
    </Section>
  );
}

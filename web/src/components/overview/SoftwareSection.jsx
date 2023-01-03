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

import { useCancellablePromise } from "@/utils";
import { useInstallerClient } from "@context/installer";
import { BUSY } from "@client/status";
import { Icon } from "@components/layout";
import { InstallerSkeleton, Section } from "@components/core";

const initialState = {
  busy: false,
  errors: [],
  errorsRead: false,
  size: ""
};

const reducer = (state, action) => {
  switch (action.type) {
    case "UPDATE_STATUS" : {
      return { ...initialState, busy: action.payload.status === BUSY };
    }

    case "UPDATE_PROPOSAL": {
      if (state.busy) return state;

      const { errors, size } = action.payload;

      console.log("errors:", errors);

      return { ...state, errors, size, errorsRead: true };
    }

    default: {
      return state;
    }
  }
};

export default function SoftwareSection ({ showErrors }) {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const updateStatus = (status) => {
      dispatch({ type: "UPDATE_STATUS", payload: { status } });
    };

    cancellablePromise(client.software.getStatus()).then(updateStatus);

    return client.software.onStatusChange(updateStatus);
  }, [client.software, cancellablePromise]);

  useEffect(() => {
    const updateProposal = async () => {
      const errors = await cancellablePromise(client.software.getValidationErrors());
      const size = await cancellablePromise(client.software.getUsedSpace());

      dispatch({ type: "UPDATE_PROPOSAL", payload: { errors, size } });
    };

    updateProposal();
  }, [client.software, cancellablePromise, state.busy]);

  const errors = showErrors ? state.errors : [];

  const UsedSize = () => {
    if (state.size === "") {
      return <InstallerSkeleton lines={1} />;
    } else {
      return (
        <>
          Installation will take {state.size}.
        </>
      );
    }
  };

  const SectionContent = () => {
    return state.busy
      ? <InstallerSkeleton lines={1} />
      : <UsedSize />;
  };

  return (
    <Section
      key="software-section"
      title="Software"
      icon={() => <Icon name="apps" />}
      errors={errors}
    >
      <SectionContent />
    </Section>
  );
}

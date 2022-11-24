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

import React, { useReducer, useEffect, useState } from "react";
import { useCancellablePromise } from "@/utils";
import { useInstallerClient } from "@context/installer";
import { BUSY } from "@client/status";

import { InstallerSkeleton, Section } from "@components/core";
import { TargetSelector, Proposal } from "@components/storage";

import { EOS_VOLUME as HardDriveIcon } from "eos-icons-react";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      const { targets, target, actions } = action.payload;
      return { ...state, targets, target, actions };
    }

    case "CHANGE_TARGET": {
      const { selected: target } = action.payload;
      return { ...state, target };
    }

    case "UPDATE_ACTIONS": {
      const { actions } = action.payload;
      return { ...state, actions };
    }

    case "CHANGE_STATUS": {
      return { ...state, status: action.payload };
    }

    default: {
      return state;
    }
  }
};

export default function Storage({ showErrors }) {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [errors, setErrors] = useState([]);
  const [state, dispatch] = useReducer(reducer, {
    targets: [],
    target: undefined,
    actions: [],
  });
  const { target, targets, actions } = state;

  const onAccept = selected =>
    client.storage.calculateStorageProposal({ candidateDevices: [selected] }).then(() => {
      const payload = { selected };
      dispatch({ type: "CHANGE_TARGET", payload });
    });

  useEffect(() => {
    const loadStorage = async () => {
      const {
        availableDevices,
        candidateDevices: [candidateDeviceId]
      } = await cancellablePromise(client.storage.getStorageProposal());
      const actions = await cancellablePromise(client.storage.getStorageActions());
      const targetDeviceId = candidateDeviceId || availableDevices[0]?.id;
      dispatch({
        type: "LOAD",
        payload: { target: targetDeviceId, targets: availableDevices, actions }
      });
    };

    loadStorage().catch(console.error);
  }, [client.storage, cancellablePromise]);

  useEffect(() => {
    return client.storage.onActionsChange(actions => {
      dispatch({ type: "UPDATE_ACTIONS", payload: { actions } });
    });
  }, [client.storage]);

  useEffect(() => {
    return client.storage.onStorageProposalChange(changes => {
      dispatch({ type: "CHANGE_TARGET", payload: { selected: changes } });
    });
  }, [client.storage]);

  useEffect(() => {
    cancellablePromise(client.storage.getStatus()).then(status => {
      dispatch({ type: "CHANGE_STATUS", payload: status });
    });
  }, [client.storage, cancellablePromise]);

  useEffect(() => {
    return client.storage.onStatusChange(status => {
      dispatch({ type: "CHANGE_STATUS", payload: status });
    });
  }, [client.storage]);

  // FIXME: this useEffect should be removed after moving storage to its own service.
  useEffect(() => {
    cancellablePromise(client.manager.getStatus()).then(status => {
      dispatch({ type: "CHANGE_STATUS", payload: status });
    });
  }, [client.manager, cancellablePromise]);

  // FIXME: this useEffect should be removed after moving storage to its own service.
  useEffect(() => {
    return client.manager.onStatusChange(status => {
      dispatch({ type: "CHANGE_STATUS", payload: status });
    });
  }, [client.manager]);

  useEffect(() => {
    client.storage.getValidationErrors().then(setErrors);
    return client.storage.onValidationChange(setErrors);
  }, [client.storage]);

  if (state.status === BUSY) {
    return (
      <InstallerSkeleton lines={3} />
    );
  }

  return (
    <>
      <Section key="users" title="Storage" icon={HardDriveIcon} errors={showErrors ? errors : []}>
        {targets.length > 0 &&
          <TargetSelector
            target={target || "Select device to install into"}
            targets={targets}
            onAccept={onAccept}
          />}
        <Proposal data={actions} />
      </Section>
    </>
  );
}

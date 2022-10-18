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
import { useCancellablePromise } from "./utils";
import { useInstallerClient } from "./context/installer";
import { BUSY } from "./client/status";

import { Alert } from "@patternfly/react-core";
import TargetSelector from "./TargetSelector";
import Proposal from "./Proposal";
import InstallerSkeleton from "./InstallerSkeleton";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      const { targets, target, actions, error } = action.payload;
      return { ...state, targets, target, actions, error };
    }

    case "CHANGE_TARGET": {
      const { selected: target } = action.payload;
      return { ...state, target };
    }

    case "UPDATE_ACTIONS": {
      const { actions, error } = action.payload;
      return { ...state, actions, error };
    }

    case "CHANGE_STATUS": {
      return { ...state, status: action.payload };
    }

    default: {
      return state;
    }
  }
};

export default function Storage() {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, {
    targets: [],
    target: undefined,
    actions: [],
    error: false
  });
  const { target, targets, actions, error } = state;

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
      const error = actions.length === 0;
      dispatch({
        type: "LOAD",
        payload: { target: targetDeviceId, targets: availableDevices, actions, error }
      });
    };

    loadStorage().catch(console.error);
  }, [client.storage, cancellablePromise]);

  useEffect(() => {
    return client.storage.onActionsChange(actions => {
      const error = actions.length === 0;
      dispatch({ type: "UPDATE_ACTIONS", payload: { actions, error } });
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

  const errorMessage = () => {
    if (targets.length === 0) {
      return "Cannot find a suitable storage device for installation";
    } else if (target) {
      return `Cannot make a proposal for ${target}`;
    } else {
      return "Something went wrong when trying to come up with an storage proposal";
    }
  };

  if (state.status === BUSY) {
    return (
      <InstallerSkeleton lines={3} />
    );
  }

  return (
    <>
      {targets.length > 0 &&
        <TargetSelector
          target={target || "Select device to install into"}
          targets={targets}
          onAccept={onAccept}
        />}
      {error && <Alert variant="danger" isPlain isInline title={errorMessage()} />}
      <Proposal data={actions} />
    </>
  );
}

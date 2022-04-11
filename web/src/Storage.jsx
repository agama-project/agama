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
import { useInstallerClient } from "./context/installer";

import { Alert } from "@patternfly/react-core";
import TargetSelector from "./TargetSelector";
import Proposal from "./Proposal";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      const { targets, target, actions } = action.payload;
      return { ...state, targets, target, actions };
    }

    case "CHANGE_TARGET": {
      const { selected: target, error } = action.payload;
      return { ...state, target, error };
    }

    case "UPDATE_ACTIONS": {
      return { ...state, actions: action.payload };
    }

    default: {
      return state;
    }
  }
};

export default function Storage() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, {
    targets: [],
    target: "",
    actions: [],
    error: false
  });
  const { target, targets, actions, error } = state;

  const onAccept = selected =>
    client.storage.calculateStorageProposal({ candidateDevices: [selected] }).then(result => {
      const payload = { selected, error: result !== 0 };
      dispatch({ type: "CHANGE_TARGET", payload });
    });

  useEffect(() => {
    const loadStorage = async () => {
      const {
        availableDevices: disks,
        candidateDevices: [disk]
      } = await client.storage.getStorageProposal();
      const actions = await client.storage.getStorageActions();
      dispatch({
        type: "LOAD",
        payload: { target: disk, targets: disks, actions }
      });
    };

    loadStorage().catch(console.error);
  }, []);

  useEffect(() => {
    return client.storage.onActionsChange(changes => {
      const { All: newActions } = changes;
      dispatch({ type: "UPDATE_ACTIONS", payload: newActions });
    });
  }, []);

  const errorMessage = `Cannot make a proposal for ${target}`;

  return (
    <>
      <TargetSelector
        target={target || "Select device to install into"}
        targets={targets}
        onAccept={onAccept}
      />
      {error && <Alert variant="danger" isPlain isInline title={errorMessage} />}
      <Proposal data={actions} />
    </>
  );
}

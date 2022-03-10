import React from "react";
import { useReducer, useEffect } from "react";
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

  useEffect(async () => {
    const {
      availableDevices: disks,
      candidateDevices: [disk]
    } = await client.storage.getStorageProposal();
    const actions = await client.storage.getStorageActions();
    dispatch({
      type: "LOAD",
      payload: { target: disk, targets: disks, actions }
    });
  }, []);

  useEffect(() => {
    // TODO: abstract D-Bus details
    return client.onPropertyChanged((_path, _iface, _signal, args) => {
      const [iface, properties] = args;

      if (iface !== "org.opensuse.DInstaller.Storage.Actions1") {
        return;
      }

      const newActions = properties.All.v.map(action => {
        const { Text: textVar, Subvol: subvolVar } = action.v;
        return { text: textVar.v, subvol: subvolVar.v };
      });

      dispatch({ type: "UPDATE_ACTIONS", payload: newActions });
    });
  }, []);

  const errorMessage = `Cannot make a proposal for ${target}`;

  return (
    <>
      <TargetSelector target={target || "Select target"} targets={targets} onAccept={onAccept} />
      {error && <Alert variant="danger" isPlain isInline title={errorMessage} />}
      <Proposal data={actions} />
    </>
  );
}

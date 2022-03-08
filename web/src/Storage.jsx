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
      return { ...state, target: action.payload, error: false };
    }

    case "UPDATE_ACTIONS": {
      return { ...state, actions: action.payload };
    }

    case "REPORT_ERROR": {
      return { ...state, error: true };
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
    error: undefined
  });
  const { target, targets, actions, error } = state;

  const onAccept = selected =>
    client
      .calculateStorageProposal({ candidateDevices: [selected] })
      .then(result => {
        if (result === 0) {
          dispatch({ type: "CHANGE_TARGET", payload: selected });
        } else {
          dispatch({ type: "REPORT_ERROR" });
        }
      });

  useEffect(async () => {
    const { availableDevices: disks, candidateDevices: [disk] } = await client.getStorageProposal();
    const actions = await client.getStorageActions();
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

      dispatch({ type: "UPDATE_ACTIONS", payload: newActions })
    });
  }, []);

  return (
    <>
      <TargetSelector
        target={target || "Select target"}
        targets={targets}
        onAccept={onAccept}
      />
      {error && <Alert variant="danger" isPlain isInline title="It failed, sorry :-)" />}
      <Proposal data={actions} />
    </>
  );
}

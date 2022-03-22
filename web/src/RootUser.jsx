import React, { useReducer, useEffect } from "react";
import { useInstallerClient } from "./context/installer";
import RootSSHKey from "./RootSSHKey";

import { Button, Form, FormGroup, Modal, ModalVariant, TextInput } from "@patternfly/react-core";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      return { ...state, ...action.payload };
    }
    case "ACCEPT": {
      return { ...state, isFormOpen: false, ...action.payload };
    }

    case "CANCEL": {
      return { ...state, isFormOpen: false };
    }

    case "CHANGE": {
      return { ...state, ...action.payload };
    }

    case "OPEN": {
      return { ...state, isFormOpen: true };
    }

    default: {
      return state;
    }
  }
};

const initialState = {
  rootPassword: null,
  isFormOpen: false,
  SSHKey: ""
};

export default function RootUser() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { rootPassword, isFormOpen, SSHKey } = state;
  const hiddenPassword = "_____DINSTALLALER_PASSWORD_SET";

  useEffect(async () => {
    const rootPassword = (await client.users.isRootPassword()) ? hiddenPassword : "";
    const SSHKey = await client.users.rootSSHKey();
    dispatch({
      type: "LOAD",
      payload: {
        rootPassword,
        SSHKey
      }
    });
  }, []);

  const open = () => dispatch({ type: "OPEN" });

  const cancel = () => dispatch({ type: "CANCEL" });

  const accept = async () => {
    // TODO: handle errors
    if (rootPassword !== hiddenPassword) {
      await client.users.setRootPassword(rootPassword);
    }
    const remembered_password = rootPassword === "" ? "" : hiddenPassword;
    client.users.setRootSSHKey(SSHKey);
    // TODO use signals instead
    dispatch({ type: "ACCEPT", payload: { rootPassword: remembered_password } });
  };

  const rootLabel = () => {
    if (rootPassword === hiddenPassword) {
      return "Root Password Set. ";
    } else {
      return "Root Password Not Set. ";
    }
  };

  const SSHKeyLabel = () => {
    if (SSHKey === "") {
      return "SSH Key Not Set. ";
    } else {
      return "SSH Key Set. ";
    }
  };

  const rootForm = () => {
    return (
      <>
        <FormGroup fieldId="rootPassword" label="Root Password">
          <TextInput
            id="rootPassword"
            type="password"
            aria-label="root password"
            value={rootPassword}
            onChange={v => dispatch({ type: "CHANGE", payload: { rootPassword: v } })}
          />
        </FormGroup>
        <FormGroup fieldId="SSHKey" label="Root SSH key">
          <RootSSHKey
            value={SSHKey}
            valueChanged={v => dispatch({ type: "CHANGE", payload: { SSHKey: v } })}
          />
        </FormGroup>
      </>
    );
  };

  // Renders nothing until know about the status of password
  if (rootPassword === null) return null;

  return (
    <>
      <Button variant="link" onClick={open}>
        {rootLabel().concat(SSHKeyLabel())}
      </Button>

      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        title="Root Configuration"
        actions={[
          <Button key="confirm" variant="primary" onClick={accept}>
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={cancel}>
            Cancel
          </Button>
        ]}
      >
        <Form>{rootForm()}</Form>
      </Modal>
    </>
  );
}

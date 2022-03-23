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

import {
  Button,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  Text,
  TextInput
} from "@patternfly/react-core";

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
  isFormOpen: false
};

export default function RootPassword() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { rootPassword, isFormOpen } = state;
  const hiddenPassword = "_____DINSTALLALER_PASSWORD_SET";

  useEffect(async () => {
    const rootPassword = (await client.users.isRootPassword()) ? hiddenPassword : "";
    dispatch({
      type: "LOAD",
      payload: {
        rootPassword
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
    // TODO use signals instead
    dispatch({ type: "ACCEPT", payload: { rootPassword: remembered_password } });
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
      </>
    );
  };

  // Renders nothing until know about the status of password
  if (rootPassword === null) return null;

  const renderLink = () => {
    const label = rootPassword === hiddenPassword ? "is set" : "is not set";
    const link = (
      <Button variant="link" isInline onClick={open}>
        {label}
      </Button>
    );

    return <Text>Root password {link}</Text>;
  };

  return (
    <>
      {renderLink()}

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

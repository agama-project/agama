import React, { useReducer, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import { Button, Checkbox, Form, FormGroup, TextInput } from "@patternfly/react-core";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      return { ...state, ...action.payload };
    }
    case "ACCEPT": {
      return { ...state, isFormOpen: false };
    }

    case "CANCEL": {
      return { ...state, isFormOpen: false, current: state.initial };
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
  rootPassword: "",
  initial: null,
  userName: "",
  userFullName: "",
  autologin: false,
  userPassword: "",
  isFormOpen: false
};

export default function Users() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { rootPassword, isFormOpen } = state;
  const user = {
    userName: state.userName,
    fullName: state.userFullName,
    autologin: state.autologin,
    password: state.userPassword
  };
  const hiddenPassword = "_____DINSTALLALER_PASSWORD_SET";

  useEffect(async () => {
    const rootPassword = (await client.users.isRootPassword()) ? hiddenPassword : "";
    const user = await client.users.getUser();
    dispatch({
      type: "LOAD",
      payload: {
        rootPassword,
        userName: user.userName,
        userFullName: user.fullName,
        userPassword: "",
        autologin: user.autologin,
        initial: user
      }
    });
  }, []);

  const open = () => dispatch({ type: "OPEN" });

  const cancel = () => dispatch({ type: "CANCEL" });

  const accept = async () => {
    // TODO: handle errors
    await client.users.setUser(user);
    if (rootPassword !== hiddenPassword && rootPassword !== "") {
      await client.users.setRootPassword(rootPassword);
    }
    dispatch({ type: "ACCEPT" });
  };

  const rootLabel = () => {
    if (rootPassword === hiddenPassword) {
      return "Root Password Set.";
    } else {
      return "Root Password Not Set. ";
    }
  }

const userLabel = () => {
    if (user !== undefined && user.userName != "") {
        return "User " + user.userName + " Set.";
      } else {
        return "First User Not Set.";
      }
}
    
    return res;
  };

  const rootUser = () => {
    return (
      <FormGroup fieldId="root" label="Root User">
        <TextInput
          id="rootPassword"
          type="password"
          aria-label="root"
          value={rootPassword}
          onChange={v => dispatch({ type: "CHANGE", payload: { rootPassword: v } })}
        />
      </FormGroup>
    );
  };

  const firstUser = () => {
    return (
      <FormGroup fieldId="user" label="The First User">
        <TextInput
          id="userFullName"
          aria-label="user fullname"
          value={user.fullName}
          label="User Full Name"
          onChange={v => dispatch({ type: "CHANGE", payload: { userFullName: v } })}
        />
        <TextInput
          id="userName"
          aria-label="user name"
          value={user.userName}
          label="User ID"
          required={true}
          onChange={v => dispatch({ type: "CHANGE", payload: { userName: v } })}
        />
        <TextInput
          id="userPassword"
          type="password"
  s        aria-label="user password"
          value={user.password}
          onChange={v => dispatch({ type: "CHANGE", payload: { userPassword: v } })}
        />
        <Checkbox
          label="Auto Login"
          aria-label="user autologin"
          id="autologin"
          checked={user.autologin}
          onChange={v => dispatch({ type: "CHANGE", payload: { autologin: v } })}
        />
      </FormGroup>
    );
  };

  return (
    <>
      <Button variant="link" onClick={open}>
        {label()}
      </Button>

      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        title="Users Configuration"
        actions={[
          <Button key="confirm" variant="primary" onClick={accept}>
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={cancel}>
            Cancel
          </Button>
        ]}
      >
        <Form>
          {rootUser()}
          {firstUser()}
        </Form>
      </Modal>
    </>
  );
}

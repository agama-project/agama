import React, { useReducer, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import {
  Button,
  Checkbox,
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
  initial: null,
  userID: "",
  fullName: "",
  autologin: false,
  password: "",
  isFormOpen: false
};

export default function Users() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { isFormOpen } = state;
  const user = {
    userName: state.userID,
    fullName: state.fullName,
    autologin: state.autologin,
    password: state.password
  };

  useEffect(async () => {
    const user = await client.users.getUser();
    dispatch({
      type: "LOAD",
      payload: {
        userID: user.userName,
        fullName: user.fullName,
        password: "",
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
    dispatch({ type: "ACCEPT" });
  };

  const userForm = () => {
    return (
      <Form>
        <FormGroup fieldId="userFullName" label="Full Name">
          <TextInput
            id="userFullName"
            aria-label="user fullname"
            value={user.fullName}
            label="User Full Name"
            onChange={v => dispatch({ type: "CHANGE", payload: { fullName: v } })}
          />
        </FormGroup>
        <FormGroup fieldId="userName" label="User ID">
          <TextInput
            id="userName"
            aria-label="user name"
            value={user.userName}
            label="User ID"
            required={true}
            onChange={v => dispatch({ type: "CHANGE", payload: { userID: v } })}
          />
        </FormGroup>
        <FormGroup fieldId="userPassword" label="Password">
          <TextInput
            id="userPassword"
            type="password"
            aria-label="user password"
            value={user.password}
            onChange={v => dispatch({ type: "CHANGE", payload: { password: v } })}
          />
        </FormGroup>
        <FormGroup fieldId="autologin" label="Autologin">
          <Checkbox
            aria-label="user autologin"
            id="autologin"
            checked={user.autologin}
            onChange={v => dispatch({ type: "CHANGE", payload: { autologin: v } })}
          />
        </FormGroup>
      </Form>
    );
  };

  const link = (content) => (
    <Button variant="link" isInline onClick={open}>
      {content}
    </Button>
  );

  const renderLink = () => {
    if (user?.userName !== "") {
      return <Text>User {link(user.userName)} is defined</Text>;
    } else {
      return <Text>A user {link("is not defined")}</Text>;
    }
  };

  return (
    <>
      {renderLink()}

      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        title="First User Configuration"
        actions={[
          <Button key="confirm" variant="primary" onClick={accept}>
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={cancel}>
            Cancel
          </Button>
        ]}
      >
        {userForm()}
      </Modal>
    </>
  );
}

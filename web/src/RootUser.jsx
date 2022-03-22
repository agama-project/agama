import React, { useReducer, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import {
  Alert,
  Button,
  Form,
  FormAlert,
  FormGroup,
  Text,
  TextInput,
  Skeleton
} from "@patternfly/react-core";

import Modal from "./Modal";

const initialState = {
  password: "",
  isPasswordSet: null,
  isFormOpen: false,
  error: null
};

const reducer = (state, action) => {
  const { type, payload } = action;

  switch (type) {
    case "SET_PASSWORD_STATUS": {
      return { ...state, ...payload };
    }

    case "PASSWORD_CHANGED": {
      return { ...state, ...payload };
    }

    case "OPEN_DIALOG": {
      return { ...state, isFormOpen: true };
    }

    case "CLOSE_DIALOG": {
      return { ...initialState, isPasswordSet: state.isPasswordSet };
    }

    case "CONFIRM_ACTION": {
      return { ...state, error: null };
    }

    case "ERROR_FOUND": {
      return { ...state, ...payload };
    }

    default: {
      return state;
    }
  }
};

export default function RootUser() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(async () => {
    const isPasswordSet = await client.users.isRootPasswordSet();
    dispatch({ type: "SET_PASSWORD_STATUS", payload: { isPasswordSet } });
  }, []);

  const open = () => dispatch({ type: "OPEN_DIALOG" });

  const cancel = () => dispatch({ type: "CLOSE_DIALOG" });

  const accept = async () => {
    // Extra check. The confirm action is already disabled when password is empty
    if (state.password !== "") {
      try {
        dispatch({ type: "CONFIRM_ACTION" });
        await client.users.setRootPassword(state.password);
        dispatch({ type: "CLOSE_DIALOG" });
      } catch (error) {
        dispatch({ type: "ERROR_FOUND", payload: { error } });
      }
    }
  };

  // Renders nothing until know about the status of password
  if (state.isPasswordSet === null) {
    return <Skeleton width="50%" fontSize="sm" screenreaderText="Loading root password status" />;
  }

  const status = state.isPasswordSet ? "already set" : "not set yet";
  const dialogTitle = state.isPasswordSet ? "Change root password" : "Set root password";
  const dialogLink = (
    <Text>
      Root Password: <span className="text--bold">{status}</span>.
    </Text>
  );

  const renderError = () => {
    if (!state.error) return null;

    return (
      <FormAlert>
        <Alert
          isPlain
          isInline
          variant="danger"
          aria-label="polite"
          title="Something went wrong, try it again"
        />
      </FormAlert>
    );
  };

  return (
    <>
      <Button variant="link" onClick={open}>
        {dialogLink}
      </Button>

      <Modal
        title={dialogTitle}
        isOpen={state.isFormOpen}
        onConfirm={accept}
        onCancel={cancel}
        confirmDisabled={state.password === ""}
      >
        <Form>
          <FormGroup fieldId="root-password" label="New password for root">
            <TextInput
              id="root-password"
              type="password"
              data-testid="root-password-input"
              onChange={v => dispatch({ type: "PASSWORD_CHANGED", payload: { password: v } })}
            />
          </FormGroup>
          {renderError()}
        </Form>
      </Modal>
    </>
  );
}

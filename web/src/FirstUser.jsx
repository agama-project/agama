import React, { useState, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import {
  Button,
  Checkbox,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  Skeleton,
  Text,
  TextInput
} from "@patternfly/react-core";

const initialUser = {
  userName: "",
  fullName: "",
  autologin: false,
  password: ""
};
export default function Users() {
  const client = useInstallerClient();
  const [user, setUser] = useState(null);
  const [formValues, setFormValues] = useState(initialUser);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(async () => {
    const userValues = await client.users.getUser();
    setUser(userValues);
    setFormValues({ ...formValues, ...userValues });
  }, []);

  if (user === null) return <Skeleton width="60%" fontSize="sm" />;

  const open = () => {
    setFormValues({ ...initialUser, ...user, password: "" });
    setIsFormOpen(true);
  };

  const cancel = () => {
    setIsFormOpen(false);
  };

  const accept = async () => {
    const result = await client.users.setUser(formValues);

    if (result) {
      setUser(formValues);
    }
    setIsFormOpen(false);
  };

  const remove = async () => {
    const result = await client.users.removeUser();

    if (result) {
      setUser(initialUser);
      setFormValues(initialUser);
    }
    setIsFormOpen(false);
  };

  const handleInputChange = (value, { target }) => {
    const { name } = target;
    setFormValues({ ...formValues, [name]: value });
  };

  const userForm = () => {
    return (
      <Form>
        <FormGroup fieldId="userFullName" label="Full name">
          <TextInput
            id="userFullName"
            name="fullName"
            aria-label="user fullname"
            value={formValues.fullName}
            label="User full Name"
            onChange={handleInputChange}
          />
        </FormGroup>
        <FormGroup fieldId="userName" label="Username">
          <TextInput
            id="userName"
            name="userName"
            aria-label="user name"
            value={formValues.userName}
            label="Username"
            required={true}
            onChange={handleInputChange}
          />
        </FormGroup>
        <FormGroup fieldId="userPassword" label="Password">
          <TextInput
            id="userPassword"
            name="password"
            type="password"
            aria-label="user password"
            value={formValues.password}
            onChange={handleInputChange}
          />
        </FormGroup>
        <FormGroup fieldId="autologin" label="Auto-login">
          <Checkbox
            aria-label="user autologin"
            id="autologin"
            name="autologin"
            isChecked={formValues.autologin}
            onChange={handleInputChange}
          />
        </FormGroup>
      </Form>
    );
  };

  const link = content => (
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
        aria-label="First User"
        actions={[
          <Button
            key="confirm"
            variant="primary"
            onClick={accept}
            isDisabled={formValues.userName === ""}
          >
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={cancel}>
            Cancel
          </Button>,
          <Button key="remove" variant="link" onClick={remove}>
            Do not create a user
          </Button>
        ]}
      >
        {userForm()}
      </Modal>
    </>
  );
}

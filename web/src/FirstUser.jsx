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

  useEffect(() => {
    client.users.getUser().then(userValues => {
      setUser(userValues);
      setFormValues({ ...formValues, ...userValues });
    });
  }, []);

  if (user === null) return <Skeleton width="50%" fontSize="sm" />;

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

  const userIsDefined = user?.userName !== "";

  const link = content => (
    <Button variant="link" isInline onClick={open}>
      {content}
    </Button>
  );

  const renderLink = () => {
    if (userIsDefined) {
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
        title="User account"
        actions={[
          <Button
            key="confirm"
            variant="primary"
            onClick={accept}
            isDisabled={formValues.userName === ""}
          >
            Confirm
          </Button>,
          <Button key="cancel" variant="secondary" onClick={cancel}>
            Cancel
          </Button>,
          <Button key="remove" variant="link" onClick={remove} isDisabled={!userIsDefined}>
            Do not create a user
          </Button>
        ]}
      >
        <Form>
          <FormGroup fieldId="userFullName" label="Full name">
            <TextInput
              id="userFullName"
              name="fullName"
              aria-label="User fullname"
              value={formValues.fullName}
              label="User full Name"
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup fieldId="userName" label="Username">
            <TextInput
              id="userName"
              name="userName"
              aria-label="Username"
              value={formValues.userName}
              label="Username"
              required
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup fieldId="userPassword" label="Password">
            <TextInput
              id="userPassword"
              name="password"
              type="password"
              aria-label="User password"
              value={formValues.password}
              onChange={handleInputChange}
            />
          </FormGroup>

          <Checkbox
            aria-label="user autologin"
            id="autologin"
            name="autologin"
            label="Auto-login"
            isChecked={formValues.autologin}
            onChange={handleInputChange}
          />
        </Form>
      </Modal>
    </>
  );
}

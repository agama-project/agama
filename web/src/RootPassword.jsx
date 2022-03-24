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

import React, { useState, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import {
  Button,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  Skeleton,
  Text,
  TextInput
} from "@patternfly/react-core";

export default function RootPassword() {
  const client = useInstallerClient();
  const [isRootPasswordSet, setIsRootPasswordSet] = useState(null);
  const [rootPassword, setRootPassword] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(async () => {
    const rootPasswordSet = await client.users.isRootPasswordSet();
    setIsRootPasswordSet(rootPasswordSet);
  }, []);

  const open = () => setIsFormOpen(true);

  const close = () => {
    setRootPassword("");
    setIsFormOpen(false);
  };

  const accept = async () => {
    // TODO: handle errors
    if (rootPassword !== "") {
      const result = await client.users.setRootPassword(rootPassword);
      setIsRootPasswordSet(result === 0);
    }
    close();
  };

  const remove = async () => {
    await client.users.removeRootPassword();
    setIsRootPasswordSet(false);
    close();
  };

  // Renders nothing until know about the status of password
  if (isRootPasswordSet === null) return <Skeleton />;

  const renderLink = () => {
    const label = isRootPasswordSet ? "is set" : "is not set";
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
        aria-label="Set new root password"
        actions={[
          <Button key="confirm" variant="primary" onClick={accept}>
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={close}>
            Cancel
          </Button>,
          <Button key="remove" variant="link" onClick={remove} isDisabled={!isRootPasswordSet}>
            Remove
          </Button>
        ]}
      >
        <Form>
          <FormGroup fieldId="rootPassword" label="New root password">
            <TextInput
              id="rootPassword"
              type="password"
              aria-label="root password"
              value={rootPassword}
              onChange={setRootPassword}
            />
          </FormGroup>
        </Form>
      </Modal>
    </>
  );
}

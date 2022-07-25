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

import React, { useState, useEffect, useCallback } from "react";
import { useSafeEffect } from "./utils";
import { useInstallerClient } from "./context/installer";

import {
  Button,
  Form,
  FormGroup,
  Skeleton,
  Text,
  TextInput
} from "@patternfly/react-core";

import Popup from './Popup';

export default function RootPassword() {
  const client = useInstallerClient();
  const [isRootPasswordSet, setIsRootPasswordSet] = useState(null);
  const [rootPassword, setRootPassword] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  useSafeEffect(useCallback((makeSafe) => {
    client.users.isRootPasswordSet()
      .then(makeSafe(setIsRootPasswordSet))
      .catch(console.error);
  }, [client.users]));

  useEffect(() => {
    return client.users.onUsersChange(changes => {
      if (changes.rootPasswordSet !== undefined) {
        setIsRootPasswordSet(changes.rootPasswordSet);
      }
    });
  }, [client.users]);

  if (isRootPasswordSet === null) return <Skeleton width="60%" fontSize="sm" />;

  const open = () => setIsFormOpen(true);

  const close = () => {
    setRootPassword("");
    setIsFormOpen(false);
  };

  const accept = async (e) => {
    e.preventDefault();
    // TODO: handle errors
    if (rootPassword !== "") {
      const result = await client.users.setRootPassword(rootPassword);
      setIsRootPasswordSet(result);
    }
    close();
  };

  const remove = async () => {
    const result = await client.users.removeRootPassword();
    if (result) {
      setIsRootPasswordSet(false);
    }
    close();
  };

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

      <Popup
        isOpen={isFormOpen}
        aria-label="Set new root password"
      >
        <Form id="root-password" onSubmit={accept}>
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

        <Popup.Actions>
          <Popup.Confirm form="root-password" type="submit" isDisabled={rootPassword === ""} />
          <Popup.Cancel onClick={close} />
          <Popup.AncillaryAction onClick={remove} isDisabled={!isRootPasswordSet} key="unset">
            Do not use a password
          </Popup.AncillaryAction>
        </Popup.Actions>
      </Popup>
    </>
  );
}

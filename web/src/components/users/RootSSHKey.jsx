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
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import {
  Button,
  Form,
  FormGroup,
  Skeleton,
  Text,
  FileUpload
} from "@patternfly/react-core";

import { Popup } from '~/components/core';

export default function RootSSHKey() {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [loading, setLoading] = useState(false);
  const [sshKey, setSSHKey] = useState(null);
  const [nextSSHKey, setNextSSHKey] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    cancellablePromise(client.users.getRootSSHKey())
      .then(setSSHKey)
      .catch(console.error);
  }, [client.users, cancellablePromise]);

  useEffect(() => {
    return client.users.onUsersChange(changes => {
      if (changes.rootSSHKey !== undefined) {
        setSSHKey(changes.rootSSHKey);
      }
    });
  }, [client.users]);

  if (sshKey === null) return <Skeleton width="55%" fontSize="sm" />;

  const open = () => {
    setNextSSHKey(sshKey);
    setIsFormOpen(true);
  };

  const cancel = () => setIsFormOpen(false);

  const accept = async (e) => {
    e.preventDefault();
    await client.users.setRootSSHKey(nextSSHKey);
    setSSHKey(nextSSHKey);
    setIsFormOpen(false);
  };

  const remove = async () => {
    await client.users.setRootSSHKey("");
    setSSHKey("");
    setIsFormOpen(false);
  };

  const renderLink = () => {
    const label = sshKey !== "" ? "is set" : "is not set";
    const link = (
      <Button variant="link" isInline onClick={open}>
        {label}
      </Button>
    );

    return <Text>Root SSH public key {link}</Text>;
  };

  return (
    <>
      {renderLink()}
      <Popup isOpen={isFormOpen} aria-label="Set root SSH public key">
        <Form id="root-ssh-key" onSubmit={accept}>
          <FormGroup fieldId="sshKey" label="Root SSH public key">
            <FileUpload
              id="sshKey"
              type="text"
              value={nextSSHKey}
              filenamePlaceholder="Upload, paste, or drop a SSH public key"
              isLoading={loading}
              browseButtonText="Upload"
              onDataChange={setNextSSHKey}
              onTextChange={setNextSSHKey}
              onReadStarted={() => setLoading(true)}
              onReadFinished={() => setLoading(false)}
              onClearClick={() => setNextSSHKey("")}
            />
          </FormGroup>
        </Form>

        <Popup.Actions>
          <Popup.Confirm form="root-ssh-key" type="submit" />
          <Popup.Cancel onClick={cancel} />
          <Popup.AncillaryAction onClick={remove} isDisabled={sshKey === ""} key="unset">
            Do not use SSH public key
          </Popup.AncillaryAction>
        </Popup.Actions>
      </Popup>
    </>
  );
}

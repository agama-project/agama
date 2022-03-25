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
  Text
} from "@patternfly/react-core";
import { FileUpload } from "@patternfly/react-core";

export default function RootSSHKey() {
  const client = useInstallerClient();
  const [loading, setLoading] = useState(false);
  const [sshKey, setSSHKey] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(async () => {
    const key = await client.users.getRootSSHKey();
    setSSHKey(key);
  }, []);

  if (sshKey === null) return <Skeleton width="55%" fontSize="sm" />;

  const accept = async () => {
    await client.users.setRootSSHKey(sshKey);
    setIsFormOpen(false);
  };

  const cancel = () => setIsFormOpen(false);
  const open = () => setIsFormOpen(true);

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
      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        aria-label="Set root SSH public key"
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
          <FormGroup fieldId="sshKey" label="Root SSH key">
            <FileUpload
              id="sshKey"
              type="text"
              value={sshKey}
              filenamePlaceholder="Upload, paste, or drop a SSH public key"
              isLoading={loading}
              browseButtonText="Upload"
              onDataChange={setSSHKey}
              onTextChange={setSSHKey}
              onReadStarted={() => setLoading(true)}
              onReadFinished={() => setLoading(false)}
              onClearClick={() => setSSHKey("")}
            />
          </FormGroup>
        </Form>
      </Modal>
    </>
  );
}

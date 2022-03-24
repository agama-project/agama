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
import { Button, Form, FormGroup, Modal, ModalVariant, Text } from "@patternfly/react-core";
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

  const accept = async () => {
    await client.users.setRootSSHKey(sshKey);
    setIsFormOpen(false);
  };

  const cancel = () => setIsFormOpen(false);
  const open = () => setIsFormOpen(true);

  if (sshKey === null) return null;

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
        <Form>
          <FormGroup fieldId="sshKey" label="Root SSH key">
            <FileUpload
              id="sshKey"
              type="text"
              value={sshKey}
              filenamePlaceholder="Drag and drop a SSH public key or upload one"
              onDataChange={setSSHKey}
              onTextChange={setSSHKey}
              onReadStarted={() => setLoading(true)}
              onReadFinished={() => setLoading(false)}
              onClearClick={() => setSSHKey("")}
              isLoading={loading}
              browseButtonText="Upload"
            />
          </FormGroup>
        </Form>
      </Modal>
    </>
  );
}

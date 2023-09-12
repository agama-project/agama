/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import React, { useState } from "react";
import { Form, FormGroup, FileUpload } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Popup } from '~/components/core';
import { useInstallerClient } from "~/context/installer";

/**
 * A dialog holding the form to set the SSH Public key for root
 * @component
 *
 * @example <caption>Simple usage</caption>
 *   <RootSSHKeyPopup isOpen onClose={() => onCloseCallback()} />
 *
 * @param {object} props
 * @param {string} [props.title="Set root SSH public key"] - the text to be used as the title of the dialog
 * @param {string} [props.currentKey=""] - the current SSH Key, if any
 * @param {boolean} props.isOpen - whether the dialog should be visible
 * @param {function} props.onClose - the function to be called when the dialog is closed
 */
export default function RootSSHKeyPopup({
  title = _("Set root SSH public key"),
  currentKey = "",
  isOpen,
  onClose
}) {
  const client = useInstallerClient();
  const [isLoading, setIsLoading] = useState(false);
  const [sshKey, setSSHKey] = useState(currentKey);

  const startUploading = () => setIsLoading(true);
  const stopUploading = () => setIsLoading(false);
  const clearKey = () => setSSHKey("");

  const close = () => {
    clearKey();
    onClose();
  };

  const accept = async (e) => {
    e.preventDefault();
    client.users.setRootSSHKey(sshKey);
    // TODO: handle/display errors
    close();
  };

  return (
    <Popup isOpen={isOpen} title={title}>
      <Form id="root-ssh-key" onSubmit={accept}>
        <FormGroup fieldId="sshKey" label={_("Root SSH public key")}>
          <FileUpload
            id="sshKey"
            type="text"
            value={sshKey}
            filenamePlaceholder={_("Upload, paste, or drop an SSH public key")}
            // TRANSLATORS: push button label
            browseButtonText={_("Upload")}
            // TRANSLATORS: push button label, clears the related input field
            clearButtonText={_("Clear")}
            isLoading={isLoading}
            onDataChange={(_, value) => setSSHKey(value)}
            onTextChange={(_, value) => setSSHKey(value)}
            onReadStarted={startUploading}
            onReadFinished={stopUploading}
            onClearClick={clearKey}
          />
        </FormGroup>
      </Form>

      <Popup.Actions>
        <Popup.Confirm form="root-ssh-key" type="submit" isDisabled={sshKey === ""} />
        <Popup.Cancel onClick={close} />
      </Popup.Actions>
    </Popup>
  );
}

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

import React, { useState } from "react";
import { useInstallerClient } from "~/context/installer";

import { Button, Text } from "@patternfly/react-core";
import { Popup } from "~/components/core";

const InstallConfirmationPopup = ({ onAccept, onClose }) => (
  <Popup
    title="Confirm Installation"
    isOpen
  >
    <Text>
      If you continue, partitions on your hard disk will be modified according to the
      installation settings in the previous dialog.
    </Text>
    <Text>
      Please, cancel and check the settings if you are unsure.
    </Text>

    <Popup.Actions>
      <Popup.Confirm onClick={onAccept}>Continue</Popup.Confirm>
      <Popup.Cancel onClick={onClose} autoFocus />
    </Popup.Actions>
  </Popup>
);

const CannotInstallPopup = ({ onClose }) => (
  <Popup
    title="Problems Found"
    isOpen
  >
    <Text>
      Some problems were found when trying to start the installation.
      Please, have a look to the reported issues and try again.
    </Text>

    <Popup.Actions>
      <Popup.Cancel onClick={onClose} autoFocus />
    </Popup.Actions>
  </Popup>
);

const renderPopup = (error, { onAccept, onClose }) => {
  if (error) {
    return <CannotInstallPopup onClose={onClose} />;
  } else {
    return <InstallConfirmationPopup onClose={onClose} onAccept={onAccept} />;
  }
};

/**
 * Installation button
 *
 * It starts the installation if there are not validation errors. Otherwise,
 * it displays a pop-up asking the user to fix the errors.
*
 * @component
 *
 * @example
 *   <InstallButton onClick={() => console.log("clicked!")} />
 *
 * @param {object} props
 * @param {() => void} [props.onClick] - function to call when the user clicks the button
 */
const InstallButton = ({ onClick }) => {
  const client = useInstallerClient();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(false);

  const open = () => {
    if (onClick) onClick();
    client.manager.canInstall().then(ok => {
      setIsOpen(true);
      setError(!ok);
    });
  };
  const close = () => setIsOpen(false);
  const install = () => client.manager.startInstallation();

  return (
    <>
      <Button isLarge variant="primary" onClick={open}>
        Install
      </Button>

      { isOpen && renderPopup(error, { onAccept: install, onClose: close }) }
    </>
  );
};

export default InstallButton;

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
import { useInstallerClient } from "~/context/installer";

import { Button, Stack } from "@patternfly/react-core";

import { Popup } from "~/components/core";
import { _ } from "~/i18n";

const InstallConfirmationPopup = ({ onAccept, onClose }) => {
  return (
    <Popup title={_("Confirm Installation")} isOpen>
      <Stack hasGutter>
        <p>
          {_(
            "If you continue, partitions on your hard disk will be modified \
according to the provided installation settings."
          )}
        </p>
        <p>{_("Please, cancel and check the settings if you are unsure.")}</p>
      </Stack>
      <Popup.Actions>
        <Popup.Confirm onClick={onAccept}>
          {/* TRANSLATORS: button label */}
          {_("Continue")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onClose}>
          {/* TRANSLATORS: button label */}
          {_("Cancel")}
        </Popup.Cancel>
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Installation button
 *
 * It starts the installation after asking for confirmation.
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

  const open = async () => {
    if (onClick) onClick();
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);
  const install = () => client.manager.startInstallation();

  return (
    <>
      <Button size="lg" variant="primary" onClick={open}>
        {/* TRANSLATORS: button label */}
        {_("Install")}
      </Button>

      {isOpen && <InstallConfirmationPopup onAccept={install} onClose={close} />}
    </>
  );
};

export default InstallButton;

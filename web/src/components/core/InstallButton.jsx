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

import { Button } from "@patternfly/react-core";

import { If, Popup } from "~/components/core";
import { _ } from "~/i18n";

const InstallConfirmationPopup = ({ hasIssues, onAccept, onClose }) => {
  const IssuesWarning = () => {
    // TRANSLATORS: the installer reports some errors,

    return (
      <p>
        <strong>
          { _("There are some reported issues. \
Please review them in the previous steps before proceeding with the installation.") }
        </strong>
      </p>
    );
  };

  const Cancel = hasIssues ? Popup.PrimaryAction : Popup.SecondaryAction;
  const Continue = hasIssues ? Popup.SecondaryAction : Popup.PrimaryAction;

  return (
    <Popup
      title={_("Confirm Installation")}
      isOpen
    >
      <div className="stack">
        <If condition={hasIssues} then={<IssuesWarning />} />
        <p>
          { _("If you continue, partitions on your hard disk will be modified \
according to the provided installation settings.") }
        </p>
        <p>
          {_("Please, cancel and check the settings if you are unsure.")}
        </p>
      </div>
      <Popup.Actions>
        <Cancel key="cancel" onClick={onClose} autoFocus={hasIssues}>
          {/* TRANSLATORS: button label */}
          {_("Cancel")}
        </Cancel>
        <Continue key="confirm" onClick={onAccept} autoFocus={!hasIssues}>
          {/* TRANSLATORS: button label */}
          {_("Continue")}
        </Continue>
      </Popup.Actions>
    </Popup>
  );
};

const CannotInstallPopup = ({ onClose }) => (
  <Popup
    title={_("Problems Found")}
    isOpen
  >
    <p>
      {_("Some problems were found when trying to start the installation. \
Please, have a look to the reported errors and try again.")}
    </p>

    <Popup.Actions>
      <Popup.Cancel onClick={onClose} autoFocus>
        {/* TRANSLATORS: button label */}
        {_("Accept")}
      </Popup.Cancel>
    </Popup.Actions>
  </Popup>
);

const renderPopup = (error, hasIssues, { onAccept, onClose }) => {
  if (error) {
    return <CannotInstallPopup onClose={onClose} />;
  } else {
    return <InstallConfirmationPopup onClose={onClose} onAccept={onAccept} hasIssues={hasIssues} />;
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
  const [hasIssues, setHasIssues] = useState(false);

  const open = async () => {
    if (onClick) onClick();
    const canInstall = await client.manager.canInstall();
    setIsOpen(true);
    setError(!canInstall);
    if (canInstall) {
      const issues = await client.issues();
      setHasIssues(Object.values(issues).some(n => n.length > 0));
    }
  };
  const close = () => setIsOpen(false);
  const install = () => client.manager.startInstallation();

  return (
    <>
      <Button size="lg" variant="primary" onClick={open}>
        {/* TRANSLATORS: button label */}
        {_("Install")}
      </Button>

      { isOpen && renderPopup(error, hasIssues, { onAccept: install, onClose: close }) }
    </>
  );
};

export default InstallButton;

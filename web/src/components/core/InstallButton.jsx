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
import { useNavigate } from "react-router-dom";

import { If, Popup } from "~/components/core";

const InstallConfirmationPopup = React.memo(({ isOpen, hasIssues, onAccept, onClose }) => {
  const navigate = useNavigate();

  const IssuesWarning = () => {
    const IssuesLink = ({ text }) => {
      return (
        <Button variant="link" isInline onClick={() => navigate("/issues")}>
          {text}
        </Button>
      );
    };

    return (
      <p className="bold">
        There are some reported issues. Please, check <IssuesLink text="the list of issues" /> before
        proceeding with the installation.
      </p>
    );
  };

  return (
    <Popup
      isOpen={isOpen}
      title="Confirm Installation"
    >
      <div className="stack">
        <If condition={hasIssues} then={<IssuesWarning />} />
        <p>
          If you continue, partitions on your hard disk will be modified according to the provided
          installation settings.
        </p>
        <p>
          Please, cancel and check the settings if you are unsure.
        </p>
      </div>
      <Popup.Actions>
        <Popup.Confirm onClick={onAccept}>Continue</Popup.Confirm>
        <Popup.Cancel onClick={onClose} autoFocus />
      </Popup.Actions>
    </Popup>
  );
});

const CannotInstallPopup = React.memo(({ isOpen, onClose }) => (
  <Popup
    isOpen={isOpen}
    title="Problems Found"
  >
    <p>
      Some problems were found when trying to start the installation.
      Please, have a look to the reported errors and try again.
    </p>

    <Popup.Actions>
      <Popup.Cancel onClick={onClose} autoFocus>Accept</Popup.Cancel>
    </Popup.Actions>
  </Popup>
));

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
    if (canInstall) setHasIssues(await client.issues.any());
    setIsOpen(true);
    setError(!canInstall);
  };

  const close = React.useCallback(() => setIsOpen(false), []);
  const install = React.useCallback(() => client.manager.startInstallation(), [client.manager]);

  return (
    <>
      <Button isLarge variant="primary" onClick={open}>
        Install
      </Button>

      <CannotInstallPopup isOpen={isOpen && !error} onClose={close} />;
      <InstallConfirmationPopup isOpen={isOpen && error} onClose={close} onAccept={install} hasIssues={hasIssues} />;
    </>
  );
};

export default InstallButton;

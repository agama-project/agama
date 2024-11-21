/*
 * Copyright (c) [2022-2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import { Button, ButtonProps, Stack, Tooltip } from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { startInstallation } from "~/api/manager";
import { useAllIssues } from "~/queries/issues";
import { useLocation } from "react-router-dom";
import { PRODUCT, ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * List of paths where the InstallButton must not be shown.
 *
 * Apart from obvious login and installation paths, it does not make sense to
 * show the button neither, when the user is about to change the product nor
 * when the installer is setting the chosen product.
 * */
const EXCLUDED_FROM = [
  ROOT.login,
  PRODUCT.changeProduct,
  PRODUCT.progress,
  ROOT.installationProgress,
  ROOT.installationFinished,
];

const InstallConfirmationPopup = ({ onAccept, onClose }) => {
  return (
    <Popup title={_("Confirm Installation")} isOpen>
      <Stack hasGutter>
        <p>
          {_(
            "If you continue, partitions on your hard disk will be modified \
according to the provided installation settings.",
          )}
        </p>
        <p>{_("Please, cancel and check the settings if you are unsure.")}</p>
      </Stack>
      <Popup.Actions>
        <Popup.Confirm onClick={onAccept}>
          {/* TRANSLATORS: button label */}
          {_("Continue")}
        </Popup.Confirm>
        <Popup.Cancel autoFocus onClick={onClose}>
          {/* TRANSLATORS: button label */}
          {_("Cancel")}
        </Popup.Cancel>
      </Popup.Actions>
    </Popup>
  );
};

/** Internal component for rendering the disabled Install button */
const DisabledButton = (props: ButtonProps) => (
  <Tooltip
    position="bottom-end"
    content={_(
      "Installation not possible yet. Please, check issues from the topbar notification area",
    )}
  >
    <Button {...props} />
  </Tooltip>
);

/**
 * Installation button
 *
 * It will be shown only if there aren't installation issues and the current
 * path is not in the EXCLUDED_FROM list.
 *
 * When clicked, it will ask for a confirmation before triggering the request
 * for starting the installation.
 */
const InstallButton = (buttonProps: Omit<ButtonProps, "onClick">) => {
  const issues = useAllIssues();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isEnabled = issues.isEmpty;

  if (EXCLUDED_FROM.includes(location.pathname)) return;

  const open = async () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const onAccept = () => {
    close();
    startInstallation();
  };

  const props: ButtonProps = {
    ...buttonProps,
    variant: "primary",
    onClick: open,
    /* TRANSLATORS: Install button label */
    children: _("Install"),
  };

  return (
    <>
      {isEnabled ? <Button {...props} /> : <DisabledButton {...props} isAriaDisabled />}
      {isOpen && <InstallConfirmationPopup onAccept={onAccept} onClose={close} />}
    </>
  );
};

export default InstallButton;

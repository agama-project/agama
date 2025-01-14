/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { Button, ButtonProps, Stack } from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { startInstallation } from "~/api/manager";
import { useAllIssues } from "~/queries/issues";
import { useLocation } from "react-router-dom";
import { SUPPORTIVE_PATHS } from "~/routes/paths";
import { _ } from "~/i18n";
import { Icon } from "../layout";

/**
 * List of paths where the InstallButton must not be shown.
 *
 * Apart from obvious login and installation paths, it does not make sense to
 * show the button neither, when the user is about to change the product,
 * defining the root authentication for the fisrt time, nor when the installer
 * is setting the chosen product.
 * */

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

/**
 * Installation button
 *
 * It will be shown only if there aren't installation issues and the current
 * path is not in the EXCLUDED_FROM list.
 *
 * When clicked, it will ask for a confirmation before triggering the request
 * for starting the installation.
 */
const InstallButton = (
  props: Omit<ButtonProps, "onClick"> & { onClickWithIssues?: () => void },
) => {
  const issues = useAllIssues();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const hasIssues = !issues.isEmpty;

  if (SUPPORTIVE_PATHS.includes(location.pathname)) return;

  const { onClickWithIssues, ...buttonProps } = props;
  const open = async () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const onAccept = () => {
    close();
    startInstallation();
  };

  // TRANSLATORS: The install button label
  const buttonText = _("Install");
  // TRANSLATORS: Accessible text included with the install button when there are issues
  const withIssuesAriaLabel = _("Not possible with the current setup. Click to know more.");

  return (
    <>
      <Button
        variant="control"
        size="lg"
        {...buttonProps}
        onClick={hasIssues ? onClickWithIssues : open}
      >
        {buttonText}
        {hasIssues && (
          <div className="agama-issues-mark" aria-label={withIssuesAriaLabel}>
            <Icon name="exclamation" size="xs" color="custom-color-300" />
          </div>
        )}
      </Button>

      {isOpen && <InstallConfirmationPopup onAccept={onAccept} onClose={close} />}
    </>
  );
};

export default InstallButton;

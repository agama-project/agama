/*
 * Copyright (c) [2026] SUSE LLC
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

import React from "react";
import { Content, Stack } from "@patternfly/react-core";
import Popup from "~/components/core/Popup";
import { useNavigate } from "react-router";
import { ROOT } from "~/routes/paths";
import { useConfig } from "~/hooks/model/config";
import { rebootAction, shutdownAction } from "~/api";
import { _ } from "~/i18n";

type ExitInstallationDialogProps = {
  onClose: () => void;
};

/**
 * Dialog to allow exiting the installation.
 */
export default function ExitInstallationDialog({ onClose }: ExitInstallationDialogProps) {
  const navigate = useNavigate();
  const config = useConfig();

  const hasPreScripts = () => {
    const scripts = config?.scripts;
    return scripts && "pre" in scripts;
  };

  const content = hasPreScripts()
    ? /* TRANSLATORS: Description of the side effects of exiting the installation. */
      _(
        "Configuration pre-scripts have been executed and may have modified your system. You can \
reboot or shut down, but any changes made by these scripts will not be undone.",
      )
    : /* TRANSLATORS: Description of the side effects of exiting the installation. */
      _(
        "You can safely reboot or shut down the system. No changes have been made to \
your disks, and your current installation setup will be canceled.",
      );

  const reboot = () => {
    rebootAction();
    navigate(ROOT.installationReboot, { replace: true });
  };

  const shutdown = () => {
    shutdownAction();
    navigate(ROOT.installationShutdown, { replace: true });
  };

  return (
    <Popup
      isOpen
      title={_("Exit installation")}
      variant="small"
      onClose={onClose}
      actions={
        <>
          <Popup.SecondaryAction onClick={reboot} icon="restart_alt">
            {_("Reboot")}
          </Popup.SecondaryAction>
          <Popup.SecondaryAction onClick={shutdown} icon="power_settings_circle">
            {_("Shut down")}
          </Popup.SecondaryAction>
        </>
      }
    >
      <Stack hasGutter>
        <Content isEditorial>{content}</Content>
      </Stack>
    </Popup>
  );
}

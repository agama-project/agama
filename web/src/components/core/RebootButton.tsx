/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { Button, ButtonProps } from "@patternfly/react-core";
import { useNavigate } from "react-router";
import { finishInstallation } from "~/api";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Reboot button component
 *
 * A pre-configured button that triggers the installation finish process and
 * navigates to the installation exit screen, which initiates a system reboot.
 *
 * The button automatically handles the reboot workflow:
 *   - Calls finishInstallation() to complete the installation process
 *   - Navigates to the installation exit route (replaces current history entry)
 *
 * Default styling can be overridden via props, but the onClick handler is
 * always controlled by this component.
 *
 */
export default function RebootButton(props: Omit<ButtonProps, "onClick">) {
  const navigate = useNavigate();

  const onReboot = () => {
    finishInstallation();
    navigate(ROOT.installationExit, { replace: true });
  };

  return (
    <Button size="lg" variant="primary" {...props} onClick={onReboot}>
      {_("Reboot")}
    </Button>
  );
}

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
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * A call-to-action button that directs users to the overview page, which
 * contains the actual installation button.
 *
 * This button does not trigger installation directly. Instead, it serves as a
 * navigation element that guides users to the overview page where they can
 * review installation details before proceeding. The label "Review and Install"
 * is intentional, indicating that users will first be presented with a summary
 * screen before they can proceed with the installation.
 */
export default function ReviewAndInstallButton(
  props: Omit<ButtonProps, "onClick"> & { onClickWithIssues?: () => void },
) {
  const navigate = useNavigate();

  const navigateToConfirmation = () => navigate(ROOT.overview);

  const { onClickWithIssues, ...buttonProps } = props;

  // TRANSLATORS: The review and install button label
  const buttonText = _("Review and install");

  return (
    <Button {...buttonProps} onClick={navigateToConfirmation}>
      {buttonText}
    </Button>
  );
}

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

import React, { useId } from "react";
import { Button, ButtonProps } from "@patternfly/react-core";
import { useLocation, useNavigate } from "react-router";
import { EXTENDED_SIDE_PATHS, ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * A call-to-action button that navigates users to the overview page containing
 * the actual installation button.
 *
 * Despite its name, this component doesn't trigger installation directly.
 * Instead, it serves as a prominent navigation element to guide users toward
 * the overview page where the real installation button resides. The "Install"
 * label is intentionally simple and action-oriented to match user intent.
 *
 * @todo Refactor component name and behavior
 * - Rename to better reflect its navigation purpose
 * - Replace route-based visibility logic with explicit prop-based control now
 *   that pages manage their own layouts
 */
const InstallButton = (
  props: Omit<ButtonProps, "onClick"> & { onClickWithIssues?: () => void },
) => {
  const labelId = useId();
  const navigate = useNavigate();
  const location = useLocation();

  if (EXTENDED_SIDE_PATHS.includes(location.pathname)) return;

  const navigateToConfirmation = () => navigate(ROOT.overview);

  const { onClickWithIssues, ...buttonProps } = props;

  // TRANSLATORS: The install button label
  const buttonText = _("Install");

  return (
    <Button variant="primary" {...buttonProps} onClick={navigateToConfirmation}>
      <span id={labelId}>{buttonText}</span>
    </Button>
  );
};

export default InstallButton;

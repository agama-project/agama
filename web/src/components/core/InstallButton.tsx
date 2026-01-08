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
import { Button, ButtonProps, Tooltip, TooltipProps } from "@patternfly/react-core";
import { useIssues } from "~/hooks/model/issue";
import { useLocation, useNavigate } from "react-router";
import { EXTENDED_SIDE_PATHS, ROOT } from "~/routes/paths";
import { _ } from "~/i18n";
import { Icon } from "../layout";
import { isEmpty } from "radashi";

/**
 * Installation button
 *
 * It will always be displayed unless in a side path. If any issues are
 * detected, a drawer listing them will be shown; otherwise, confirmation will
 * be requested before initiating the installation process.
 */
const InstallButton = (
  props: Omit<ButtonProps, "onClick"> & { onClickWithIssues?: () => void },
) => {
  const labelId = useId();
  const tooltipId = useId();
  const issues = useIssues();
  const navigate = useNavigate();
  const location = useLocation();
  const hasIssues = !isEmpty(issues);

  if (EXTENDED_SIDE_PATHS.includes(location.pathname)) return;

  const navigateToConfirmation = () => navigate(ROOT.overview);

  const { onClickWithIssues, ...buttonProps } = props;

  // TRANSLATORS: The install button label
  const buttonText = _("Install");
  // TRANSLATORS: Text included with the install button when there are issues
  const withIssuesText = _("Not possible with the current setup. Click to know more.");

  const Wrapper = !hasIssues ? React.Fragment : Tooltip;
  const tooltipProps: TooltipProps = {
    id: tooltipId,
    content: withIssuesText,
    position: "bottom-start",
    flipBehavior: ["bottom-end"],
  };

  return (
    <>
      <Wrapper {...(hasIssues && tooltipProps)}>
        <Button
          variant="control"
          className="agm-install-button"
          {...buttonProps}
          onClick={hasIssues ? onClickWithIssues : navigateToConfirmation}
          icon={hasIssues && <Icon name="error_fill" />}
          iconPosition="end"
        >
          <span id={labelId}>{buttonText}</span>
        </Button>
      </Wrapper>
    </>
  );
};

export default InstallButton;

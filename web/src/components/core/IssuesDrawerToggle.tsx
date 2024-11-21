/*
 * Copyright (c) [2024] SUSE LLC
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
import { NotificationBadge, NotificationBadgeProps } from "@patternfly/react-core";
import { useLocation } from "react-router-dom";
import { Icon } from "~/components/layout";
import { useAllIssues } from "~/queries/issues";
import { useInstallerStatus } from "~/queries/status";
import { PRODUCT, ROOT } from "~/routes/paths";
import { InstallationPhase } from "~/types/status";
import { _ } from "~/i18n";

export type IssuesDrawerToggleProps = {
  label?: string;
  onClick: () => void;
  isExpanded: NotificationBadgeProps["isExpanded"];
};

/**
 * Returns a toggle intended for changing the visibility of IssuesDrawer
 */
const IssuesDrawerToggle = ({
  label = _("Show preflight checks"),
  isExpanded,
  onClick,
}: IssuesDrawerToggleProps) => {
  const location = useLocation();
  const issues = useAllIssues();
  const { phase } = useInstallerStatus({ suspense: true });

  if (issues.isEmpty) return;
  if (phase === InstallationPhase.Install) return;
  if ([PRODUCT.changeProduct, PRODUCT.progress, ROOT.login].includes(location.pathname)) return;

  return (
    <NotificationBadge
      aria-label={label}
      attentionIcon={<Icon name="error" />}
      variant="attention"
      isExpanded={isExpanded}
      onClick={onClick}
    />
  );
};

export default IssuesDrawerToggle;

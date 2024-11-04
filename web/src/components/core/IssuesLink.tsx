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
import { useLocation } from "react-router-dom";
import { useAllIssues } from "~/queries/issues";
import Link, { LinkProps } from "~/components/core/Link";
import { Icon } from "../layout";
import { Tooltip } from "@patternfly/react-core";
import { PRODUCT, ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Installation issues link
 *
 * As a counterpart of the InstallButton, it shows a button with a warning icon
 * when the installation is not possible because there are installation issues.
 */
const IssuesLink = (props: Omit<LinkProps, "to">) => {
  const issues = useAllIssues();
  const location = useLocation();

  if (issues.isEmpty) return;
  // Do not show the button if the user is about to change the product or the
  // installer is configuring a product.
  if ([PRODUCT.changeProduct, PRODUCT.progress].includes(location.pathname)) return;

  return (
    <Tooltip
      content={_("Installation not possible yet because of issues. Check them at Overview page.")}
    >
      <Link aria-label={_("Installation issues")} {...props} to={ROOT.overview}>
        <Icon name="warning" />
      </Link>
    </Tooltip>
  );
};

export default IssuesLink;

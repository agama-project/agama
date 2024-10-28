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
import { PATHS as PRODUCT_PATHS } from "~/routes/products";
import { PATHS as ROOT_PATHS } from "~/router";
import { Icon } from "../layout";
import { Tooltip } from "@patternfly/react-core";
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
  // Do not show the button if the user is about to change the product.
  if (location.pathname === PRODUCT_PATHS.changeProduct) return;

  return (
    <Tooltip
      content={_("Installation not possible yet because of issues. Check them at Overview page.")}
    >
      <Link aria-label={_("Installation issues")} {...props} to={ROOT_PATHS.overview}>
        <Icon name="warning" />
      </Link>
    </Tooltip>
  );
};

export default IssuesLink;

/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { DropdownItem, DropdownItemProps } from "@patternfly/react-core";
import { useHref, useLocation } from "react-router";
// import { useRegistration } from "~/queries/software";
import { PRODUCT as PATHS, SIDE_PATHS } from "~/routes/paths";
import { _ } from "~/i18n";
import { useSystem } from "~/hooks/model/system";
import { useStatus } from "~/hooks/model/status";
import { isEmpty } from "radashi";

/**
 * DropdownItem Option for navigating to the selection product.
 */
export default function ChangeProductOption({ children, ...props }: Omit<DropdownItemProps, "to">) {
  const { products, software } = useSystem();
  const { stage } = useStatus();
  const currentLocation = useLocation();
  const to = useHref(PATHS.changeProduct);
  const hasModes = products.find((p) => !isEmpty(p.modes));

  if (products.length <= 1 && !hasModes) return null;
  if (software?.registration) return null;
  if (SIDE_PATHS.includes(currentLocation.pathname)) return null;
  if (stage !== "configuring") return null;

  const getLabel = () => {
    if (products.length === 1 && hasModes) return _("Change mode");
    if (hasModes) return _("Change product or mode");
    return _("Change product");
  };

  return (
    <DropdownItem to={to} {...props}>
      {children || getLabel()}
    </DropdownItem>
  );
}

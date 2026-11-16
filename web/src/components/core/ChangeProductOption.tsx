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
import { DropdownItem, DropdownItemProps, Flex } from "@patternfly/react-core";
import { href, useHref } from "react-router";
import { PRODUCT as PATHS } from "~/routes/paths";
import { _ } from "~/i18n";
import { useStatus } from "~/hooks/model/status";
import Link, { LinkProps } from "~/components/core/Link";
import Icon from "~/components/layout/Icon";

import menuStyles from "@patternfly/react-styles/css/components/Menu/menu";

type ChangeProductOptionProps = Omit<DropdownItemProps, "to" | "component" | "children"> &
  Omit<LinkProps, "to" | "component" | "children"> & {
    /**
     * The component to render.
     *   - "a": Renders as a Link component (default)
     *   - "dropdownitem": Renders as a DropdownItem component
     */
    component?: "dropdownitem" | "a";
    /**
     * Whether to display an icon before the label hinting that the option
     * leads to changing the current selection.
     */
    showIcon?: boolean;
  };

/**
 * Navigation option leading to Quick setup, where the product, location, disk
 * and login are set.
 *
 * Available while the installation is being configured, always with the same
 * label and, as a menu item, the same description, whether the product can
 * change or not.
 *
 * Can be rendered as either a link (default) or dropdown menu item. Optionally
 * displays an edit icon when `showIcon` is true.
 *
 * @example
 * // As a link (default)
 * <ChangeProductOption />
 *
 * @example
 * // As a dropdown item with icon
 * <ChangeProductOption component="dropdownitem" showIcon />
 */
export default function ChangeProductOption({
  component = "a",
  showIcon = false,
  ...props
}: ChangeProductOptionProps) {
  const { stage } = useStatus();
  const resolvedPath = useHref(PATHS.changeProduct);
  const to = component === "a" ? href(PATHS.changeProduct) : resolvedPath;

  if (stage !== "configuring") return null;

  // TRANSLATORS: menu entry leading to the screen with the basic settings
  // (product, location, disk and login)
  const label = _("Quick setup");

  if (component === "dropdownitem") {
    return (
      <DropdownItem to={`${to}?byUser`} {...props}>
        {/* The description goes below the name, not below the icon too, as the
            item's own description would. */}
        <Flex gap={{ default: "gapSm" }} flexWrap={{ default: "nowrap" }}>
          {showIcon && <Icon name="amend" size="lg" />}
          <div>
            {label}
            <div className={menuStyles.menuItemDescription}>
              {
                // TRANSLATORS: description of the "Quick setup" menu entry
                _("Run the quick setup again")
              }
            </div>
          </div>
        </Flex>
      </DropdownItem>
    );
  }

  return (
    <Link to={`${to}?byUser`} {...props}>
      <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
        {showIcon && <Icon name="amend" size="lg" />}
        {label}
      </Flex>
    </Link>
  );
}

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
import { useSystem } from "~/hooks/model/system";
import { useStatus } from "~/hooks/model/status";
import { isEmpty } from "radashi";
import Link, { LinkProps } from "~/components/core/Link";
import Icon from "~/components/layout/Icon";

type ChangeProductOptionProps = Omit<DropdownItemProps, "to" | "component" | "children"> &
  Omit<LinkProps, "to" | "component" | "children"> & {
    /**
     * The component to render.
     *   - "a": Renders as a Link component (default)
     *   - "dropdownitem": Renders as a DropdownItem component
     */
    component?: "dropdownitem" | "a";
    /**
     * Whether to display an edit icon before the label.
     * When true, displays an "edit_square" icon.
     */
    showIcon?: boolean;
  };

/**
 * Navigation option for changing the selected product or mode.
 *
 * This component conditionally renders based on the system state:
 *   - Returns null if there's only one product without modes
 *   - Returns null if software is registered
 *   - Returns null if installation stage is not "configuring"
 *
 * The label adapts to the available options:
 *   - "Change mode" when there's one product with modes
 *   - "Change product or mode" when there are multiple products and at least
 *     one has modes
 *   - "Change product" when there are multiple products without modes
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
  const { products, software } = useSystem();
  const { stage } = useStatus();
  const resolvedPath = useHref(PATHS.changeProduct);
  const to = component === "a" ? href(PATHS.changeProduct) : resolvedPath;
  const hasModes = products.find((p) => !isEmpty(p.modes));

  if (products.length <= 1 && !hasModes) return null;
  if (software?.registration) return null;
  if (stage !== "configuring") return null;

  const getLabel = () => {
    if (products.length === 1 && hasModes) return _("Change mode");
    if (hasModes) return _("Change product or mode");
    return _("Change product");
  };

  const Component = component === "a" ? Link : DropdownItem;
  const Wrapper = component === "a" ? Flex : React.Fragment;
  const wrapperProps =
    component === "a"
      ? { gap: { default: "gapXs" } as const, alignItems: { default: "alignItemsCenter" } as const }
      : {};

  return (
    <Component to={to} {...props}>
      <Wrapper {...wrapperProps}>
        {showIcon && <Icon name="edit_square" />} {getLabel()}
      </Wrapper>
    </Component>
  );
}

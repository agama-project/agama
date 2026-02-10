/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import {
  Masthead,
  MastheadContent,
  MastheadMain,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Breadcrumbs from "~/components/core/Breadcrumbs";
import { SkipTo } from "~/components/core";
import { useProductInfo } from "~/hooks/model/config/product";
import { ROOT } from "~/routes/paths";

import type { BreadcrumbProps } from "~/components/core/Breadcrumbs";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
/**
 * Props for the Header component.
 *
 * The layout follows a flexible horizontal structure where the primary content
 * (Title/Breadcrumbs) is on the left, and up to three slots are grouped at the
 * end of the toolbar:
 *
 * [Title | Breadcrumbs]...........[startSlot] [centerSlot] [endSlot]
 *
 * openSUSE Tumbleweed..........................Option v | English/US
 */
export type HeaderProps = {
  /**
   * Page title rendered as the main heading (h1).
   *
   * If provided, the title takes precedence over breadcrumbs.
   * If omitted, breadcrumbs are rendered instead, and the final
   * item acts as the main heading (h1).
   */
  title?: React.ReactNode;

  /** Breadcrumb navigation items shown when 'title' is not provided. */
  breadcrumbs?: BreadcrumbProps[];

  /**
   * The first slot in the trailing actions group.
   *
   * While intended for status indicators like the progress monitor,
   * it is a flexible container for any page-specific utility.
   */
  startSlot?: React.ReactNode;

  /**
   * The middle slot in the trailing actions group, positioned between
   * the start and end slots.
   *
   * This area is typically used for contextual actions, such as secondary
   * navigation or configuration menus. Like its sibling slots, it accepts any
   * React node to provide enough flexibility to fulfill page requirements.
   *
   * @example
   * ```tsx
   * <Header
   *   title="Storage"
   *   centerSlot={
   *     <Dropdown>
   *       <DropdownItem>Advanced settings</DropdownItem>
   *       <DropdownItem>Export configuration</DropdownItem>
   *     </Dropdown>
   *   }
   * />
   * ```
   */
  centerSlot?: React.ReactNode;

  /**
   * The final slot at the very edge of the header.
   *
   * This is intended for content that requires maximum discoverability.
   * Like the other slots, it accepts any React node to accommodate various
   * interaction patterns, though it is often a button or a link.
   *
   * **Common Use Cases:**
   * - Global navigation links (e.g., "Install").
   * - Button triggers for high-priority settings (e.g., L10n settings).
   * - Primary call-to-action buttons for the current workflow.
   *
   * @example
   * <Header endSlot={<Link to="/overview">Review and Install</Link>} />
   */
  endSlot?: React.ReactNode;

  /** Whether to hide the "Skip to content" accessibility link. */
  hideSkipToContent?: boolean;
};

/**
 * Internal component for building the page header
 *
 * Built on top of {@link https://www.patternfly.org/components/masthead | PF/Masthead}
 */
export default function Header({
  title,
  breadcrumbs,
  startSlot,
  centerSlot,
  endSlot,
  hideSkipToContent = false,
}: HeaderProps): React.ReactNode {
  const product = useProductInfo();

  return (
    <Masthead>
      <MastheadMain className={spacingStyles.pXs}>
        {!hideSkipToContent && <SkipTo />}
        {title ? (
          <Title headingLevel="h1">{title}</Title>
        ) : (
          <Breadcrumbs>
            {product && breadcrumbs && (
              <Breadcrumbs.Item
                hideDivider
                isEditorial
                path={ROOT.overview}
                label={
                  <Icon
                    name="list_alt"
                    width="1.4em"
                    height="1.4em"
                    style={{ verticalAlign: "middle" }}
                  />
                }
              />
            )}
            {breadcrumbs &&
              breadcrumbs.map((props, i) => (
                <Breadcrumbs.Item
                  isEditorial={i === 0}
                  key={i}
                  isCurrent={i === breadcrumbs.length - 1}
                  {...props}
                />
              ))}
          </Breadcrumbs>
        )}
      </MastheadMain>
      <MastheadContent>
        <Toolbar isFullHeight>
          <ToolbarContent>
            <ToolbarGroup align={{ default: "alignEnd" }} columnGap={{ default: "columnGapXs" }}>
              {startSlot && <ToolbarItem>{startSlot}</ToolbarItem>}
              {centerSlot && <ToolbarItem>{centerSlot}</ToolbarItem>}
              {endSlot && <ToolbarItem>{endSlot}</ToolbarItem>}
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
}

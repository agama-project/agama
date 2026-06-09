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
  Flex,
  Masthead,
  MastheadContent,
  MastheadMain,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import Breadcrumbs from "~/components/core/Breadcrumbs";
import Text from "~/components/core/Text";
import ProductLogo from "~/components/product/ProductLogo";
import { SkipTo } from "~/components/core";
import { useProductInfo } from "~/hooks/model/config/product";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

import type { BreadcrumbProps } from "~/components/core/Breadcrumbs";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

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
   * Whether to omit the leading "Installation" breadcrumb that links back to
   * the main summary page.
   *
   * Set it on the summary page itself, where linking back to it would be
   * redundant and the breadcrumb only needs to name the current location.
   */
  hideSummaryLink?: boolean;

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
   * - Button triggers for high-priority settings (e.g., L10n settings).
   * - Primary call-to-action buttons for the current workflow.
   *
   * @example
   * <Header endSlot={<Button>Retry</Button>} />
   */
  endSlot?: React.ReactNode;

  /** Whether to hide the "Skip to content" accessibility link. */
  hideSkipToContent?: boolean;
};

/**
 * Main breadcrumb navigation for the page, shown together with the product
 * logo and name.
 *
 * Used when the header has no explicit title; the last breadcrumb item is the
 * current page and acts as the heading (h1). A leading "Installation" item
 * linking back to the main page is prepended unless `hideSummaryLink` is set.
 */
function MainBreadcrumbs({
  breadcrumbs,
  hideSummaryLink,
}: Pick<HeaderProps, "breadcrumbs" | "hideSummaryLink">) {
  const product = useProductInfo();

  // Assemble the breadcrumb items first, so rendering only needs to know that
  // the first item never shows a leading divider.
  const items: BreadcrumbProps[] = [];

  // Prepend the link back to the main summary page, unless hideSummaryLink is
  // set or there is no product and breadcrumbs to accompany it.
  if (product && breadcrumbs && !hideSummaryLink) {
    items.push({
      isEditorial: true,
      path: ROOT.overview,
      // TRANSLATORS: First breadcrumb item, linking back to the main page
      // where the whole installation can be reviewed.
      label: _("Installation"),
    });
  }

  breadcrumbs?.forEach((item, index) =>
    items.push({
      ...item,
      isEditorial: index === 0,
      isCurrent: index === breadcrumbs.length - 1,
    }),
  );

  return (
    <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
      <ProductLogo product={product} width="35px" />
      <Flex direction={{ default: "column" }} gap={{ default: "gapNone" }}>
        {product && (
          <Text textStyle="textColorSubtle" className={textStyles.fontSizeXs}>
            {product.name}
          </Text>
        )}
        <Breadcrumbs>
          {items.map((item, index) => (
            <Breadcrumbs.Item key={index} {...item} hideDivider={index === 0 || item.hideDivider} />
          ))}
        </Breadcrumbs>
      </Flex>
    </Flex>
  );
}

/**
 * Page header (masthead) with the heading on the left and the trailing action
 * slots on the right.
 *
 * The heading is either the given `title` or, when omitted, the main
 * breadcrumb navigation with the product logo and name.
 *
 * Built on top of {@link https://www.patternfly.org/components/masthead | PF/Masthead}
 */
export default function Header({
  title,
  breadcrumbs,
  hideSummaryLink = false,
  startSlot,
  centerSlot,
  endSlot,
  hideSkipToContent = false,
}: HeaderProps): React.ReactNode {
  return (
    <Masthead>
      <MastheadMain className={spacingStyles.pXs}>
        {!hideSkipToContent && <SkipTo />}
        {title ? (
          <Title headingLevel="h1" className={textStyles.fontSizeXl}>
            {title}
          </Title>
        ) : (
          <MainBreadcrumbs breadcrumbs={breadcrumbs} hideSummaryLink={hideSummaryLink} />
        )}
      </MastheadMain>
      <MastheadContent>
        <Toolbar isFullHeight>
          <ToolbarContent>
            <ToolbarGroup align={{ default: "alignEnd" }} columnGap={{ default: "columnGapXs" }}>
              {startSlot && <ToolbarItem>{startSlot}</ToolbarItem>}
              {centerSlot && <ToolbarItem>{centerSlot}</ToolbarItem>}
              {endSlot && (
                <ToolbarItem columnGap={{ default: "columnGapXs" }}>{endSlot}</ToolbarItem>
              )}
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
}

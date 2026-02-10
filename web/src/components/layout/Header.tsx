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

import React, { useState } from "react";
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Masthead,
  MastheadContent,
  MastheadMain,
  MenuToggle,
  MenuToggleElement,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import {
  ChangeProductOption,
  InstallerOptions,
  ReviewAndInstallButton,
  SkipTo,
} from "~/components/core";
import ProgressStatusMonitor from "~/components/core/ProgressStatusMonitor";
import Breadcrumbs from "~/components/core/Breadcrumbs";
import { useProductInfo } from "~/hooks/model/config/product";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

import type { BreadcrumbProps } from "~/components/core/Breadcrumbs";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

export type HeaderProps = {
  /**
   * Page title rendered as the main heading (h1).
   *
   * When provided, the title is shown instead of breadcrumb navigation.
   * When omitted, breadcrumbs are rendered and the last breadcrumb
   * represents the current page.
   */
  title?: React.ReactNode;
  /** Whether the "Skip to content" link should be mounted */
  showSkipToContent?: boolean;
  /** Whether the installer options link should be mounted */
  showInstallerOptions?: boolean;
  /** Breadcrumb navigation items */
  breadcrumbs?: BreadcrumbProps[];
  /** Whether the progress monitor must not be mounted */
  hideProgressMonitor?: boolean;
};

const OptionsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(!isOpen);

  return (
    <Dropdown
      popperProps={{ position: "right", appendTo: () => document.body }}
      isOpen={isOpen}
      onOpenChange={toggle}
      onSelect={toggle}
      onActionClick={toggle}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={toggle}
          aria-label={_("Options toggle")}
          isExpanded={isOpen}
          isFullHeight
          variant="plain"
        >
          <Icon name="expand_circle_down" />
        </MenuToggle>
      )}
    >
      <DropdownList>
        <ChangeProductOption />
        <DropdownItem key="download-logs" to={ROOT.logs} download="agama-logs.tar.gz">
          {_("Download logs")}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

/**
 * Internal component for building the page header
 *
 * Built on top of {@link https://www.patternfly.org/components/masthead | PF/Masthead}
 */
export default function Header({
  title,
  breadcrumbs,
  showSkipToContent = true,
  showInstallerOptions = true,
  hideProgressMonitor = false,
}: HeaderProps): React.ReactNode {
  const product = useProductInfo();

  return (
    <Masthead>
      <MastheadMain className={spacingStyles.pXs}>
        {showSkipToContent && <SkipTo />}
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
              {!hideProgressMonitor && (
                <ToolbarItem>
                  <ProgressStatusMonitor />
                </ToolbarItem>
              )}
              {showInstallerOptions && (
                <ToolbarItem>
                  <InstallerOptions />
                </ToolbarItem>
              )}
              <ToolbarItem>
                <ReviewAndInstallButton />
              </ToolbarItem>
              <ToolbarItem>
                <OptionsDropdown />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
}

/*
 * Copyright (c) [2026] SUSE LLC
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
import { Flex } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import { TranslatedString, _ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import displayStyles from "@patternfly/react-styles/css/utilities/Display/display";

export type BreadcrumbProps = {
  /** The label to display for the breadcrumb item */
  label: React.ReactNode | TranslatedString;
  /** The URL path the breadcrumb item links to */
  path?: string;
  /**
   * Optional menu providing contextual navigation for the breadcrumb item.
   *
   * When provided, it appears adjacent to the breadcrumb label and is intended
   * to contain navigation options related to the area or section represented by
   * the breadcrumb.
   *
   * @remarks
   *
   * **Accessibility requirement**
   *
   * The menu trigger must be fully accessible.
   * Missing or incorrect ARIA attributes may result in an inaccessible breadcrumb.
   *
   * At a minimum, the trigger is expected to define:
   *   - aria-label="[Descriptive label]"
   *   - aria-haspopup="true"
   *   - aria-expanded="true | false"
   *
   * @example
   * ```tsx
   * <Breadcrumbs.Item
   *   label="Storage"
   *   path="/storage"
   *   menu={
   *     <Dropdown>
   *       <DropdownItem to="/storage/settings">Advanced settings</DropdownItem>
   *       <DropdownItem to="/storage/iscsi">iSCSI configuration</DropdownItem>
   *     </Dropdown>
   *   }
   * />
   * ```
   */
  menu?: React.ReactNode;
  /** Option to hide the divider (e.g., chevron icon) between breadcrumb items */
  hideDivider?: boolean;
  /** Flag to indicate if the breadcrumb item should have special editorial
   * style (e.g., bold and larger font) */
  isEditorial?: boolean;
  /** Flag indicating this breadcrumb represents the current page. Will set
   * `aria-current="page"` for accessibility. */
  isCurrent?: boolean;
};

/**
 * Renders an individual breadcrumb item with a link and optional divider.
 * Can be styled differently making use of isEditorial prop.
 */
const Breadcrumb = ({
  label,
  path,
  menu,
  isCurrent = false,
  hideDivider = false,
  isEditorial = false,
}: BreadcrumbProps) => {
  const content = (
    <Text isBold={isEditorial} className={isEditorial && textStyles.fontSizeLg}>
      {label}
    </Text>
  );

  return (
    <Flex
      component="li"
      gap={{ default: "gapXs" }}
      alignItems={{ default: "alignItemsCenter" }}
      aria-current={isCurrent ? "page" : undefined}
    >
      {!hideDivider && <Icon name="chevron_right" aria-hidden />}
      {isCurrent ? (
        <h1 className={displayStyles.displayInline}>{content}</h1>
      ) : (
        <Link to={path} variant="link" isInline>
          {content}
        </Link>
      )}
      {menu}
    </Flex>
  );
};

/**
 * Renders a list of breadcrumb items
 *
 * @example
 * <Breadcrumbs>
 *   <Breadcrumbs.Item label="Language and region" path="/l10n" />
 *   <Breadcrumbs.Item label="Keyboard selection" path="/l10n/keyboard/select" />
 * </Breadcrumbs>
 *
 */
const Breadcrumbs = ({ a11yName = _("Breadcrumbs"), children }) => {
  return (
    <nav aria-label={a11yName} className="agm-breadcrumb">
      <Flex
        component="ol"
        gap={{ default: "gapNone" }}
        alignItems={{ default: "alignItemsCenter" }}
        alignContent={{ default: "alignContentCenter" }}
      >
        {children}
      </Flex>
    </nav>
  );
};

Breadcrumbs.Item = Breadcrumb;

export default Breadcrumbs;

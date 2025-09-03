/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { Flex, Content } from "@patternfly/react-core";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import { RequireAtLeastOne } from "~/types/helpers";

/**
 * Props for the `MenuHeader` component.
 */
export type MenuHeaderProps = {
  /**
   * The main heading text for the menu section. Typically a short, descriptive
   * title that labels the group of menu options below.
   *
   * Example: "Appearance Settings"
   */
  title?: string;

  /**
   * Additional context or explanation displayed under the title if it was
   * provided. Rendered with smaller font styling, can include JSX elements for
   * formatting.
   *
   * Example: "Customize the theme and layout."
   */
  description?: React.ReactNode;
};

/**
 * Renders a title and/or description, typically used to add context to a group
 * of related menu options.
 *
 * Requires at least one of `title` or `description` to be provided.
 *
 * The title is rendered prominently, while the description appears in a smaller
 * font, intended to provide helpful guidance or clarification for users.
 *
 * @example
 * <MenuHeader
 *   title="Appearance Settings"
 *   description="Customize the theme and layout."
 * />
 */
export default function MenuHeader({ title, description }: RequireAtLeastOne<MenuHeaderProps>) {
  return (
    <Flex
      direction={{ default: "column" }}
      gap={{ default: "gapXs" }}
      className={[spacingStyles.pxMd, spacingStyles.pyXs].join(" ")}
    >
      <Content component="h4">{title}</Content>
      {description && <small>{description}</small>}
    </Flex>
  );
}

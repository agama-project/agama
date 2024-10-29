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
import {
  EmptyState,
  EmptyStateHeader,
  EmptyStateBody,
  Stack,
  EmptyStateFooter,
  EmptyStateActions,
  EmptyStateProps,
  EmptyStateHeaderProps,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { IconProps } from "../layout/Icon";

type EmptyStateWrapperProps = {
  title: string;
  icon: IconProps["name"];
  color?: string;
  headingLevel?: EmptyStateHeaderProps["headingLevel"];
  noPadding?: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

/**
 * Convenient wrapper for easing the use of PF/EmptyState component
 *
 * For consistence, try to use it as much as possible. Use PF/EmptyState
 * directly when dealing with a very specific UI use case and more freedom is
 * needed.
 *
 * @todo write documentation
 */
export default function EmptyStateWrapper({
  title,
  icon,
  color = "color-100",
  headingLevel = "h4",
  noPadding = false,
  actions,
  children,
  ...rest
}: Partial<EmptyStateProps> & EmptyStateWrapperProps) {
  // @ts-ignore
  if (noPadding) rest.className = [rest.className, "no-padding"].join(" ").trim();

  return (
    <EmptyState variant="lg" {...rest}>
      <EmptyStateHeader
        headingLevel={headingLevel}
        titleText={title}
        // FIXME: Allow more colors, not only PF text utils. See core/Icon.jsx too.
        titleClassName={`pf-v5-u-${color}`}
        icon={<Icon name={icon} size="xxl" color={color} />}
      />
      {children && (
        <EmptyStateBody>
          <Stack hasGutter>{children}</Stack>
        </EmptyStateBody>
      )}
      {actions && (
        <EmptyStateFooter>
          <EmptyStateActions>{actions}</EmptyStateActions>
        </EmptyStateFooter>
      )}
    </EmptyState>
  );
}

/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

// @ts-check

import React from "react";
import { EmptyState, EmptyStateHeader, EmptyStateBody, Flex } from "@patternfly/react-core";
import { Icon } from "~/components/layout";

/**
 * @typedef {import("~/components/layout/Icon").IconName} IconName
 * @typedef {import("@patternfly/react-core").EmptyStateProps} EmptyStateProps
 * @typedef {import("@patternfly/react-core").EmptyStateHeaderProps} EmptyStateHeaderProps
 */

/**
 * Convenient wrapper for easing the use of PF/EmptyState component
 *
 * For consistence, try to use it as much as possible. Use PF/EmptyState
 * directly when dealing with a very specific UI use case and more freedom is
 * needed.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {IconName} props.icon
 * @param {string} props.color
 * @param {EmptyStateHeaderProps["headingLevel"]} [props.headingLevel="h4"]
 * @param {boolean} [props.noPadding=false]
 * @param {React.ReactNode} props.children
 * @param {EmptyStateProps} [props.rest]
 * @todo write documentation
 */
export default function EmptyStateWrapper({
  title,
  icon,
  color,
  headingLevel = "h4",
  noPadding = false,
  children,
  ...rest
}) {
  if (noPadding) rest.className = [rest.className, "no-padding"].join(" ").trim();

  return (
    <EmptyState variant="lg" {...rest}>
      <EmptyStateHeader
        headingLevel={headingLevel}
        titleText={title}
        titleClassName={`pf-v5-u-${color}`}
        icon={<Icon name={icon} size="xxl" color={color} />}
      />
      <EmptyStateBody>
        <Flex
          direction={{ default: "column" }}
          rowGap={{ default: "rowGapMd" }}
          justifyContent={{ default: "justifyContentCenter" }}
        >
          {children}
        </Flex>
      </EmptyStateBody>
    </EmptyState>
  );
}

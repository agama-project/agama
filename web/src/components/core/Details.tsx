/*
 * Copyright (c) [2025] SUSE LLC
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
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Flex,
  Skeleton,
} from "@patternfly/react-core";
import type {
  DescriptionListTermProps,
  DescriptionListDescriptionProps,
  DescriptionListProps,
} from "@patternfly/react-core";
import { _ } from "~/i18n";

type ItemProps = {
  /** The label/term for this field */
  label: DescriptionListTermProps["children"];
  /** The value/description for this field */
  children: DescriptionListDescriptionProps["children"];
  /** Additional props passed to the DescriptionListTerm component */
  termProps?: Omit<DescriptionListTermProps, "children">;
  /** Additional props passed to the DescriptionListDescription component */
  descriptionProps?: Omit<DescriptionListDescriptionProps, "children">;
};

/**
 * A single item in a `Details` description list.
 *
 * Wraps a PatternFly `DescriptionListGroup` with `DescriptionListTerm` and
 * `DescriptionListDescription`.
 */
const Item = ({ label, children, termProps = {}, descriptionProps = {} }: ItemProps) => {
  return (
    <DescriptionListGroup>
      <DescriptionListTerm {...termProps}>{label}</DescriptionListTerm>
      <DescriptionListDescription {...descriptionProps}>{children}</DescriptionListDescription>
    </DescriptionListGroup>
  );
};

type SummaryItemProps = {
  /** The label for the DescriptionListTerm */
  label: React.ReactNode;
  /** The primary value of the item */
  content: React.ReactNode;
  /** Secondary information displayed below the content */
  description?: React.ReactNode;
  /** Whether to display the skeleton loading state */
  isLoading?: boolean;
};

/**
 * A layout-opinionated item for `Details`.
 *
 * Used for rendering items in the Agama overview and confirmation pages, where
 * a single term has to be rendered with a primary value and an optional
 * description as well as a consistent "loading skeleton states" when isLoading
 * is true.
 */
const StackItem = ({ label, content, description, isLoading }: SummaryItemProps) => {
  return (
    <Item label={label}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
        {isLoading ? (
          <>
            <Skeleton aria-label={_("Waiting for proposal")} width="50%" />
            <Skeleton />
          </>
        ) : (
          <>
            {content}
            {description && <small className="pf-v6-u-text-color-subtle">{description}</small>}
          </>
        )}
      </Flex>
    </Item>
  );
};

/**
 * An abstraction over PatternFly's `DescriptionList`.
 *
 * Provides a simpler, more declarative API for building description lists using
 * the compound component pattern with `Details.Item`.
 *
 * @example
 * ```tsx
 * <Details isHorizontal isCompact displaySize="lg">
 *   <Details.Item label="Model">Lenovo ThinkPad P14s Gen 4</Details.Item>
 *   <Details.Item label="CPU">AMD Ryzen™ 7 × 16</Details.Item>
 *   <Details.Item label="Language">
 *     <Button variant="link" isInline>English</Button>
 *   </Details.Item>
 * </Details>
 * ```
 */
const Details = ({ children, ...props }: DescriptionListProps) => {
  return <DescriptionList {...props}>{children}</DescriptionList>;
};

Details.Item = Item;
Details.StackItem = StackItem;

export default Details;
export type { ItemProps as DetailsItemProps };

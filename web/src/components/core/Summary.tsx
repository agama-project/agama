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
import { Content, Flex, FlexItem, Skeleton, Title } from "@patternfly/react-core";
import Icon, { IconProps } from "~/components/layout/Icon";
import NestedContent from "~/components/core/NestedContent";
import Text from "~/components/core/Text";
import { _ } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

type SummaryProps = {
  /**
   * The name of the icon to display next to the title.
   * Ignored when `hasIssues` is true, which picks its own icon.
   */
  icon: IconProps["name"];
  /**
   * The label/title for the summary item.
   * Typically rendered as a heading (h3) for semantic structure.
   */
  title: React.ReactNode;
  /**
   * The primary value or content of the summary item.
   * Displayed below the title with emphasis when issues are present.
   */
  value: React.ReactNode;
  /**
   * Optional secondary information displayed below the primary value.
   * Rendered in a smaller, subtle text style.
   */
  description?: React.ReactNode;
  /**
   * Whether to display skeleton loading placeholders instead of actual content.
   * When true, shows loading states for both value and description.
   */
  isLoading?: boolean;
  /**
   * Whether a summary item has issues that require attention.
   * When true:
   *   - Displays the icon signalling an issue instead of the regular one
   *   - Applies bold styling to value and description
   *   - Colors the icon accordingly
   */
  hasIssues?: boolean;
};

const ValueSkeleton = () => (
  <Skeleton
    width="30%"
    height="var(--pf-t--global--font--size--body--lg)"
    style={{ marginBlockStart: "var(--pf-t--global--spacer--xs)" }}
    aria-label={_("Waiting for proposal")}
  />
);

const DescriptionSkeletons = () => (
  <>
    <Skeleton height="var(--pf-t--global--font--size--body--default)" />
    <Skeleton width="70%" height="var(--pf-t--global--font--size--body--default)" />
  </>
);

/**
 * A presentational component for displaying a titled summary with an icon,
 * value, and optional description.
 *
 * Designed for the overview page where consistent visual presentation of
 * summary information is needed.
 *
 * Supports loading states with skeleton placeholders.
 *
 * @example
 * ```tsx
 * <Summary
 *   icon="hard_drive"
 *   title="Storage"
 *   value="Use device vda (25 GiB)"
 *   description="Potential data loss affecting at least openSUSE Leap"
 * />
 * ```
 */
const Summary = ({
  title,
  icon,
  value,
  description,
  isLoading,
  hasIssues = false,
}: SummaryProps) => {
  return (
    <div>
      {/* The row must not wrap: a title too long for the space left beside the
          icon has to wrap its own text instead of dropping to the line below,
          which would leave the icon stranded on a line of its own. */}
      <Flex
        gap={{ default: "gapXs" }}
        alignItems={{ default: "alignItemsFlexStart" }}
        flexWrap={{ default: "nowrap" }}
      >
        <FlexItem flex={{ default: "flexNone" }}>
          {/* Both icons come from the same component at the same size, so the
              one signalling an issue sits exactly where the regular one would,
              whatever the product's typography does to the line around it. */}
          <Icon
            name={hasIssues ? "warning" : icon}
            size="md"
            className={hasIssues ? textStyles.textColorStatusWarning : undefined}
          />
        </FlexItem>
        <Title headingLevel="h3">{title}</Title>
      </Flex>
      <NestedContent margin="mxLg">
        <NestedContent margin="myXs">
          <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
            {isLoading ? (
              <ValueSkeleton />
            ) : (
              <Content isEditorial>
                <Text isBold={hasIssues}>{value}</Text>
              </Content>
            )}
            {isLoading ? (
              <DescriptionSkeletons />
            ) : (
              description && (
                <Text
                  component="small"
                  isBold={hasIssues}
                  className={[textStyles.textColorSubtle, "text-balance"].join(" ")}
                >
                  {description}
                </Text>
              )
            )}
          </Flex>
        </NestedContent>
      </NestedContent>
    </div>
  );
};

export default Summary;

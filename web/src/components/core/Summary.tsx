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
import { Content, Flex, Skeleton, Title } from "@patternfly/react-core";
import Icon, { IconProps } from "~/components/layout/Icon";
import NestedContent from "~/components/core/NestedContent";
import Text from "~/components/core/Text";
import { _ } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import WarningIcon from "@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon";

type SummaryProps = {
  /**
   * The name of the icon to display next to the title.
   * Ignored when `hasIssues` is true (warning icon is shown instead).
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
   *   - Displays a warning icon instead of the regular icon
   *   - Applies bold styling to value and description
   *   - Adds warning color styling to the icon
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
      <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
        {hasIssues ? (
          <WarningIcon
            aria-hidden="true"
            className={[textStyles.fontSizeMd, textStyles.textColorStatusWarning].join(" ")}
          />
        ) : (
          <Icon name={icon} />
        )}
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
                <Text component="small" isBold={hasIssues} className={textStyles.textColorSubtle}>
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

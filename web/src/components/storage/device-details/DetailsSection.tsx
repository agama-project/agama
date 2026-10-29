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
import { Flex, FlexItem, Title } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import Icon from "~/components/layout/Icon";
import type { IconProps } from "~/components/layout/Icon";

export type DetailsSectionProps = {
  /** What the section holds, such as "Current content". */
  title: React.ReactNode;
  /** A mark shown before the title. Decorative: screen readers skip it. */
  icon?: IconProps["name"];
  /** What the section shows, such as a table or a sentence. */
  children: React.ReactNode;
};

/**
 * A part of the device details under its own heading.
 *
 * The heading is one level under the panel title, so screen reader users can
 * jump between the parts of the panel the same way sighted users scan them.
 *
 * @example
 * <DetailsSection title={_("Current content")}>
 *   <CurrentContentSection entry={entry} subject={subject} />
 * </DetailsSection>
 */
export default function DetailsSection({ title, icon, children }: DetailsSectionProps) {
  const body = (
    <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }} flex={{ default: "flex_1" }}>
      <Title headingLevel="h3" size="md" className={textStyles.textColorBrand}>
        {title}
      </Title>
      <Flex
        direction={{ default: "column" }}
        gap={{ default: "gapMd" }}
        className="agm-details-section__content"
      >
        {children}
      </Flex>
    </Flex>
  );

  if (!icon) return <section>{body}</section>;

  /* The icon in a column of its own, so the content starts where the title
     does and reads as held by the section. */
  return (
    <Flex
      component="section"
      gap={{ default: "gapSm" }}
      flexWrap={{ default: "nowrap" }}
      alignItems={{ default: "alignItemsBaseline" }}
    >
      <FlexItem className={textStyles.textColorSubtle}>
        <Icon name={icon} isMiddleAligned />
      </FlexItem>
      {body}
    </Flex>
  );
}

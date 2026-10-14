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
import { Flex, Title } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

export type SheetSectionProps = {
  /** What the section holds, such as "Current content". */
  title: React.ReactNode;
  /** What the section shows, such as a table or a sentence. */
  children: React.ReactNode;
};

/**
 * A part of the device sheet under its own heading.
 *
 * The heading is one level under the sheet title, so screen reader users can
 * jump between the parts of the sheet the same way sighted users scan them.
 *
 * @example
 * <SheetSection title={_("Current content")}>
 *   <CurrentContentSection entry={entry} subject={subject} />
 * </SheetSection>
 */
export default function SheetSection({ title, children }: SheetSectionProps) {
  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }} component="section">
      <Title headingLevel="h3" size="md" className={textStyles.textColorBrand}>
        {title}
      </Title>
      <Flex
        direction={{ default: "column" }}
        gap={{ default: "gapMd" }}
        className="agm-sheet-section__content"
      >
        {children}
      </Flex>
    </Flex>
  );
}

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

export type SheetSectionProps = {
  /** What the section is about, read as its heading. */
  title: React.ReactNode;
  /** A control deciding what the section reports, set on the heading's line. */
  actions?: React.ReactNode;
  /** What the section reports. */
  children?: React.ReactNode;
};

/**
 * One part of the device sheet, under a heading of its own.
 *
 * The sheet has no tabs, so headings are what a screen reader user jumps
 * between, and what a sighted reader uses to tell one part from the next. The
 * heading is one level under the sheet's title, which is the sheet's `h2`.
 *
 * The spacing is PatternFly's: close within a section, so what it holds reads
 * as one block, and wider between sections, which is left to whatever stacks
 * them.
 *
 * @example
 * <SheetSection
 *   title={_("Physical volumes")}
 *   actions={<Button variant="link">{_("Change")}</Button>}
 * >
 *   {_("Any needed partition will be created at sda.")}
 * </SheetSection>
 */
export default function SheetSection({
  title,
  actions,
  children,
}: SheetSectionProps): React.ReactNode {
  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        gap={{ default: "gapSm" }}
        flexWrap={{ default: "wrap" }}
      >
        <Title headingLevel="h3" size="md">
          {title}
        </Title>
        {actions && <FlexItem>{actions}</FlexItem>}
      </Flex>
      {children}
    </Flex>
  );
}

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
import { Flex, FlexItem } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import type { IconProps } from "~/components/layout/Icon";

export type SheetItemProps = {
  /** A mark for the kind of thing the item is about. Left out where the words carry it alone. */
  icon?: IconProps["name"];
  /** What the item is about, such as "LVM". Left out where the value says it all. */
  name?: React.ReactNode;
  /** A short value read right after the name, on the same line. */
  value?: React.ReactNode;
  /** Lines and controls under the name, each on its own line. */
  children?: React.ReactNode;
};

/**
 * One fact in a device sheet section: an optional icon, a bold name with an
 * optional value beside it, and whatever explains or changes it underneath.
 *
 * Every single fact in the sheet takes this shape, so a reader learns it once.
 * Lists of things, such as the partitions to create, are tables of their own
 * and do not need it. Controls go on their own line under the name, so they
 * are always found in the same place.
 *
 * @example
 * <SheetItem icon="rotate_auto" name={_("Boot")} value={_("partitions configured here")}>
 *   {_("This disk was automatically chosen for booting.")}
 * </SheetItem>
 */
export default function SheetItem({ icon, name, value, children }: SheetItemProps) {
  return (
    <Flex
      gap={{ default: "gapSm" }}
      flexWrap={{ default: "nowrap" }}
      alignItems={{ default: "alignItemsBaseline" }}
    >
      {icon && (
        <FlexItem>
          <Icon name={icon} isMiddleAligned />
        </FlexItem>
      )}
      <Flex
        direction={{ default: "column" }}
        gap={{ default: "gapSm" }}
        flex={{ default: "flex_1" }}
      >
        <FlexItem>
          {name && <Text isBold>{name}</Text>}
          {name && value && " "}
          {value}
        </FlexItem>
        {children && <FlexItem>{children}</FlexItem>}
      </Flex>
    </Flex>
  );
}

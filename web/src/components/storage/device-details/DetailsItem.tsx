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

export type DetailsItemProps = {
  /** An optional icon. */
  icon?: IconProps["name"];
  /** An optional bold name, such as "LVM". */
  name?: React.ReactNode;
  /** A short value after the name, on the same line. */
  value?: React.ReactNode;
  /** Content under the name, such as explanations or controls. */
  children?: React.ReactNode;
};

/**
 * A fact in a device details section: an optional icon, a bold name with an
 * optional value, and content under them.
 *
 * @example
 * <DetailsItem icon="rotate_auto" name={_("Boot")} value={_("partitions configured here")}>
 *   {_("This disk was automatically chosen for booting.")}
 * </DetailsItem>
 */
export default function DetailsItem({ icon, name, value, children }: DetailsItemProps) {
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

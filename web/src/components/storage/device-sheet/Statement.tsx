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
import Icon, { IconProps } from "~/components/layout/Icon";
import Text from "~/components/core/Text";

export type StatementProps = {
  /** A mark for what is being said, which the words beside it also say. */
  icon: IconProps["name"];
  /** What the statement is about, in two or three words. */
  heading: React.ReactNode;
  /** The statement itself, which may name other entries and lead to them. */
  children: React.ReactNode;
  /**
   * Whether the statement reads under its heading rather than beside it. For a
   * statement that is a sentence rather than a name or two, which run on from
   * a heading set beside them.
   */
  isStacked?: boolean;
};

/**
 * Something true about the entry, said above what it holds.
 *
 * Several facts about a device have no row to live in: what it is used by, what
 * the installer adds to it for booting, how much of it a group takes. They are
 * statements rather than settings, so they read as short blocks of prose with a
 * mark rather than as a term and a value: a sentence set beside its term runs
 * on from it.
 *
 * Grouped by {@link Statements}, which rules them off from each other and from
 * the content below.
 *
 * @example
 * <Statements>
 *   <Statement icon="network_node" heading={_("Used by")}>
 *     <RelatedNames items={users} />
 *   </Statement>
 * </Statements>
 */
export default function Statement({
  icon,
  heading,
  children,
  isStacked = false,
}: StatementProps): React.ReactNode {
  return (
    <Flex
      className="agm-statement"
      gap={{ default: "gapSm" }}
      flexWrap={{ default: "nowrap" }}
      alignItems={{ default: "alignItemsBaseline" }}
    >
      <FlexItem>
        <Icon name={icon} size="xs" aria-hidden />
      </FlexItem>
      <FlexItem>
        {isStacked ? (
          <>
            <div>{heading}</div>
            <div className="agm-statement__detail">{children}</div>
          </>
        ) : (
          <>
            <Text isBold>{heading}</Text> {children}
          </>
        )}
      </FlexItem>
    </Flex>
  );
}

/** A run of {@link Statement}s, ruled off from each other and from what follows. */
export function Statements({ children }: React.PropsWithChildren): React.ReactNode {
  return <div className="agm-statements">{children}</div>;
}

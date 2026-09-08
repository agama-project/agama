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
import { Content, Divider, Flex, FlexItem, Title } from "@patternfly/react-core";
import Text from "~/components/core/Text";

export type SummaryLayoutProps = {
  /** The sentence the page opens with, and whatever in it is a control. */
  title: React.ReactNode;
  /** A decision offered where its consequence is read. */
  control?: React.ReactNode;
  /** What the plan costs, and the way into the whole picture. */
  count?: React.ReactNode;
  /** A line about what the reader does next, where the page has more to it. */
  body?: React.ReactNode;
  /** What the reader can do about all of the above, read as one row. */
  actions?: React.ReactNode;
  /** Read in a strip beside the sheet rather than across the page. */
  isNarrow?: boolean;
  /** Closes against what follows it, where the page continues under it. */
  isTight?: boolean;
};

/**
 * How every state of the storage page opens: a sentence, what it costs, and the
 * way on.
 *
 * A plain centred column rather than PatternFly's `EmptyState`. The empty state
 * is an arrangement for a page with nothing on it, and it says so with
 * everything it does: a mark over the heading, the measure it bounds the body
 * to, the room it keeps around a page that has nothing to fill it. This page
 * has content, and borrowing that arrangement made it read as though it did
 * not. What is kept is what the arrangement was for: one column, centred,
 * bounded to a readable measure, with the sentence first and the actions last.
 *
 * This is arrangement and nothing else. It reads none of the plan and renders
 * no words of its own, so the caller decides what each slot says.
 *
 * The title is the page's own `h2`, under the page title. Slots are read in the
 * order they matter: what is true, then the decision that changes it, then what
 * it costs, then what to do with whatever follows.
 *
 * @example
 * <SummaryLayout
 *   title={<ConfigurationTitle />}
 *   count={<Consequences />}
 *   actions={<RetargetOffer device={device} />}
 * />
 */
export default function SummaryLayout({
  title,
  control,
  count,
  body,
  actions,
  isNarrow = false,
  isTight = false,
}: SummaryLayoutProps) {
  const alignItems = { default: isNarrow ? "alignItemsStretch" : "alignItemsCenter" } as const;
  const className = [
    "agm-summary-layout",
    isNarrow && "agm-summary-layout--narrow",
    isTight && "agm-summary-layout--tight",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Flex
      direction={{ default: "column" }}
      alignItems={alignItems}
      gap={{ default: "gapMd" }}
      className={className}
    >
      {/* What the page reports, as one block, with the room kept for what
          follows it rather than spent inside it.

          How much room depends on what the block holds. Consecutive sentences
          about one plan are set close, or they read as three separate
          announcements. A control among them is not a sentence: at the spacing
          of prose it reads as a line of the prose, and the things above and
          below it crowd against its edges. */}
      <FlexItem>
        <Flex
          direction={{ default: "column" }}
          alignItems={alignItems}
          gap={{ default: control ? "gapMd" : "gapXs" }}
        >
          <FlexItem className="agm-summary-layout__measure">
            <Title
              headingLevel="h2"
              size={isNarrow ? "lg" : "xl"}
              className="agm-summary-layout__title"
            >
              {title}
            </Title>
          </FlexItem>
          {/* Above the consequence it changes, so the reader sees what it did. */}
          {control && <FlexItem>{control}</FlexItem>}
          {/* Under the sentence, and above the line explaining what to do next:
              what the plan costs is the second thing the reader wants, and an
              instruction about the list below is the last. */}
          {count && <FlexItem className="agm-summary-layout__measure">{count}</FlexItem>}
          {/* A line about what to do with what follows, not a second heading:
              smaller and lighter than everything above it, so the three are
              read in the order they matter. */}
          {body && (
            <FlexItem className="agm-summary-layout__measure">
              <Content component="p" className="agm-summary-layout__body">
                <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{body}</Text>
              </Content>
            </FlexItem>
          )}
        </Flex>
      </FlexItem>
      {actions && (
        <>
          {/* A short rule, centred: what is above it is the page reporting,
              what is below it is what the reader can do about it. Run the width
              of the text it follows, it would divide the page rather than close
              a paragraph of it. */}
          <FlexItem className="agm-summary-layout__rule">
            <Divider />
          </FlexItem>
          <FlexItem>
            {/* Centred on the line rather than at its top: these are controls of
                different heights, and a menu toggle sitting a few pixels above
                the buttons beside it reads as a second row. */}
            <Flex
              gap={{ default: "gapSm" }}
              alignItems={{ default: "alignItemsCenter" }}
              justifyContent={{ default: "justifyContentCenter" }}
              flexWrap={{ default: "wrap" }}
            >
              {actions}
            </Flex>
          </FlexItem>
        </>
      )}
    </Flex>
  );
}

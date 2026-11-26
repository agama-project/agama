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

export type SummaryWithActionsProps = {
  /** A one-line summary. */
  summary: React.ReactNode;
  /** An optional second line. */
  detail?: React.ReactNode;
  /** Actions shown under the text, such as links to a form. */
  actions?: React.ReactNode;
};

/**
 * A short statement and its actions, for a section with little or nothing to
 * list yet. A paragraph rather than an empty state, so the actions stay where
 * other sections have them.
 *
 * @example
 * <SummaryWithActions
 *   summary={_("Define some partitions or format the whole device.")}
 *   actions={
 *     <>
 *       <Link to={addPartitionPath} keepQuery variant="link" isInline>
 *         {_("Add partition")}
 *       </Link>
 *       <Link to={formatPath} keepQuery variant="link" isInline>
 *         {_("Format device")}
 *       </Link>
 *     </>
 *   }
 * />
 */
export default function SummaryWithActions({ summary, detail, actions }: SummaryWithActionsProps) {
  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
      <FlexItem>
        <p>{summary}</p>
        {detail && <p>{detail}</p>}
      </FlexItem>
      {actions && (
        <FlexItem>
          <Flex gap={{ default: "gapLg" }}>{actions}</Flex>
        </FlexItem>
      )}
    </Flex>
  );
}

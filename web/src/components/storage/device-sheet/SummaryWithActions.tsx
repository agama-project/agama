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

export type SummaryWithActionsProps = {
  /** What the section has to say, in one line. Shown in bold. */
  summary: React.ReactNode;
  /** An optional second line, explaining the summary or what can be done next. */
  detail?: React.ReactNode;
  /** The ways to act on it, such as links to a form. Shown under the text. */
  actions?: React.ReactNode;
};

/**
 * A short statement in a section of the device panel, followed by the ways to
 * act on it.
 *
 * Meant for a section with little or nothing to list yet: a device the
 * installation does not use, a disk used only for booting, or a disk whose
 * partitions a volume group needs. It says where things stand in a bold line,
 * optionally explains it in a regular line under it, and puts the actions
 * last, aligned with the text.
 *
 * Not an empty state on purpose. A centred empty state draws the eye and moves
 * its actions to the middle of the section, while here the actions stay where
 * they are in every other section, at the start of the line under the content,
 * so a reader finds them in the same place whatever the device holds.
 *
 * The bold line is not a heading: the section already has one, and a heading
 * inside it would add a level to the outline for a single sentence. It is a
 * paragraph, read as part of the section.
 *
 * @example
 * <SummaryWithActions
 *   summary={_("Not used by the installation yet")}
 *   detail={_("Add partitions to it, or format it whole for a single file system.")}
 *   actions={
 *     <>
 *       <Link to={addPartitionPath} keepQuery variant="secondary" size="sm">
 *         {_("Add partition")}
 *       </Link>
 *       <Link to={formatPath} keepQuery variant="secondary" size="sm">
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
        <p>
          <Text isBold>{summary}</Text>
        </p>
        {detail && <p>{detail}</p>}
      </FlexItem>
      {actions && (
        <FlexItem>
          <Flex gap={{ default: "gapSm" }}>{actions}</Flex>
        </FlexItem>
      )}
    </Flex>
  );
}

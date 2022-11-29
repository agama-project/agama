/*
 * Copyright (c) [2022] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import { filesize } from "filesize";

import {
  TableComposable,
  Thead,
  Tr,
  Th,
  Tbody,
  Td
} from '@patternfly/react-table';

import {
  Label,
  Split,
  SplitItem,
} from "@patternfly/react-core";
import { LockIcon } from '@patternfly/react-icons';

export default function ProposalVolumes({ volumes }) {
  const columns = {
    volume: "Volume",
    details: "Details",
    size: "Size limits",
    actions: "Actions"
  };

  const Details = ({ volume }) => {
    const isLv = volume.deviceType === "lvm_lv";
    const hasSnapshots = volume.fsType === "Btrfs" && volume.snapshots;

    const text = `${volume.fsType} ${isLv ? "logical volume" : "partition"}`;

    return (
      <Split>
        <SplitItem>{text}</SplitItem>
        {volume.encrypted &&
          <SplitItem>
            <Label icon={<LockIcon />} isCompact>encrypted</Label>
          </SplitItem>}
        {hasSnapshots &&
          <SplitItem>
            <Label isCompact>with snapshots</Label>
          </SplitItem>}
      </Split>
    );
  };

  const SizeLimits = ({ volume }) => {
    const sizeText = (size) => {
      if (size === -1) return "Unlimited";

      return filesize(size, { base: 2 });
    };

    const limits = `${sizeText(volume.minSize)} - ${sizeText(volume.maxSize)}`;
    const isAuto = volume.adaptiveSizes && !volume.fixedSizeLimits;

    return (
      <Split>
        <SplitItem>{limits}</SplitItem>
        {isAuto &&
          <SplitItem>
            <Label isCompact>auto-calculated</Label>
          </SplitItem>}
      </Split>
    );
  };

  return (
    <TableComposable aria-label="Simple table" variant="compact" borders>
      <Thead>
        <Tr>
          <Th>{columns.volume}</Th>
          <Th>{columns.details}</Th>
          <Th>{columns.size}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {volumes.map(volume =>
          <Tr key={volume.mountPoint}>
            <Td dataLabel={columns.volume}>{volume.mountPoint}</Td>
            <Td dataLabel={columns.details}><Details volume={volume} /></Td>
            <Td dataLabel={columns.size}><SizeLimits volume={volume} /></Td>
          </Tr>
        )}
      </Tbody>
    </TableComposable>
  );
}

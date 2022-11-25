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

import {
  TableComposable,
  Thead,
  Tr,
  Th,
  Tbody,
  Td
} from '@patternfly/react-table';

import {
  Button,
} from "@patternfly/react-core";

export default function ProposalVolumes({ volumes, onChange }) {
  const removeVolume = volume => {
    const newVolumes = volumes.filter(v => v.mountPoint !== volume.mountPoint);
    onChange(newVolumes);
  };

  const columns = {
    volume: "Volume",
    details: "Details",
    size: "Size limits",
    actions: "Actions"
  };

  const actions = (volume) => {
    return (
      <Button variant="link" isDanger onClick={() => removeVolume(volume)}>
        Remove
      </Button>
    );
  };

  return (
    <TableComposable aria-label="Simple table" variant="compact" borders>
      <Thead>
        <Tr>
          <Th>{columns.volume}</Th>
          <Th>{columns.details}</Th>
          <Th>{columns.size}</Th>
          <Th>{columns.actions}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {volumes.map(volume =>
          <Tr key={volume.mountPoint}>
            <Td dataLabel={columns.volume}>{volume.mountPoint}</Td>
            <Td dataLabel={columns.details}>{volume.fsType}</Td>
            <Td dataLabel={columns.size}>{volume.minSize}-{volume.maxSize}</Td>
            <Td dataLabel={columns.actions}>{actions(volume)}</Td>
          </Tr>
        )}
      </Tbody>
    </TableComposable>
  );
}

/*
 * Copyright (c) [2024] SUSE LLC
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

import React, { useState } from "react";
import { deactivateZFCPDisk } from "~/api/storage/zfcp";
import { useZFCPControllers, useZFCPDisks } from "~/queries/storage/zfcp";
import { ZFCPDisk } from "~/types/zfcp";
import { useCancellablePromise } from "~/utils";
import RowActions from "../../core/RowActions";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import { Skeleton } from "@patternfly/react-core";
import { _ } from "~/i18n";

/**
 * Table of zFCP disks.
 */
export default function ZFCPDisksTable() {
  const disks = useZFCPDisks();
  const controllers = useZFCPControllers();
  const { cancellablePromise } = useCancellablePromise();

  const columns = [
    { id: "name", label: _("Name") },
    { id: "channel", label: _("Channel ID") },
    { id: "wwpn", label: _("WWPN") },
    { id: "lun", label: _("LUN") },
  ];

  const columnValue = (disk: ZFCPDisk, column) => disk[column.id];

  const actions = (disk: ZFCPDisk) => {
    const controller = controllers.find((c) => c.channel === disk.channel);
    if (!controller || controller.lunScan) return [];

    return [
      {
        label: _("Deactivate"),
        run: async () =>
          await cancellablePromise(deactivateZFCPDisk(controller.id, disk.wwpn, disk.lun)),
      },
    ];
  };

  const [loadingRow, setLoadingRow] = useState("");

  const sortedDisks = () => {
    return disks.sort((d1, d2) => {
      const v1 = columnValue(d1, columns[0]);
      const v2 = columnValue(d2, columns[0]);
      if (v1 < v2) return -1;
      if (v1 > v2) return 1;
      return 0;
    });
  };

  const Actions = ({ device }: { device: ZFCPDisk }) => {
    const deviceActions = actions(device);
    if (deviceActions.length === 0) return null;

    const items = deviceActions.map((action) => ({
      title: action.label,
      onClick: async () => {
        setLoadingRow(device.name);
        await action.run();
        setLoadingRow("");
      },
    }));

    return <RowActions id="disks_actions" actions={items} />;
  };

  return (
    <Table variant="compact">
      <Thead>
        <Tr>
          {columns.map((column) => (
            <Th key={column.id}>{column.label}</Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {sortedDisks().map((device) => {
          const RowContent = () => {
            if (loadingRow === device.name) {
              return (
                <Td colSpan={columns.length + 1}>
                  <Skeleton />
                </Td>
              );
            }

            return (
              <>
                {columns.map((column) => (
                  <Td key={column.id} dataLabel={column.label}>
                    {columnValue(device, column)}
                  </Td>
                ))}
                <Td isActionCell key="device-actions">
                  <Actions device={device} />
                </Td>
              </>
            );
          };

          return (
            <Tr key={device.name}>
              <RowContent />
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}

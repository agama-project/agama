import { Skeleton } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import React, { useState } from "react";
import { _ } from "~/i18n";
import { useCancellablePromise } from "~/utils";
import { RowActions } from "../core";
import { ZFCPController } from "~/types/zfcp";
import { activateZFCPController } from "~/api/zfcp";
import { useZFCPControllers } from "~/queries/zfcp";

/**
 * Table of zFCP controllers.
 *
 */
export default function ZFCPControllersTable() {
  const controllers = useZFCPControllers();
  const { cancellablePromise } = useCancellablePromise();

  const columns = [
    { id: "channel", label: _("Channel ID") },
    { id: "active", label: _("Status") },
    { id: "lunScan", label: _("Auto LUNs Scan") },
  ];

  const columnValue = (controller: ZFCPController, column: { id: string }) => {
    let value: string;

    switch (column.id) {
      case "channel":
        value = controller.channel;
        break;
      case "active":
        value = controller.active ? _("Activated") : _("Deactivated");
        break;
      case "lunScan":
        if (controller.active) value = controller.lunScan ? _("Yes") : _("No");
        else value = "-";
        break;
      default:
        value = "";
    }

    return value;
  };

  const actions = (controller: ZFCPController) => {
    if (controller.active) return [];

    return [
      {
        label: _("Activate"),
        run: async () => await cancellablePromise(activateZFCPController(controller.id)),
      },
    ];
  };

  const [loadingRow, setLoadingRow] = useState("");

  const sortedDevices = (): ZFCPController[] => {
    return controllers.sort((d1, d2) => {
      const v1 = columnValue(d1, columns[0]);
      const v2 = columnValue(d2, columns[0]);
      if (v1 < v2) return -1;
      if (v1 > v2) return 1;
      return 0;
    });
  };

  const Actions = ({ device }) => {
    const deviceActions = actions(device);
    if (deviceActions.length === 0) return null;

    const items = deviceActions.map((action) => ({
      title: action.label,
      onClick: async () => {
        setLoadingRow(device.id);
        await action.run();
        setLoadingRow(undefined);
      },
    }));

    return <RowActions id="zfcp_controllers_actions" actions={items} />;
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
        {sortedDevices().map((device) => {
          const RowContent = () => {
            if (loadingRow === device.id) {
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
            <Tr key={device.id}>
              <RowContent />
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}

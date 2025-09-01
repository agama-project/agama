// import { Skeleton } from "@patternfly/react-core";
import { Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem } from "@patternfly/react-core";
import FormatFilter from "~/components/storage/dasd/FormatFilter";
import StatusFilter from "~/components/storage/dasd/StatusFilter";
import React, { useState } from "react";
import { _ } from "~/i18n";
import { useCancellablePromise } from "~/hooks/use-cancellable-promise";
import { RowActions, SelectableDataTable } from "../../core";
import { ZFCPController, ZFCPDisk } from "~/types/zfcp";
import { activateZFCPController } from "~/api/storage/zfcp";
import { useZFCPConfig, useZFCPControllers, useZFCPDisks } from "~/queries/storage/zfcp";
import { sort } from "fast-sort";
import { objectify } from "radashi";

const LUNScanInfo = () => {
  const { allowLunScan } = useZFCPConfig();
  // TRANSLATORS: the text in the square brackets [] will be displayed in bold
  const lunScanEnabled = _(
    "Automatic LUN scan is [enabled]. Activating a controller which is \
      running in NPIV mode will automatically configures all its LUNs.",
  );
  // TRANSLATORS: the text in the square brackets [] will be displayed in bold
  const lunScanDisabled = _(
    "Automatic LUN scan is [disabled]. LUNs have to be manually \
      configured after activating a controller.",
  );

  const msg = allowLunScan ? lunScanEnabled : lunScanDisabled;
  const [msgStart, msgBold, msgEnd] = msg.split(/[[\]]/);

  return (
    <p>
      {msgStart}
      <b>{msgBold}</b>
      {msgEnd}
    </p>
  );
};

/**
 * Props for the FiltersToolbar component used in the DASD table.
 */
type FiltersToolbarProps = {
  /** Current filter state */
  filters: object;
  /** Callback invoked when a filter value changes. */
  onFilterChange?: () => void;
};

/**
 * Renders the toolbar used to filter DASD devices.
 */
const FiltersToolbar = ({ filters = {}, onFilterChange }: FiltersToolbarProps) => (
  <Toolbar>
    <ToolbarContent>
      <ToolbarGroup>
        <ToolbarItem>
          <FormatFilter
            value={filters.formatted}
            onChange={(_, v) => onFilterChange("formatted", v)}
          />
        </ToolbarItem>
        <ToolbarItem>
          <StatusFilter value={filters.status} onChange={(_, v) => onFilterChange("status", v)} />
        </ToolbarItem>
      </ToolbarGroup>
    </ToolbarContent>
  </Toolbar>
);

/**
 * Table of zFCP controllers.
 *
 */
export default function ZFCPControllersTable() {
  const controllers = useZFCPControllers();
  const disks = useZFCPDisks();
  const { cancellablePromise } = useCancellablePromise();

  const columns = [
    { id: "channel", label: _("Channel ID") },
    { id: "active", label: _("Status") },
    { id: "lunScan", label: _("Auto LUNs Scan") },
  ];

  const columnValue = (disk: ZFCPDisk, column: { id: string }) => {
    let value: string;

    switch (column.id) {
      case "channel":
        value = disk.channel;
        break;
      case "name":
        value = disk.name;
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

  console.log(sort);
  console.log("controllers", controllers);
  console.log("disks", disks);
  console.log(loadingRow);
  console.log(Actions);

  const disksById = objectify(disks, (d) => d.lun);

  console.log(disksById);

  const devices = sortedDevices().map((c) => {
    c.isController = true;
    c.luns = [];

    Object.entries(c.lunsMap).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length > 0) {
        c.luns = v.map((l) => ({ wwpn: k, lun: l, ...disksById[l] }));
      }
    });

    return c;
  });

  console.log("DEVICES", devices);

  const ControllerInfo = ({ controller }) => {
    if (controller.active) return;

    return "Controller is not active yet";
  };

  return (
    <>
      <LUNScanInfo />
      <FiltersToolbar />
      <SelectableDataTable
        isStickyHeader
        items={devices}
        initialExpandedKeys={devices.map((d) => d.id)}
        itemSelectable={(i) => !i.isController}
        selectionMode="multiple"
        itemChildren={(i) => i.luns}
        itemActions={(item) => {
          if (item.isController) return [];

          return [
            item.name && { title: "Deactivate", onClick: console.log },
            !item.name && { title: "Active", onClick: console.log },
          ].filter(Boolean);
        }}
        columns={[
          {
            name: _("Controller"),
            value: (i) => (i.lun ? undefined : i.channel),
            pfThProps: { width: 20 },
          },
          {
            name: _("WWPN"),
            value: (i) => (i.isController ? <ControllerInfo controller={i} /> : i.wwpn),
            pfThProps: { width: 20 },
            pfTdProps: (i) => ({
              colSpan: i.isController ? 5 : 1,
            }),
          },
          { name: _("Lun"), value: (i) => i.lun, pfThProps: { width: 20 } },
          {
            name: _("Status"),
            value: (i) => {
              if (!i.lun) return;

              return i.name ? "Active" : "Inactive";
            },
            pfThProps: { width: 20 },
          },
          {
            name: _("Name"),
            value: (i) => i.name,
            pfThProps: { width: 30 },
          },
        ]}
      />
    </>
  );
}

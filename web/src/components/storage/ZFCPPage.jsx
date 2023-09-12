/*
 * Copyright (c) [2023] SUSE LLC
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

// cspell:ignore wwpns npiv

import React, { useCallback, useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Skeleton, Toolbar, ToolbarContent, ToolbarItem } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';

import { _ } from "~/i18n";
import { MainActions } from "~/components/layout";
import { If, Page, Popup, RowActions, Section, SectionSkeleton } from "~/components/core";
import { ZFCPDiskForm } from "~/components/storage";
import { noop, useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";

/**
 * @typedef {import(~/clients/storage).ZFCPManager} ZFCPManager
 * @typedef {import(~/clients/storage).ZFCPController} Controller
 * @typedef {import(~/clients/storage).ZFCPDisk} Disk
 *
 * @typedef {object} LUN
 * @property {string} channel
 * @property {string} wwpn
 * @property {string} lun
 */

/**
 * Internal class for managing zFCP data in a format that is useful for components.
 */
class Manager {
  /**
   * @param {Controller[]} controllers
   * @param {Disk[]} disks
   * @param {LUN[]} luns
   */
  constructor(controllers = [], disks = [], luns = []) {
    this.controllers = controllers;
    this.disks = disks;
    this.luns = luns;
  }

  /**
   * Gets the activated controllers.
   *
   * @returns {Controller[]}
   */
  getActiveControllers() {
    return this.controllers.filter(c => c.active);
  }

  /**
   * Gets the controller for the given channel.
   *
   * @param {string} channel
   * @returns {Controller|undefined}
   */
  getController(channel) {
    const index = this.findController(channel);
    if (index === -1) return undefined;

    return this.controllers[index];
  }

  /**
   * Updates the info about the given controller.
   *
   * @param {Controller} controller
   * @returns {void}
   */
  updateController(controller) {
    const index = this.findController(controller.channel);
    if (index === -1) return;

    this.controllers[index] = controller;
  }

  /**
   * Gets the disk for the given channel, WWPN and LUN.
   *
   * @param {string} channel
   * @param {wwpn} wwpn
   * @param {lun} lun
   * @returns {Disk|undefined}
   */
  getDisk(channel, wwpn, lun) {
    const index = this.findDisk(channel, wwpn, lun);
    if (index === -1) return undefined;

    return this.disks[index];
  }

  /**
   * Adds the given disk to the list of disks.
   *
   * @param {Disk} disk
   * @returns {void}
   */
  addDisk(disk) {
    if (this.getDisk(disk.channel, disk.wwpn, disk.lun)) return;

    this.disks.push(disk);
  }

  /**
   * Removes the given disk from the list of disks.
   * @param {Disk} disk
   * @returns {void}
   */
  removeDisk(disk) {
    const index = this.findDisk(disk.channel, disk.wwpn, disk.lun);
    if (index === -1) return;

    this.disks.splice(index, 1);
  }

  /**
   * Adds the given LUNs
   *
   * @param {LUN[]} luns
   * @returns {void}
   */
  addLUNs(luns) {
    for (const lun of luns) {
      const existingLUN = this.luns.find(l => l.channel === lun.channel && l.wwpn === lun.wwpn && l.lun === lun.lun);
      if (!existingLUN) this.luns.push(lun);
    }
  }

  /**
   * Gets the list of inactive LUNs.
   *
   * @returns {LUN[]}
   */
  getInactiveLUNs() {
    const luns = this.getActiveControllers().map(controller => {
      return this.luns.filter(l => l.channel === controller.channel &&
        !this.isLUNActive(l.channel, l.wwpn, l.lun));
    });

    return luns.flat();
  }

  /**
   * Whether the LUN is active.
   *
   * @param {string} channel
   * @param {string} wwpn
   * @param {string} lun
   * @returns {boolean}
   */
  isLUNActive(channel, wwpn, lun) {
    const disk = this.getDisk(channel, wwpn, lun);
    return disk !== undefined;
  }

  /**
   * @private
   * Index of the controller for the given channel.
   *
   * @param {string} channel
   * @returns {number}
   */
  findController(channel) {
    return this.controllers.findIndex(c => c.channel === channel);
  }

  /**
   * @private
   * Index of the disk with the given channel, WWPN and LUN.
   *
   * @param {string} channel
   * @param {string} wwpn
   * @param {string} lun
   * @returns {number}
   */
  findDisk(channel, wwpn, lun) {
    return this.disks.findIndex(d => d.channel === channel && d.wwpn === wwpn && d.lun === lun);
  }
}

/**
 * Generic table for zFCP devices.
 *
 * It shows a row as loading meanwhile performing an action.
 *
 * @component
 *
 * @param {object} props
 * @param {Controller[]|Disk[]} [props.devices] - Devices to show in the table.
 * @param {Column[]} [props.columns] - Columns to show.
 * @param {ColumnValueFn} [props.columnValue] - Function to get the value of a column for a given device.
 * @param {DeviceActionsFn} [props.actions] - Function to get the actions for a given device.
 *
 * @callback ColumnValueFn
 * @param {Controller} controller
 * @param {Column} Column
 * @returns {string}
 *
 * @typedef {object} Column
 * @property {string} id
 * @property {string} label
 *
 * @callback DeviceActionsFn
 * @param {Controller|Disk} device
 * @returns {DeviceAction[]}
 *
 * @typedef {DeviceAction}
 * @property {string} label
 * @property {function} call
 */
const DevicesTable = ({ devices = [], columns = [], columnValue = noop, actions = noop }) => {
  const [loadingRow, setLoadingRow] = useState();

  const sortedDevices = () => {
    return devices.sort((d1, d2) => {
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

    const items = deviceActions.map((action) => (
      {
        title: action.label,
        onClick: async () => {
          setLoadingRow(device.id);
          await action.run();
          setLoadingRow(undefined);
        }
      }
    ));

    return <RowActions actions={items} />;
  };

  return (
    <Table variant="compact">
      <Thead>
        <Tr>
          { columns.map((column) => <Th key={column.id}>{column.label}</Th>) }
        </Tr>
      </Thead>
      <Tbody>
        { sortedDevices().map((device) => (
          <Tr key={device.id}>
            <If
              condition={loadingRow === device.id}
              then={<Td colSpan={columns.length + 1}><Skeleton /></Td>}
              else={
                <>
                  { columns.map(column => <Td key={column.id} dataLabel={column.label}>{columnValue(device, column)}</Td>) }
                  <Td isActionCell key="device-actions">
                    <Actions device={device} />
                  </Td>
                </>
              }
            />
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

/**
 * Table of zFCP controllers.
 * @component
 *
 * @param {object} props
 * @param {ZFCPManager} props.client
 * @param {Manager} props.manager
 */
const ControllersTable = ({ client, manager }) => {
  const { cancellablePromise } = useCancellablePromise();

  const columns = [
    { id: "channel", label: _("Channel ID") },
    { id: "status", label: _("Status") },
    { id: "lunScan", label: _("Auto LUNs Scan") }
  ];

  const columnValue = (controller, column) => {
    let value;

    switch (column.id) {
      case "channel":
        value = controller.channel;
        break;
      case "status":
        value = controller.active ? _("Activated") : _("Deactivated");
        break;
      case "lunScan":
        if (controller.active)
          value = controller.lunScan ? _("Yes") : _("No");
        else
          value = "-";
        break;
    }

    return value;
  };

  const actions = (controller) => {
    if (controller.active) return [];

    return [
      {
        label: _("Activate"),
        run: async () => await cancellablePromise(client.activateController(controller))
      }
    ];
  };

  return (
    <DevicesTable
      devices={manager.controllers}
      columns={columns}
      columnValue={columnValue}
      actions={actions}
    />
  );
};

/**
 * Table of zFCP disks.
 * @component
 *
 * @param {object} props
 * @param {ZFCPManager} props.client
 * @param {Manager} props.manager
 */
const DisksTable = ({ client, manager }) => {
  const { cancellablePromise } = useCancellablePromise();

  const columns = [
    { id: "name", label: _("Name") },
    { id: "channel", label: _("Channel ID") },
    { id: "wwpn", label: _("WWPN") },
    { id: "lun", label: _("LUN") }
  ];

  const columnValue = (disk, column) => disk[column.id];

  const actions = (disk) => {
    const controller = manager.getController(disk.channel);
    if (!controller || controller.lunScan) return [];

    return [
      {
        label: _("Deactivate"),
        run: async () => await cancellablePromise(
          client.deactivateDisk(controller, disk.wwpn, disk.lun)
        )
      }
    ];
  };

  return (
    <DevicesTable
      devices={manager.disks}
      columns={columns}
      columnValue={columnValue}
      actions={actions}
    />
  );
};

/**
 * Section for zFCP controllers.
 * @component
 *
 * @param {object} props
 * @param {ZFCPManager} props.client
 * @param {Manager} props.manager
 * @param {function} props.load - Allows loading the zFCP data.
 * @param {boolean} props.isLoading
 */
const ControllersSection = ({ client, manager, load = noop, isLoading = false }) => {
  const [allowLUNScan, setAllowLUNScan] = useState(false);

  useEffect(() => {
    const load = async () => {
      const autoScan = await client.getAllowLUNScan();
      setAllowLUNScan(autoScan);
    };

    load();
  }, [client, setAllowLUNScan]);

  const EmptyState = () => {
    return (
      <div className="stack">
        <div className="bold">{_("No zFCP controllers found")}</div>
        <div>{_("Please, try to read the zFCP devices again.")}</div>
        {/* TRANSLATORS: button label */}
        <Button variant="primary" onClick={load}>{_("Read zFCP devices")}</Button>
      </div>
    );
  };

  const Content = () => {
    const LUNScanInfo = () => {
      const msg = allowLUNScan
        // TRANSLATORS: the text in the square brackets [] will be displayed in bold
        ? _("Automatic LUN scan is [enabled]. Activating a controller which is \
running in NPIV mode will automatically configures all its LUNs.")
        // TRANSLATORS: the text in the square brackets [] will be displayed in bold
        : _("Automatic LUN scan is [disabled]. LUNs have to be manually \
configured after activating a controller.");

      const [msgStart, msgBold, msgEnd] = msg.split(/[[\]]/);

      return (
        <p>
          {msgStart}<b>{msgBold}</b>{msgEnd}
        </p>
      );
    };

    return (
      <>
        <LUNScanInfo />
        <ControllersTable client={client} manager={manager} />
      </>
    );
  };

  return (
    <Section title="Controllers">
      <If
        condition={isLoading}
        then={<SectionSkeleton />}
        else={
          <If
            condition={manager.controllers.length === 0}
            then={<EmptyState />}
            else={<Content />}
          />
        }
      />
    </Section>
  );
};

/**
 * Popup to show the zFCP disk form.
 * @component
 *
 * @param {object} props
 * @param {ZFCPManager} props.client
 * @param {Manager} props.manager
 * @param {function} props.onClose - Callback to be called when closing the popup.
 */
const DiskPopup = ({ client, manager, onClose = noop }) => {
  const [isAcceptDisabled, setIsAcceptDisabled] = useState(false);
  const { cancellablePromise } = useCancellablePromise();

  const onSubmit = async (formData) => {
    setIsAcceptDisabled(true);
    const controller = manager.getController(formData.channel);
    const result = await cancellablePromise(client.activateDisk(controller, formData.wwpn, formData.lun));
    setIsAcceptDisabled(false);

    if (result === 0) onClose();
  };

  const onLoading = (isLoading) => {
    setIsAcceptDisabled(isLoading);
  };

  const formId = "ZFCPDiskForm";

  return (
    <Popup isOpen title={_("Activate a zFCP disk")}>
      <ZFCPDiskForm
        id={formId}
        luns={manager.getInactiveLUNs()}
        onSubmit={onSubmit}
        onLoading={onLoading}
      />
      <Popup.Actions>
        <Popup.Confirm
          form={formId}
          type="submit"
          isDisabled={isAcceptDisabled}
        >
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onClose} />
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Section for zFCP disks.
 * @component
 *
 * @param {object} props
 * @param {ZFCPManager} props.client
 * @param {Manager} props.manager
 * @param {boolean} props.isLoading
 */
const DisksSection = ({ client, manager, isLoading = false }) => {
  const [isActivateOpen, setIsActivateOpen] = useState(false);

  const openActivate = () => setIsActivateOpen(true);
  const closeActivate = () => setIsActivateOpen(false);

  const EmptyState = () => {
    const NoActiveControllers = () => {
      return (
        <div>{_("Please, try to activate a zFCP controller.")}</div>
      );
    };

    const NoActiveDisks = () => {
      return (
        <>
          <div>{_("Please, try to activate a zFCP disk.")}</div>
          {/* TRANSLATORS: button label */}
          <Button variant="primary" onClick={openActivate}>{_("Activate zFCP disk")}</Button>
        </>
      );
    };

    return (
      <div className="stack">
        <div className="bold">{_("No zFCP disks found")}</div>
        <If
          condition={manager.getActiveControllers().length === 0}
          then={<NoActiveControllers />}
          else={<NoActiveDisks />}
        />
      </div>
    );
  };

  const Content = () => {
    const isDisabled = manager.getInactiveLUNs().length === 0;

    return (
      <>
        <Toolbar className="no-stack-gutter">
          <ToolbarContent>
            <ToolbarItem align={{ default: "alignRight" }}>
              {/* TRANSLATORS: button label */}
              <Button onClick={openActivate} isDisabled={isDisabled}>{_("Activate new disk")}</Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        <DisksTable client={client} manager={manager} />
      </>
    );
  };

  return (
    // TRANSLATORS: section title
    <Section title={_("Disks")}>
      <If
        condition={isLoading}
        then={<SectionSkeleton />}
        else={
          <If
            condition={manager.disks.length === 0}
            then={<EmptyState />}
            else={<Content />}
          />
        }
      />
      <If
        condition={isActivateOpen}
        then={
          <DiskPopup
            client={client}
            manager={manager}
            onClose={closeActivate}
          />
        }
      />
    </Section>
  );
};

const reducer = (state, action) => {
  const { type, payload } = action;

  switch (type) {
    case "START_LOADING": {
      return { ...state, isLoading: true };
    }

    case "STOP_LOADING": {
      return { ...state, isLoading: false };
    }

    case "SET_MANAGER": {
      const { manager } = payload;
      return { ...state, manager };
    }

    case "UPDATE_CONTROLLER": {
      state.manager.updateController(payload.controller);
      return { ...state };
    }

    case "ADD_DISK": {
      const { disk } = payload;
      state.manager.addDisk(disk);
      return { ...state };
    }

    case "REMOVE_DISK": {
      const { disk } = payload;
      state.manager.removeDisk(disk);
      return { ...state };
    }

    case "ADD_LUNS": {
      const { luns } = payload;
      state.manager.addLUNs(luns);
      return { ...state };
    }

    default: {
      return state;
    }
  }
};

const initialState = {
  manager: new Manager(),
  isLoading: true
};

/**
 * Page for managing zFCP devices.
 * @component
 */
export default function ZFCPPage() {
  const { storage: client } = useInstallerClient();
  const navigate = useNavigate();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  const getLUNs = useCallback(async (controller) => {
    const luns = [];
    const wwpns = await cancellablePromise(client.zfcp.getWWPNs(controller));
    for (const wwpn of wwpns) {
      const all = await cancellablePromise(client.zfcp.getLUNs(controller, wwpn));
      for (const lun of all) {
        luns.push({ channel: controller.channel, wwpn, lun });
      }
    }
    return luns;
  }, [client.zfcp, cancellablePromise]);

  const load = useCallback(async () => {
    dispatch({ type: "START_LOADING" });
    await cancellablePromise(client.zfcp.probe());
    const controllers = await cancellablePromise(client.zfcp.getControllers());
    const disks = await cancellablePromise(client.zfcp.getDisks());
    const luns = [];
    for (const controller of controllers) {
      if (controller.active && !controller.lunScan) {
        luns.push(await getLUNs(controller));
      }
    }
    const manager = new Manager(controllers, disks, luns.flat());
    dispatch({ type: "SET_MANAGER", payload: { manager } });
    dispatch({ type: "STOP_LOADING" });
  }, [client.zfcp, cancellablePromise, getLUNs]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  useEffect(() => {
    const subscriptions = [];

    const subscribe = async () => {
      const action = (type, payload) => dispatch({ type, payload });

      subscriptions.push(
        await client.zfcp.onControllerChanged(async (controller) => {
          action("UPDATE_CONTROLLER", { controller });
          if (controller.active && !controller.lunScan) {
            const luns = await getLUNs(controller);
            action("ADD_LUNS", { luns });
          }
        }),
        await client.zfcp.onDiskAdded(d => action("ADD_DISK", { disk: d })),
        await client.zfcp.onDiskRemoved(d => action("REMOVE_DISK", { disk: d }))
      );
    };

    const unsubscribe = () => {
      subscriptions.forEach(fn => fn());
    };

    subscribe();
    return unsubscribe;
  }, [client.zfcp, cancellablePromise, getLUNs]);

  return (
    // TRANSLATORS: page title
    <Page title={_("Storage zFCP")} icon="hard_drive">
      <MainActions>
        <Button size="lg" variant="secondary" onClick={() => navigate("/storage")}>{_("Back")}</Button>
      </MainActions>

      <ControllersSection
        client={client.zfcp}
        manager={state.manager}
        load={load}
        isLoading={state.isLoading}
      />
      <DisksSection
        client={client.zfcp}
        manager={state.manager}
        isLoading={state.isLoading}
      />
    </Page>
  );
}

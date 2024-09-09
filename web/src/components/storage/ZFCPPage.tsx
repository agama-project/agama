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

import React, { MouseEventHandler, useCallback, useEffect, useReducer, useState } from "react";
import {
  Button,
  Skeleton,
  Stack,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { Popup, RowActions, Section, SectionSkeleton } from "~/components/core";
import { ZFCPDiskForm } from "~/components/storage";
import { _ } from "~/i18n";
import { noop, useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { useZFCPConfig, useZFCPControllers, useZFCPDisks } from "~/queries/zfcp";
import { ZFCPController, ZFCPDisk } from "~/types/zfcp";
import ZFCPDisksTable from "./ZFCPDisksTable";
import ZFCPControllersTable from "./ZFCPControllersTable";
import { fetchLUNs, fetchWWPNs } from "~/api/zfcp";

type LUN = {
  channel: string,
  wwpn: string,
  lun: string
}

/**
 * @typedef {import(~/clients/storage).ZFCPManager} ZFCPManager
 * @typedef {import(~/clients/storage).ZFCPController} Controller
 * @typedef {import(~/clients/storage).ZFCPDisk} Disk
 *
 */

/**
 * Internal class for managing zFCP data in a format that is useful for components.
 */
class Manager {
  controllers: ZFCPController[];
  disks: ZFCPDisk[];
  luns: LUN[];

  constructor(controllers: ZFCPController[] = [], disks: ZFCPDisk[] = [], luns: LUN[] = []) {
    this.controllers = controllers;
    this.disks = disks;
    this.luns = luns;
  }

  /**
   * Gets the activated controllers.
   */
  getActiveControllers() {
    return this.controllers.filter((c) => c.active);
  }

  /**
   * Gets the controller for the given channel.
   */
  getController(channel: string) {
    const index = this.findController(channel);
    if (index === -1) return undefined;

    return this.controllers[index];
  }

  /**
   * Updates the info about the given controller.
   *
   */
  updateController(controller: ZFCPController) {
    const index = this.findController(controller.channel);
    if (index === -1) return;

    this.controllers[index] = controller;
  }

  /**
   * Gets the disk for the given channel, WWPN and LUN.
   */
  getDisk(channel: string, wwpn: string, lun: string) {
    const index = this.findDisk(channel, wwpn, lun);
    if (index === -1) return undefined;

    return this.disks[index];
  }

  /**
   * Adds the given disk to the list of disks.
   *
   */
  addDisk(disk: ZFCPDisk) {
    if (this.getDisk(disk.channel, disk.WWPN, disk.LUN)) return;

    this.disks.push(disk);
  }

  /**
   * Removes the given disk from the list of disks.
   */
  removeDisk(disk: ZFCPDisk) {
    const index = this.findDisk(disk.channel, disk.WWPN, disk.LUN);
    if (index === -1) return;

    this.disks.splice(index, 1);
  }

  /**
   * Adds the given LUNs
   *
   */
  addLUNs(luns: LUN[]) {
    for (const lun of luns) {
      const existingLUN = this.luns.find(
        (l) => l.channel === lun.channel && l.wwpn === lun.wwpn && l.lun === lun.lun,
      );
      if (!existingLUN) this.luns.push(lun);
    }
  }

  /**
   * Gets the list of inactive LUNs.
   */
  getInactiveLUNs() {
    const luns = this.getActiveControllers().map((controller) => {
      return this.luns.filter(
        (l) => l.channel === controller.channel && !this.isLUNActive(l.channel, l.wwpn, l.lun),
      );
    });

    return luns.flat();
  }

  /**
   * Whether the LUN is active.
   *
   */
  isLUNActive(channel: string, wwpn: string, lun: string) {
    const disk = this.getDisk(channel, wwpn, lun);
    return disk !== undefined;
  }

  /**
   * @private
   * Index of the controller for the given channel.
   *
   */
  findController(channel: string) {
    return this.controllers.findIndex((c) => c.channel === channel);
  }

  /**
   * @private
   * Index of the disk with the given channel, WWPN and LUN.
   *
   */
  findDisk(channel: string, wwpn: string, lun: string) {
    return this.disks.findIndex((d) => d.channel === channel && d.WWPN === wwpn && d.LUN === lun);
  }
}

/**
 * Section for zFCP controllers.
 */
const ControllersSection = ({ load = noop, isLoading = false }: { load: MouseEventHandler, isLoading: boolean }) => {
  const allowLUNScan = useZFCPConfig().allowLUNScan;
  const controllers = useZFCPControllers();

  const EmptyState = () => {
    return (
      <Stack hasGutter>
        <div>{_("No zFCP controllers found.")}</div>
        <div>{_("Please, try to read the zFCP devices again.")}</div>
        {/* TRANSLATORS: button label */}
        <Button variant="primary" onClick={load}>
          {_("Read zFCP devices")}
        </Button>
      </Stack>
    );
  };

  const Content = () => {
    const LUNScanInfo = () => {
      const msg = allowLUNScan
        ? // TRANSLATORS: the text in the square brackets [] will be displayed in bold
        _(
          "Automatic LUN scan is [enabled]. Activating a controller which is \
running in NPIV mode will automatically configures all its LUNs.",
        )
        : // TRANSLATORS: the text in the square brackets [] will be displayed in bold
        _(
          "Automatic LUN scan is [disabled]. LUNs have to be manually \
configured after activating a controller.",
        );

      const [msgStart, msgBold, msgEnd] = msg.split(/[[\]]/);

      return (
        <p>
          {msgStart}
          <b>{msgBold}</b>
          {msgEnd}
        </p>
      );
    };

    return (
      <>
        <LUNScanInfo />
        <ZFCPControllersTable />
      </>
    );
  };

  return (
    <Section title="Controllers">
      {isLoading && <SectionSkeleton />}
      {!isLoading && controllers.length === 0 ? <EmptyState /> : <Content />}
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
    const result = await cancellablePromise(
      client.activateDisk(controller, formData.wwpn, formData.lun),
    );
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
        <Popup.Confirm form={formId} type="submit" isDisabled={isAcceptDisabled}>
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
      return <div>{_("Please, try to activate a zFCP controller.")}</div>;
    };

    const NoActiveDisks = () => {
      return (
        <>
          <div>{_("Please, try to activate a zFCP disk.")}</div>
          {/* TRANSLATORS: button label */}
          <Button variant="primary" onClick={openActivate}>
            {_("Activate zFCP disk")}
          </Button>
        </>
      );
    };

    return (
      <Stack hasGutter>
        <div>{_("No zFCP disks found.")}</div>
        {manager.getActiveControllers().length === 0 ? <NoActiveControllers /> : <NoActiveDisks />}
      </Stack>
    );
  };

  const Content = () => {
    const isDisabled = manager.getInactiveLUNs().length === 0;

    return (
      <>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem align={{ default: "alignRight" }}>
              {/* TRANSLATORS: button label */}
              <Button onClick={openActivate} isDisabled={isDisabled}>
                {_("Activate new disk")}
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        <ZFCPDisksTable />
      </>
    );
  };

  return (
    // TRANSLATORS: section title
    <Section title={_("Disks")}>
      {isLoading && <SectionSkeleton />}
      {!isLoading && manager.disks.length === 0 ? <EmptyState /> : <Content />}
      {isActivateOpen && <DiskPopup client={client} manager={manager} onClose={closeActivate} />}
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
  isLoading: true,
};

/**
 * Page for managing zFCP devices.
 * @component
 */
export default function ZFCPPage() {
  const { storage: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  const getLUNs = useCallback(
    async (controller: ZFCPController) => {
      const luns = [];
      const wwpns = await cancellablePromise(fetchWWPNs(controller.id));
      for (const wwpn of wwpns) {
        const all = await cancellablePromise(fetchLUNs(controller.id, wwpn));
        for (const lun of all) {
          luns.push({ channel: controller.channel, wwpn, lun });
        }
      }
      return luns;
    },
    [client.zfcp, cancellablePromise],
  );

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
        await client.zfcp.onDiskAdded((d) => action("ADD_DISK", { disk: d })),
        await client.zfcp.onDiskRemoved((d) => action("REMOVE_DISK", { disk: d })),
      );
    };

    const unsubscribe = () => {
      subscriptions.forEach((fn) => fn());
    };

    subscribe();
    return unsubscribe;
  }, [client.zfcp, cancellablePromise, getLUNs]);

  return (
    <>
      <ControllersSection
        client={client.zfcp}
        manager={state.manager}
        load={load}
        isLoading={state.isLoading}
      />
      <DisksSection client={client.zfcp} manager={state.manager} isLoading={state.isLoading} />
    </>
  );
}

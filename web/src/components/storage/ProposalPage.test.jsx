/*
 * Copyright (c) [2022-2024] SUSE LLC
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

// @ts-check

import React from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { createCallbackMock, installerRender } from "~/test-utils";
import { createClient } from "~/client";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { StorageClient } from "~/client/storage";
import { IDLE } from "~/client/status";
import { ProposalPage } from "~/components/storage";

/**
 * @typedef {import ("~/client/storage").ProposalResult} ProposalResult
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").Volume} Volume
 */

jest.mock("~/client");
jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <div>PFSkeleton</div>

  };
});
jest.mock("~/components/core/Sidebar", () => () => <div>Agama sidebar</div>);
jest.mock("~/components/storage/ProposalPageMenu", () => () => <div>ProposalPage Options</div>);

jest.mock("~/context/product", () => ({
  ...jest.requireActual("~/context/product"),
  useProduct: () => ({
    selectedProduct : { name: "Test" }
  })
}));

/** @type {StorageDevice} */
const vda = {
  sid: 59,
  type: "disk",
  isDrive: true,
  description: "",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/vda",
  size: 1e+12,
  systems : ["Windows 11", "openSUSE Leap 15.2"],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

/** @type {StorageDevice} */
const vdb = {
  sid: 60,
  type: "disk",
  isDrive: true,
  description: "",
  vendor: "Seagate",
  model: "Unknown",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  name: "/dev/vdb",
  size: 1e+6
};

/**
 * @param {string} mountPath
 * @returns {Volume}
 */
const volume = (mountPath) => {
  return (
    {
      mountPath,
      target: "DEFAULT",
      fsType: "Btrfs",
      minSize: 1024,
      maxSize: 1024,
      autoSize: false,
      snapshots: false,
      transactional: false,
      outline: {
        required: false,
        fsTypes: ["Btrfs"],
        supportAutoSize: false,
        snapshotsConfigurable: false,
        snapshotsAffectSizes: false,
        sizeRelevantVolumes: [],
        adjustByRam: false
      }
    }
  );
};

/** @type {StorageClient} */
let storage;

/** @type {ProposalResult} */
let proposalResult;

beforeEach(() => {
  proposalResult = {
    settings: {
      target: "DISK",
      targetPVDevices: [],
      configureBoot: false,
      bootDevice: "",
      defaultBootDevice: "",
      encryptionPassword: "",
      encryptionMethod: "",
      spacePolicy: "",
      spaceActions: [],
      volumes: [],
      installationDevices: []
    },
    actions: []
  };

  storage = {
    probe: jest.fn().mockResolvedValue(0),
    // @ts-expect-error Some methods have to be private to avoid type complaint.
    proposal: {
      getAvailableDevices: jest.fn().mockResolvedValue([vda, vdb]),
      getEncryptionMethods: jest.fn().mockResolvedValue([]),
      getProductMountPoints: jest.fn().mockResolvedValue([]),
      getResult: jest.fn().mockResolvedValue(proposalResult),
      defaultVolume: jest.fn(mountPath => Promise.resolve(volume(mountPath))),
      calculate: jest.fn().mockResolvedValue(0),
    },
    // @ts-expect-error Some methods have to be private to avoid type complaint.
    system: {
      getDevices: jest.fn().mockResolvedValue([vda, vdb])
    },
    // @ts-expect-error Some methods have to be private to avoid type complaint.
    staging: {
      getDevices: jest.fn().mockResolvedValue([vda])
    },
    getErrors: jest.fn().mockResolvedValue([]),
    isDeprecated: jest.fn().mockResolvedValue(false),
    onDeprecate: jest.fn(),
    onStatusChange: jest.fn()
  };

  // @ts-expect-error Mocking method does not exist fo InstallerClient type.
  createClient.mockImplementation(() => ({ storage }));
});

it("probes storage if the storage devices are deprecated", async () => {
  storage.isDeprecated = jest.fn().mockResolvedValue(true);
  installerRender(<ProposalPage />);
  await waitFor(() => expect(storage.probe).toHaveBeenCalled());
});

it("does not probe storage if the storage devices are not deprecated", async () => {
  installerRender(<ProposalPage />);
  await waitFor(() => expect(storage.probe).not.toHaveBeenCalled());
});

it("loads the proposal data", async () => {
  proposalResult.settings.target = "DISK";
  proposalResult.settings.targetDevice = vda.name;

  installerRender(<ProposalPage />);

  screen.getAllByText(/PFSkeleton/);
  expect(screen.queryByText(/Installation device/)).toBeNull();
  await screen.findByText(/Installation device/);
  await screen.findByText(/\/dev\/vda/);
});

it("renders the device, settings and result sections", async () => {
  installerRender(<ProposalPage />);

  await screen.findByText(/Device/);
  await screen.findByText(/Settings/);
  await screen.findByText(/Result/);
});

describe("when the storage devices become deprecated", () => {
  it("probes storage", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    storage.onDeprecate = mockFunction;

    installerRender(<ProposalPage />);

    storage.isDeprecated = jest.fn().mockResolvedValue(true);
    const [onDeprecateCb] = callbacks;
    await act(() => onDeprecateCb());

    await waitFor(() => expect(storage.probe).toHaveBeenCalled());
  });

  it("loads the proposal data", async () => {
    proposalResult.settings.target = "DISK";
    proposalResult.settings.targetDevice = vda.name;

    const [mockFunction, callbacks] = createCallbackMock();
    storage.onDeprecate = mockFunction;

    installerRender(<ProposalPage />);

    await screen.findByText(/\/dev\/vda/);

    proposalResult.settings.targetDevice = vdb.name;

    const [onDeprecateCb] = callbacks;
    await act(() => onDeprecateCb());

    await screen.findByText(/\/dev\/vdb/);
  });
});

describe("when there is no proposal yet", () => {
  it("shows the page as loading", async () => {
    proposalResult = undefined;

    installerRender(<ProposalPage />);

    screen.getAllByText(/PFSkeleton/);
    await waitFor(() => expect(screen.queryByText(/Installation device/)).toBeNull());
  });

  it("loads the proposal when the service finishes to calculate", async () => {
    const defaultResult = proposalResult;
    proposalResult = undefined;

    const [mockFunction, callbacks] = createCallbackMock();
    storage.onStatusChange = mockFunction;

    installerRender(<ProposalPage />);

    screen.getAllByText(/PFSkeleton/);

    proposalResult = defaultResult;
    proposalResult.settings.target = "DISK";
    proposalResult.settings.targetDevice = vda.name;

    const [onStatusChangeCb] = callbacks;
    await act(() => onStatusChangeCb(IDLE));
    await screen.findByText(/\/dev\/vda/);
  });
});

describe("when there is a proposal", () => {
  beforeEach(() => {
    proposalResult.settings.target = "DISK";
    proposalResult.settings.targetDevice = vda.name;
  });

  it("does not load the proposal when the service finishes to calculate", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    storage.onStatusChange = mockFunction;

    installerRender(<ProposalPage />);

    await screen.findByText(/\/dev\/vda/);

    const [onStatusChangeCb] = callbacks;
    expect(onStatusChangeCb).toBeUndefined();
  });
});

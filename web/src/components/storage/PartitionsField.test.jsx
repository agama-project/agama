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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import PartitionsField from "~/components/storage/PartitionsField";

/**
 * @typedef {import("~/components/storage/PartitionsField").PartitionsFieldProps} PartitionsFieldProps
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").Volume} Volume
 */

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <div>PFSkeleton</div>
  };
});

/** @type {Volume} */
const rootVolume = {
  mountPath: "/",
  target: "DEFAULT",
  fsType: "Btrfs",
  minSize: 1024,
  maxSize: 2048,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: true,
    fsTypes: ["Btrfs", "Ext4"],
    supportAutoSize: true,
    snapshotsConfigurable: true,
    snapshotsAffectSizes: true,
    sizeRelevantVolumes: [],
    adjustByRam: false,
    productDefined: true
  }
};

/** @type {Volume} */
const swapVolume = {
  mountPath: "swap",
  target: "DEFAULT",
  fsType: "Swap",
  minSize: 1024,
  maxSize: 1024,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: false,
    fsTypes: ["Swap"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    sizeRelevantVolumes: [],
    adjustByRam: false,
    productDefined: true
  }
};

/** @type {Volume} */
const homeVolume = {
  mountPath: "/home",
  target: "DEFAULT",
  fsType: "XFS",
  minSize: 1024,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: false,
    fsTypes: ["Ext4", "XFS"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    sizeRelevantVolumes: [],
    adjustByRam: false,
    productDefined: true
  }
};

/** @type {StorageDevice} */
const sda = {
  sid: 59,
  name: "/dev/sda",
  description: "",
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  transport: "usb",
  size: 1024
};

/** @type {StorageDevice} */
const sda1 = {
  sid: 69,
  name: "/dev/sda1",
  description: "",
  isDrive: false,
  type: "partition",
  size: 256,
  filesystem: {
    sid: 169,
    type: "Swap"
  }
};

/** @type {StorageDevice} */
const sda2 = {
  sid: 79,
  name: "/dev/sda2",
  description: "",
  isDrive: false,
  type: "partition",
  size: 512,
  filesystem: {
    sid: 179,
    type: "Ext4"
  }
};

/** @type {PartitionsFieldProps} */
let props;

const expandField = async () => {
  const render = plainRender(<PartitionsField {...props} />);
  const button = screen.getByRole("button", { name: "Partitions and file systems" });
  await render.user.click(button);
  return render;
};

beforeEach(() => {
  props = {
    volumes: [rootVolume, swapVolume],
    templates: [],
    devices: [],
    target: "DISK",
    targetDevice: undefined,
    configureBoot: false,
    bootDevice: undefined,
    defaultBootDevice: undefined,
    onVolumesChange: jest.fn(),
    onBootChange: jest.fn()
  };
});

/** @todo Add tests for collapsed field. */

it("allows to reset the file systems", async () => {
  const { user } = await expandField();
  const button = screen.getByRole("button", { name: "Reset to defaults" });
  await user.click(button);

  expect(props.onVolumesChange).toHaveBeenCalledWith([]);
});

it("allows to add a file system", async () => {
  props.templates = [homeVolume];
  const { user } = await expandField();

  const button = screen.getByRole("button", { name: "Add file system" });
  await user.click(button);

  const popup = await screen.findByRole("dialog");
  const accept = within(popup).getByRole("button", { name: "Accept" });
  await user.click(accept);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(props.onVolumesChange).toHaveBeenCalledWith([rootVolume, swapVolume, homeVolume]);
});

it("allows to cancel adding a file system", async () => {
  props.templates = [homeVolume];
  const { user } = await expandField();

  const button = screen.getByRole("button", { name: "Add file system" });
  await user.click(button);

  const popup = await screen.findByRole("dialog");
  const cancel = within(popup).getByRole("button", { name: "Cancel" });
  await user.click(cancel);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(props.onVolumesChange).not.toHaveBeenCalled();
});

describe("if there are volumes", () => {
  beforeEach(() => {
    props.volumes = [rootVolume, homeVolume, swapVolume];
  });

  it("renders skeleton for each volume if loading", async () => {
    props.isLoading = true;
    await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");

    const rows = within(body).getAllByRole("row");
    expect(rows.length).toEqual(3);

    const loadingRows = within(body).getAllByRole("row", { name: "PFSkeleton" });
    expect(loadingRows.length).toEqual(3);
  });

  it("renders the information for each volume", async () => {
    await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");

    expect(within(body).queryAllByRole("row").length).toEqual(3);
    within(body).getByRole("row", { name: "/ Btrfs 1 KiB - 2 KiB Partition at installation disk" });
    within(body).getByRole("row", { name: "/home XFS at least 1 KiB Partition at installation disk" });
    within(body).getByRole("row", { name: "swap Swap 1 KiB Partition at installation disk" });
  });

  it("allows deleting the volume", async () => {
    const { user } = await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");
    const row = within(body).getByRole("row", { name: "/home XFS at least 1 KiB Partition at installation disk" });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    const deleteAction = within(row).queryByRole("menuitem", { name: "Delete" });
    await user.click(deleteAction);

    expect(props.onVolumesChange).toHaveBeenCalledWith(expect.not.arrayContaining([homeVolume]));
  });

  it("allows editing the volume", async () => {
    const { user } = await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");
    const row = within(body).getByRole("row", { name: "/home XFS at least 1 KiB Partition at installation disk" });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    const editAction = within(row).queryByRole("menuitem", { name: "Edit" });
    await user.click(editAction);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Edit file system");
  });

  it("allows changing the location of the volume", async () => {
    const { user } = await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");
    const row = within(body).getByRole("row", { name: "/home XFS at least 1 KiB Partition at installation disk" });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    const locationAction = within(row).queryByRole("menuitem", { name: "Change location" });
    await user.click(locationAction);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Location for /home file system");
  });

  describe("and there is a transactional Btrfs root volume", () => {
    beforeEach(() => {
      props.volumes = [{ ...rootVolume, snapshots: true, transactional: true }];
    });

    it("renders 'transactional' legend as part of its information", async () => {
      await expandField();

      const [, volumes] = await screen.findAllByRole("rowgroup");

      within(volumes).getByRole("row", { name: "/ Transactional Btrfs 1 KiB - 2 KiB Partition at installation disk" });
    });
  });

  describe("and there is Btrfs volume using snapshots", () => {
    beforeEach(() => {
      props.volumes = [{ ...rootVolume, snapshots: true, transactional: false }];
    });

    it("renders 'with snapshots' legend as part of its information", async () => {
      await expandField();

      const [, volumes] = await screen.findAllByRole("rowgroup");

      within(volumes).getByRole("row", { name: "/ Btrfs with snapshots 1 KiB - 2 KiB Partition at installation disk" });
    });
  });

  describe("and some volumes are allocated at separate disks", () => {
    beforeEach(() => {
      props.volumes = [
        rootVolume,
        { ...swapVolume, target: "NEW_PARTITION", targetDevice: sda },
        { ...homeVolume, target: "NEW_VG", targetDevice: sda }
      ];
    });

    it("renders the locations", async () => {
      await expandField();

      const [, volumes] = await screen.findAllByRole("rowgroup");

      within(volumes).getByRole("row", { name: "swap Swap 1 KiB Partition at /dev/sda" });
      within(volumes).getByRole("row", { name: "/home XFS at least 1 KiB Separate LVM at /dev/sda" });
    });
  });

  describe("and some volumes are reusing existing block devices", () => {
    beforeEach(() => {
      props.volumes = [
        rootVolume,
        { ...swapVolume, target: "FILESYSTEM", targetDevice: sda1 },
        { ...homeVolume, target: "DEVICE", targetDevice: sda2 }
      ];
    });

    it("renders the locations", async () => {
      await expandField();

      const [, volumes] = await screen.findAllByRole("rowgroup");

      within(volumes).getByRole("row", { name: "swap Reused Swap 256 B /dev/sda1" });
      within(volumes).getByRole("row", { name: "/home XFS 512 B /dev/sda2" });
    });
  });
});

describe("if there are not volumes", () => {
  beforeEach(() => {
    props.volumes = [];
  });

  it("renders an empty table if it is not loading", async () => {
    await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");
    expect(body).toBeEmptyDOMElement();
  });

  it("renders an skeleton row if it is loading", async () => {
    props.isLoading = true;

    await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");
    const rows = within(body).getAllByRole("row", { name: "PFSkeleton" });

    expect(rows.length).toEqual(1);
  });
});

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
import PartitionsField, { PartitionsFieldProps } from "~/components/storage/PartitionsField";
import { ProposalTarget, StorageDevice, Volume, VolumeTarget } from "~/types/storage";

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <div>PFSkeleton</div>,
  };
});

const rootVolume: Volume = {
  mountPath: "/",
  target: VolumeTarget.DEFAULT,
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
    productDefined: true,
  },
};

const swapVolume: Volume = {
  mountPath: "swap",
  target: VolumeTarget.DEFAULT,
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
    productDefined: true,
  },
};

const homeVolume: Volume = {
  mountPath: "/home",
  target: VolumeTarget.DEFAULT,
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
    productDefined: true,
  },
};

const arbitraryVolume: Volume = {
  mountPath: "",
  target: VolumeTarget.DEFAULT,
  fsType: "XFS",
  minSize: 1024,
  maxSize: 4096,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: false,
    fsTypes: ["Ext4", "XFS"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    adjustByRam: false,
    sizeRelevantVolumes: [],
    productDefined: false,
  },
};

const sda: StorageDevice = {
  sid: 59,
  name: "/dev/sda",
  description: "",
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  transport: "usb",
  size: 1024,
};

const sda1: StorageDevice = {
  sid: 69,
  name: "/dev/sda1",
  description: "",
  isDrive: false,
  type: "partition",
  size: 256,
  filesystem: {
    sid: 169,
    type: "Swap",
  },
};

const sda2: StorageDevice = {
  sid: 79,
  name: "/dev/sda2",
  description: "",
  isDrive: false,
  type: "partition",
  size: 512,
  filesystem: {
    sid: 179,
    type: "Ext4",
  },
};

let props: PartitionsFieldProps;

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
    availableDevices: [],
    volumeDevices: [sda],
    target: ProposalTarget.DISK,
    targetDevices: [],
    configureBoot: false,
    bootDevice: undefined,
    defaultBootDevice: undefined,
    onVolumesChange: jest.fn(),
  };
});

it.skip("allows to reset the file systems", async () => {
  const { user } = await expandField();
  const button = screen.getByRole("button", { name: "Reset to defaults" });
  await user.click(button);

  expect(props.onVolumesChange).toHaveBeenCalledWith([]);
});

it.skip("renders a button for adding a file system when only arbitrary volumes can be added", async () => {
  props.templates = [arbitraryVolume];
  const { user } = await expandField();
  const button = screen.getByRole("button", { name: "Add file system" });
  expect(button).not.toHaveAttribute("aria-expanded");
  await user.click(button);
  screen.getByRole("dialog", { name: "Add file system" });
});

it.skip("renders a menu for adding a file system when predefined and arbitrary volume can be added", async () => {
  props.templates = [homeVolume, arbitraryVolume];
  const { user } = await expandField();

  const button = screen.getByRole("button", { name: "Add file system" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  await user.click(button);

  expect(button).toHaveAttribute("aria-expanded", "true");
  const homeOption = screen.getByRole("menuitem", { name: "/home" });
  await user.click(homeOption);

  screen.getByRole("dialog", { name: "Add /home file system" });
});

it.skip("renders the control for adding a file system when using transactional system with optional templates", async () => {
  props.templates = [{ ...rootVolume, transactional: true }, homeVolume];
  await expandField();
  screen.queryByRole("button", { name: "Add file system" });
});

it.skip("does not render the control for adding a file system when using transactional system with no optional templates", async () => {
  props.templates = [{ ...rootVolume, transactional: true }];
  await expandField();
  expect(screen.queryByRole("button", { name: "Add file system" })).toBeNull();
});

it.skip("renders the control as disabled when there are no more left predefined volumes to add and arbitrary volumes are not allowed", async () => {
  props.templates = [rootVolume, homeVolume];
  props.volumes = [rootVolume, homeVolume];
  await expandField();
  const button = screen.getByRole("button", { name: "Add file system" });
  expect(button).toBeDisabled();
});

it.skip("allows to add a file system", async () => {
  props.templates = [homeVolume];
  const { user } = await expandField();

  const button = screen.getByRole("button", { name: "Add file system" });
  await user.click(button);
  const homeOption = screen.getByRole("menuitem", { name: "/home" });
  await user.click(homeOption);

  const dialog = await screen.findByRole("dialog");
  const accept = within(dialog).getByRole("button", { name: "Accept" });
  await user.click(accept);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(props.onVolumesChange).toHaveBeenCalledWith([rootVolume, swapVolume, homeVolume]);
});

it.skip("allows to cancel adding a file system", async () => {
  props.templates = [arbitraryVolume];
  const { user } = await expandField();

  const button = screen.getByRole("button", { name: "Add file system" });
  await user.click(button);

  const popup = await screen.findByRole("dialog");
  const cancel = within(popup).getByRole("button", { name: "Cancel" });
  await user.click(cancel);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(props.onVolumesChange).not.toHaveBeenCalled();
});

describe.skip("if there are volumes", () => {
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
    within(body).getByRole("row", {
      name: "/home XFS at least 1 KiB Partition at installation disk",
    });
    within(body).getByRole("row", { name: "swap Swap 1 KiB Partition at installation disk" });
  });

  it("allows deleting the volume", async () => {
    const { user } = await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");
    const row = within(body).getByRole("row", {
      name: "/home XFS at least 1 KiB Partition at installation disk",
    });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    const deleteAction = within(row).queryByRole("menuitem", { name: "Delete" });
    await user.click(deleteAction);

    expect(props.onVolumesChange).toHaveBeenCalledWith(expect.not.arrayContaining([homeVolume]));
  });

  it("allows editing the volume", async () => {
    const { user } = await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");
    const row = within(body).getByRole("row", {
      name: "/home XFS at least 1 KiB Partition at installation disk",
    });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    const editAction = within(row).queryByRole("menuitem", { name: "Edit" });
    await user.click(editAction);

    const popup = await screen.findByRole("dialog");
    within(popup).getByRole("heading", { name: "Edit /home file system" });
  });

  it("allows changing the location of the volume", async () => {
    const { user } = await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");
    const row = within(body).getByRole("row", {
      name: "/home XFS at least 1 KiB Partition at installation disk",
    });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    const locationAction = within(row).queryByRole("menuitem", { name: "Change location" });
    await user.click(locationAction);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Location for /home file system");
  });

  // FIXME: improve at least the test description
  it("does not allow resetting the volume location when already using the default location", async () => {
    const { user } = await expandField();

    const [, body] = await screen.findAllByRole("rowgroup");
    const row = within(body).getByRole("row", {
      name: "/home XFS at least 1 KiB Partition at installation disk",
    });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    expect(within(row).queryByRole("menuitem", { name: "Reset location" })).toBeNull();
  });

  describe("and a volume has a non default location", () => {
    beforeEach(() => {
      props.volumes = [{ ...homeVolume, target: VolumeTarget.NEW_PARTITION, targetDevice: sda }];
    });

    it("allows resetting the volume location", async () => {
      const { user } = await expandField();

      const [, body] = await screen.findAllByRole("rowgroup");
      const row = within(body).getByRole("row", {
        name: "/home XFS at least 1 KiB Partition at /dev/sda",
      });
      const actions = within(row).getByRole("button", { name: "Actions" });
      await user.click(actions);
      const resetLocationAction = within(row).queryByRole("menuitem", { name: "Reset location" });
      await user.click(resetLocationAction);
      expect(props.onVolumesChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            mountPath: "/home",
            target: "DEFAULT",
            targetDevice: undefined,
          }),
        ]),
      );

      // NOTE: sadly we cannot perform the below check because the component is
      // always receiving the same mocked props and will still having a /home as
      // "Partition at /dev/sda"
      // await within(body).findByRole("row", { name: "/home XFS at least 1 KiB Partition at installation device" });
    });
  });

  describe("and there is a transactional Btrfs root volume", () => {
    beforeEach(() => {
      props.volumes = [{ ...rootVolume, snapshots: true, transactional: true }];
    });

    it("renders 'transactional' legend as part of its information", async () => {
      await expandField();

      const [, volumes] = await screen.findAllByRole("rowgroup");

      within(volumes).getByRole("row", {
        name: "/ Transactional Btrfs 1 KiB - 2 KiB Partition at installation disk",
      });
    });
  });

  describe("and there is Btrfs volume using snapshots", () => {
    beforeEach(() => {
      props.volumes = [{ ...rootVolume, snapshots: true, transactional: false }];
    });

    it("renders 'with snapshots' legend as part of its information", async () => {
      await expandField();

      const [, volumes] = await screen.findAllByRole("rowgroup");

      within(volumes).getByRole("row", {
        name: "/ Btrfs with snapshots 1 KiB - 2 KiB Partition at installation disk",
      });
    });
  });

  describe("and some volumes are allocated at separate disks", () => {
    beforeEach(() => {
      props.volumes = [
        rootVolume,
        { ...swapVolume, target: VolumeTarget.NEW_PARTITION, targetDevice: sda },
        { ...homeVolume, target: VolumeTarget.NEW_VG, targetDevice: sda },
      ];
    });

    it("renders the locations", async () => {
      await expandField();

      const [, volumes] = await screen.findAllByRole("rowgroup");

      within(volumes).getByRole("row", { name: "swap Swap 1 KiB Partition at /dev/sda" });
      within(volumes).getByRole("row", {
        name: "/home XFS at least 1 KiB Separate LVM at /dev/sda",
      });
    });
  });

  describe("and some volumes are reusing existing block devices", () => {
    beforeEach(() => {
      props.volumes = [
        rootVolume,
        { ...swapVolume, target: VolumeTarget.FILESYSTEM, targetDevice: sda1 },
        { ...homeVolume, target: VolumeTarget.DEVICE, targetDevice: sda2 },
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

describe.skip("if there are not volumes", () => {
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

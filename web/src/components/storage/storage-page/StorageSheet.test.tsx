/*
 * Copyright (c) [2026] SUSE LLC
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

import React from "react";
import { screen } from "@testing-library/react";
import { installerRender, mockRoutes } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import StorageSheet from "~/components/storage/storage-page/StorageSheet";

const mockConfig = jest.fn();
const mockSystemDevice = jest.fn();
const mockProposalDevices = jest.fn();
const mockActions = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
  useConvertDevice: () => jest.fn(),
  useConvertPartitionableToVolumeGroup: () => jest.fn(),
  useDeleteDrive: () => jest.fn(),
  useDeleteMdRaid: () => jest.fn(),
  useDeleteVolumeGroup: () => jest.fn(),
  useDeletePartition: () => jest.fn(),
  useDeleteLogicalVolume: () => jest.fn(),
  useSetSpacePolicy: () => jest.fn(),
  /* Mocked although the module above it already is: a hook calling another
     hook of its own module calls the module's binding, not the mocked export,
     so the real suspense query underneath would run. */
  useDevice: () => ({ name: "/dev/sda", spacePolicy: "keep" }),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: () => mockSystemDevice(),
  useAvailableDevices: () => [],
  useFlattenDevices: () => [],
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useFlattenDevices: () => mockProposalDevices(),
  useActions: () => mockActions(),
}));

jest.mock("~/components/storage/storage-page/ResultSheet", () => () => (
  <div>everything the installer will do</div>
));

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [{ name: "/dev/sda", partitions: [] }],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

const page = <div>the storage page</div>;
const sheet = () => screen.queryByRole("region");

/**
 * Renders the page at one address.
 *
 * The address is set here rather than in a `beforeEach`, because `mockRoutes`
 * queues one value per call: set in two nested blocks, the outer one is never
 * consumed and turns up in whatever test runs next.
 */
const renderAt = (address: string) => {
  mockRoutes(address);
  return installerRender(<StorageSheet page={page} />);
};

describe("StorageSheet", () => {
  beforeEach(() => {
    mockConfig.mockReturnValue(config());
    mockProposalDevices.mockReturnValue([]);
    mockActions.mockReturnValue([]);
    mockSystemDevice.mockReturnValue({
      name: "/dev/sda",
      class: "drive",
      drive: { type: "disk", info: {} },
      block: { size: 64424509440, udevPaths: ["pci-0000:0a:00.0"] },
      partitionTable: { type: "gpt" },
    });
  });

  it("shows the page and no panel where the address names nothing", () => {
    installerRender(<StorageSheet page={page} />);

    screen.getByText("the storage page");
    expect(sheet()).not.toBeInTheDocument();
  });

  describe("when the address names an entry", () => {
    it("opens on it, saying what it is the way its row says it", () => {
      renderAt("/storage?sheet=drives.0");

      screen.getByRole("region", { name: /sda/ });
      screen.getByText(/60 GiB/);
    });

    it("names where the system keeps it, which survives a rename", () => {
      renderAt("/storage?sheet=drives.0");

      screen.getByText("pci-0000:0a:00.0");
    });

    it("offers the same acts its row offers", () => {
      renderAt("/storage?sheet=drives.0");

      screen.getByRole("button", { name: "Actions for sda" });
    });

    it("opens on what the device is left as, which is why a reader came", () => {
      mockProposalDevices.mockReturnValue([
        { sid: 59, name: "/dev/sda", class: "drive", block: { size: 64424509440 } },
      ]);
      mockActions.mockReturnValue([{ device: 59, text: "" }]);
      renderAt("/storage?sheet=drives.0");

      screen.getByText("How this disk looks once the installer is done.");
      screen.getByRole("treegrid");
    });

    it("says so where the installer has worked no layout out", () => {
      renderAt("/storage?sheet=drives.0");

      screen.getByText(/no layout to show/);
    });

    it("marks each view without the mark becoming part of its name", () => {
      renderAt("/storage?sheet=drives.0");

      /* Exact names: a mark read out with the words would change them. */
      screen.getByRole("tab", { name: "Final layout" });
      screen.getByRole("tab", { name: "Planned content" });
      screen.getByRole("tab", { name: "Current content" });
    });

    it("offers the views of it left to right, as time moving forwards", () => {
      renderAt("/storage?sheet=drives.0");

      screen.getByRole("tab", { name: "Final layout" });
      screen.getByRole("tab", { name: "Planned content" });
    });

    it("says in each view where what it holds is decided, and leads there", async () => {
      const { user } = renderAt("/storage?sheet=drives.0");
      await user.click(screen.getByRole("button", { name: "Current content" }));

      expect(screen.getByRole("tab", { name: "Current content" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("opens on what it becomes, not on what there is to change", () => {
      renderAt("/storage?sheet=drives.0");

      expect(screen.getByRole("tab", { name: "Final layout" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    describe("and the address names one of its views", () => {
      beforeEach(() => {
        mockConfig.mockReturnValue(
          config({
            drives: [
              {
                name: "/dev/sda",
                partitions: [{ mountPath: "/", size: { default: false, min: 1e10 } }],
              },
            ],
          }),
        );
      });

      it("opens on that one instead, listing what the new system gets here", () => {
        renderAt("/storage?sheet=drives.0&sheetTab=planned");

        screen.getByText("What this disk will hold for the new system.");
        screen.getByRole("rowheader", { name: /\// });
      });

      it("offers the one act that changes what is planned here", () => {
        renderAt("/storage?sheet=drives.0&sheetTab=planned");

        screen.getByRole("link", { name: /Add partition/ });
      });

      it("offers moving what is planned to another device, after what it would move", () => {
        renderAt("/storage?sheet=drives.0&sheetTab=planned");

        screen.getByRole("button", { name: /Use another device/ });
      });
    });

    describe("and the address names what is on it today", () => {
      beforeEach(() => {
        mockSystemDevice.mockReturnValue({
          name: "/dev/sda",
          class: "drive",
          drive: { type: "disk", info: {} },
          block: { size: 64424509440 },
          partitions: [
            { sid: 41, name: "/dev/sda1", block: { size: 5e10, systems: ["Windows 11"] } },
          ],
        });
      });

      it("names what is there and what becomes of it", () => {
        renderAt("/storage?sheet=drives.0&sheetTab=current");

        screen.getByText("What to do with the existing partitions");
        screen.getByRole("rowheader", { name: "sda1" });
        /* The system found on it reads in its own column, beside what it is. */
        screen.getByText("Windows 11");
        screen.getByText("Kept");
      });

      it("lists the free space too, so keeping everything has something to show", () => {
        mockSystemDevice.mockReturnValue({
          name: "/dev/sda",
          class: "drive",
          drive: { type: "disk", info: {} },
          block: { size: 64424509440 },
          partitionTable: { type: "gpt", unusedSlots: [{ start: 9e10, size: 1e10 }] },
          partitions: [
            { sid: 41, name: "/dev/sda1", block: { start: 0, size: 5e10, systems: [] } },
          ],
        });
        renderAt("/storage?sheet=drives.0&sheetTab=current");

        screen.getByRole("rowheader", { name: "Free space" });
      });

      it("puts the decision above the column it governs", () => {
        renderAt("/storage?sheet=drives.0&sheetTab=current");

        screen.getByRole("group", { name: "Allowed changes" });
      });

      it("says so where the device is empty, and asks nothing", () => {
        mockSystemDevice.mockReturnValue({
          name: "/dev/sda",
          class: "drive",
          drive: { type: "disk", info: {} },
          block: { size: 64424509440 },
          partitions: [],
        });
        renderAt("/storage?sheet=drives.0&sheetTab=current");

        screen.getByText("The device is empty.");
        expect(screen.queryByRole("group", { name: "Allowed changes" })).not.toBeInTheDocument();
      });
    });

    describe("and nothing is planned on it", () => {
      it("says so, and carries the act that changes it", () => {
        renderAt("/storage?sheet=drives.0&sheetTab=planned");

        screen.getByRole("heading", { name: "Nothing planned for this device yet" });
        screen.getByText(/Add a volume, or reuse one of the partitions already on it/);
        screen.getByRole("link", { name: /Add partition/ });
      });

      it("does not offer moving it, since there is nothing to move", () => {
        renderAt("/storage?sheet=drives.0&sheetTab=planned");

        expect(
          screen.queryByRole("button", { name: /Use another device/ }),
        ).not.toBeInTheDocument();
      });
    });

    describe("and the whole device goes to something else", () => {
      beforeEach(() => {
        mockConfig.mockReturnValue(
          config({
            drives: [{ name: "/dev/sda", partitions: [] }],
            volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"] }],
          }),
        );
      });

      it("says which, and offers the way to it", () => {
        renderAt("/storage?sheet=drives.0&sheetTab=planned");

        screen.getByRole("heading", { name: "No partitions are planned here" });
        screen.getByText(/The whole device goes to/);
        /* Twice: once in the statement above the content, once in the state
           that says nothing is planned. Both lead to the same entry. */
        expect(screen.getAllByRole("link", { name: "system" })).toHaveLength(2);
      });

      it("says the device starts the machine, and what that costs it", () => {
        mockConfig.mockReturnValue(
          config({
            drives: [{ name: "/dev/sda", partitions: [] }],
            volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"] }],
            /* Automatic still records which disk it chose. */
            boot: { configure: true, device: { default: true, name: "/dev/sda" } },
          }),
        );
        mockProposalDevices.mockReturnValue([
          {
            sid: 59,
            name: "/dev/sda",
            partitions: [
              {
                sid: 90,
                name: "/dev/sda1",
                description: "BIOS Boot Partition",
                block: { size: 8388608 },
              },
            ],
          },
        ]);
        renderAt("/storage?sheet=drives.0&sheetTab=planned");

        screen.getByText("Boot device, chosen automatically.");
        screen.getByText(/Partitions to boot: a new partition \(8 MiB\)\./);
      });

      it("says so above the content too, on one line", () => {
        renderAt("/storage?sheet=drives.0&sheetTab=planned");

        /* The heading and what it says share one line rather than stacking. */
        const heading = screen.getByText("Used by");
        expect(heading.parentElement).toHaveTextContent(/^Used by system$/);
      });
    });
  });

  describe("when the entry is one the configuration defines rather than finds", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(
        config({
          drives: [{ name: "/dev/sda", partitions: [] }],
          volumeGroups: [
            { vgName: "system", targetDevices: ["/dev/sda"], targetDevicesPolicy: "useNeeded" },
          ],
        }),
      );
    });

    it("offers a view of what it is made of", () => {
      renderAt("/storage?sheet=volumeGroups.0");

      screen.getByRole("tab", { name: "Properties" });
    });

    it("offers a disk no such view, since a disk is the hardware", () => {
      renderAt("/storage?sheet=drives.0");

      expect(screen.queryByRole("tab", { name: "Properties" })).not.toBeInTheDocument();
    });

    it("names what it is built on, and offers the way to each", () => {
      renderAt("/storage?sheet=volumeGroups.0&sheetTab=properties");

      screen.getByText("Uses");
      screen.getByRole("link", { name: "sda" });
    });

    it("says how much of those devices it takes", () => {
      renderAt("/storage?sheet=volumeGroups.0&sheetTab=properties");

      screen.getByText("Space taken");
      screen.getByText("Only what its volumes need");
    });

    it("offers the form that changes both, after what it changes", () => {
      renderAt("/storage?sheet=volumeGroups.0&sheetTab=properties");

      screen.getByRole("link", { name: /Edit the volume group/ });
    });
  });

  describe("when the address names an entry the configuration no longer has", () => {
    it("leaves the reader on the page rather than on a broken panel", () => {
      renderAt("/storage?sheet=drives.7");

      screen.getByText("the storage page");
      expect(sheet()).not.toBeInTheDocument();
    });
  });

  describe("when the address makes no sense at all", () => {
    it("reads as a shut panel, since an address can be edited by hand", () => {
      renderAt("/storage?sheet=nonsense");

      expect(sheet()).not.toBeInTheDocument();
    });
  });

  describe("when the address names the whole picture", () => {
    it("opens on it instead", () => {
      renderAt("/storage?sheet=result");

      screen.getByRole("region", { name: "Result" });
      screen.getByText("everything the installer will do");
    });
  });
});

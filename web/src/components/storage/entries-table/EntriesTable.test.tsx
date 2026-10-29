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
import { screen, within } from "@testing-library/react";
import { useSearchParams } from "react-router";
import { installerRender } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import EntriesTable from "~/components/storage/entries-table/EntriesTable";

const mockConfig = jest.fn();
const mockSystemDevice = jest.fn();
const mockSystemDevices = jest.fn();
const mockStagingDevices = jest.fn();
const mockActions = jest.fn();

/**
 * The acts a row's menu offers, which are real mutations reading a query that
 * never settles under a synchronous assertion. Unmocked they suspend, and a
 * suspended tree renders nothing and says nothing about why.
 */
jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
  useConvertDevice: () => jest.fn(),
  useConvertPartitionableToVolumeGroup: () => jest.fn(),
  useDeleteDrive: () => jest.fn(),
  useDeleteMdRaid: () => jest.fn(),
  useDeleteVolumeGroup: () => jest.fn(),
  useChangeTargetDrive: () => jest.fn(),
}));

/* Disks the installation could move to: changing it is offered only with more
   than one. */
const mockCandidateDrives = jest.fn().mockReturnValue([]);

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: (name: string) => mockSystemDevice(name),
  useFlattenDevices: () => mockSystemDevices(),
  useAvailableDevices: () => [],
  useCandidateDrives: () => mockCandidateDrives(),
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useFlattenDevices: () => mockStagingDevices(),
  useActions: () => mockActions(),
}));

jest.mock("~/components/storage/ConfigureDeviceMenu", () => () => <div>bring in more devices</div>);

/**
 * How many things a line names before counting them instead, so a test can move
 * it.
 *
 * The number and the sentence that reads it have to agree on how many names
 * there is room for. Only running one against the other says whether they do,
 * and a sentence with too few places for them drops the rest in silence.
 *
 * Read through a getter, since a line reads the number as it renders rather
 * than when the module loads.
 */
let mockNamesPerLine = 2;

jest.mock("~/components/storage/shared/naming", () => ({
  get NAMES_PER_LINE() {
    return mockNamesPerLine;
  },
}));

/* Every group of tests in this file, since a test that moves the number is
   sitting next to several that read what it produced. */
beforeEach(() => {
  mockNamesPerLine = 2;
});

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

/**
 * The entries of one category, as a reader who cannot see the arrangement
 * meets them: a group of rows of the list's table, named by its heading.
 *
 * Asking for the table by its role also guards the one prop that would fail
 * quietly: PatternFly calls its tables grids by default, and a grid is an
 * interactive widget rather than something to read.
 */
const table = (name = "Used disks") =>
  within(screen.getByRole("table", { name: "Devices of the installation" })).getByRole("rowgroup", {
    name,
  });

/**
 * The address, so a test can read what a control wrote to it.
 *
 * A row writes through the router's own setter rather than through the navigate
 * spy, so what it did is visible in the address and nowhere else.
 */
const Address = () => {
  const [params] = useSearchParams();
  return <output>{params.toString()}</output>;
};

/** Every category and entry name the list reads out, in the order it reads them. */
const names = () =>
  screen.getAllByRole("heading", { level: 2 }).flatMap((heading) => [
    heading.textContent,
    ...within(table(heading.textContent))
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent),
  ]);

/** What the row says the installer will do, and what that costs. */
const rowText = (name: string) =>
  screen
    .getAllByRole("row")
    .find((row) => within(row).queryByRole("rowheader")?.textContent?.startsWith(name))
    ?.textContent;

describe("EntriesTable", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(null);
    mockSystemDevices.mockReturnValue([]);
    mockStagingDevices.mockReturnValue([]);
    mockActions.mockReturnValue([]);
  });

  describe("when the configuration holds nothing", () => {
    it("renders no list at all", () => {
      mockConfig.mockReturnValue(config());
      installerRender(<EntriesTable />);

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  it("closes with the offer to add to it, at the end of what it appends to", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda" }] }));
    installerRender(<EntriesTable />);

    screen.getByText("bring in more devices");
  });

  it("names each category over the entries it heads", () => {
    mockConfig.mockReturnValue(
      config({ drives: [{ name: "/dev/sda" }], volumeGroups: [{ vgName: "system" }] }),
    );
    installerRender(<EntriesTable />);

    within(screen.getByRole("region", { name: "Volume groups" })).getByRole("table", {
      name: "Volume groups",
    });
    within(screen.getByRole("region", { name: "Used disks" })).getByRole("table", {
      name: "Used disks",
    });
  });

  describe("when the installation uses a single disk", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda", partitions: [] }] }));
    });

    it("offers changing it beside the heading of the disks, in a plain cell", () => {
      mockCandidateDrives.mockReturnValueOnce([{ name: "/dev/sda" }, { name: "/dev/sdb" }]);
      installerRender(<EntriesTable />);

      const heading = within(table("Used disk")).getByRole("heading", { level: 2 });
      const cell = heading.closest("td");
      const button = within(cell).getByRole("button", { name: "Change installation disk" });
      expect(button).toHaveTextContent("Change target disk…");
    });
  });

  describe("as one table", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(
        config({
          drives: [{ name: "/dev/sda", partitions: [] }],
          volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"], logicalVolumes: [] }],
        }),
      );
    });

    it("lists every category in a single table, a group of rows each, named by its heading", () => {
      installerRender(<EntriesTable />);

      const list = screen.getByRole("table", { name: "Devices of the installation" });
      expect(screen.getAllByRole("table")).toHaveLength(1);
      within(list).getByRole("rowgroup", { name: "Volume group" });
      within(list).getByRole("rowgroup", { name: "Used disk" });
    });

    it("keeps each heading a real heading, in a data cell rather than a header cell", () => {
      installerRender(<EntriesTable />);

      const headings = screen.getAllByRole("heading", { level: 2 });
      expect(headings.map((h) => h.textContent)).toEqual(["Volume group", "Used disk"]);
      headings.forEach((heading) => expect(heading.closest("td")).not.toBeNull());
    });
  });

  describe("when the installation uses more than one disk", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(
        config({
          drives: [
            { name: "/dev/sda", partitions: [] },
            { name: "/dev/sdb", partitions: [] },
          ],
        }),
      );
    });

    it("does not offer changing the installation disk", () => {
      installerRender(<EntriesTable />);

      expect(screen.queryByRole("button", { name: "Change installation disk" })).toBeNull();
    });
  });

  it("reads from what is defined down to the hardware it is defined on", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
        mdRaids: [{ name: "/dev/md0" }],
        volumeGroups: [{ vgName: "system" }],
      }),
    );
    installerRender(<EntriesTable />);

    expect(names()).toEqual([
      "Volume groups",
      "system",
      "RAID devices",
      "md0",
      "Used disks",
      "sda",
      "sdb",
    ]);
  });

  describe("the first column", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda", partitions: [] }] }));
      mockSystemDevice.mockReturnValue({
        name: "/dev/sda",
        class: "drive",
        drive: { type: "disk", model: "Samsung SSD 980 PRO 2TB", info: {} },
        block: { size: 64424509440, systems: ["Windows 11"] },
        partitionTable: { type: "gpt" },
        partitions: [],
      });
    });

    it("says how big a disk is beside its name, and its model under it", () => {
      installerRender(<EntriesTable />);

      within(table()).getByRole("rowheader", {
        name: /^sda · 60 GiB\s*Samsung SSD 980 PRO 2TB$/,
      });
    });

    it("says what kind of disk it is where the machine reports no model", () => {
      mockSystemDevice.mockReturnValue({
        name: "/dev/sda",
        class: "drive",
        drive: { type: "disk", info: {} },
        block: { size: 64424509440 },
        partitions: [],
      });
      installerRender(<EntriesTable />);

      within(table()).getByRole("rowheader", { name: /^sda · 60 GiB\s*Disk$/ });
    });

    it("leaves what is on the disk today to the panel", () => {
      installerRender(<EntriesTable />);
      const cell = within(table()).getByRole("rowheader", { name: /^sda/ });

      expect(cell).not.toHaveTextContent("Windows 11");
    });
  });

  it("says nothing about a device the machine does not have", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sdz" }] }));
    installerRender(<EntriesTable />);

    within(table()).getByRole("rowheader", { name: "sdz" });
  });
});

describe("what a row says the installer will do", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(null);
    mockSystemDevices.mockReturnValue([]);
    mockStagingDevices.mockReturnValue([]);
    mockActions.mockReturnValue([]);
  });

  it("names both jobs of a disk that holds a volume group and starts the machine", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"] }],
        boot: { configure: true, device: { default: false, name: "/dev/sda" } },
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Host LVM volume group system and boot");
  });

  it("says under a volume group's name that it is to be created, where a disk shows its model", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda", partitions: [] }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"], logicalVolumes: [] }],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("system")).toContain("LVM");
  });

  it("says a disk with nothing planned on it will be skipped", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [
          { name: "/dev/sda", partitions: [{ mountPath: "/" }] },
          { name: "/dev/sdb", partitions: [] },
        ],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("sdb")).toContain("Nothing planned yet, will be skipped");
    const rows = screen.getAllByRole("row");
    const rowOf = (name: string) =>
      rows.find((row) => within(row).queryByRole("rowheader")?.textContent?.startsWith(name));
    expect(rowOf("sdb")).toHaveClass("agm-entries-table__row--idle");
    expect(rowOf("sda")).not.toHaveClass("agm-entries-table__row--idle");
    expect(rowText("sda")).not.toContain("will be skipped");
  });

  it("names what a disk holds, so the relationship reads from either end", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }],
        volumeGroups: [
          { vgName: "system", targetDevices: ["/dev/sda"] },
          { vgName: "another", targetDevices: ["/dev/sda"] },
        ],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Host LVM volume groups system and another");
  });

  it("counts what it has no room to name", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }],
        volumeGroups: [
          { vgName: "one", targetDevices: ["/dev/sda"] },
          { vgName: "two", targetDevices: ["/dev/sda"] },
          { vgName: "three", targetDevices: ["/dev/sda"] },
        ],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Host 3 LVM volume groups");
  });

  it("names all of them where it is given room for all of them", () => {
    mockNamesPerLine = 3;
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }],
        volumeGroups: [
          { vgName: "one", targetDevices: ["/dev/sda"] },
          { vgName: "two", targetDevices: ["/dev/sda"] },
          { vgName: "three", targetDevices: ["/dev/sda"] },
        ],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Host LVM volume groups one, two, and three");
  });

  it("counts the partitions it creates and the ones it takes over", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [
          {
            name: "/dev/sda",
            partitions: [
              { mountPath: "/" },
              { mountPath: "swap" },
              {
                name: "/dev/sda3",
                mountPath: "/home",
                filesystem: { default: false, reuse: true },
              },
            ],
          },
        ],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Create 2 partitions");
    expect(rowText("sda")).toContain("Reuse 1 partition");
  });

  it("says where a volume group sits and what it will hold", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }],
        volumeGroups: [
          {
            vgName: "system",
            targetDevices: ["/dev/sda"],
            logicalVolumes: [{ mountPath: "/" }, { mountPath: "swap" }],
          },
        ],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("system")).toContain("Create LVM volume group on sda");
    expect(rowText("system")).toContain("Define 2 logical volumes");
  });

  it("names the disks a volume group sits on while there is room", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda", "/dev/sdb"] }],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("system")).toContain("Create LVM volume group on sda and sdb");
  });

  it("counts them once there are more than it can name", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }, { name: "/dev/sdc" }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda", "/dev/sdb", "/dev/sdc"] }],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("system")).toContain("Create LVM volume group on 3 disks");
  });

  it("names all of them where it is given room for all of them", () => {
    mockNamesPerLine = 3;
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }, { name: "/dev/sdc" }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda", "/dev/sdb", "/dev/sdc"] }],
      }),
    );
    installerRender(<EntriesTable />);

    expect(rowText("system")).toContain("Create LVM volume group on sda, sdb, and sdc");
  });
});

describe("what a row says it costs", () => {
  /** A disk carrying Windows, which the installation may or may not remove. */
  const windowsPartition = {
    sid: 41,
    name: "/dev/sda1",
    class: "partition",
    block: { systems: ["Windows 11"] },
    filesystem: { sid: 42, type: "ntfs" },
  };

  /** The same partition once the installation is done with it, where it stays. */
  const kept = { ...windowsPartition };

  beforeEach(() => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda" }] }));
    mockSystemDevice.mockReturnValue({ name: "/dev/sda", partitions: [windowsPartition] });
    mockSystemDevices.mockReturnValue([windowsPartition]);
    /* Still there when the installation is done, which is the quiet case the
       tests that cost something move away from. */
    mockStagingDevices.mockReturnValue([kept]);
    mockActions.mockReturnValue([]);
  });

  it("names what the machine loses, rather than counting it", () => {
    mockStagingDevices.mockReturnValue([]);
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Windows 11 will be deleted");
  });

  it("counts what it cannot name", () => {
    mockSystemDevice.mockReturnValue({
      name: "/dev/sda",
      partitions: [{ sid: 41, name: "/dev/sda1", class: "partition", block: { systems: [] } }],
    });
    mockSystemDevices.mockReturnValue([
      { sid: 41, name: "/dev/sda1", class: "partition", block: { systems: [] } },
    ]);
    mockStagingDevices.mockReturnValue([]);
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toContain("1 partition will be deleted");
  });

  it("tells a shrink apart from a deletion", () => {
    mockActions.mockReturnValue([{ device: 41, text: "", resize: true }]);
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toContain("1 partition will shrink");
    expect(rowText("sda")).not.toContain("deleted");
  });

  /* Emptying a partition to reuse it deletes the file system that was on it,
     and the plan says so. The partition itself stays, so the row has to read
     the plan rather than the word "delete" in it. */
  it("does not call a partition deleted while the installation keeps it", () => {
    mockStagingDevices.mockReturnValue([{ ...kept, filesystem: { sid: 99, type: "btrfs" } }]);
    mockActions.mockReturnValue([{ device: 41, text: "", delete: true }]);
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Windows 11 will be formatted");
    expect(rowText("sda")).not.toContain("deleted");
  });

  it("says nothing where the installation costs nothing", () => {
    installerRender(<EntriesTable />);

    expect(rowText("sda")).toBe("sda");
  });
});

describe("the way into an entry", () => {
  beforeEach(() => {
    mockSystemDevice.mockImplementation((name: string) => ({
      name,
      class: "drive",
      drive: { type: "disk", info: {} },
      block: { size: 64424509440 },
    }));
    mockSystemDevices.mockReturnValue([]);
    mockStagingDevices.mockReturnValue([]);
    mockActions.mockReturnValue([]);
    mockConfig.mockReturnValue(
      config({
        drives: [
          { name: "/dev/sda", partitions: [] },
          { name: "/dev/sdb", partitions: [] },
        ],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"], logicalVolumes: [] }],
      }),
    );
  });

  const renderWithAddress = () =>
    installerRender(
      <>
        <EntriesTable />
        <Address />
      </>,
    );

  it("is the name itself, as a link a reader can copy", async () => {
    const { user } = renderWithAddress();
    await user.click(screen.getByRole("link", { name: "sdb" }));

    expect(screen.getByRole("status").textContent).toBe("device=drives.sdb");
  });

  it("names the group where the group is what the row is about", async () => {
    const { user } = renderWithAddress();
    await user.click(screen.getByRole("link", { name: "system" }));

    expect(screen.getByRole("status").textContent).toBe("device=volumeGroups.system");
  });

  it("leaves the rest of the row to the name's link, with no handler of its own", async () => {
    /* The whole row opens through the link stretched over it, which is drawn
       by the stylesheet and so cannot be clicked here. What can be checked is
       that nothing else listens: a row handler is what would need its own
       keyboard model. */
    const { user } = renderWithAddress();
    const row = within(table()).getByRole("row", { name: /^sda/ });
    await user.click(within(row).getAllByRole("cell")[0]);

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("leaves the row's menu to the menu, rather than opening both", async () => {
    const { user } = renderWithAddress();
    await user.click(screen.getByRole("button", { name: "Actions for sda" }));

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("marks the entry whose panel is open", async () => {
    const { user } = renderWithAddress();
    await user.click(screen.getByRole("link", { name: "sdb" }));

    expect(screen.getByRole("link", { name: "sdb" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "sda" })).not.toHaveAttribute("aria-current");
  });

  it("keeps a tab stop for every name and every menu", async () => {
    const { user } = installerRender(<EntriesTable />);
    await user.tab();
    expect(screen.getByRole("link", { name: "system" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Actions for system" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("link", { name: "sda" })).toHaveFocus();
  });

  it("walks the entries with the arrow keys, without taking their tab stops", async () => {
    const { user } = installerRender(<EntriesTable />);
    screen.getByRole("link", { name: "system" }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("link", { name: "sda" })).toHaveFocus();

    await user.keyboard("{End}");
    expect(screen.getByRole("link", { name: "sdb" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("link", { name: "system" })).toHaveFocus();
  });

  it("moves between an entry's name and its menu with the side arrows", async () => {
    const { user } = installerRender(<EntriesTable />);
    screen.getByRole("link", { name: "sda" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("button", { name: "Actions for sda" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("link", { name: "sda" })).toHaveFocus();
  });

  it("is also the menu's first offer, for a reader who never tries the name", async () => {
    const { user } = installerRender(<EntriesTable />);
    await user.click(screen.getByRole("button", { name: "Actions for sda" }));

    /* Named in full where the item is heard on its own, and read as the verb
       alone on screen, where the row it hangs off says which entry this is. */
    expect(screen.getByRole("menuitem", { name: "Configure sda" })).toHaveTextContent(
      /^Configure$/,
    );
  });

  it("says what kind of thing a volume group is, whose name alone does not", async () => {
    const { user } = installerRender(<EntriesTable />);
    await user.click(screen.getByRole("button", { name: "Actions for system" }));

    expect(
      screen.getByRole("menuitem", { name: "Configure system LVM volume group" }),
    ).toHaveTextContent(/^Configure$/);
  });
});

describe("what a row offers", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(null);
    mockSystemDevices.mockReturnValue([]);
    mockStagingDevices.mockReturnValue([]);
    mockActions.mockReturnValue([]);
  });

  /** Opens the menu of the row for the given entry. */
  const openMenu = async (user: ReturnType<typeof installerRender>["user"], name: string) => {
    await user.click(screen.getByRole("button", { name: `Actions for ${name}` }));
  };

  it("names each menu after the entry it acts on", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }] }));
    installerRender(<EntriesTable />);

    screen.getByRole("button", { name: "Actions for sda" });
    screen.getByRole("button", { name: "Actions for sdb" });
  });

  it("offers a disk another device, a volume group, and a way out of the plan", async () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda", partitions: [] }, { name: "/dev/sdb" }, { name: "/dev/sdc" }],
      }),
    );
    const { user } = installerRender(<EntriesTable />);
    await openMenu(user, "sda");

    screen.getByRole("menuitem", { name: /Use another device/ });
    screen.getByRole("menuitem", { name: /Create LVM volume group on sda/ });
    screen.getByRole("menuitem", { name: /Do not use this device/ });
  });

  it("does not offer to drop the only device, which would leave nowhere to install", async () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda", partitions: [] }] }));
    const { user } = installerRender(<EntriesTable />);
    await openMenu(user, "sda");

    screen.getByRole("menuitem", { name: /Use another device/ });
    expect(screen.queryByRole("menuitem", { name: /Do not use/ })).not.toBeInTheDocument();
  });

  it("offers a volume group being defined the way it is defined, and a way out", async () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda", partitions: [] }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"] }],
      }),
    );
    const { user } = installerRender(<EntriesTable />);
    await openMenu(user, "system");

    screen.getByRole("menuitem", { name: /Edit the volume group/ });
    screen.getByRole("menuitem", { name: /Do not use/ });
  });
});

describe("when an act cannot be carried out", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(null);
    mockSystemDevices.mockReturnValue([]);
    mockStagingDevices.mockReturnValue([]);
    mockActions.mockReturnValue([]);
  });

  const openMenu = async (user: ReturnType<typeof installerRender>["user"], name: string) => {
    await user.click(screen.getByRole("button", { name: `Actions for ${name}` }));
  };

  it("keeps the act's own name, and says what would have to change first", async () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda", partitions: [] }, { name: "/dev/sdb" }, { name: "/dev/sdc" }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"] }],
      }),
    );
    const { user } = installerRender(<EntriesTable />);
    await openMenu(user, "sda");

    /* The reason is read out with the act rather than beside it, since
       PatternFly puts a menu item's description inside the item's own control.
       So it needs no `aria-describedby`, and adding one would say it twice. */
    screen.getByRole("menuitem", {
      name: /Use another device.*The LVM volume group 'system' is built on this device\./,
    });
  });

  it("leaves the act reachable, rather than skipping past the reason", async () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda", partitions: [] }, { name: "/dev/sdb" }, { name: "/dev/sdc" }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"] }],
      }),
    );
    const { user } = installerRender(<EntriesTable />);
    await openMenu(user, "sda");

    const item = screen.getByRole("menuitem", { name: /Use another device/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).not.toBeDisabled();
  });

  it("says what holds a reused file system in place", async () => {
    mockConfig.mockReturnValue(
      config({
        drives: [
          { name: "/dev/sda", partitions: [], filesystem: { default: false, reuse: true } },
          { name: "/dev/sdb" },
          { name: "/dev/sdc" },
        ],
      }),
    );
    const { user } = installerRender(<EntriesTable />);
    await openMenu(user, "sda");

    screen.getByRole("menuitem", {
      name: /Its file system is being kept as it is, and a file system cannot be moved\./,
    });
  });

  it("offers the act plainly where nothing holds the plan here", async () => {
    mockConfig.mockReturnValue(
      config({ drives: [{ name: "/dev/sda", partitions: [{ mountPath: "/" }] }] }),
    );
    const { user } = installerRender(<EntriesTable />);
    await openMenu(user, "sda");

    const item = screen.getByRole("menuitem", { name: /Use another device/ });
    expect(item).not.toHaveAttribute("aria-disabled", "true");
  });
});

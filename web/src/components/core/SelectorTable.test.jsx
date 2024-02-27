/*
 * Copyright (c) [2024] SUSE LLC
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

import React from "react";
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { SelectorTable } from "~/components/core";

const sda = {
  sid: "59",
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  busId: "",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/sda",
  size: 1024,
  recoverableSize: 0,
  systems : [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

const sda1 = {
  sid: "60",
  isDrive: false,
  type: "",
  active: true,
  name: "/dev/sda1",
  size: 512,
  recoverableSize: 128,
  systems : [],
  udevIds: [],
  udevPaths: []
};

const sda2 = {
  sid: "61",
  isDrive: false,
  type: "",
  active: true,
  name: "/dev/sda2",
  size: 512,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

sda.partitionTable = {
  type: "gpt",
  partitions: [sda1, sda2],
  unpartitionedSize: 512
};

const lv1 = {
  sid: "163",
  name: "/dev/custom/vg/lv1",
  content: "Personal Data"
};

const vg = {
  sid: "162",
  type: "vg",
  name: "/dev/custom/vg",
  lvs: [
    lv1
  ]
};

const columns = [
  { name: "Device", value: (item) => item.name },
  {
    name: "Content",
    value: (item) => {
      if (item.isDrive) return item.systems.map((s, i) => <p key={i}>{s}</p>);
      if (item.type === "vg") return "";

      return item.content;
    }
  },
  { name: "Size", value: (item) => item.size },
];

const devices = [sda, vg];

describe("SelectorTable", () => {
  it("renders a table with given name", () => {
    plainRender(<SelectorTable aria-label="Single device selection" />);
    screen.getByRole("grid", { name: "Single device selection" });
  });

  it("renders the table headers", () => {
    plainRender(<SelectorTable columns={columns} />);
    const table = screen.getByRole("grid");
    within(table).getByRole("columnheader", { name: "Device" });
    within(table).getByRole("columnheader", { name: "Content" });
    within(table).getByRole("columnheader", { name: "Size" });
  });

  it("renders a row per given item", () => {
    plainRender(
      <SelectorTable columns={columns} items={devices} />
    );
    const table = screen.getByRole("grid");
    within(table).getByRole("row", { name: /dev\/sda 1024/ });
    within(table).getByRole("row", { name: /dev\/custom\/vg/ });
  });

  it("renders a radio per row when not mounted as multiple", () => {
    plainRender(
      <SelectorTable columns={columns} items={devices} />
    );
    const table = screen.getByRole("grid");
    const sda = within(table).getByRole("row", { name: /dev\/sda 1024/ });
    const lv = within(table).getByRole("row", { name: /dev\/custom\/vg/ });
    [sda, lv].forEach((row) => within(row).getByRole("radio"));
  });

  it("renders a checkbox selector per row when mounted as multiple", () => {
    plainRender(
      <SelectorTable columns={columns} items={devices} isMultiple />
    );
    const table = screen.getByRole("grid");
    const sda = within(table).getByRole("row", { name: /dev\/sda 1024/ });
    const lv = within(table).getByRole("row", { name: /dev\/custom\/vg/ });
    [sda, lv].forEach((row) => within(row).getByRole("checkbox"));
  });

  it("uses id for checking if item is expanded when itemIdKey prop is not given", () => {
    plainRender(
      <SelectorTable
        items={devices}
        columns={columns}
        initialExpandedItems={["/dev/sda"]}
        itemChildrenPaths={["partitionTable.partitions", "lvs"]}
      />
    );

    const table = screen.getByRole("grid");
    const sdaChild = within(table).queryByRole("row", { name: /dev\/sda1 512/ });
    expect(sdaChild).toBeNull();
  });

  it("uses given itemIdKey prop for checking if is expanded", () => {
    plainRender(
      <SelectorTable
        items={devices}
        columns={columns}
        itemIdKey="name"
        initialExpandedItems={["/dev/sda"]}
        itemChildrenPaths={["partitionTable.partitions", "lvs"]}
      />
    );

    const table = screen.getByRole("grid");
    const sdaChild = within(table).queryByRole("row", { name: /dev\/sda1 512/ });
    expect(sdaChild).not.toBeNull();
  });

  // TODO: make below unit test work. Even though in manual testing seems to
  // work, RTL complains about not being able to find an accessible checkbox
  // element
  it.skip("renders as selected item(s) matching selected prop", async () => {
    plainRender(
      <SelectorTable
        columns={columns}
        items={devices}
        itemChildrenPaths={["partitionTable.partitions", "lvs"]}
        initialExpandedItems={["/dev/sda", "/dev/custom/vg"]}
        selected={[sda1, lv1]}
        isMultiple
      />
    );
    const table = screen.getByRole("grid");
    const selection = await screen.getAllByRole("checkbox", { checked: true });
    const sda1Row = within(table).getByRole("row", { name: /dev\/sda1/ });
    const lv1Row = within(table).getByRole("row", { name: /Personal Data/ });
    [sda1Row, lv1Row].forEach(row => within(row).getByRole("checkbox", { checked: true }));
    expect(selection.length).toEqual(2);
  });

  describe("when initialExpandedItems is given", () => {
    it("renders expanded items whose itemIdKey matches with one of given values", () => {
      plainRender(
        <SelectorTable
          columns={columns}
          items={devices}
          itemIdKey="name"
          initialExpandedItems={["/dev/sda"]}
          itemChildrenPaths={["partitionTable.partitions", "lvs"]}
        />
      );

      const table = screen.getByRole("grid");
      within(table).getByRole("row", { name: /dev\/sda1 512/ });
      within(table).getByRole("row", { name: /dev\/sda2 512/ });
    });
  });

  describe("when path to children is given", () => {
    describe("but it is not valid", () => {
      it("render items without toggler", () => {
        plainRender(
          <SelectorTable columns={columns} items={devices} itemChildrenPaths="wrong.path" />
        );
        const table = screen.getByRole("grid");
        const sdaRow = within(table).getByRole("row", { name: /dev\/sda 1024/ });
        const sdaChildrenToggler = within(sdaRow).queryByRole("button", { name: "Details" });
        expect(sdaChildrenToggler).toBeNull();
      });
    });

    describe("but it does not provide content", () => {
      it("render items without toggler", () => {
        plainRender(
          <SelectorTable columns={columns} items={devices} itemChildrenPaths="systems" />
        );
        const table = screen.getByRole("grid");
        const sdaRow = within(table).getByRole("row", { name: /dev\/sda 1024/ });
        const sdaChildrenToggler = within(sdaRow).queryByRole("button", { name: "Details" });
        expect(sdaChildrenToggler).toBeNull();
      });
    });

    describe("but it does not provide an Array", () => {
      it("render items without toggler", () => {
        plainRender(
          <SelectorTable columns={columns} items={devices} itemChildrenPaths="model" />
        );
        const table = screen.getByRole("grid");
        const sdaRow = within(table).getByRole("row", { name: /dev\/sda 1024/ });
        const sdaChildrenToggler = within(sdaRow).queryByRole("button", { name: "Details" });
        expect(sdaChildrenToggler).toBeNull();
      });
    });

    describe("and children are found", () => {
      it("renders a toggler in parent", () => {
        plainRender(
          <SelectorTable columns={columns} items={devices} itemChildrenPaths="partitionTable.partitions" />
        );
        const table = screen.getByRole("grid");
        const sdaRow = within(table).getByRole("row", { name: /dev\/sda 1024/ });
        const lvRow = within(table).getByRole("row", { name: /dev\/custom\/vg/ });

        within(sdaRow).getByRole("button", { name: "Details" });
        // NOTE above that path for LV children was not given,
        const lvChildrenToggler = within(lvRow).queryByRole("button", { name: "Details" });
        expect(lvChildrenToggler).toBeNull();
      });

      it("renders children", async () => {
        const { user } = plainRender(
          <SelectorTable
            columns={columns}
            items={devices}
            itemChildrenPaths={["partitionTable.partitions", "lvs"]}
          />
        );
        const table = screen.getByRole("grid");
        const sdaRow = within(table).getByRole("row", { name: /dev\/sda 1024/ });
        const sdaChildrenToggler = within(sdaRow).getByRole("button", { name: "Details" });
        const lvRow = within(table).getByRole("row", { name: /dev\/custom\/vg$/ });
        const lvChildrenToggler = within(lvRow).getByRole("button", { name: "Details" });

        await user.click(sdaChildrenToggler);
        await user.click(lvChildrenToggler);

        within(table).getByRole("row", { name: /dev\/sda1 512/ });
        within(table).getByRole("row", { name: /dev\/sda2 512/ });
        within(table).getByRole("row", { name: /dev\/custom\/vg\/lv1/ });
      });
    });
  });
});

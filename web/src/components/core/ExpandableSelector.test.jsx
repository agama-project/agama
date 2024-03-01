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
import { ExpandableSelector } from "~/components/core";

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

const sdb = {
  sid: "62",
  isDrive: true,
  type: "disk",
  vendor: "Samsung",
  model: "Samsung Evo 8 Pro",
  driver: ["ahci"],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/sdb",
  size: 2048,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

const lv1 = {
  sid: "163",
  name: "/dev/system/vg/lv1",
  content: "Personal Data"
};

const vg = {
  sid: "162",
  type: "vg",
  name: "/dev/system/vg",
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
      if (item.type === "vg") return `${item.lvs.length} logical volume(s)`;

      return item.content;
    }
  },
  { name: "Size", value: (item) => item.size },
];

const onChangeFn = jest.fn();

let props;
const commonProps = {
  columns,
  items: [sda, sdb, vg],
  itemIdKey: "sid",
  initialExpandedKeys: [sda.sid, vg.sid],
  itemChildren: (item) => (
    item.isDrive ? item.partitionTable?.partitions : item.lvs
  ),
  onSelectionChange: onChangeFn,
  "aria-label": "Device selector"
};

describe("ExpandableSelector", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation();
  });

  afterAll(() => {
    console.error.mockRestore();
  });

  beforeEach(() => {
    props = { ...commonProps };
  });

  it("renders a table with given name", () => {
    plainRender(<ExpandableSelector {...props} />);
    screen.getByRole("grid", { name: "Device selector" });
  });

  it("renders the table headers", () => {
    plainRender(<ExpandableSelector {...props} />);
    const table = screen.getByRole("grid");
    within(table).getByRole("columnheader", { name: "Device" });
    within(table).getByRole("columnheader", { name: "Content" });
    within(table).getByRole("columnheader", { name: "Size" });
  });

  it("renders a rowgroup per parent item", () => {
    plainRender(<ExpandableSelector {...props} />);
    const groups = screen.getAllByRole("rowgroup");
    // NOTE: since <thead> has also the rowgroup role, we expect to found 4 in
    // this example: 1 thead + 3 tbody (sda, sdb, vg)
    expect(groups.length).toEqual(4);
  });

  it("renders a row per given item and found children", () => {
    plainRender(<ExpandableSelector {...props} />);
    const table = screen.getByRole("grid");
    within(table).getByRole("row", { name: /dev\/sda 1024/ });
    within(table).getByRole("row", { name: /dev\/sdb 2048/ });
    within(table).getByRole("row", { name: /dev\/system\/vg 1 logical/ });
    within(table).getByRole("row", { name: /dev\/sda1 512/ });
    within(table).getByRole("row", { name: /dev\/sda2 512/ });
    within(table).getByRole("row", { name: /Personal Data/ });
  });

  it("renders a expand toggler in items with children", () => {
    plainRender(<ExpandableSelector {...props} />);
    const table = screen.getByRole("grid");
    const sdaRow = within(table).getByRole("row", { name: /dev\/sda 1024/ });
    const sdbRow = within(table).getByRole("row", { name: /dev\/sdb 2048/ });
    const lvRow = within(table).getByRole("row", { name: /dev\/system\/vg 1 logical/ });

    within(sdaRow).getByRole("button", { name: "Details" });
    within(lvRow).getByRole("button", { name: "Details" });
    // `/dev/sdb` does not have children, toggler must not be there
    const sdbChildrenToggler = within(sdbRow).queryByRole("button", { name: "Details" });
    expect(sdbChildrenToggler).toBeNull();
  });

  it("renders as expanded items which value for `itemIdKey` is included in `initialExpandedKeys` prop", () => {
    plainRender(
      <ExpandableSelector {...props} itemIdKey="name" initialExpandedKeys={["/dev/sda"]} />
    );
    const table = screen.getByRole("grid");
    within(table).getByRole("row", { name: /dev\/sda1 512/ });
    within(table).getByRole("row", { name: /dev\/sda2 512/ });
  });

  it("keeps track of expanded items", async () => {
    const { user } = plainRender(
      <ExpandableSelector {...props} itemIdKey="name" initialExpandedKeys={["/dev/sda"]} />
    );
    const table = screen.getByRole("grid");
    const sdaRow = within(table).getByRole("row", { name: /sda 1024/ });
    const sdaToggler = within(sdaRow).getByRole("button", { name: "Details" });
    const vgRow = within(table).getByRole("row", { name: /vg 1 logical/ });
    const vgToggler = within(vgRow).getByRole("button", { name: "Details" });

    within(table).getByRole("row", { name: /dev\/sda1 512/ });
    within(table).getByRole("row", { name: /dev\/sda2 512/ });

    await user.click(vgToggler);

    within(table).getByRole("row", { name: /Personal Data/ });

    await user.click(sdaToggler);
    const sdaPartitionsRows = within(table).queryAllByRole("row", { name: /sda[d] 512/ });
    expect(sdaPartitionsRows.length).toEqual(0);
  });

  it("uses 'id' as key when `itemIdKey` prop is not given", () => {
    plainRender(
      <ExpandableSelector {...props} itemIdKey={undefined} />
    );

    const table = screen.getByRole("grid");
    // Since itemIdKey does not match the id used for the item, they are
    // collapsed by default and their children are not visible
    const sdaChild = within(table).queryByRole("row", { name: /dev\/sda1 512/ });
    expect(sdaChild).toBeNull();
  });

  it("uses given `itemIdKey` as key", () => {
    plainRender(
      <ExpandableSelector {...props} itemIdKey="name" initialExpandedKeys={["/dev/sda"]} />
    );

    const table = screen.getByRole("grid");
    // Since itemIdKey === "name", "/dev/sda" is properly mounted as expanded. Its
    // children must be visible
    const sdaChild = within(table).queryByRole("row", { name: /dev\/sda1 512/ });
    expect(sdaChild).not.toBeNull();
  });

  describe("when `itemsSelected` is given", () => {
    it("renders nothing as checked if value is an empty array", () => {
      plainRender(<ExpandableSelector {...props} itemsSelected={[]} />);
      const table = screen.getByRole("grid");
      const selection = within(table).queryAllByRole("radio", { checked: true });
      expect(selection.length).toEqual(0);
    });

    describe("but it isn't an array", () => {
      it("outputs to console.error", () => {
        plainRender(<ExpandableSelector {...props} itemsSelected="Whatever" />);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("prop must be an array"),
          "Whatever"
        );
      });

      it("renders nothing as selected", () => {
        plainRender(<ExpandableSelector {...props} itemsSelected="Whatever" />);
        const table = screen.getByRole("grid");
        const selection = within(table).queryAllByRole("radio", { checked: true });
        expect(selection.length).toEqual(0);
      });
    });
  });

  describe("when mounted as single selector", () => {
    describe.each([undefined, null, false])("because isMultiple={%s}", (isMultiple) => {
      beforeEach(() => {
        props = { ...props, isMultiple };
      });

      it("renders a radio per item row", () => {
        plainRender(<ExpandableSelector {...props} />);
        const table = screen.getByRole("grid");
        const radios = within(table).getAllByRole("radio");
        expect(radios.length).toEqual(6);
      });

      describe("and `itemsSelected` is given", () => {
        describe("and it is an array with just one item", () => {
          it("renders it as checked", async () => {
            plainRender(<ExpandableSelector {...props} itemsSelected={[sda1]} />);
            const table = screen.getByRole("grid");
            const sda1Row = within(table).getByRole("row", { name: /dev\/sda1/ });
            const selection = screen.getAllByRole("radio", { checked: true });
            expect(selection.length).toEqual(1);
            within(sda1Row).getByRole("radio", { checked: true });
          });
        });

        describe("but it is an array with more than one item", () => {
          it("outputs to console.error", () => {
            plainRender(<ExpandableSelector {...props} itemsSelected={[sda1, lv1]} />);
            expect(console.error).toHaveBeenCalledWith(
              expect.stringContaining("Using only the first element")
            );
          });

          it("renders the first one as checked", async () => {
            plainRender(<ExpandableSelector {...props} itemsSelected={[sda1, lv1]} />);
            const table = screen.getByRole("grid");
            const selection = screen.getAllByRole("radio", { checked: true });
            const sda1Row = within(table).getByRole("row", { name: /dev\/sda1/ });
            const lv1Row = within(table).getByRole("row", { name: /Personal Data/ });
            const lv1Radio = within(lv1Row).getByRole("radio");
            within(sda1Row).getByRole("radio", { checked: true });
            expect(lv1Radio).not.toHaveAttribute("checked", true);
            expect(selection.length).toEqual(1);
          });
        });
      });

      describe("and user selects an already selected item", () => {
        it("does not trigger the `onSelectionChange` callback", async () => {
          const { user } = plainRender(<ExpandableSelector {...props} itemsSelected={[sda1]} />);
          const sda1row = screen.getByRole("row", { name: /dev\/sda1/ });
          const sda1radio = within(sda1row).getByRole("radio");
          await user.click(sda1radio);
          expect(onChangeFn).not.toHaveBeenCalled();
        });
      });

      describe("and user selects a not selected item", () => {
        it("calls the `onSelectionChange` callback with a collection holding only selected item", async () => {
          const { user } = plainRender(<ExpandableSelector {...props} itemsSelected={[sda1]} />);
          const sda2row = screen.getByRole("row", { name: /dev\/sda2/ });
          const sda2radio = within(sda2row).getByRole("radio");
          await user.click(sda2radio);
          expect(onChangeFn).toHaveBeenCalledWith([sda2]);
        });
      });
    });
  });

  describe("when mounted as multiple selector", () => {
    beforeEach(() => {
      props = { ...props, isMultiple: true };
    });

    it("renders a checkbox per item row", () => {
      plainRender(<ExpandableSelector {...props} />);
      const table = screen.getByRole("grid");
      const checkboxes = within(table).getAllByRole("checkbox");
      expect(checkboxes.length).toEqual(6);
    });

    describe("and `itemsSelected` is given", () => {
      it("renders given items as checked", async () => {
        plainRender(<ExpandableSelector {...props} itemsSelected={[sda1, lv1]} />);
        const table = screen.getByRole("grid");
        const selection = screen.getAllByRole("checkbox", { checked: true });
        const sda1Row = within(table).getByRole("row", { name: /dev\/sda1/ });
        const lv1Row = within(table).getByRole("row", { name: /Personal Data/ });
        within(sda1Row).getByRole("checkbox", { checked: true });
        within(lv1Row).getByRole("checkbox", { checked: true });
        expect(selection.length).toEqual(2);
      });
    });

    it("renders initially selected items given via `itemsSelected` prop", async () => {
      plainRender(<ExpandableSelector {...props} isMultiple itemsSelected={[sda1, lv1]} />);
      const table = screen.getByRole("grid");
      const sda1Row = within(table).getByRole("row", { name: /dev\/sda1/ });
      const lv1Row = within(table).getByRole("row", { name: /Personal Data/ });
      const selection = screen.getAllByRole("checkbox", { checked: true });
      expect(selection.length).toEqual(2);
      [sda1Row, lv1Row].forEach(row => within(row).getByRole("checkbox", { checked: true }));
    });

    describe("and user selects an already selected item", () => {
      it("triggers the `onSelectionChange` callback with a collection not including the item", async () => {
        const { user } = plainRender(<ExpandableSelector {...props} itemsSelected={[sda1, sda2]} />);
        const sda1row = screen.getByRole("row", { name: /dev\/sda1/ });
        const sda1radio = within(sda1row).getByRole("checkbox");
        await user.click(sda1radio);
        expect(onChangeFn).toHaveBeenCalledWith([sda2]);
      });
    });

    describe("and user selects a not selected item", () => {
      it("calls the `onSelectionChange` callback with a collection including the item", async () => {
        const { user } = plainRender(<ExpandableSelector {...props} itemsSelected={[sda1]} />);
        const sda2row = screen.getByRole("row", { name: /dev\/sda2/ });
        const sda2checkbox = within(sda2row).getByRole("checkbox");
        await user.click(sda2checkbox);
        expect(onChangeFn).toHaveBeenCalledWith([sda1, sda2]);
      });
    });
  });
});

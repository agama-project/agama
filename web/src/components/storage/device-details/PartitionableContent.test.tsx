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
import { installerRender } from "~/test-utils";
import configModel from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";
import type { Partitionable } from "~/model/storage/config-model";
import PartitionableContent from "~/components/storage/device-details/PartitionableContent";

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => ({ drives: [{ name: "/dev/vdc" }] }),
  useDeletePartition: () => jest.fn(),
  useDeleteLogicalVolume: () => jest.fn(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => [],
}));

const mockUsers = jest.fn().mockReturnValue([]);

jest.mock("~/components/storage/shared/users", () => ({
  ...jest.requireActual("~/components/storage/shared/users"),
  usersOf: () => mockUsers(),
}));

const disk = (partitions: Partitionable.Device["partitions"] = []): Entry => ({
  config: { name: "/dev/vdc", partitions } as Partitionable.Device,
  device: undefined,
  name: "vdc",
  isVolumeGroup: false,
});

const withHome = disk([{ mountPath: "/home", size: { default: false, min: 5 * 1024 ** 3 } }]);

const subject = { collection: "drives" as const, index: 0 };

const lvmSentence = "New partitions may be added as LVM physical volumes for system.";
const bootSentence = "Additional partitions to boot the system may be created if needed.";
const tableName = "Planned content";

describe("PartitionableContent", () => {
  afterEach(() => {
    mockUsers.mockReturnValue([]);
    jest.restoreAllMocks();
  });

  it("shows the table of partitions alone when the disk has no other role", () => {
    installerRender(<PartitionableContent entry={withHome} subject={subject} />);

    screen.getByRole("table", { name: tableName });
    screen.getByRole("link", { name: "Add partition" });
    expect(screen.queryByText(bootSentence)).toBeNull();
  });

  describe("on a disk a volume group takes room from", () => {
    beforeEach(() => mockUsers.mockReturnValue([{ name: "system" }]));

    it("says so in a paragraph rather than a list item, and offers adding partitions", () => {
      installerRender(<PartitionableContent entry={disk()} subject={subject} />);

      expect(screen.getByRole("paragraph")).toHaveTextContent(lvmSentence);
      expect(screen.queryByRole("list")).toBeNull();
      screen.getByRole("link", { name: "Add partition" });
      expect(screen.queryByRole("link", { name: "Change boot options" })).toBeNull();
    });

    it("says so after the table of partitions", () => {
      installerRender(<PartitionableContent entry={withHome} subject={subject} />);

      const table = screen.getByRole("table", { name: tableName });
      const sentence = screen.getByText(lvmSentence);
      expect(table.compareDocumentPosition(sentence)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe("on a disk the system boots from", () => {
    beforeEach(() => jest.spyOn(configModel.boot, "hasDevice").mockReturnValue(true));

    it("says so and offers adding partitions and changing the boot options", () => {
      installerRender(<PartitionableContent entry={disk()} subject={subject} />);

      screen.getByText(bootSentence);
      screen.getByRole("link", { name: "Add partition" });
      screen.getByRole("link", { name: "Change boot options" });
    });

    it("says so after the table of partitions, with the same ways to act", () => {
      installerRender(<PartitionableContent entry={withHome} subject={subject} />);

      const table = screen.getByRole("table", { name: tableName });
      const sentence = screen.getByText(bootSentence);
      expect(table.compareDocumentPosition(sentence)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      screen.getByRole("link", { name: "Add partition" });
      screen.getByRole("link", { name: "Change boot options" });
    });
  });

  it("puts the table first, then the LVM and boot sentences", () => {
    mockUsers.mockReturnValue([{ name: "system" }]);
    jest.spyOn(configModel.boot, "hasDevice").mockReturnValue(true);
    installerRender(<PartitionableContent entry={withHome} subject={subject} />);

    const table = screen.getByRole("table", { name: tableName });
    const lvm = screen.getByText(lvmSentence);
    const boot = screen.getByText(bootSentence);
    expect(table.compareDocumentPosition(lvm)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(lvm.compareDocumentPosition(boot)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("never says partitions can be added in a sentence of its own", () => {
    mockUsers.mockReturnValue([{ name: "system" }]);
    installerRender(<PartitionableContent entry={disk()} subject={subject} />);

    expect(screen.queryByText(/can be explicitly defined/)).toBeNull();
  });
});

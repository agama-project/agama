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
import { plainRender } from "~/test-utils";
import type { Storage as System } from "~/model/system";
import type { Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";
import ExistingContent from "~/components/storage/device-details/ExistingContent";

const mockSystemDevices = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => mockSystemDevices(),
}));

const disk = (values: Partial<System.Device> = {}): System.Device => ({
  sid: 1,
  name: "/dev/vdd",
  class: "drive",
  ...values,
});

const entry = (device: System.Device): Entry => ({
  config: { name: "/dev/vdd" } as Partitionable.Device,
  device,
  name: "vdd",
  isVolumeGroup: false,
});

describe("ExistingContent", () => {
  beforeEach(() => {
    mockSystemDevices.mockReturnValue([]);
  });

  describe("when the device holds a file system", () => {
    const device = disk({ filesystem: { sid: 2, type: "ext4" } });

    it("names it", () => {
      plainRender(<ExistingContent entry={entry(device)} />);

      screen.getByText("Ext4 file system.");
      expect(screen.queryByRole("strong")).toBeNull();
    });

    it("says it is deleted when the installation deletes it", () => {
      plainRender(<ExistingContent entry={entry(device)} isDeleted />);

      expect(screen.getByRole("paragraph")).toHaveTextContent(
        "Ext4 file system: it will be deleted and its data lost.",
      );
      expect(screen.getByRole("strong")).toHaveTextContent("it will be deleted and its data lost");
    });
  });

  describe("when the device belongs to an LVM volume group", () => {
    beforeEach(() => {
      mockSystemDevices.mockReturnValue([
        { sid: 9, name: "/dev/system", volumeGroup: { size: 1, physicalVolumes: [1] } },
      ]);
    });

    it("names the group", () => {
      plainRender(<ExistingContent entry={entry(disk())} />);

      screen.getByText(/LVM physical volume for the volume group .*system/);
    });

    it("says the group goes when the installation deletes it", () => {
      plainRender(<ExistingContent entry={entry(disk())} isDeleted />);

      expect(screen.getByRole("strong")).toHaveTextContent(
        /^the whole volume group .*system.* will be deleted and its data lost$/,
      );
    });
  });

  describe("when the device belongs to a RAID", () => {
    beforeEach(() => {
      mockSystemDevices.mockReturnValue([
        { sid: 8, name: "/dev/md0", md: { level: "raid1", devices: [1] } },
      ]);
    });

    it("names the RAID", () => {
      plainRender(<ExistingContent entry={entry(disk())} />);

      screen.getByText(/Part of the RAID .*md0/);
    });

    it("says the RAID goes when the installation deletes it", () => {
      plainRender(<ExistingContent entry={entry(disk())} isDeleted />);

      expect(screen.getByRole("strong")).toHaveTextContent(
        /^the whole RAID .*md0.* will be deleted and its data lost$/,
      );
    });
  });

  it("says nothing was found on an empty device", () => {
    plainRender(<ExistingContent entry={entry(disk())} />);

    screen.getByText("No content detected.");
  });
});

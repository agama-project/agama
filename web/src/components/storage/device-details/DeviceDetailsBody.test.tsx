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
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import type { Entry } from "~/components/storage/device-details/entry";
import DeviceDetailsBody from "~/components/storage/device-details/DeviceDetailsBody";

const mockHasCurrentContent = jest.fn();
const mockConfig = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

/* The sections have their own tests; here only which ones the panel shows. */
jest.mock("~/components/storage/device-details/CurrentContentSection", () => ({
  __esModule: true,
  default: () => <p>current content table</p>,
  hasCurrentContent: () => mockHasCurrentContent(),
}));
jest.mock("~/components/storage/device-details/ExistingContent", () => () => (
  <p>existing content</p>
));
jest.mock("~/components/storage/device-details/PropertiesSection", () => () => <p>properties</p>);
jest.mock("~/components/storage/device-details/PartitionableContent", () => () => (
  <p>partitions</p>
));
jest.mock("~/components/storage/device-details/PartitionableNoContent", () => () => <p>usage</p>);
jest.mock("~/components/storage/device-details/PartitionableMountContent", () => () => (
  <p>file system</p>
));
jest.mock("~/components/storage/device-details/VolumeGroupContent", () => () => (
  <p>logical volumes</p>
));

const subject = { collection: "drives" as const, index: 0 };

const diskEntry = (
  config: Partial<Partitionable.Device> = {},
  device: Partial<Storage.Device> = {},
): Entry => ({
  config: { name: "/dev/vda", ...config } as Partitionable.Device,
  device: { name: "/dev/vda", ...device } as Storage.Device,
  name: "vda",
  isVolumeGroup: false,
});

const groupEntry = (config: Partial<ConfigModel.VolumeGroup> = {}): Entry => ({
  config: { vgName: "system", ...config } as ConfigModel.VolumeGroup,
  device: null,
  name: "system",
  isVolumeGroup: true,
});

const headings = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("DeviceDetailsBody", () => {
  beforeEach(() => {
    mockHasCurrentContent.mockReturnValue(false);
    mockConfig.mockReturnValue({ drives: [{ name: "/dev/vda" }] });
  });

  describe("for a volume group the installation creates", () => {
    it("shows its properties and its logical volumes", () => {
      plainRender(<DeviceDetailsBody entry={groupEntry()} subject={subject} />);

      expect(headings()).toEqual(["Properties", "Logical volumes"]);
    });
  });

  describe("for an existing volume group", () => {
    it("shows the planned and the current logical volumes", () => {
      mockHasCurrentContent.mockReturnValue(true);
      plainRender(<DeviceDetailsBody entry={groupEntry({ name: "system" })} subject={subject} />);

      expect(headings()).toEqual(["Logical volumes for the new system", "Current logical volumes"]);
      screen.getByText("current content table");
    });

    it("says when it holds no logical volumes", () => {
      plainRender(<DeviceDetailsBody entry={groupEntry({ name: "system" })} subject={subject} />);

      expect(headings()).toEqual(["Logical volumes for the new system", "Current logical volumes"]);
      screen.getByText("No logical volumes detected.");
    });
  });

  describe("for a disk used whole by a file system", () => {
    it("shows only the file system when it is reused", () => {
      const entry = diskEntry({ mountPath: "/home", filesystem: { reuse: true, default: false } });
      plainRender(<DeviceDetailsBody entry={entry} subject={subject} />);

      expect(headings()).toEqual(["File system"]);
    });

    it("shows the partitions it deletes when it is formatted", () => {
      mockHasCurrentContent.mockReturnValue(true);
      const entry = diskEntry({ mountPath: "/home", filesystem: { reuse: false, default: false } });
      plainRender(<DeviceDetailsBody entry={entry} subject={subject} />);

      expect(headings()).toEqual(["File system", "Current partitions"]);
    });

    it("shows the content it deletes when it is formatted and has no partitions", () => {
      const entry = diskEntry({ mountPath: "/home", filesystem: { reuse: false, default: false } });
      plainRender(<DeviceDetailsBody entry={entry} subject={subject} />);

      expect(headings()).toEqual(["File system", "Current content"]);
    });
  });

  describe("for a disk with partitions for the new system", () => {
    /* A partition mounted on it is what makes the disk used. */
    beforeEach(() =>
      mockConfig.mockReturnValue({
        drives: [{ name: "/dev/vda", partitions: [{ mountPath: "/" }] }],
      }),
    );

    it("shows the planned and the current partitions", () => {
      mockHasCurrentContent.mockReturnValue(true);
      plainRender(<DeviceDetailsBody entry={diskEntry()} subject={subject} />);

      expect(headings()).toEqual(["Partitions for the new system", "Current partitions"]);
    });

    it("shows the current content when the disk has no partitions", () => {
      plainRender(<DeviceDetailsBody entry={diskEntry()} subject={subject} />);

      expect(headings()).toEqual(["Partitions for the new system", "Current content"]);
    });
  });

  describe("for a disk not used yet", () => {
    it("shows only how to use it when it has partitions", () => {
      mockHasCurrentContent.mockReturnValue(true);
      plainRender(<DeviceDetailsBody entry={diskEntry()} subject={subject} />);

      expect(headings()).toEqual(["Usage"]);
    });

    it("shows only how to use it when it holds a file system", () => {
      const entry = diskEntry({}, { filesystem: { type: "ext4" } as Storage.Filesystem });
      plainRender(<DeviceDetailsBody entry={entry} subject={subject} />);

      expect(headings()).toEqual(["Usage"]);
    });

    it("shows how to use it and its current content otherwise", () => {
      plainRender(<DeviceDetailsBody entry={diskEntry()} subject={subject} />);

      expect(headings()).toEqual(["Usage", "Current content"]);
    });
  });
});

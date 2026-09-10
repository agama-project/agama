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

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
  useConvertDevice: () => jest.fn(),
  useConvertPartitionableToVolumeGroup: () => jest.fn(),
  useDeleteDrive: () => jest.fn(),
  useDeleteMdRaid: () => jest.fn(),
  useDeleteVolumeGroup: () => jest.fn(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: () => mockSystemDevice(),
  useAvailableDevices: () => [],
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

describe("StorageSheet", () => {
  beforeEach(() => {
    mockConfig.mockReturnValue(config());
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
    beforeEach(() => {
      mockRoutes("/storage?sheet=drives.0");
    });

    it("opens on it, saying what it is the way its row says it", () => {
      installerRender(<StorageSheet page={page} />);

      screen.getByRole("region", { name: /sda/ });
      screen.getByText(/60 GiB/);
    });

    it("names where the system keeps it, which survives a rename", () => {
      installerRender(<StorageSheet page={page} />);

      screen.getByText("pci-0000:0a:00.0");
    });

    it("offers the same acts its row offers", () => {
      installerRender(<StorageSheet page={page} />);

      screen.getByRole("button", { name: "Actions for sda" });
    });
  });

  describe("when the address names an entry the configuration no longer has", () => {
    beforeEach(() => {
      mockRoutes("/storage?sheet=drives.7");
    });

    it("leaves the reader on the page rather than on a broken panel", () => {
      installerRender(<StorageSheet page={page} />);

      screen.getByText("the storage page");
      expect(sheet()).not.toBeInTheDocument();
    });
  });

  describe("when the address makes no sense at all", () => {
    beforeEach(() => {
      mockRoutes("/storage?sheet=nonsense");
    });

    it("reads as a shut panel, since an address can be edited by hand", () => {
      installerRender(<StorageSheet page={page} />);

      expect(sheet()).not.toBeInTheDocument();
    });
  });

  describe("when the address names the whole picture", () => {
    beforeEach(() => {
      mockRoutes("/storage?sheet=result");
    });

    it("opens on it instead", () => {
      installerRender(<StorageSheet page={page} />);

      screen.getByRole("region", { name: "Result" });
      screen.getByText("everything the installer will do");
    });
  });
});

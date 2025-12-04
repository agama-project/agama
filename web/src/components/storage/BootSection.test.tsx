/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { useAvailableDrives } from "~/hooks/api/system/storage";
import { useModel } from "~/hooks/storage/model";
import { installerRender } from "~/test-utils";
import type { storage } from "~/api/system";

import BootSection from "./BootSection";

jest.mock("~/hooks/api/system/storage");
jest.mock("~/hooks/storage/model");

const useAvailableDrivesMock = useAvailableDrives as jest.Mock;
const useModelMock = useModel as jest.Mock;

const mockSda: storage.Device = {
  sid: 1,
  name: "sda",
  class: "drive",
  block: {
    start: 0,
    size: 536870912000,
    shrinking: { supported: false },
  },
  drive: { type: "disk" },
};

describe("BootSection", () => {
  afterEach(() => {
    useAvailableDrivesMock.mockReset();
    useModelMock.mockReset();
  });

  it("shows the default message when the boot is default", () => {
    useAvailableDrivesMock.mockReturnValue([]);
    useModelMock.mockReturnValue({
      boot: {
        isDefault: true,
        getDevice: () => null,
      },
    });

    installerRender(<BootSection />);

    expect(
      screen.getByText(/Partitions to boot will be set up if needed at the installation disk/),
    ).toBeInTheDocument();
  });

  it("shows the current device when the boot is default", () => {
    useAvailableDrivesMock.mockReturnValue([mockSda]);
    useModelMock.mockReturnValue({
      boot: {
        isDefault: true,
        getDevice: () => mockSda,
      },
    });

    installerRender(<BootSection />);

    expect(
      screen.getByText(/Currently sda \(500 GiB\), based on the location/),
    ).toBeInTheDocument();
  });

  it("shows a specific device when the boot is not default", () => {
    useAvailableDrivesMock.mockReturnValue([mockSda]);
    useModelMock.mockReturnValue({
      boot: {
        isDefault: false,
        getDevice: () => mockSda,
      },
    });

    installerRender(<BootSection />);

    expect(
      screen.getByText(/Partitions to boot will be set up if needed at sda \(500 GiB\)\./),
    ).toBeInTheDocument();
  });

  it("shows that no partition will be configured", () => {
    useAvailableDrivesMock.mockReturnValue([]);
    useModelMock.mockReturnValue({
      boot: {
        isDefault: false,
        getDevice: () => null,
      },
    });

    installerRender(<BootSection />);

    expect(
      screen.getByText(/No partitions will be automatically configured for booting./),
    ).toBeInTheDocument();
  });

  it("shows a link for changing the boot device", () => {
    useAvailableDrivesMock.mockReturnValue([]);
    useModelMock.mockReturnValue({
      boot: {
        isDefault: true,
        getDevice: () => null,
      },
    });

    installerRender(<BootSection />);

    expect(screen.getByRole("link", { name: /Change/ })).toBeInTheDocument();
  });
});

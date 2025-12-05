/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { render, screen } from "@testing-library/react";
import MenuDeviceDescription from "./MenuDeviceDescription";
import {
  typeDescription,
  contentDescription,
  filesystemLabels,
} from "~/components/storage/utils/device";
import type { storage } from "~/api/system";

jest.mock("~/components/storage/utils/device", () => ({
  typeDescription: jest.fn(),
  contentDescription: jest.fn(),
  filesystemLabels: jest.fn(),
}));

const mockTypeDescription = typeDescription as jest.Mock;
const mockContentDescription = contentDescription as jest.Mock;
const mockFilesystemLabels = filesystemLabels as jest.Mock;

describe("MenuDeviceDescription", () => {
  const device: storage.Device = {
    sid: 1,
    name: "sda",
    class: "drive",
  };

  beforeEach(() => {
    mockTypeDescription.mockReturnValue("Drive");
    mockContentDescription.mockReturnValue("1GB");
    mockFilesystemLabels.mockReturnValue([]);
  });

  it("renders type and content descriptions", () => {
    render(<MenuDeviceDescription device={device} />);
    expect(screen.getByText("Drive")).toBeInTheDocument();
    expect(screen.getByText("1GB")).toBeInTheDocument();
  });

  it("renders filesystem labels when available", () => {
    mockFilesystemLabels.mockReturnValue(["ext4", "xfs"]);
    render(<MenuDeviceDescription device={device} />);
    expect(screen.getByText("ext4")).toBeInTheDocument();
    expect(screen.getByText("xfs")).toBeInTheDocument();
  });

  it("does not render filesystem labels when not available", () => {
    render(<MenuDeviceDescription device={device} />);
    expect(screen.queryByText("ext4")).not.toBeInTheDocument();
    expect(screen.queryByText("xfs")).not.toBeInTheDocument();
  });
});

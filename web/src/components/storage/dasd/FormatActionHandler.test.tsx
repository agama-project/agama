/*
 * Copyright (c) [2025-2026] SUSE LLC
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

import type { Device } from "~/model/system/dasd";

import FormatActionHandler from "./FormatActionHandler";

const offlineDasdMock: Device = {
  channel: "0.0.0191",
  active: false,
  deviceName: "",
  formatted: false,
  diag: false,
  status: "offline",
  type: "ECKD",
  accessType: "rw",
  partitionInfo: "1",
};

const onlineDasdMock: Device = {
  channel: "0.0.0160",
  active: true,
  deviceName: "dasda",
  formatted: true,
  diag: false,
  status: "active",
  type: "ECKD",
  accessType: "rw",
  partitionInfo:
    "/dev/dasda1 (Linux native), /dev/dasda2 (Linux native), /dev/dasda3 (Linux native)",
};

const anotherOnlineDasdMock: Device = {
  channel: "0.0.0592",
  active: true,
  deviceName: "dasdk",
  formatted: true,
  diag: false,
  status: "active", // former "read_only"
  type: "ECKD",
  accessType: "rw",
  partitionInfo: "",
};

let consoleErrorSpy: jest.SpyInstance;

describe("DASD/FormatActionHandler", () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error");
    consoleErrorSpy.mockImplementation();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("does nothing and logs an error when devices is empty", () => {
    const { container } = plainRender(
      <FormatActionHandler devices={[]} onFormat={jest.fn()} onClose={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(consoleErrorSpy).toHaveBeenCalledWith("FormatActionHandler called without devices");
  });

  it("renders confirmation for a single online device", () => {
    plainRender(
      <FormatActionHandler devices={[onlineDasdMock]} onFormat={jest.fn()} onClose={jest.fn()} />,
    );
    screen.getByRole("heading", { name: "Format device 0.0.0160", level: 1 });
  });

  it("renders offline warning for a single offline device", () => {
    plainRender(
      <FormatActionHandler devices={[offlineDasdMock]} onFormat={jest.fn()} onClose={jest.fn()} />,
    );
    screen.getByRole("heading", { name: "Cannot format 0.0.0191", level: 1 });
    screen.getByText(/It is offline/i);
  });

  it("renders offline list warning for multiple devices with one offline", () => {
    plainRender(
      <FormatActionHandler
        devices={[onlineDasdMock, offlineDasdMock]}
        onFormat={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    screen.getByRole("heading", { name: /Cannot format all the selected devices/, level: 1 });
    screen.getByText(/devices are offline/i);
    screen.getByText(/191/i);
  });

  it("renders bulk confirmation for multiple online devices", () => {
    plainRender(
      <FormatActionHandler
        devices={[onlineDasdMock, anotherOnlineDasdMock]}
        onFormat={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    screen.getByText("Format selected devices?");
    screen.getByText(/destroy any data stored on the devices/);
    screen.getByText(/0\.0\.0160/);
    screen.getByText(/0\.0\.0592/);
  });

  it("calls onFormat and onClose on user confirmation", async () => {
    const onFormat = jest.fn();
    const onClose = jest.fn();
    const { user } = plainRender(
      <FormatActionHandler devices={[onlineDasdMock]} onFormat={onFormat} onClose={onClose} />,
    );
    await user.click(screen.getByRole("button", { name: "Format now" }));
    expect(onFormat).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when user cancels", async () => {
    const onFormat = jest.fn();
    const onClose = jest.fn();
    const { user } = plainRender(
      <FormatActionHandler devices={[onlineDasdMock]} onFormat={onFormat} onClose={onClose} />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onFormat).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

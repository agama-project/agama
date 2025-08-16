/*
 * Copyright (c) [2025] SUSE LLC
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
import FormatActionHandler from "./FormatActionHandler";

const formatDASDMutationMock = jest.fn();

jest.mock("~/queries/storage/dasd", () => ({
  useFormatDASDMutation: () => ({
    mutate: formatDASDMutationMock,
  }),
}));

const offlineDasdMock = {
  id: "0.0.0191",
  enabled: false,
  deviceName: "",
  formatted: false,
  diag: false,
  status: "offline",
  deviceType: "ECKD",
  accessType: "rw",
  partitionInfo: "1",
  hexId: 401,
};

const onlineDasdMock = {
  id: "0.0.0160",
  enabled: true,
  deviceName: "dasda",
  formatted: true,
  diag: false,
  status: "active",
  deviceType: "ECKD",
  accessType: "rw",
  partitionInfo:
    "/dev/dasda1 (Linux native), /dev/dasda2 (Linux native), /dev/dasda3 (Linux native)",
  hexId: 352,
};

const anotherOnlineDasdMock = {
  id: "0.0.0592",
  enabled: true,
  deviceName: "dasdk",
  formatted: true,
  diag: false,
  status: "read_only",
  deviceType: "ECKD",
  accessType: "rw",
  partitionInfo: "",
  hexId: 1426,
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
    const { container } = plainRender(<FormatActionHandler devices={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(consoleErrorSpy).toHaveBeenCalledWith("FormatActionHnalder called without devices");
  });

  it("shows confirmation for a single online device", () => {
    plainRender(<FormatActionHandler devices={[onlineDasdMock]} />);
    screen.getByRole("heading", { name: "Format device 0.0.0160", level: 1 });
  });

  it("shows offline warning for a single offline device", () => {
    plainRender(<FormatActionHandler devices={[offlineDasdMock]} />);
    screen.getByRole("heading", { name: "Cannot format 0.0.0191", level: 1 });
    screen.getByText(/It is offline/i);
  });

  it("shows offline list warning for multiple devices with one offline", () => {
    plainRender(<FormatActionHandler devices={[onlineDasdMock, offlineDasdMock]} />);
    screen.getByRole("heading", { name: /Cannot format all the selected devices/, level: 1 });
    screen.getByText(/devices are offline/i);
    screen.getByText(/191/i);
  });

  it("shows bulk confirmation for multiple online devices", () => {
    plainRender(<FormatActionHandler devices={[onlineDasdMock, anotherOnlineDasdMock]} />);
    screen.getByText("Format selected devices?");
    screen.getByText(/destroy any data stored on the devices/);
    screen.getByText(onlineDasdMock.id);
    screen.getByText(anotherOnlineDasdMock.id);
  });

  it("calls formatDASD and onAccept on user confirmation", async () => {
    const onAccept = jest.fn();
    const { user } = plainRender(
      <FormatActionHandler devices={[onlineDasdMock]} onAccept={onAccept} />,
    );
    const confirmButton = screen.getByRole("button", { name: "Format now" });
    await user.click(confirmButton);
    expect(formatDASDMutationMock).toHaveBeenCalledWith([onlineDasdMock.id]);
    expect(onAccept).toHaveBeenCalled();
  });

  it("calls onCancel if user cancels", async () => {
    const onCancel = jest.fn();
    const { user } = plainRender(
      <FormatActionHandler devices={[onlineDasdMock]} onCancel={onCancel} />,
    );
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);
    expect(onCancel).toHaveBeenCalled();
  });
});

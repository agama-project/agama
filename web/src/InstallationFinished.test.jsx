/*
 * Copyright (c) [2022] SUSE LLC
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

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import { createClient } from "./lib/client";

import InstallationFinished from "./InstallationFinished";

jest.mock("./lib/client");

let startProbingFn = jest.fn();
let rebootSystemFn = jest.fn();

describe("InstallationFinished", () => {
  beforeEach(() => {
    createClient.mockImplementation(() => {
      return {
        manager: {
          startProbing: startProbingFn,
          rebootSystem: rebootSystemFn
        }
      };
    });
  });

  it("shows the finished installation screen", async () => {
    authRender(<InstallationFinished />);

    await screen.findByText("Congratulations!");
  });

  it("shows a 'Restart Installation' button", async () => {
    authRender(<InstallationFinished />);

    await screen.findByRole("button", { name: /Restart Installation/i });
  });

  it("shows a 'Reboot' button", async () => {
    authRender(<InstallationFinished />);

    await screen.findByRole("button", { name: /Reboot/i });
  });


  it("starts the probing process if user clicks on 'Restart Installation' button", async () => {
    authRender(<InstallationFinished />);

    const button = await screen.findByRole("button", { name: /Restart Installation/i });
    userEvent.click(button);
    expect(startProbingFn).toHaveBeenCalled();
  });

  it("reboots the system if the user clicks on 'Reboot' button", async () => {
    authRender(<InstallationFinished />);
    const button = await screen.findByRole("button", { name: /Reboot/i });
    userEvent.click(button);
    expect(rebootSystemFn).toHaveBeenCalled();
  });
});

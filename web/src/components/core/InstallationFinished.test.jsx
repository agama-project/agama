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
import { installerRender } from "~/test-utils";
import { createClient } from "~/client";

import InstallationFinished from "./InstallationFinished";

jest.mock("~/client");
// Since Agama sidebar is now rendered by the core/Page component, it's needed
// to mock it when testing a Page with plainRender and/or not taking care about
// sidebar's content.
jest.mock("~/components/core/Sidebar", () => () => <div>Agama sidebar</div>);

const finishInstallationFn = jest.fn();

describe("InstallationFinished", () => {
  beforeEach(() => {
    createClient.mockImplementation(() => {
      return {
        manager: {
          finishInstallation: finishInstallationFn,
          useIguana: () => Promise.resolve(false)
        }
      };
    });
  });

  it("shows the finished installation screen", () => {
    installerRender(<InstallationFinished />);
    screen.getByText("Congratulations!");
  });

  it("shows a 'Reboot' button", () => {
    installerRender(<InstallationFinished />);
    screen.getByRole("button", { name: /Reboot/i });
  });

  it("reboots the system if the user clicks on 'Reboot' button", async () => {
    const { user } = installerRender(<InstallationFinished />);
    const rebootButton = screen.getByRole("button", { name: /Reboot/i });
    await user.click(rebootButton);
    expect(finishInstallationFn).toHaveBeenCalled();
  });
});

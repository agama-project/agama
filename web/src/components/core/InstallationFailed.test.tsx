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
import InstallationFailed from "./InstallationFailed";

describe("InstallationFailed", () => {
  it("shows the installation failed heading", () => {
    plainRender(<InstallationFailed />);
    screen.getByRole("heading", { name: "Installation failed" });
  });

  it("shows instructions to download logs", () => {
    plainRender(<InstallationFailed />);
    screen.getByText("Download logs to troubleshoot or share with support.");
  });

  it("shows instructions to reboot", () => {
    plainRender(<InstallationFailed />);
    screen.getByText("Reboot to try again.");
  });

  it("shows a 'Reboot' button", () => {
    plainRender(<InstallationFailed />);
    screen.getByRole("button", { name: "Reboot" });
  });

  it("shows a 'Download logs' button", () => {
    plainRender(<InstallationFailed />);
    screen.getByRole("link", { name: /Download logs/i });
  });
});

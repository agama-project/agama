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
import InstallationExit from "./InstallationExit";

describe("InstallationExit", () => {
  describe("when rebooting", () => {
    it("makes users aware system is rebooting", () => {
      plainRender(<InstallationExit action="reboot" />);
      screen.getByRole("heading", { name: "The system is rebooting", level: 1 });
    });

    it("makes users aware installer is no longer useful", () => {
      plainRender(<InstallationExit action="reboot" />);
      screen.getByText("The installer interface is no longer available.");
    });

    it("invites users to close the installer", () => {
      plainRender(<InstallationExit action="reboot" />);
      screen.getByText("You can safely close this window.");
    });
  });

  describe("when shutting down", () => {
    it("makes users aware system is shutting down", () => {
      plainRender(<InstallationExit action="shutdown" />);
      screen.getByRole("heading", { name: "The system is shutting down", level: 1 });
    });

    it("makes users aware installer is no longer useful", () => {
      plainRender(<InstallationExit action="shutdown" />);
      screen.getByText("The installer interface is no longer available.");
    });

    it("invites users to close the installer", () => {
      plainRender(<InstallationExit action="shutdown" />);
      screen.getByText("You can safely close this window.");
    });
  });
});

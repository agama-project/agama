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
import { authRender } from "./test-utils";

import InstallationProgress from "./InstallationProgress";

describe("InstallationProgress", () => {
  it("uses 'Installing' as title", async () => {
    authRender(<InstallationProgress />);

    await screen.findByText("Installing");
  });

  it("shows progress bars", async () => {
    authRender(<InstallationProgress />);

    await screen.findByLabelText("Main progress bar");
  });

  it("shows disabled 'Finish' action", async () => {
    authRender(<InstallationProgress />);

    const button = await screen.findByRole("button", { name: /Finish/i });
    expect(button).toHaveAttribute("disabled");
  });
});

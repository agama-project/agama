/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import { screen, waitFor, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";

import About from "./About";

describe("About", () => {
  it("allows user to read 'About D-Installer'", async () => {
    const { user } = plainRender(<About />);

    const button = screen.getByRole("button", { name: /About/i });
    await user.click(button);

    const dialog = await screen.findByRole("dialog");

    within(dialog).getByText("About D-Installer");

    const closeButton = within(dialog).getByRole("button", { name: /Close/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

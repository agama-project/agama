/*
 * Copyright (c) [2023] SUSE LLC
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
import { Terminal } from "~/components/core";

describe("Terminal", () => {
  it("displays the cockpit terminal in an iframe", async () => {
    plainRender(<Terminal />);
    const dialog = await screen.findByRole("dialog");
    const iframe = dialog.querySelector("iframe");
    expect(iframe.src).toMatch(/cockpit\/@localhost\/system\/terminal.html/);
  });

  it("closes the popup after clicking the close button", async () => {
    const { user } = plainRender(<Terminal />);
    const dialog = await screen.findByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: /Close/i });

    await user.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("triggers the onCloseCallback after clicking the close button", async () => {
    const callback = jest.fn();
    const { user } = plainRender(<Terminal onCloseCallback={callback} />);
    const dialog = await screen.findByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: /Close/i });

    await user.click(closeButton);

    expect(callback).toHaveBeenCalled();
  });
});

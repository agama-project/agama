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
import { plainRender, mockComponent } from "@/test-utils";

import { DBusError } from "@components/layout";

jest.mock("@components/layout/Layout", () => ({
  MainActions: ({ children }) => children,
  PageIcon: ({ children }) => children,
  Title: ({ children }) => children,
}));

describe("DBusError", () => {
  it("includes a generic D-Bus connection problem message", () => {
    plainRender(<DBusError />);

    expect(screen.getByText(/Could not connect to the D-Bus service/i))
      .toBeInTheDocument();
  });

  it("calls location.reload when user clicks on 'Reload'", async () => {
    const { user } = plainRender(<DBusError />);

    const reloadButton = await screen.findByRole("button", { name: /Reload/i });

    // Mock location.reload
    // https://remarkablemark.org/blog/2021/04/14/jest-mock-window-location-href
    const { location } = window;
    delete window.location;
    window.location = { reload: jest.fn() };

    await user.click(reloadButton);
    expect(window.location.reload).toHaveBeenCalled();

    // restore windows.location
    window.location = location;
  });
});

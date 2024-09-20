/*
 * Copyright (c) [2024] SUSE LLC
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
import { screen, waitFor, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import TargetsSection from "./TargetsSection";
import { deleteNode, discover, login, logout } from "~/api/storage/iscsi";

let mockNodes = [];
const mockDiscover = jest.fn();
const node1 = {
  id: 1,
  address: "192.168.122.10",
  target: "iqn.2024-09.com.example",
  port: "e5ce1696dbf39d938e88",
  connected: false,
  ibft: false,
  interface: "default",
  startup: "",
};

const node2 = {
  id: 2,
  address: "192.168.122.10",
  target: "iqn.2024-09.com.example",
  port: "a9fd1c74adea4cbd80502",
  connected: true,
  ibft: false,
  interface: "default",
  startup: "onboot",
};

jest.mock("~/queries/storage/iscsi", () => ({
  ...jest.requireActual("~/queries/storage/iscsi"),
  useNodes: () => mockNodes,
}));

jest.mock("~/api/storage/iscsi", () => ({
  ...jest.requireActual("~/queries/storage/iscsi"),
  discover: jest.fn().mockResolvedValue(true),
  login: jest.fn().mockResolvedValue(0),
  logout: jest.fn(),
  deleteNode: jest.fn(),
}));

describe("TargetsSection", () => {
  beforeEach(() => {
    mockNodes = [];
    mockDiscover.mockResolvedValue(true);
  });

  describe("allows discovering the node", () => {
    it("asks for discover info and closes the dialog on success", async () => {
      const { user } = plainRender(<TargetsSection />);
      const button = await screen.findByRole("button", { name: "Discover iSCSI targets" });
      await user.click(button);

      const dialog = await screen.findByRole("dialog");

      const ipAddressInput = within(dialog).getByLabelText(/IP address/);
      await user.type(ipAddressInput, "192.168.122.10");

      const portInput = within(dialog).getByLabelText(/Port/);
      await user.clear(portInput);
      await user.type(portInput, "3260");

      const [usernameInput] = within(dialog).queryAllByText("User name");
      await user.type(usernameInput, "admin");

      const [passwordInput] = within(dialog).queryAllByText("Password");
      await user.type(passwordInput, "admin.pass");

      const confirmButton = await within(dialog).findByRole("button", { name: "Confirm" });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(dialog).not.toBeInTheDocument();
      });

      expect(discover).toHaveBeenCalledWith("192.168.122.10", 3260, {
        username: "admin",
        password: "admin.pass",
        reverseUsername: "",
        reversePassword: "",
      });
    });
  });

  describe("when there is a target", () => {
    beforeEach(() => {
      mockNodes = [node1, node2];
    });

    it("allows logging into disconnected targets", async () => {
      const { user } = plainRender(<TargetsSection />);

      const row = await screen.findByRole("row", { name: /Disconnected/ });
      const actionsButton = await within(row).findByRole("button", { name: "Actions" });
      await user.click(actionsButton);
      const loginButton = await screen.findByRole("menuitem", { name: "Login" });
      await user.click(loginButton);

      const dialog = await screen.findByRole("dialog");
      const startupSelect = await within(dialog).findByRole("combobox", { name: "Startup" });
      await user.selectOptions(startupSelect, "Automatic");

      const [usernameInput] = within(dialog).queryAllByText("User name");
      await user.type(usernameInput, "admin");

      const [passwordInput] = within(dialog).queryAllByText("Password");
      await user.type(passwordInput, "admin.pass");

      const confirmButton = await within(dialog).findByRole("button", { name: "Confirm" });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(dialog).not.toBeInTheDocument();
      });

      expect(login).toHaveBeenCalledWith(node1, {
        username: "admin",
        password: "admin.pass",
        reverseUsername: "",
        reversePassword: "",
        startup: "automatic",
      });
    });

    it("allows logging out connected targets", async () => {
      const { user } = plainRender(<TargetsSection />);

      const row = await screen.findByRole("row", { name: /Connected/ });
      const actionsButton = await within(row).findByRole("button", { name: "Actions" });
      await user.click(actionsButton);
      const logoutButton = await screen.findByRole("menuitem", { name: "Logout" });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(logout).toHaveBeenCalledWith(node2);
      });
    });

    it("allows deleting a disconnected target", async () => {
      const { user } = plainRender(<TargetsSection />);

      const row = await screen.findByRole("row", { name: /Disconnected/ });
      const actionsButton = await within(row).findByRole("button", { name: "Actions" });
      await user.click(actionsButton);
      const deleteButton = await screen.findByRole("menuitem", { name: "Delete" });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(deleteNode).toHaveBeenCalledWith(node1);
      });
    });
  });
});

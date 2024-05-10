/*
 * Copyright (c) [2024] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { LoginPage } from "~/components/core";

let mockIsAuthenticated;
const mockLoginFn = jest.fn();

jest.mock("~/context/auth", () => ({
  ...jest.requireActual("~/context/auth"),
  useAuth: () => {
    return {
      isAuthenticated: mockIsAuthenticated,
      login: mockLoginFn
    };
  }
}));

describe("LoginPage", () => {
  beforeAll(() => {
    mockIsAuthenticated = false;
    jest.spyOn(console, "error").mockImplementation();
  });

  afterAll(() => {
    console.error.mockRestore();
  });

  describe("when user is not authenticated", () => {
    it("renders reference to root", () => {
      plainRender(<LoginPage />);
      screen.getAllByText(/root/);
    });

    it("allows entering a password", async () => {
      const { user } = plainRender(<LoginPage />);
      const form = screen.getByRole("form", { name: "Login form" });
      const passwordInput = within(form).getByLabelText("Password input");
      const loginButton = within(form).getByRole("button", { name: "Log in" });

      await user.type(passwordInput, "s3cr3t");
      await user.click(loginButton);

      expect(mockLoginFn).toHaveBeenCalledWith("s3cr3t");
    });

    it("renders a button to know more about the project", async () => {
      const { user } = plainRender(<LoginPage />);
      const button = screen.getByRole("button", { name: "What is this?" });

      await user.click(button);

      const dialog = await screen.findByRole("dialog");
      within(dialog).getByText(/About/);
    });
  });
});

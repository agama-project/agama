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
import { AuthErrors } from "~/context/auth";

let mockIsAuthenticated;
const mockLoginFn = jest.fn();
let mockLoginError;

jest.mock("~/context/auth", () => ({
  ...jest.requireActual("~/context/auth"),
  useAuth: () => {
    return {
      isAuthenticated: mockIsAuthenticated,
      login: mockLoginFn,
      error: mockLoginError,
    };
  },
}));

describe.skip("LoginPage", () => {
  beforeAll(() => {
    mockIsAuthenticated = false;
    mockLoginError = null;
    mockLoginFn.mockResolvedValue({ status: 200 });
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

    describe("and the entered password is wrong", () => {
      beforeAll(() => {
        mockLoginFn.mockResolvedValue({ status: 400 });
        mockLoginError = AuthErrors.AUTH;
      });

      it("renders an authentication error", async () => {
        const { user } = plainRender(<LoginPage />);
        const form = screen.getByRole("form", { name: "Login form" });
        const passwordInput = within(form).getByLabelText("Password input");
        const loginButton = within(form).getByRole("button", { name: "Log in" });

        await user.type(passwordInput, "s3cr3t");
        await user.click(loginButton);

        expect(mockLoginFn).toHaveBeenCalledWith("s3cr3t");
        const form_error = screen.getByRole("form", { name: "Login form" });
        within(form_error).getByText(/Could not log in/);
      });
    });

    describe("and the server is down", () => {
      beforeAll(() => {
        mockLoginFn.mockResolvedValue({ status: 504 });
        mockLoginError = AuthErrors.SERVER;
      });

      it("renders a server error text", async () => {
        const { user } = plainRender(<LoginPage />);
        const form = screen.getByRole("form", { name: "Login form" });
        const passwordInput = within(form).getByLabelText("Password input");
        const loginButton = within(form).getByRole("button", { name: "Log in" });

        await user.type(passwordInput, "s3cr3t");
        await user.click(loginButton);

        expect(mockLoginFn).toHaveBeenCalledWith("s3cr3t");
        const form_error = screen.getByRole("form", { name: "Login form" });
        within(form_error).getByText(/Could not authenticate/);
      });
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

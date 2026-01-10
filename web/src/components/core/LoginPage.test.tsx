/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { installerRender, mockRoutes } from "~/test-utils";
import { AuthErrors } from "~/context/auth";
import { Plain as PlainLayout } from "~/components/layout/Layout";
import LoginPage from "./LoginPage";

let consoleErrorSpy: jest.SpyInstance;
let mockIsAuthenticated: boolean;
let mockLoginError;

const mockLoginFn = jest.fn();

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/components/layout/Header", () => () => <div>Header Mock</div>);

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

describe("LoginPage", () => {
  beforeAll(() => {
    mockRoutes("/login");
    mockLoginFn.mockResolvedValue({ status: 200 });
    mockIsAuthenticated = false;
    mockLoginError = null;
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  // Regresion test: when wrapped by Layout, it shouldn't fail with
  // "No QueryClient set, use QueryClientProvider to set one"
  // See commit ecc8d0865abbbebc7795e39bd85ec9462010d065
  it("renders its content even when wrapped by Layout", async () => {
    installerRender(
      <PlainLayout>
        <LoginPage />
      </PlainLayout>,
    );
    await screen.findByRole("form", { name: "Login form" });
  });

  describe("when user is not authenticated", () => {
    it("renders reference to root", () => {
      installerRender(<LoginPage />);
      screen.getAllByText(/root/);
    });

    it("allows entering a password", async () => {
      const { user } = installerRender(<LoginPage />);
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
        const { user } = installerRender(<LoginPage />);
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
        const { user } = installerRender(<LoginPage />);
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
  });
});

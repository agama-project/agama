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
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import App from "./App";
import { createClient } from "./client";

jest.mock("./client");
jest.mock("./Installer", () => {
  return {
    __esModule: true,
    default: () => {
      return <div>Installer Component</div>;
    }
  };
});

describe("when the user is already logged in", () => {
  beforeEach(() => {
    createClient.mockImplementation(() => {
      return {
        auth: {
          authorize: (_username, _password) => Promise.resolve(false),
          isLoggedIn: () => Promise.resolve(true),
          currentUser: () => Promise.resolve("jane")
        }
      };
    });
  });

  it("shows the installer", async () => {
    authRender(<App />);
    await screen.findByText("Installer Component");
  });
});

describe("when username and password are wrong", () => {
  beforeEach(() => {
    createClient.mockImplementation(() => {
      return {
        auth: {
          authorize: () => Promise.reject(new Error("password does not match")),
          isLoggedIn: () => Promise.resolve(false),
          onSignal: jest.fn()
        }
      };
    });
  });

  it("shows an error", async () => {
    authRender(<App />);

    await screen.findByText(/Username/i);

    userEvent.type(screen.getByLabelText(/Username/i), "john");
    userEvent.type(screen.getByLabelText(/Password/i), "something");
    userEvent.click(screen.getByRole("button", { name: /Login/ }));

    await screen.findByText(/Authentication failed/i);
  });
});

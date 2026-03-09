/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { installerRender, mockRouteError } from "~/test-utils";
import ErrorPage from "./ErrorPage";

jest.mock("stacktracey", () =>
  jest.fn().mockImplementation(() => ({
    withSources: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    asTable: jest.fn().mockReturnValue("app.ts:10  myFunc\napp.ts:20  caller"),
  })),
);

const routeError = (status: number, statusText: string, data: unknown) => ({
  __isRouteError: true,
  status,
  statusText,
  data,
});

describe("ErrorPage", () => {
  describe("when the error is a route error response", () => {
    describe("when it is a 404", () => {
      beforeEach(() => {
        mockRouteError(routeError(404, "Not Found", null));
      });

      it("shows the HTTP status and statusText", () => {
        installerRender(<ErrorPage />);
        screen.getByText("404 Not Found");
      });

      it("does not show a stack trace", () => {
        installerRender(<ErrorPage />);
        expect(screen.queryByRole("code")).not.toBeInTheDocument();
      });
    });

    describe("when it carries a data payload", () => {
      beforeEach(() => {
        mockRouteError(routeError(403, "Forbidden", "You do not have access"));
      });

      it("shows the data payload", () => {
        installerRender(<ErrorPage />);
        screen.getByText("You do not have access");
      });
    });
  });

  describe("when the error is an unexpected error", () => {
    describe("when it is a standard Error", () => {
      beforeEach(() => {
        mockRouteError(new Error("Something exploded"));
      });

      it("shows the 'Unexpected error' heading", () => {
        installerRender(<ErrorPage />);
        screen.getByText("Unexpected error");
      });

      it("shows the error message", () => {
        installerRender(<ErrorPage />);
        screen.getByText("Something exploded");
      });

      it("shows the stack trace", () => {
        installerRender(<ErrorPage />);
        screen.getByText(/app\.ts:10.*myFunc/);
      });
    });

    describe("when the thrown value is not an Error instance", () => {
      beforeEach(() => {
        mockRouteError("a plain string");
      });

      it("shows the 'Unexpected error' heading", () => {
        installerRender(<ErrorPage />);
        screen.getByText("Unexpected error");
      });

      it("shows 'Unknown error' as the message", () => {
        installerRender(<ErrorPage />);
        screen.getByText("Unknown error");
      });

      it("does not show a stack trace", () => {
        installerRender(<ErrorPage />);
        expect(screen.queryByRole("code")).not.toBeInTheDocument();
      });
    });
  });
});

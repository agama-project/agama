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
    withSourcesAsync: jest.fn().mockResolvedValue({
      filter: jest.fn().mockReturnThis(),
      asTable: jest.fn().mockReturnValue("app.ts:10  myFunc\napp.ts:20  caller"),
    }),
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

      it("does not show a skeleton", () => {
        installerRender(<ErrorPage />);
        expect(screen.queryByText("Retrieving error details")).not.toBeInTheDocument();
      });
    });

    describe("when the data payload is a string", () => {
      beforeEach(() => {
        mockRouteError(routeError(403, "Forbidden", "You do not have access"));
      });

      it("shows the data payload as-is", () => {
        installerRender(<ErrorPage />);
        screen.getByText("You do not have access");
      });
    });

    describe("when the data payload is not a string", () => {
      beforeEach(() => {
        mockRouteError(
          routeError(422, "Unprocessable Entity", { field: "email", issue: "invalid" }),
        );
      });

      it("shows the JSON-serialised payload", () => {
        installerRender(<ErrorPage />);
        screen.getByText(/\"field\":\"email\"/);
      });
    });
  });

  describe("when the error is an unexpected error", () => {
    describe("when it is a standard Error", () => {
      beforeEach(() => {
        mockRouteError(new Error("Something exploded"));
      });

      it("shows the 'Unexpected error' heading", async () => {
        installerRender(<ErrorPage />);
        screen.getByText("Unexpected error");
        await screen.findByText(/app\.ts:10.*myFunc/);
      });

      it("shows the error message", async () => {
        installerRender(<ErrorPage />);
        screen.getByText("Something exploded");
        await screen.findByText(/app\.ts:10.*myFunc/);
      });

      it("shows a skeleton while the trace is loading", async () => {
        installerRender(<ErrorPage />);
        screen.getByText("Retrieving error details");
        await screen.findByText(/app\.ts:10.*myFunc/);
      });

      it("shows the stack trace once loaded", async () => {
        installerRender(<ErrorPage />);
        await screen.findByText(/app\.ts:10.*myFunc/);
      });

      it("hides the skeleton once the trace is loaded", async () => {
        installerRender(<ErrorPage />);
        await screen.findByText(/app\.ts:10.*myFunc/);
        expect(screen.queryByText("Retrieving error details")).not.toBeInTheDocument();
      });
    });

    describe("when withSourcesAsync fails", () => {
      beforeEach(() => {
        const StackTracey = require("stacktracey");
        StackTracey.mockImplementationOnce(() => ({
          withSourcesAsync: jest.fn().mockRejectedValue(new Error("network error")),
          filter: jest.fn().mockReturnThis(),
          asTable: jest.fn().mockReturnValue("app.ts:10  myFunc (no sources)"),
        }));
        mockRouteError(new Error("Something exploded"));
      });

      it("falls back to the raw stack table", async () => {
        installerRender(<ErrorPage />);
        await screen.findByText(/app\.ts:10.*myFunc \(no sources\)/);
      });
    });

    describe("when the thrown value is not an Error instance", () => {
      beforeEach(() => {
        mockRouteError({ code: 42, reason: "unknown" });
      });

      it("shows the 'Something went wrong' heading", async () => {
        installerRender(<ErrorPage />);
        screen.getByText("Something went wrong");
        await screen.findByText(/\"code\":42/);
      });

      it("shows 'Unknown error' as the message", async () => {
        installerRender(<ErrorPage />);
        screen.getByText("Unknown error");
        await screen.findByText(/\"code\":42/);
      });

      it("shows the JSON-serialised value", async () => {
        installerRender(<ErrorPage />);
        await screen.findByText(/\"code\":42/);
      });
    });
  });
});

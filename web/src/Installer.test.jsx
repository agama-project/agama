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

import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import { createClient } from "./lib/client";
import { PROBING, PROBED, INSTALLING, INSTALLED } from "./lib/client/status";

import Installer from "./Installer";

jest.mock("./lib/client");

// Mock some components,
// See https://www.chakshunyu.com/blog/how-to-mock-a-react-component-in-jest/#default-export

jest.mock("./DBusError", () => () => "D-BusError Mock");
jest.mock("./ProbingProgress", () => () => "ProbingProgress Mock");
jest.mock("./InstallationProgress", () => () => "InstallationProgress Mock");
jest.mock("./InstallationFinished", () => () => "InstallationFinished Mock");
jest.mock("./Overview", () => () => "Overview Mock");

let callbacks;
let initialStatusMock = null;
let onChangeFn = jest.fn();
let getStatusFn = jest.fn();

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      manager: {
        getStatus: getStatusFn,
        onChange: onChangeFn
      }
    };
  });
});

describe("Installer", () => {
  describe("when there are problems connecting with D-Bus service", () => {
    beforeEach(() => {
      getStatusFn = () => {
        throw "Could'n connect to D-Bus service";
      };
    });

    it("renders the DBusError component", async () => {
      authRender(<Installer />);

      await screen.findByText("D-BusError Mock");
    });
  });

  describe("when D-Bus service status changes", () => {
    beforeEach(() => {
      callbacks = [];
      getStatusFn = () => Promise.resolve(initialStatusMock);
      onChangeFn = cb => callbacks.push(cb);
    });

    it("renders the ProbingProgress component when PROBING", async () => {
      authRender(<Installer />);

      await screen.findByText(/Loading.*environment/i);

      // NOTE: there can be more than one susbcriptions to the
      // manager#onChange. We're insterested in the latest one here.
      const cb = callbacks[callbacks.length - 1];
      act(() => {
        cb({ Status: PROBING });
      });

      await screen.findByText("ProbingProgress Mock");
    });

    it("renders the InstallationProgress component when INSTALLING", async () => {
      authRender(<Installer />);

      await screen.findByText(/Loading.*environment/i);

      // NOTE: there can be more than one susbcriptions to the
      // manager#onChange. We're insterested in the latest one here.
      const cb = callbacks[callbacks.length - 1];
      act(() => {
        cb({ Status: INSTALLING });
      });

      await screen.findByText("InstallationProgress Mock");
    });

    it("renders the InstallationFinished component when INSTALLED", async () => {
      authRender(<Installer />);

      await screen.findByText(/Loading.*environment/i);

      // NOTE: there can be more than one susbcriptions to the
      // manager#onChange. We're insterested in the latest one here.
      const cb = callbacks[callbacks.length - 1];
      act(() => {
        cb({ Status: INSTALLED });
      });

      await screen.findByText("InstallationFinished Mock");
    });

    it("renders the Overview component if not PROBING, INSTALLING, or INSTALLED", async () => {
      authRender(<Installer />);

      await screen.findByText(/Loading.*environment/i);

      // NOTE: there can be more than one susbcriptions to the
      // manager#onChange. We're insterested in the latest one here.
      const cb = callbacks[callbacks.length - 1];
      act(() => {
        cb({ Status: PROBED });
      });

      await screen.findByText("Overview Mock");
    });
  });
});

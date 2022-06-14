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
import { installerRender } from "./test-utils";
import { createClient } from "./client";
import { PROBING, PROBED, INSTALLING, INSTALLED } from "./client/status";

import App from "./App";

jest.mock("./client");

// Mock some components,
// See https://www.chakshunyu.com/blog/how-to-mock-a-react-component-in-jest/#default-export

jest.mock("./DBusError", () => () => "D-BusError Mock");
jest.mock("./ProbingProgress", () => () => "ProbingProgress Mock");
jest.mock("./InstallationProgress", () => () => "InstallationProgress Mock");
jest.mock("./InstallationFinished", () => () => "InstallationFinished Mock");
jest.mock("./Overview", () => () => "Overview Mock");
jest.mock("./Questions", () => () => <div>Questions Mock</div>);
jest.mock("./TargetIpsPopup", () => () => "Target IPs Mock");

const callbacks = {};
const initialStatusMock = null;
let getStatusFn = jest.fn();

// capture the latest subsccription to the manager#onChange for triggering it manually
const onChangeFn = cb => { callbacks.onChange = cb };

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      manager: {
        getStatus: getStatusFn,
        onChange: onChangeFn
      },
      monitor: {
        onDisconnect: jest.fn()
      },
      network: {
        config: jest.fn()
      }
    };
  });
});

const changeStatusTo = status => act(() => callbacks.onChange({ Status: status }));

describe("App", () => {
  describe("when there are problems connecting with D-Bus service", () => {
    beforeEach(() => {
      getStatusFn = () => Promise.reject(new Error("Couldn't connect to D-Bus service"));
    });

    it("renders the Questions and DBusError components", async () => {
      installerRender(<App />);

      await screen.findByText("Questions Mock");
      await screen.findByText("D-BusError Mock");
    });
  });

  describe("when D-Bus service status changes", () => {
    beforeEach(() => {
      getStatusFn = () => Promise.resolve(initialStatusMock);
    });

    it("renders Questions and ProbingProgress components when PROBING", async () => {
      installerRender(<App />);

      await screen.findByText(/Loading.*environment/i);

      changeStatusTo(PROBING);

      await screen.findByText("Questions Mock");
      await screen.findByText("ProbingProgress Mock");
    });

    it("renders Questions and InstallationProgress components when INSTALLING", async () => {
      installerRender(<App />);

      await screen.findByText(/Loading.*environment/i);

      changeStatusTo(INSTALLING);

      await screen.findByText("Questions Mock");
      await screen.findByText("InstallationProgress Mock");
    });

    it("renders Questions and InstallationFinished components when INSTALLED", async () => {
      installerRender(<App />);

      await screen.findByText(/Loading.*environment/i);

      changeStatusTo(INSTALLED);

      await screen.findByText("Questions Mock");
      await screen.findByText("InstallationFinished Mock");
    });

    it("renders Questions and Overview components if not PROBING, INSTALLING, or INSTALLED", async () => {
      installerRender(<App />);

      await screen.findByText(/Loading.*environment/i);

      changeStatusTo(PROBED);

      await screen.findByText("Questions Mock");
      await screen.findByText("Overview Mock");
    });
  });
});

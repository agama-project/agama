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
import { STARTUP, CONFIG, INSTALL } from "./client/phase";
import { IDLE, BUSY } from "./client/status";

import App from "./App";

jest.mock("./client");

// Mock some components,
// See https://www.chakshunyu.com/blog/how-to-mock-a-react-component-in-jest/#default-export

jest.mock("./DBusError", () => () => "D-BusError Mock");
jest.mock("./InstallationProgress", () => () => "InstallationProgress Mock");
jest.mock("./InstallationFinished", () => () => "InstallationFinished Mock");
jest.mock("./Overview", () => () => "Overview Mock");
jest.mock("./TargetIpsPopup", () => () => "Target IPs Mock");
jest.mock('react-router-dom', () => ({
  Outlet: () => <div>Content</div>
}));

const callbacks = {};
const getStatusFn = jest.fn();
const getPhaseFn = jest.fn().mockResolvedValue(STARTUP);
const product = { id: "Tumbleweed", name: "openSUSE Tumbleweed" };
const products = [product];

// capture the latest subscription to the manager#onStatusChange for triggering it manually
const onStatusChangeFn = cb => { callbacks.onStatusChange = cb };

// capture the latest subscription to the manager#onPhaseChange for triggering it manually
const onPhaseChangeFn = cb => { callbacks.onPhaseChange = cb };

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      manager: {
        getStatus: getStatusFn,
        getPhase: getPhaseFn,
        onPhaseChange: onPhaseChangeFn,
        onStatusChange: onStatusChangeFn
      },
      monitor: {
        onDisconnect: jest.fn()
      },
      network: {
        config: jest.fn()
      },
      software: {
        getProducts: jest.fn().mockResolvedValue(products),
        getSelectedProduct: jest.fn().mockResolvedValue(product),
        onProductChange: jest.fn()
      }
    };
  });
});

const changeStatusTo = status => act(() => callbacks.onStatusChange(status));
const changePhaseTo = phase => act(() => callbacks.onPhaseChange(phase));

describe("App", () => {
  describe("when there are problems connecting with D-Bus service", () => {
    beforeEach(() => {
      getStatusFn.mockRejectedValue(new Error("Couldn't connect to D-Bus service"));
    });

    it("renders the DBusError component", async () => {
      installerRender(<App />);
      await screen.findByText("D-BusError Mock");
    });
  });

  describe("when D-Bus service status changes", () => {
    beforeEach(() => {
      getStatusFn.mockResolvedValue(BUSY);
    });

    it("renders InstallationProgress components when INSTALLING", async () => {
      installerRender(<App />);
      await screen.findByText(/Loading.*environment/i);

      changePhaseTo(INSTALL);
      changeStatusTo(BUSY);
      await screen.findByText("InstallationProgress Mock");
    });

    it("renders InstallationFinished components when INSTALLED", async () => {
      installerRender(<App />);
      await screen.findByText(/Loading.*environment/i);

      changePhaseTo(INSTALL);
      changeStatusTo(IDLE);
      await screen.findByText("InstallationFinished Mock");
    });

    it("renders the content if not PROBING, INSTALLING, or INSTALLED", async () => {
      installerRender(<App />);
      await screen.findByText(/Loading.*environment/i);

      changePhaseTo(CONFIG);
      changeStatusTo(IDLE);
      await screen.findByText("Content");
    });
  });
});

/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { installerRender } from "~/test-utils";

import App from "./App";
import { createClient } from "~/client";
import { STARTUP, CONFIG, INSTALL } from "~/client/phase";
import { IDLE, BUSY } from "~/client/status";

jest.mock("~/client");

// list of available products
let mockProducts;
jest.mock("~/context/product", () => ({
  ...jest.requireActual("~/context/product"),
  useProduct: () => {
    return {
      products: mockProducts,
      selectedProduct: null
    };
  }
}));

// Mock some components,
// See https://www.chakshunyu.com/blog/how-to-mock-a-react-component-in-jest/#default-export
jest.mock("~/components/questions/Questions", () => () => <div>Questions Mock</div>);
jest.mock("~/components/core/Installation", () => () => <div>Installation Mock</div>);
jest.mock("~/components/layout/Loading", () => () => <div>Loading Mock</div>);

// this object holds the mocked callbacks
const callbacks = {};
const getStatusFn = jest.fn();
const getPhaseFn = jest.fn();

// capture the latest subscription to the manager#onPhaseChange for triggering it manually
const onPhaseChangeFn = cb => { callbacks.onPhaseChange = cb };
const onStatusChangeFn = cb => { callbacks.onStatusChange = cb };
const changePhaseTo = phase => act(() => callbacks.onPhaseChange(phase));

describe("App", () => {
  beforeEach(() => {
    // setting the language through a cookie
    document.cookie = "CockpitLang=en-us; path=/;";
    createClient.mockImplementation(() => {
      return {
        manager: {
          getStatus: getStatusFn,
          getPhase: getPhaseFn,
          onPhaseChange: onPhaseChangeFn,
          onStatusChange: onStatusChangeFn,
        },
        l10n: {
          locales: jest.fn().mockResolvedValue([["en_us", "English", "United States"]]),
          getLocales: jest.fn().mockResolvedValue(["en_us"]),
          timezones: jest.fn().mockResolvedValue([]),
          getTimezone: jest.fn().mockResolvedValue("Europe/Berlin"),
          keymaps: jest.fn().mockResolvedValue([]),
          getKeymap: jest.fn().mockResolvedValue(undefined),
          getUILocale: jest.fn().mockResolvedValue("en_us"),
          setUILocale: jest.fn().mockResolvedValue("en_us"),
          onTimezoneChange: jest.fn(),
          onLocalesChange: jest.fn(),
          onKeymapChange: jest.fn()
        }
      };
    });

    mockProducts = [
      { id: "openSUSE", name: "openSUSE Tumbleweed" },
      { id: "Leap Micro", name: "openSUSE Micro" }
    ];
  });

  afterEach(() => {
    // setting a cookie with already expired date removes it
    document.cookie = "CockpitLang=; path=/; expires=" + new Date(0).toUTCString();
  });

  describe("when the software context is not initialized", () => {
    beforeEach(() => {
      mockProducts = undefined;
    });

    it("renders the Loading screen", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Loading Mock");
    });
  });

  describe("on the startup phase", () => {
    beforeEach(() => {
      getPhaseFn.mockResolvedValue(STARTUP);
      getStatusFn.mockResolvedValue(BUSY);
    });

    it("renders the Loading screen", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Loading Mock");
    });
  });

  describe("when the D-Bus service is busy during startup", () => {
    beforeEach(() => {
      getPhaseFn.mockResolvedValue(STARTUP);
      getStatusFn.mockResolvedValue(BUSY);
    });

    it("renders the Loading screen", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Loading Mock");
    });
  });

  describe("on the CONFIG phase", () => {
    beforeEach(() => {
      getPhaseFn.mockResolvedValue(CONFIG);
    });

    it("renders the application content", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText(/Outlet Content/);
    });
  });

  describe("on the INSTALL phase", () => {
    beforeEach(() => {
      getPhaseFn.mockResolvedValue(INSTALL);
    });

    it("renders the application content", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Installation Mock");
    });
  });

  describe("when D-Bus service phase changes", () => {
    beforeEach(() => {
      getPhaseFn.mockResolvedValue(CONFIG);
    });

    it("renders the Installation component on the INSTALL phase", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText(/Outlet Content/);
      changePhaseTo(INSTALL);
      await screen.findByText("Installation Mock");
    });
  });

  describe("when the config phase is done", () => {
    beforeEach(() => {
      getPhaseFn.mockResolvedValue(CONFIG);
      getStatusFn.mockResolvedValue(IDLE);
    });

    it("renders the application's content", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText(/Outlet Content/);
    });
  });
});

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

import Main from "./Main";

jest.mock("./client");
jest.mock("./Questions", () => () => <div>Questions Mock</div>);
jest.mock("./DBusError", () => () => <div>D-BusError Mock</div>);
jest.mock("./InstallationProgress", () => () => "InstallationProgress Mock");
jest.mock("./InstallationFinished", () => () => "InstallationFinished Mock");
jest.mock("./LoadingEnvironment", () => () => "LoadingEnvironment Mock");
jest.mock('react-router-dom', () => ({
  Outlet: () => <div>Content</div>,
}));

const callbacks = {};
const getStatusFn = jest.fn();
const getPhaseFn = jest.fn();

// capture the latest subscription to the manager#onStatusChange for triggering it manually
const onStatusChangeFn = cb => { callbacks.onStatusChange = cb };

// capture the latest subscription to the manager#onPhaseChange for triggering it manually
const onPhaseChangeFn = cb => { callbacks.onPhaseChange = cb };

const changeStatusTo = status => act(() => callbacks.onStatusChange(status));
const changePhaseTo = phase => act(() => callbacks.onPhaseChange(phase));

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
      }
    };
  });
});

describe("when running on config phase", () => {
  beforeEach(() => {
    getPhaseFn.mockResolvedValue(CONFIG);
    getStatusFn.mockResolvedValue(IDLE);
  });

  it("renders the Questions component and the content", async () => {
    installerRender(<Main />);

    await screen.findByText("Questions Mock");
    await screen.findByText("Content");
  });
});

describe("when busy during startup", () => {
  beforeEach(() => {
    getPhaseFn.mockResolvedValue(STARTUP);
    getStatusFn.mockResolvedValue(BUSY);
  });

  it("renders the Questions component and the content", async () => {
    installerRender(<Main />);

    await screen.findByText("LoadingEnvironment Mock");
  });
});

describe("when there are problems connecting with D-Bus service", () => {
  beforeEach(() => {
    getStatusFn.mockRejectedValue(new Error("Couldn't connect to D-Bus service"));
  });

  it("renders the DBusError component", async () => {
    installerRender(<Main />);
    await screen.findByText("D-BusError Mock");
  });
});

describe("when D-Bus service status changes", () => {
  beforeEach(() => {
    getStatusFn.mockResolvedValue(BUSY);
  });

  it("renders InstallationProgress components when INSTALLING", async () => {
    installerRender(<Main />);
    await screen.findByText(/Loading.*environment/i);

    changePhaseTo(INSTALL);
    changeStatusTo(BUSY);
    await screen.findByText("InstallationProgress Mock");
  });

  it("renders InstallationFinished components when INSTALLED", async () => {
    installerRender(<Main />);
    await screen.findByText(/Loading.*environment/i);

    changePhaseTo(INSTALL);
    changeStatusTo(IDLE);
    await screen.findByText("InstallationFinished Mock");
  });

  it("renders the content if not PROBING, INSTALLING, or INSTALLED", async () => {
    installerRender(<Main />);
    await screen.findByText(/Loading.*environment/i);

    changePhaseTo(CONFIG);
    changeStatusTo(IDLE);
    await screen.findByText("Content");
  });
});

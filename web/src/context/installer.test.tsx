/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { act, screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";

import type { InstallerClient } from "~/client";

jest.mock("~/components/layout/Loading", () => () => <div>Loading Mock</div>);

let client: InstallerClient | null = null;
let closeHandlers: (() => void)[] = [];

jest.mock("~/client", () => ({
  ...jest.requireActual("~/client"),
  getInstallerClient: () => Promise.resolve(client),
  installerClient: () => client,
  onInstallerClientChange: () => () => undefined,
}));

import { InstallerClientProvider } from "./installer";

/**
 * Builds a client in the given connection state, recording the handlers
 * registered for a connection loss so tests can trigger one.
 */
const buildClient = ({
  isConnected = true,
  isRecoverable = true,
}: { isConnected?: boolean; isRecoverable?: boolean } = {}): InstallerClient => ({
  isConnected: () => isConnected,
  isRecoverable: () => isRecoverable,
  onConnect: () => () => undefined,
  onClose: (handler) => {
    closeHandlers.push(handler);
    return () => undefined;
  },
  onError: () => () => undefined,
  onEvent: () => () => undefined,
});

const Content = () => <>Content</>;

const renderProvider = () =>
  plainRender(
    <InstallerClientProvider>
      <Content />
    </InstallerClientProvider>,
  );

const loseConnection = () => act(() => closeHandlers.forEach((handler) => handler()));

describe("InstallerClientProvider", () => {
  beforeEach(() => {
    closeHandlers = [];
  });

  describe("when the client is connected", () => {
    beforeEach(() => {
      client = buildClient();
    });

    it("renders the children", async () => {
      renderProvider();
      await screen.findByText("Content");
    });
  });

  describe("when the client is not connected yet", () => {
    beforeEach(() => {
      client = buildClient({ isConnected: false });
    });

    it("renders a loading indicator", async () => {
      renderProvider();
      await screen.findByText("Loading Mock");
    });
  });

  describe("when the connection is lost but can be recovered", () => {
    beforeEach(() => {
      client = buildClient({ isRecoverable: true });
    });

    it("renders a loading indicator", async () => {
      renderProvider();
      await screen.findByText("Content");

      loseConnection();

      await screen.findByText("Loading Mock");
    });
  });

  describe("when the connection is lost for good", () => {
    beforeEach(() => {
      client = buildClient({ isRecoverable: false });
    });

    it("reports that the server cannot be reached", async () => {
      renderProvider();
      await screen.findByText("Content");

      loseConnection();

      await screen.findByText("Cannot connect");
    });
  });
});

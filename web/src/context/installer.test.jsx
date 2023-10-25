/*
 * Copyright (c) [2023] SUSE LLC
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
import { createDefaultClient } from "~/client";
import { plainRender, createCallbackMock } from "~/test-utils";
import { InstallerClientProvider, useInstallerClientStatus } from "./installer";

jest.mock("~/client");

let onDisconnectFn = jest.fn();
const isConnectedFn = jest.fn();

// Helper component to check the client status.
const ClientStatus = () => {
  const { attempt, connected } = useInstallerClientStatus();

  return (
    <ul>
      <li>{`attempt: ${attempt}`}</li>
      <li>{`connected: ${connected}`}</li>
    </ul>
  );
};

describe("installer context", () => {
  beforeEach(() => {
    createDefaultClient.mockImplementation(() => {
      return {
        isConnected: isConnectedFn,
        onDisconnect: onDisconnectFn
      };
    });
  });

  describe("when there are problems connecting to the D-Bus service", () => {
    beforeEach(() => {
      isConnectedFn.mockResolvedValueOnce(false);
      isConnectedFn.mockResolvedValueOnce(true);
    });

    it("reports each attempt through the useInstallerClientStatus hook", async () => {
      plainRender(
        <InstallerClientProvider interval={0.1}>
          <ClientStatus />
        </InstallerClientProvider>);
      await screen.findByText("attempt: 1");
    });
  });

  describe("when the client is connected", () => {
    beforeEach(() => {
      isConnectedFn.mockResolvedValue(true);
    });

    it("reports the status through the useInstallerClientStatus hook", async () => {
      plainRender(
        <InstallerClientProvider interval={0.1}>
          <ClientStatus />
        </InstallerClientProvider>);
      await screen.findByText("connected: true");
    });
  });

  describe("when the D-Bus service is disconnected", () => {
    beforeEach(() => {
      isConnectedFn.mockResolvedValue(true);
    });

    it("reconnects to the D-Bus service", async () => {
      const [onDisconnect, callbacks] = createCallbackMock();
      onDisconnectFn = onDisconnect;

      plainRender(
        <InstallerClientProvider interval={0.1}>
          <ClientStatus />
        </InstallerClientProvider>
      );
      await screen.findByText("connected: true");
      const [disconnect] = callbacks;
      act(disconnect);
      await screen.findByText("connected: false");
    });
  });
});

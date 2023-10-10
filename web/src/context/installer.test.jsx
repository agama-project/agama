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
import { act, screen, waitFor } from "@testing-library/react";
import { createDefaultClient } from "~/client";
import { plainRender, createCallbackMock } from "~/test-utils";
import { InstallerClientProvider } from "./installer";

jest.mock("~/client");
jest.mock("~/L10nWrapper", () => ({ children }) => children);

let onDisconnectFn = jest.fn();
const isConnectedFn = jest.fn();

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
      isConnectedFn.mockResolvedValue(false);
    });

    it("displays an error", async () => {
      plainRender(<InstallerClientProvider interval={0.1} max_attempts={1} disableL10n />);
      await waitFor(() => {
        expect(screen.queryByText(/Could not connect/)).toBeInTheDocument();
      });
    });
  });

  describe("when the client is connected", () => {
    beforeEach(() => {
      isConnectedFn.mockResolvedValue(true);
    });

    it("displays the children elements", async () => {
      plainRender(
        <InstallerClientProvider disableL10n>
          <div>Hello world!</div>
        </InstallerClientProvider>
      );
      await screen.findByText(/Loading installation environment/);
      await waitFor(() => {
        expect(screen.queryByText("Hello world!")).toBeInTheDocument();
      });
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
        <InstallerClientProvider disableL10n>
          <div>Hello world!</div>
        </InstallerClientProvider>
      );
      await screen.findByText(/Loading installation environment/);
      await screen.findByText(/Hello world!/);
      const [disconnect] = callbacks;
      act(disconnect);
      await screen.findByText(/Loading installation environment/);
      await screen.findByText(/Hello world!/);
    });
  });
});

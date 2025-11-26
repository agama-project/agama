/*
 * Copyright (c) [2025] SUSE LLC
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
import { plainRender } from "~/test-utils";
import { Connection } from "~/types/network";
import NoPersistentConnectionsAlert from "./NoPersistentConnectionsAlert";

let mockConnections: Connection[];

jest.mock("~/hooks/network/proposal", () => ({
  ...jest.requireActual("~/hooks/network/proposal"),
  useConnections: () => mockConnections,
}));

describe("<NoPersistentConnectionsAlert />", () => {
  describe("when there are persistent connections", () => {
    beforeEach(() => {
      mockConnections = [
        new Connection("Newtwork 2", {
          wireless: {
            security: "none",
            ssid: "Network 2",
            mode: "infrastructure",
          },
          persistent: true,
        }),
        new Connection("Newtwork 3", {
          wireless: {
            security: "none",
            ssid: "Network 2",
            mode: "infrastructure",
          },
          persistent: false,
        }),
      ];
    });

    it("renders nothing", () => {
      const { container } = plainRender(<NoPersistentConnectionsAlert />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when there are no persistent connections", () => {
    beforeEach(() => {
      mockConnections = [
        new Connection("Newtwork 2", {
          wireless: {
            security: "none",
            ssid: "Network 2",
            mode: "infrastructure",
          },
          persistent: false,
        }),
        new Connection("Newtwork 3", {
          wireless: {
            security: "none",
            ssid: "Network 2",
            mode: "infrastructure",
          },
          persistent: false,
        }),
      ];
    });

    it("renders a custom alert to notify the user", () => {
      plainRender(<NoPersistentConnectionsAlert />);

      screen.getByText("Custom alert:");
      screen.getByText("Installed system may not have network connections");
      screen.getByText(/All.*managed through this interface.*not be copied.*/);
    });
  });
});

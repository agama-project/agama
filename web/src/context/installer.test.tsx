/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { createClient } from "~/client";
import { plainRender } from "~/test-utils";
import { InstallerClientProvider } from "./installer";
import { DummyWSClient } from "~/client/ws";

jest.mock("~/components/layout/Loading", () => () => <div>Loading Mock</div>);

// Helper component to check the client status.
const Content = () => {
  return <>Content</>;
};

describe("installer context", () => {
  describe("when the WebSocket is connected", () => {
    it("renders the children", async () => {
      const ws = new DummyWSClient();
      const client = createClient(new URL("https://localhost"), ws);

      plainRender(
        <InstallerClientProvider client={client}>
          <Content />
        </InstallerClientProvider>,
      );

      await screen.findByText("Content");
    });
  });

  describe("when the WebSocket is not connected", () => {
    it("renders the a loading indicator", async () => {
      const client = createClient(new URL("https://localhost"));

      plainRender(
        <InstallerClientProvider client={client}>
          <Content />
        </InstallerClientProvider>,
      );
      await screen.findByText("Loading Mock");
    });
  });
});

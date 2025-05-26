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
import AllConnectionsStatusAlert from "./AllConnectionsStatusAlert";
import { Connection } from "~/types/network";

let mockConnections: Connection[];

jest.mock("~/queries/network", () => ({
  ...jest.requireActual("~/queries/network"),
  useConnections: () => mockConnections,
}));

describe("AllConnectionsStatusAlert", () => {
  describe("when there is only one connection", () => {
    describe("and it is set to persistent (`keep` is true)", () => {
      beforeEach(() => {
        mockConnections = [
          new Connection("Newtwork 2", {
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            keep: true,
          }),
        ];
      });

      it("renders nothing", () => {
        const { container } = plainRender(<AllConnectionsStatusAlert />);
        expect(container).toBeEmptyDOMElement();
      });
    });

    describe("and it is set to transient (`keep` is false)", () => {
      beforeEach(() => {
        mockConnections = [
          new Connection("Newtwork 2", {
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            keep: false,
          }),
        ];
      });

      it("renders the 'full-transient' alert", () => {
        plainRender(<AllConnectionsStatusAlert />);

        screen.getByText("No connections will be available in the installed system");
      });
    });
  });

  describe("when there is more than one connection", () => {
    describe("and all are transient (`keep` is false)", () => {
      beforeEach(() => {
        mockConnections = [
          new Connection("Newtwork 2", {
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            keep: false,
          }),
          new Connection("Newtwork 3", {
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            keep: false,
          }),
        ];
      });

      it("renders a 'full-transient' alert", () => {
        plainRender(<AllConnectionsStatusAlert />);

        screen.getByText("No connections will be available in the installed system");
        screen.getByRole("button", { name: "Set all to be available in the installed system" });
      });
    });
    describe("and all are persistent (`keep` is true)", () => {
      beforeEach(() => {
        mockConnections = [
          new Connection("Newtwork 2", {
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            keep: true,
          }),
          new Connection("Newtwork 3", {
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            keep: true,
          }),
        ];
      });

      it("renders a 'full-persistent' alert", () => {
        plainRender(<AllConnectionsStatusAlert />);

        screen.getByText("All connections will be available in the installed system");
        screen.getByRole("button", { name: "Set all for installation only" });
      });
    });
    describe("and there are both, persistent and transient connections", () => {
      beforeEach(() => {
        mockConnections = [
          new Connection("Newtwork 2", {
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            keep: true,
          }),
          new Connection("Newtwork 3", {
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            keep: false,
          }),
        ];
      });

      it("renders a 'mixed' alert", () => {
        plainRender(<AllConnectionsStatusAlert />);

        screen.getByText("Some connections will be available in the installed system.");
        screen.getByRole("button", { name: "Set all to be available in the installed system" });
        screen.getByRole("button", { name: "Set all for installation only" });
      });
    });
  });

  // TODO: update below test when actions are implemented
  it.skip("triggers the correct action on button click", async () => {
    const onAllPermanentClick = jest.fn();
    const onAllTransientClick = jest.fn();

    const { user } = plainRender(<AllConnectionsStatusAlert mode="mixed" connections={3} />);

    const allPermanent = screen.getByRole("button", {
      name: "Set all to be available in the installed system",
    });
    const allTransient = screen.getByRole("button", { name: "Set all for installation only" });

    await user.click(allPermanent);
    expect(onAllPermanentClick).toHaveBeenCalled();

    await user.click(allTransient);
    expect(onAllTransientClick).toHaveBeenCalled();
  });
});

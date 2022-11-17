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

import { screen } from "@testing-library/react";
import { installerRender } from "./test-utils";

import HiddenNetworkForm from "./HiddenNetworkForm";

const beforeDisplayingFn = jest.fn();

jest.mock("./WifiConnectionForm", () => () => "WifiConnectionForm mock");

describe("HiddenNetworkForm", () => {
  describe("when it is visible", () => {
    it("renders the WifiConnectionForm", async () => {
      installerRender(<HiddenNetworkForm visible />);
      await screen.findByText("WifiConnectionForm mock");
    });

    it("does not render the link for connecting to a hidden network", async () => {
      installerRender(<HiddenNetworkForm visible />);
      expect(screen.queryByText(/Connect to hidden network/i)).not.toBeInTheDocument();
    });
  });

  describe("when it is not visible", () => {
    it("does not render the WifiConnectionForm", async () => {
      installerRender(<HiddenNetworkForm visible={false} />);
      expect(screen.queryByText("WifiConnectionForm mock")).not.toBeInTheDocument();
    });

    it("renders the link for connecting to a hidden network", async () => {
      installerRender(<HiddenNetworkForm visible={false} />);
      await screen.findByText(/Connect to hidden network/i);
    });

    describe("and the user clicks on the opening link", () => {
      it("triggers the beforeDisplaying callback", async () => {
        const { user } = installerRender(<HiddenNetworkForm visible={false} beforeDisplaying={beforeDisplayingFn} />);

        const link = await screen.findByRole("button", { name: "Connect to hidden network" });
        await user.click(link);

        expect(beforeDisplayingFn).toHaveBeenCalled();
      });
    });
  });
});

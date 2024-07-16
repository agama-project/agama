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
import { plainRender } from "~/test-utils";

import { WifiHiddenNetworkForm } from "~/components/network";

jest.mock("~/components/network/WifiConnectionForm", () => () => (
  <div>WifiConnectionForm mock</div>
));

describe("WifiHiddenNetworkForm", () => {
  describe("when it is visible", () => {
    it("renders the WifiConnectionForm", () => {
      plainRender(<WifiHiddenNetworkForm visible />);

      screen.getByText("WifiConnectionForm mock");
    });

    it("does not render the link for connecting to a hidden network", () => {
      plainRender(<WifiHiddenNetworkForm visible />);
      expect(screen.queryByText(/Connect to hidden network/i)).not.toBeInTheDocument();
    });
  });

  describe("when it is not visible", () => {
    it("does not render the WifiConnectionForm", () => {
      plainRender(<WifiHiddenNetworkForm visible={false} />);
      expect(screen.queryByText("WifiConnectionForm mock")).not.toBeInTheDocument();
    });

    it("renders the link for connecting to a hidden network", () => {
      plainRender(<WifiHiddenNetworkForm visible={false} />);
      screen.findByText(/Connect to hidden network/i);
    });
  });
});

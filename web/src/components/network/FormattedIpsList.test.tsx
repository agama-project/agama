/*
 * Copyright (c) [2026] SUSE LLC
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
import { installerRender } from "~/test-utils";
import FormattedIPsList from "./FormattedIpsList";
import { NETWORK } from "~/routes/paths";

let mockUseIpAddressesFn: jest.Mock<string[]> = jest.fn();

jest.mock("~/hooks/model/system/network", () => ({
  ...jest.requireActual("~/hooks/model/system/network"),
  useIpAddresses: () => mockUseIpAddressesFn(),
}));

describe("FormattedIPsList", () => {
  it("renders nothing when no IP addresses are available", () => {
    mockUseIpAddressesFn.mockReturnValue([]);

    const { container } = installerRender(<FormattedIPsList />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a single IP address when only one address is available", () => {
    mockUseIpAddressesFn.mockReturnValue(["192.168.1.1"]);

    const { rerender } = installerRender(<FormattedIPsList />);
    screen.getByText("192.168.1.1");

    mockUseIpAddressesFn.mockReturnValue(["fe80::1"]);
    rerender(<FormattedIPsList />);
    screen.getByText("fe80::1");
  });

  it("does not render a link when exactly two addresses are available", () => {
    mockUseIpAddressesFn.mockReturnValue(["192.168.1.1", "fe80::1"]);

    installerRender(<FormattedIPsList />);
    screen.getByText("192.168.1.1 and fe80::1");
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("renders a link when there are more than two IP addresses", () => {
    mockUseIpAddressesFn.mockReturnValue(["192.168.1.1", "fe80::1", "192.168.1.2", "fe80::2"]);

    installerRender(<FormattedIPsList />);
    const moreLink = screen.getByRole("link", { name: "2 more" });
    expect(moreLink).toHaveAttribute("href", NETWORK.root);
  });

  it("renders a link when there are multiple IP addresses of the same type", () => {
    mockUseIpAddressesFn.mockReturnValue(["192.168.1.1", "192.168.1.2"]);

    const { rerender } = installerRender(<FormattedIPsList />);
    screen.getByText(/192\.168\.1\.1/);
    const moreLink = screen.getByRole("link", { name: "1 more" });
    expect(moreLink).toHaveAttribute("href", NETWORK.root);

    mockUseIpAddressesFn.mockReturnValue(["fe80::1", "fe80::2"]);
    rerender(<FormattedIPsList />);
    screen.getByText(/fe80::1/);
    const moreLink2 = screen.getByRole("link", { name: "1 more" });
    expect(moreLink2).toHaveAttribute("href", NETWORK.root);
  });

  it("renders only the first IP of each type when there are multiple addresses of each type", () => {
    mockUseIpAddressesFn.mockReturnValue(["192.168.1.1", "fe80::1", "192.168.1.2", "fe80::2"]);

    installerRender(<FormattedIPsList />);
    screen.getByText(/192\.168\.1\.1/);
    screen.getByText(/fe80::1/);
    expect(screen.queryByText(/192\.168\.1\.2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/fe80::2/)).not.toBeInTheDocument();
    screen.getByRole("link", { name: "2 more" });
  });
});

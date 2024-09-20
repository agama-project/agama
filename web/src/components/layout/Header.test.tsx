/*
 * Copyright (c) [2024] SUSE LLC
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
import { installerRender } from "~/test-utils";
import Header from "./Header";

const tumbleweed = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  description: "Tumbleweed description...",
};
const microos = {
  id: "MicroOS",
  name: "openSUSE MicroOS",
  description: "MicroOS description",
};

jest.mock("~/components/core/InstallerOptions", () => () => <div>Installer Options Mock</div>);

jest.mock("~/queries/software", () => ({
  useProduct: () => ({
    products: [tumbleweed, microos],
    selectedProduct: tumbleweed,
  }),
}));

describe("Header", () => {
  it("renders the product name unless mount with hideProductName prop", () => {
    const { rerender } = installerRender(<Header />);
    screen.getByRole("heading", { name: tumbleweed.name, level: 1 });
    rerender(<Header hideProductName={false} />);
    screen.getByRole("heading", { name: tumbleweed.name, level: 1 });
    rerender(<Header hideProductName />);
    expect(screen.queryByRole("heading", { name: tumbleweed.name, level: 1 })).toBeNull();
  });

  it("renders the installer options unless mount with hideInstallerOptions prop", () => {
    const { rerender } = installerRender(<Header />);
    screen.getByText("Installer Options Mock");
    rerender(<Header hideInstallerOptions={false} />);
    screen.getByText("Installer Options Mock");
    rerender(<Header hideInstallerOptions />);
    expect(screen.queryByText("Installer Options Mock")).toBeNull();
  });
});

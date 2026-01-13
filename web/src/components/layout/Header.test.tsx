/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { plainRender, installerRender } from "~/test-utils";
import { Product } from "~/types/software";
import { System } from "~/model/system/network";
import Header from "./Header";
import { useSystem } from "~/hooks/model/system";

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  description: "Tumbleweed description...",
  registration: false,
};

const microos: Product = {
  id: "MicroOS",
  name: "openSUSE MicroOS",
  description: "MicroOS description",
  registration: false,
};

const network: System = {
  connections: [],
  devices: [],
  state: {
    connectivity: true,
    copyNetwork: true,
    networkingEnabled: true,
    wirelessEnabled: true,
  },
  accessPoints: [],
};

jest.mock("~/components/core/InstallerOptions", () => () => <div>Installer Options Mock</div>);
jest.mock("~/components/core/InstallButton", () => () => <div>Install Button Mock</div>);

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: (): ReturnType<typeof useSystem> => ({ products: [tumbleweed, microos], network }),
}));

jest.mock("~/hooks/model/config/product", () => ({
  ...jest.requireActual("~/hooks/model/config/product"),
  useProductInfo: (): Product => tumbleweed,
}));

describe("Header", () => {
  it("renders given title as heading level 1", () => {
    plainRender(<Header title={tumbleweed.name} />);
    screen.getByRole("heading", { name: tumbleweed.name, level: 1 });
  });

  it("renders skip to content link", async () => {
    plainRender(<Header />);
    screen.getByRole("link", { name: "Skip to content" });
  });

  it("does not render skip to content link when showSkipToContent is false", async () => {
    plainRender(<Header showSkipToContent={false} />);
    expect(screen.queryByRole("link", { name: "Skip to content" })).toBeNull();
  });

  it("mounts the Install button", () => {
    plainRender(<Header />);
    screen.getByText("Install Button Mock");
  });

  it("mounts installer options by default", () => {
    plainRender(<Header showInstallerOptions />);
    screen.getByText("Installer Options Mock");
  });

  it("mounts installer options when showInstallerOptions=true", () => {
    plainRender(<Header showInstallerOptions />);
    screen.getByText("Installer Options Mock");
  });

  it("does not mount installer options when showInstallerOptions=false", () => {
    plainRender(<Header showInstallerOptions={false} />);
    expect(screen.queryByText("Installer Options Mock")).toBeNull();
  });

  it("renders an options dropdown by default", async () => {
    const { user } = installerRender(<Header />);
    expect(screen.queryByRole("menu")).toBeNull();
    const toggler = screen.getByRole("button", { name: "Options toggle" });
    await user.click(toggler);
    const menu = await screen.findByRole("menu");
    within(menu).getByRole("menuitem", { name: "Change product" });
    within(menu).getByRole("menuitem", { name: "Download logs" });
  });
});

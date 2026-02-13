/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { installerRender, mockNavigateFn } from "~/test-utils";
import ConnectedDevicesMenu from "./ConnectedDevicesMenu";
import { STORAGE as PATHS } from "~/routes/paths";

/*const mockUseZFCPSupported = jest.fn();
jest.mock("~/queries/storage/zfcp", () => ({
  ...jest.requireActual("~/queries/storage/zfcp"),
  useZFCPSupported: () => mockUseZFCPSupported(),
}));

const mockUseDASDSupported = jest.fn();
jest.mock("~/queries/storage/dasd", () => ({
  ...jest.requireActual("~/queries/storage/dasd"),
  useDASDSupported: () => mockUseDASDSupported(),
}));
*/

const mockReactivateSystem = jest.fn();
jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  activateStorageAction: () => mockReactivateSystem(),
}));

/*
beforeEach(() => {
  mockUseZFCPSupported.mockReturnValue(false);
  mockUseDASDSupported.mockReturnValue(false);
});
*/

async function openMenu() {
  const { user } = installerRender(<ConnectedDevicesMenu />);
  const button = screen.getByRole("button", { name: "More storage options" });
  await user.click(button);
  const menu = screen.getByRole("menu");
  return { user, menu };
}

it("renders the menu", () => {
  const { container } = installerRender(<ConnectedDevicesMenu />);
  screen.getByText("More");
  const icon = container.querySelector("svg");
  expect(icon).toHaveAttribute("data-icon-name", "arrow_drop_down");
});

it("allows users to rescan devices", async () => {
  const { user, menu } = await openMenu();
  const reprobeItem = within(menu).getByRole("menuitem", { name: /Rescan/ });
  await user.click(reprobeItem);
  expect(mockReactivateSystem).toHaveBeenCalled();
});

it("allows users to configure iSCSI", async () => {
  const { user, menu } = await openMenu();
  const iscsiItem = within(menu).getByRole("menuitem", { name: /Configure iSCSI/ });
  await user.click(iscsiItem);
  expect(mockNavigateFn).toHaveBeenCalledWith(PATHS.iscsi.root);
});

describe("if zFCP is not supported", () => {
  /*
  beforeEach(() => {
    mockUseZFCPSupported.mockReturnValue(false);
  });
  */

  it("does not allow users to configure zFCP", async () => {
    const { menu } = await openMenu();
    const zfcpItem = within(menu).queryByRole("menuitem", { name: /Configure zFCP/ });
    expect(zfcpItem).not.toBeInTheDocument();
  });
});

describe.skip("if zFCP is supported", () => {
  /*
  beforeEach(() => {
    mockUseZFCPSupported.mockReturnValue(true);
  });
  */

  it("allows users to configure zFCP", async () => {
    const { user, menu } = await openMenu();
    const zfcpItem = within(menu).getByRole("menuitem", { name: /Configure zFCP/ });
    await user.click(zfcpItem);
    expect(mockNavigateFn).toHaveBeenCalledWith(PATHS.zfcp.root);
  });
});

describe("if DASD is not supported", () => {
  /*
  beforeEach(() => {
    mockUseDASDSupported.mockReturnValue(false);
  });
  */

  it("does not allow users to configure DASD", async () => {
    const { menu } = await openMenu();
    const dasdItem = within(menu).queryByRole("menuitem", { name: /Configure DASD/ });
    expect(dasdItem).not.toBeInTheDocument();
  });
});

describe.skip("if DASD is supported", () => {
  /*
  beforeEach(() => {
    mockUseDASDSupported.mockReturnValue(true);
  });
  */

  it("allows users to configure DASD", async () => {
    const { user, menu } = await openMenu();
    const dasdItem = within(menu).getByRole("menuitem", { name: /Configure DASD/ });
    await user.click(dasdItem);
    expect(mockNavigateFn).toHaveBeenCalledWith(PATHS.dasd);
  });
});

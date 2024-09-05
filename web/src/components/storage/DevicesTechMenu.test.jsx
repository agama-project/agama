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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { createClient } from "~/client";
import DevicesTechMenu from "./DevicesTechMenu";
import { DASDSupported } from "~/api/dasd";

jest.mock("~/client");
jest.mock("~/api/dasd");

const isZFCPSupportedFn = jest.fn();

const zfcp = {
  isSupported: isZFCPSupportedFn,
};

beforeEach(() => {
  DASDSupported.mockResolvedValue(false);
  isZFCPSupportedFn.mockResolvedValue(false);

  createClient.mockImplementation(() => {
    return {
      storage: { zfcp },
    };
  });
});

it("contains an entry for configuring iSCSI", async () => {
  const { user } = installerRender(<DevicesTechMenu />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  const link = screen.getByRole("option", { name: /iSCSI/ });
  expect(link).toHaveAttribute("href", "/storage/iscsi");
});

it("contains an entry for configuring DASD when is supported", async () => {
  DASDSupported.mockResolvedValue(true);
  const { user } = installerRender(<DevicesTechMenu />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  const link = screen.getByRole("option", { name: /DASD/ });
  expect(link).toHaveAttribute("href", "/storage/dasd");
});

it("does not contain an entry for configuring DASD when is NOT supported", async () => {
  DASDSupported.mockResolvedValue(false);
  const { user } = installerRender(<DevicesTechMenu />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  expect(screen.queryByRole("option", { name: /DASD/ })).toBeNull();
});

it("contains an entry for configuring zFCP when is supported", async () => {
  isZFCPSupportedFn.mockResolvedValue(true);
  const { user } = installerRender(<DevicesTechMenu />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  const link = screen.getByRole("option", { name: /zFCP/ });
  expect(link).toHaveAttribute("href", "/storage/zfcp");
});

it("does not contain an entry for configuring zFCP when is NOT supported", async () => {
  isZFCPSupportedFn.mockResolvedValue(false);
  const { user } = installerRender(<DevicesTechMenu />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  expect(screen.queryByRole("option", { name: /DASD/ })).toBeNull();
});

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
import DevicesTechMenu from "./DevicesTechMenu";
import { _ } from "~/i18n";
import { supportedDASD } from "~/api/dasd";
import { supportedZFCP } from "~/api/zfcp";

jest.mock("~/api/dasd");
jest.mock("~/api/zfcp");

beforeEach(() => {
  (supportedDASD as jest.Mock).mockResolvedValue(false);
  (supportedZFCP as jest.Mock).mockResolvedValue(false);
});

it("contains an entry for configuring iSCSI", async () => {
  const { user } = installerRender(<DevicesTechMenu label={_("storage techs")} />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  const link = screen.getByRole("option", { name: /iSCSI/ });
  expect(link).toHaveAttribute("href", "/storage/iscsi");
});

it("does not contain an entry for configuring DASD when is NOT supported", async () => {
  const { user } = installerRender(<DevicesTechMenu label={_("storage techs")} />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  expect(screen.queryByRole("option", { name: /DASD/ })).toBeNull();
});

it("contains an entry for configuring DASD when is supported", async () => {
  (supportedDASD as jest.Mock).mockResolvedValue(true);
  const { user } = installerRender(<DevicesTechMenu label={_("storage techs")} />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  const link = screen.getByRole("option", { name: /DASD/ });
  expect(link).toHaveAttribute("href", "/storage/dasd");
});

it("does not contain an entry for configuring zFCP when is NOT supported", async () => {
  const { user } = installerRender(<DevicesTechMenu label={_("storage techs")} />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  expect(screen.queryByRole("option", { name: /DASD/ })).toBeNull();
});

it("contains an entry for configuring zFCP when is supported", async () => {
  (supportedZFCP as jest.Mock).mockResolvedValue(true);
  const { user } = installerRender(<DevicesTechMenu label={_("storage techs")} />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  const link = screen.getByRole("option", { name: /zFCP/ });
  expect(link).toHaveAttribute("href", "/storage/zfcp");
});

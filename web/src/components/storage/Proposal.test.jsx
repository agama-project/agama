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
import Proposal from "./Proposal";

const subvolAction = {
  text: "Create subvolume @ on /dev/sda1",
  subvol: true,
  delete: false
};

const generalAction = {
  text: "Mount /dev/sda1 as root",
  subvol: false,
  delete: false
};

it("displays the actions showing/hiding the subvolume actions on user request", async () => {
  const { user } = installerRender(<Proposal data={[generalAction, subvolAction]} />);
  expect(screen.getByText(generalAction.text)).toBeVisible();
  expect(screen.getByText(subvolAction.text)).not.toBeVisible();

  const showButton = screen.getByRole("button", { name: /Show/ });
  await user.click(showButton);
  expect(screen.getByText(subvolAction.text)).toBeVisible();

  const hideButton = screen.getByRole("button", { name: /Hide/ });
  await user.click(hideButton);
  expect(screen.getByText(subvolAction.text)).not.toBeVisible();
});

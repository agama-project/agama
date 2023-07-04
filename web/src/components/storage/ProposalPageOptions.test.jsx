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
import { installerRender, mockLayout } from "~/test-utils";
import { createClient } from "~/client";
import { ProposalPageOptions } from "~/components/storage";

jest.mock("~/client");
jest.mock("~/components/layout/Layout", () => mockLayout());

const isDASDSupportedFn = jest.fn();

const dasd = {
  isSupported: isDASDSupportedFn
};

const isZFCPSupportedFn = jest.fn();

const zfcp = {
  isSupported: isZFCPSupportedFn
};

beforeEach(() => {
  isDASDSupportedFn.mockResolvedValue(false);
  isZFCPSupportedFn.mockResolvedValue(false);

  createClient.mockImplementation(() => {
    return {
      storage: { dasd, zfcp }
    };
  });
});

it("contains an entry for configuring iSCSI", async () => {
  const { user } = installerRender(<ProposalPageOptions />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  screen.getByRole("menuitem", { name: /iSCSI/ });
});

it("contains an entry for configuring DASD when is supported", async () => {
  isDASDSupportedFn.mockResolvedValue(true);
  const { user } = installerRender(<ProposalPageOptions />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  screen.getByRole("menuitem", { name: /DASD/ });
});

it("does not contain an entry for configuring DASD when is NOT supported", async () => {
  isDASDSupportedFn.mockResolvedValue(false);
  const { user } = installerRender(<ProposalPageOptions />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  expect(screen.queryByRole("menuitem", { name: /DASD/ })).toBeNull();
});

it("contains an entry for configuring zFCP when is supported", async () => {
  isZFCPSupportedFn.mockResolvedValue(true);
  const { user } = installerRender(<ProposalPageOptions />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  screen.getByRole("menuitem", { name: /zFCP/ });
});

it("does not contain an entry for configuring zFCP when is NOT supported", async () => {
  isZFCPSupportedFn.mockResolvedValue(false);
  const { user } = installerRender(<ProposalPageOptions />);
  const toggler = screen.getByRole("button");
  await user.click(toggler);
  expect(screen.queryByRole("menuitem", { name: /DASD/ })).toBeNull();
});

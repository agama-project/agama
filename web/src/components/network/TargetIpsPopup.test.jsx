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

import { act, screen, waitFor, within } from "@testing-library/react";
import { installerRender } from "@/test-utils";
import { createClient } from "@client";

import { TargetIpsPopup } from "@components/network";

jest.mock("@client");

const addresses = [
  { address: "1.2.3.4", prefix: 24 },
  { address: "5.6.7.8", prefix: 16 },
];
const addressFn = jest.fn().mockReturnValue(addresses);
const networkSettings = { wifiScanSupported: false, hostname: "example.net" };
const settingsFn = jest.fn().mockReturnValue(networkSettings);

describe("TargetIpsPopup", () => {
  let callbacks;
  beforeEach(() => {
    callbacks = [];
    const onNetworkEventFn = (cb) => { callbacks.push(cb) };
    createClient.mockImplementation(() => {
      return {
        network: {
          onNetworkEvent: onNetworkEventFn,
          addresses: addressFn,
          settings: settingsFn,
          setUp: jest.fn().mockResolvedValue()
        }
      };
    });
  });

  it("lists target IPs in hostname labeled popup", async () => {
    const { user } = installerRender(<TargetIpsPopup />);

    const button = await screen.findByRole("button", { name: /1.2.3.4\/24 \(example.net\)/i });
    await user.click(button);

    const dialog = await screen.findByRole("dialog");

    within(dialog).getByText(/IP Addresses/);
    within(dialog).getByText("5.6.7.8/16");

    const closeButton = within(dialog).getByRole("button", { name: /Close/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("triggers onClickCallback function when popup is open", async () => {
    const onClickCallback = jest.fn();

    const { user } = installerRender(<TargetIpsPopup onClickCallback={onClickCallback} />);

    const button = await screen.findByRole("button", { name: /1.2.3.4\/24 \(example.net\)/i });
    await user.click(button);
    expect(onClickCallback).toHaveBeenCalled();
  });

  it("updates address and hostname if they change", async () => {
    installerRender(<TargetIpsPopup />);
    await screen.findByRole("button", { name: /1.2.3.4\/24 \(example.net\)/i });

    addressFn.mockReturnValue([{ address: "5.6.7.8", prefix: 24 }]);
    settingsFn.mockReturnValue({ wifiScanSupported: false, hostname: "localhost.localdomain" });
    act(() => {
      callbacks.forEach(cb => cb());
    });
    await screen.findByRole("button", { name: /5.6.7.8\/24 \(localhost.localdomain\)/i });
  });
});

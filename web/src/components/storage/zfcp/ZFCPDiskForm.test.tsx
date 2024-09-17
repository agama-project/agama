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
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { plainRender } from "~/test-utils";
import { ZFCPDisk, ZFCPController } from "~/types/zfcp";
import ZFCPDiskForm from "./ZFCPDiskForm";

// The form does not provide a submit button by itself.
const FormWrapper = (props) => {
  return (
    <>
      <ZFCPDiskForm {...props} />
      <input type="submit" form={props.id} value="Accept" />
    </>
  );
};

const mockZFCPDisk: ZFCPDisk[] = [
  {
    name: "/dev/sda",
    channel: "0.0.fa00",
    wwpn: "0x500507630b181216",
    lun: "0x4020404900000000",
  },
  {
    name: "/dev/sdb",
    channel: "0.0.fc00",
    wwpn: "0x500507630b101216",
    lun: "0x0001000000000000",
  },
];

const mockZFCPControllers: ZFCPController[] = [
  {
    id: "1",
    channel: "0.0.fa00",
    lunScan: false,
    active: true,
    lunsMap: {
      "0x500507630b181216": ["0x4020404900000000", "0x4020404900000001"],
      "0x500507680d7e284a": [],
      "0x500507680d0e284a": [],
    },
  },
  {
    id: "2",
    channel: "0.0.fc00",
    lunScan: false,
    active: true,
    lunsMap: {
      "0x500507680d7e284b": [],
      "0x500507680d0e284b": [],
      "0x500507630b101216": ["0x0000000000000000", "0x0001000000000000"],
    },
  },
];

jest.mock("~/queries/zfcp", () => ({
  useZFCPDisks: () => mockZFCPDisk,
  useZFCPControllers: () => mockZFCPControllers,
}));

const props = {
  id: "ZFCPDiskForm",
  onSubmit: jest.fn().mockResolvedValue({ data: null, status: 200 }),
  onLoading: jest.fn(),
};

it("renders a form for selecting channel, WWPN and LUN", async () => {
  plainRender(<ZFCPDiskForm {...props} />);

  const form = await screen.findByRole("form");
  const channelSelector = within(form).getByRole("combobox", { name: "Channel ID" });
  expect(within(channelSelector).getAllByRole("option").length).toBe(2);
  within(channelSelector).getByRole("option", { name: "0.0.fc00" });

  within(form).getByRole("combobox", { name: "WWPN" });
  within(form).getByRole("combobox", { name: "LUN" });
});

it("offers the WWPNs of the selected channel", async () => {
  plainRender(<ZFCPDiskForm {...props} />);

  const form = await screen.findByRole("form");
  const channelSelector = within(form).getByRole("combobox", { name: "Channel ID" });
  const channelOption = within(channelSelector).getByRole("option", { name: "0.0.fa00" });

  await userEvent.selectOptions(channelSelector, channelOption);

  const wwpnSelector = within(form).getByRole("combobox", { name: "WWPN" });
  expect(within(wwpnSelector).getAllByRole("option").length).toBe(1);
  within(wwpnSelector).getByRole("option", { name: "0x500507630b181216" });
});

it("offers the LUNs of the selected channel and WWPN", async () => {
  plainRender(<ZFCPDiskForm {...props} />);

  const form = await screen.findByRole("form");
  const channelSelector = within(form).getByRole("combobox", { name: "Channel ID" });
  const channelOption = within(channelSelector).getByRole("option", { name: "0.0.fa00" });

  await userEvent.selectOptions(channelSelector, channelOption);

  const wwpnSelector = within(form).getByRole("combobox", { name: "WWPN" });
  expect(within(wwpnSelector).getAllByRole("option").length).toBe(1);
  const wwpnOption = within(wwpnSelector).getByRole("option", { name: "0x500507630b181216" });

  await userEvent.selectOptions(wwpnSelector, wwpnOption);

  const lunSelector = within(form).getByRole("combobox", { name: "LUN" });
  expect(within(lunSelector).getAllByRole("option").length).toBe(1);
  within(lunSelector).getByRole("option", { name: "0x4020404900000001" });
});

describe("when the form is submitted", () => {
  it("calls to the given onSubmit prop", async () => {
    const { user } = plainRender(<FormWrapper {...props} />);

    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(props.onSubmit).toHaveBeenCalledWith({
      id: "1",
      channel: "0.0.fa00",
      wwpn: "0x500507630b181216",
      lun: "0x4020404900000001",
    });

    expect(screen.queryByText(/was not activated/)).toBeNull();
  });

  it("shows an error if the action fails", async () => {
    props.onSubmit = jest.fn().mockResolvedValue({ status: 400 });

    const { user } = plainRender(<FormWrapper {...props} />);

    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);

    screen.getByText(/was not activated/);
  });
});

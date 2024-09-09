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

import React, { ComponentProps } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { plainRender } from "~/test-utils";
import { ZFCPDiskForm } from "~/components/storage";

// The form does not provide a submit button by itself.
const FormWrapper = (props) => {
  return (
    <>
      <ZFCPDiskForm {...props} />
      <input type="submit" form={props.id} value="Accept" />
    </>
  );
};

const luns = [
  { channel: "0.0.fa00", wwpn: "0x500507630703d3b3", lun: "0x0000000000000001" },
  { channel: "0.0.fa00", wwpn: "0x500507630703d3b3", lun: "0x0000000000000002" },
  { channel: "0.0.fa00", wwpn: "0x500507630704d3b3", lun: "0x0000000000000010" },
  { channel: "0.0.fa00", wwpn: "0x500507630704d3b3", lun: "0x0000000000000020" },
  { channel: "0.0.fb00", wwpn: "0x500507630705d3b3", lun: "0x0000000000000100" },
  { channel: "0.0.fb00", wwpn: "0x500507630705d3b3", lun: "0x0000000000000200" },
];

let props = {};

beforeEach(() => {
  props = {
    id: "ZFCPDiskForm",
    luns,
    onSubmit: jest.fn().mockResolvedValue(0),
    onLoading: jest.fn(),
  };
});

it("renders a form for selecting channel, WWPN and LUN", async () => {
  plainRender(<ZFCPDiskForm {...props} />);

  const form = await screen.findByRole("form");
  const channelSelector = within(form).getByRole("combobox", { name: "Channel ID" });
  expect(within(channelSelector).getAllByRole("option").length).toBe(2);
  within(channelSelector).getByRole("option", { name: "0.0.fa00" });
  within(channelSelector).getByRole("option", { name: "0.0.fb00" });

  within(form).getByRole("combobox", { name: "WWPN" });
  within(form).getByRole("combobox", { name: "LUN" });
});

it("offers the WWPNs of the selected channel", async () => {
  plainRender(<ZFCPDiskForm {...props} />);

  const form = await screen.findByRole("form");
  const channelSelector = within(form).getByRole("combobox", { name: "Channel ID" });
  const channelOption = within(channelSelector).getByRole("option", { name: "0.0.fb00" });

  await userEvent.selectOptions(channelSelector, channelOption);

  const wwpnSelector = within(form).getByRole("combobox", { name: "WWPN" });
  expect(within(wwpnSelector).getAllByRole("option").length).toBe(1);
  within(wwpnSelector).getByRole("option", { name: "0x500507630705d3b3" });
});

it("offers the LUNs of the selected channel and WWPN", async () => {
  plainRender(<ZFCPDiskForm {...props} />);

  const form = await screen.findByRole("form");
  const channelSelector = within(form).getByRole("combobox", { name: "Channel ID" });
  const channelOption = within(channelSelector).getByRole("option", { name: "0.0.fa00" });

  await userEvent.selectOptions(channelSelector, channelOption);

  const wwpnSelector = within(form).getByRole("combobox", { name: "WWPN" });
  expect(within(wwpnSelector).getAllByRole("option").length).toBe(2);
  const wwpnOption = within(wwpnSelector).getByRole("option", { name: "0x500507630704d3b3" });

  await userEvent.selectOptions(wwpnSelector, wwpnOption);

  const lunSelector = within(form).getByRole("combobox", { name: "LUN" });
  expect(within(lunSelector).getAllByRole("option").length).toBe(2);
  within(lunSelector).getByRole("option", { name: "0x0000000000000010" });
  within(lunSelector).getByRole("option", { name: "0x0000000000000020" });
});

describe("when the form is submitted", () => {
  it("calls to the given onSubmit prop", async () => {
    const { user } = plainRender(<FormWrapper {...props} />);

    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(props.onSubmit).toHaveBeenCalledWith({
      channel: "0.0.fa00",
      wwpn: "0x500507630703d3b3",
      lun: "0x0000000000000001",
    });

    expect(screen.queryByText(/was not activated/)).toBeNull();
  });

  it("shows an error if the action fails", async () => {
    props.onSubmit = jest.fn().mockResolvedValue(1);

    const { user } = plainRender(<FormWrapper {...props} />);

    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);

    screen.getByText(/was not activated/);
  });
});

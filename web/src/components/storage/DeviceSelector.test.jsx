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

import React, { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender } from "@/test-utils";
import { DeviceSelector } from "@components/storage";

const availableDevices = [
  { id: "/dev/sda", label: "/dev/sda, 500 GiB" },
  { id: "/dev/sdb", label: "/dev/sdb, 1 TiB" },
  { id: "/dev/sdc", label: "/dev/sdc, 250 GiB" },
];

const selectedDevice = "/dev/sdb";

describe("DeviceSelector", () => {
  it("renders a combobox with given options", () => {
    installerRender(
      <DeviceSelector value={selectedDevice} options={availableDevices} />
    );

    const selector = screen.getByRole("combobox", { name: "Storage device selector" });
    within(selector).getByRole("option", { name: "/dev/sda, 500 GiB" });
    within(selector).getByRole("option", { name: "/dev/sdb, 1 TiB" });
    within(selector).getByRole("option", { name: "/dev/sdc, 250 GiB" });
  });

  it("renders a combobox with given value as selected option", () => {
    installerRender(
      <DeviceSelector value={selectedDevice} options={availableDevices} />
    );

    const selector = screen.getByRole("combobox", { name: "Storage device selector" });
    const option = within(selector).getByRole("option", { name: "/dev/sdb, 1 TiB" });
    expect(option.selected).toBe(true);
  });

  it("triggers onChange callback when user changes the selected option", async () => {
    const FakeSection = () => {
      const [selectedOption, setSelectedOption] = useState(null);

      return (
        <>
          <DeviceSelector
            value={selectedDevice}
            options={availableDevices}
            onChange={setSelectedOption}
          />
          Selected device: {selectedOption}
        </>
      );
    };

    const { user } = installerRender(<FakeSection />);
    const selector = screen.getByRole("combobox", { name: "Storage device selector" });
    const option = within(selector).getByRole("option", { name: "/dev/sdc, 250 GiB" });

    await waitFor(() => {
      expect(screen.queryByText("Selected device: /dev/sdc")).not.toBeInTheDocument();
    });

    await user.selectOptions(selector, option);

    await screen.findByText("Selected device: /dev/sdc");
  });
});

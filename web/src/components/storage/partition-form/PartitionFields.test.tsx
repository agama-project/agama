/*
 * Copyright (c) [2026] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { defaultOptions } from "./fields";
import PartitionFields from "./PartitionFields";

const mockDevice = {
  sid: 1,
  name: "/dev/vdd",
  description: "Virtual disk",
  partitions: [
    {
      sid: 10,
      name: "vdd1",
      description: "10.00 GiB",
      filesystem: { sid: 100, type: "ext4" as const, label: "Data" },
    },
    {
      sid: 20,
      name: "vdd2",
      description: "20.00 GiB",
      filesystem: { sid: 200, type: "xfs" as const, label: "" },
    },
    {
      sid: 30,
      name: "vdd3",
      description: "5.00 GiB",
      filesystem: undefined,
    },
  ],
};

function TestForm({ availablePartitions = mockDevice.partitions }) {
  const form = useAppForm({ ...defaultOptions });
  return (
    <PartitionFields form={form} device={mockDevice} availablePartitions={availablePartitions} />
  );
}

describe("PartitionFields", () => {
  describe("when no partitions are available", () => {
    it("shows a read-only field explaining that a new partition will be created", () => {
      installerRender(<TestForm availablePartitions={[]} />);
      screen.getByText(/New partition. There are no available/);
    });
  });

  describe("when partitions are available", () => {
    it("shows a dropdown with 'New partition' option", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByLabelText("Partition"));
      screen.getByRole("option", { name: /New partition/ });
    });

    it("shows existing partitions as options", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByLabelText("Partition"));
      screen.getByRole("option", { name: /vdd1/ });
      screen.getByRole("option", { name: /vdd2/ });
      screen.getByRole("option", { name: /vdd3/ });
    });

    it("includes partition size in the option label", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByLabelText("Partition"));
      screen.getByRole("option", { name: /10\.00 GiB/ });
      screen.getByRole("option", { name: /20\.00 GiB/ });
      screen.getByRole("option", { name: /5\.00 GiB/ });
    });

    it("includes filesystem label in the option description when available", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByLabelText("Partition"));
      screen.getByRole("option", { name: /Data/ });
    });

    it("pre-selects 'New partition' by default", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByLabelText("Partition"));
      expect(screen.getByRole("option", { name: /New partition/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });
});

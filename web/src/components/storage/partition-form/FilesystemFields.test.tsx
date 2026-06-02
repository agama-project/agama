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
import { defaultOptions, FILESYSTEM_TYPE } from "./fields";
import FilesystemFields from "./FilesystemFields";

const mockVolumeTemplate = {
  minSize: 20 * 1024 * 1024 * 1024,
  fsType: "xfs",
  outline: {
    fsTypes: ["xfs", "ext4", "btrfs"],
  },
};

jest.mock("~/hooks/model/system/storage", () => ({
  useVolumeTemplate: () => mockVolumeTemplate,
}));

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
      description: "30.00 GiB",
      filesystem: undefined,
    },
  ],
};

function TestForm({ defaultValues = {} }: { defaultValues?: object }) {
  const form = useAppForm({
    ...defaultOptions,
    defaultValues: {
      ...defaultOptions.defaultValues,
      ...defaultValues,
    },
  });

  return <FilesystemFields form={form} device={mockDevice} />;
}

describe("FilesystemFields", () => {
  it("renders the filesystem selector", () => {
    installerRender(<TestForm />);
    screen.getByLabelText("File system");
  });

  describe("when creating a new partition", () => {
    it("shows Default option", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByLabelText("File system"));
      screen.getByRole("option", { name: "Default" });
    });

    it("shows available filesystem types", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByLabelText("File system"));
      screen.getByRole("option", { name: "XFS" });
      screen.getByRole("option", { name: "Ext4" });
      screen.getByRole("option", { name: "Btrfs" });
    });

    it("shows hint when Default is selected with committed mount point", () => {
      installerRender(
        <TestForm
          defaultValues={{
            committedMountPoint: "/home",
            filesystem: FILESYSTEM_TYPE.AUTO,
          }}
        />,
      );
      screen.getByText(/Uses XFS/);
    });

    it("does not show hint when Default is selected without mount point", () => {
      installerRender(
        <TestForm
          defaultValues={{
            committedMountPoint: "",
            filesystem: FILESYSTEM_TYPE.AUTO,
          }}
        />,
      );
      expect(screen.queryByText(/Uses/)).not.toBeInTheDocument();
    });
  });

  describe("when reusing a partition with compatible filesystem", () => {
    const defaultValues = {
      name: "vdd1",
      committedMountPoint: "/home",
      filesystem: "reuse",
    };

    it("shows 'Current' option as the first option", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("File system"));
      const options = screen.getAllByRole("option");
      expect(options[0]).toHaveTextContent(/Current \(Ext4\)/);
    });

    it("includes keep data description in Current option", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("File system"));
      screen.getByRole("option", { name: /Do not format/ });
    });

    it("shows format options after a divider", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("File system"));
      screen.getByRole("option", { name: "Default" });
      screen.getByRole("option", { name: "XFS" });
    });

    it("shows warning when switching from reuse to format", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("File system"));
      await user.click(screen.getByRole("option", { name: "Default" }));
      screen.getByText(/Existing data on vdd1 will be destroyed/);
    });

    it("does not show warning when Current option is selected", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.queryByText(/will be destroyed/)).not.toBeInTheDocument();
    });
  });

  describe("when reusing a partition without filesystem", () => {
    it("auto-resets to Default when filesystem is 'reuse'", async () => {
      const { user } = installerRender(
        <TestForm
          defaultValues={{
            name: "vdd3",
            committedMountPoint: "/home",
            filesystem: "reuse",
          }}
        />,
      );

      await user.click(screen.getByLabelText("File system"));
      const options = screen.getAllByRole("option");
      expect(options[0]).toHaveTextContent("Default");
      expect(screen.queryByRole("option", { name: /Current/ })).not.toBeInTheDocument();
    });

    it("does not show Current option in dropdown", async () => {
      const { user } = installerRender(
        <TestForm
          defaultValues={{
            name: "vdd3",
            committedMountPoint: "/home",
            filesystem: FILESYSTEM_TYPE.AUTO,
          }}
        />,
      );

      await user.click(screen.getByLabelText("File system"));
      expect(screen.queryByRole("option", { name: /Current/ })).not.toBeInTheDocument();
      screen.getByRole("option", { name: "Default" });
    });
  });

  describe("when only one filesystem type is available", () => {
    beforeEach(() => {
      mockVolumeTemplate.fsType = "swap";
      mockVolumeTemplate.outline.fsTypes = ["swap"];
    });

    afterEach(() => {
      mockVolumeTemplate.fsType = "xfs";
      mockVolumeTemplate.outline.fsTypes = ["xfs", "ext4", "btrfs"];
    });

    it("shows a read-only field instead of dropdown", () => {
      installerRender(
        <TestForm defaultValues={{ committedMountPoint: "swap", filesystem: "swap" }} />,
      );
      screen.getByText("Swap");
      expect(screen.queryByRole("button", { name: "File system" })).not.toBeInTheDocument();
    });
  });

  describe("additional filesystem settings", () => {
    it("shows checkbox for additional settings when filesystem supports it", async () => {
      installerRender(<TestForm defaultValues={{ filesystem: FILESYSTEM_TYPE.AUTO }} />);
      screen.getByLabelText(/Define more file system settings/);
    });

    it("does not show checkbox when reusing partition", () => {
      installerRender(<TestForm defaultValues={{ name: "vdd1", filesystem: "reuse" }} />);
      expect(screen.queryByLabelText(/Define more file system settings/)).not.toBeInTheDocument();
    });
  });
});

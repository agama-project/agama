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
import { sharedDefaultOptions, SIZE_MODE } from "./fields";
import type { UseSolvedSizes } from "./SizeFields";
import SizeFields from "./SizeFields";

jest.mock("~/hooks/model/system/storage", () => ({
  useVolumeTemplate: () => ({
    minSize: 20 * 1024 * 1024 * 1024,
    fsType: "xfs",
    autoSize: true,
    mountPath: "/home",
    outline: {
      fsTypes: ["xfs", "ext4"],
      sizeRelevantVolumes: [],
      snapshotsAffectSizes: false,
      adjustByRam: false,
    },
  }),
}));

// The host form provides the size-solving hook; SizeFields itself is agnostic.
const fakeUseSolvedSizes: UseSolvedSizes = (mountPoint) =>
  mountPoint ? { min: "20 GiB", max: undefined } : null;

function TestForm({ defaultValues = {} }: { defaultValues?: object }) {
  const form = useAppForm({
    ...sharedDefaultOptions,
    defaultValues: {
      ...sharedDefaultOptions.defaultValues,
      ...defaultValues,
    },
  });

  return <SizeFields form={form} useSolvedSizes={fakeUseSolvedSizes} />;
}

describe("SizeFields", () => {
  it("renders the size mode selector", () => {
    installerRender(<TestForm />);
    screen.getByLabelText("Size");
  });

  describe("when size mode is Automatic", () => {
    it("shows automatic size note when mount point is committed", () => {
      installerRender(<TestForm defaultValues={{ committedMountPoint: "/home" }} />);
      screen.getByText(/Minimum/);
      screen.getByText(/size for .* with the current settings/);
    });

    it("does not show size note when mount point is empty", () => {
      installerRender(<TestForm defaultValues={{ committedMountPoint: "" }} />);
      expect(screen.queryByText(/Minimum/)).not.toBeInTheDocument();
    });
  });

  describe("when size mode is Fixed", () => {
    const defaultValues = { sizeMode: SIZE_MODE.FIXED };

    it("shows the value input field", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Fixed/ }));
      screen.getByLabelText("Value");
    });

    it("shows format instructions", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Fixed/ }));
      screen.getByText(/The size must be a number followed by a unit/);
      screen.getByText(/GiB.*power of 2/);
    });
  });

  describe("when size mode is Range", () => {
    const defaultValues = { sizeMode: SIZE_MODE.RANGE };

    it("shows minimum and maximum input fields", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Range/ }));
      screen.getByLabelText("Minimum");
      screen.getByLabelText("Maximum");
    });

    it("shows format instructions in plural form", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Range/ }));
      screen.getByText(/The limits must be numbers followed by a unit/);
    });
  });

  describe("when size mode is Expand", () => {
    const defaultValues = { sizeMode: SIZE_MODE.EXPAND };

    it("shows the minimum input field", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Expand/ }));
      screen.getByLabelText("Minimum");
    });

    it("shows format instructions", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Expand/ }));
      screen.getByText(/The size must be a number followed by a unit/);
    });
  });

  describe("size mode options", () => {
    it("includes all four size modes", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByLabelText("Size"));
      screen.getByRole("option", { name: /^Automatic/ });
      screen.getByRole("option", { name: /^Fixed/ });
      screen.getByRole("option", { name: /^Range/ });
      screen.getByRole("option", { name: /^Expand/ });
    });

    it("shows descriptions for each option", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByLabelText("Size"));
      screen.getByRole("option", { name: /Let the installer set the size/ });
      screen.getByRole("option", { name: /Set a specific size/ });
      screen.getByRole("option", { name: /Set minimum and maximum/ });
      screen.getByRole("option", { name: /use more space if available/ });
    });
  });
});

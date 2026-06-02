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
import { defaultOptions, SIZE_MODE } from "./fields";
import SizeFields from "./SizeFields";

jest.mock("~/hooks/model/system/storage", () => ({
  useVolumeTemplate: () => ({
    minSize: 20 * 1024 * 1024 * 1024,
    fsType: "xfs",
    outline: {
      fsTypes: ["xfs", "ext4"],
    },
  }),
}));

function TestForm({ defaultValues = {} }: { defaultValues?: object }) {
  const form = useAppForm({
    ...defaultOptions,
    defaultValues: {
      ...defaultOptions.defaultValues,
      ...defaultValues,
    },
  });

  return <SizeFields form={form} />;
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
      screen.getByText(/Determined by/);
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
      screen.getByText(/Enter value as number followed by unit/);
      screen.getByText(/Units can be binary/);
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
      screen.getByText(/Enter values as number followed by unit/);
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

    it("shows helper text about additional space", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Expand/ }));
      screen.getByText(/May use additional space if available/);
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
      screen.getByRole("option", { name: /Installer determines the size/ });
      screen.getByRole("option", { name: /Set a specific size/ });
      screen.getByRole("option", { name: /Set minimum and maximum/ });
      screen.getByRole("option", { name: /grows if space available/ });
    });
  });
});

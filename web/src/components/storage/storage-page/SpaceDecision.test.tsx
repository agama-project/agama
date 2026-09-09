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
import { screen, within } from "@testing-library/react";
import { plainRender, mockNavigateFn } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import SpaceDecision from "~/components/storage/storage-page/SpaceDecision";

const mockDeviceConfig = jest.fn();
const mockSetSpacePolicy = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useDevice: () => mockDeviceConfig(),
  useSetSpacePolicy: () => mockSetSpacePolicy,
}));

const drive = (spacePolicy?: ConfigModel.SpacePolicy): ConfigModel.Drive =>
  ({ name: "/dev/vdd", spacePolicy }) as ConfigModel.Drive;

const options = () => screen.getByRole("group", { name: "Allowed changes" });

describe("SpaceDecision", () => {
  beforeEach(() => {
    mockDeviceConfig.mockReturnValue(drive("keep"));
  });

  it("offers the four answers at once, so the reader sees the whole decision", () => {
    plainRender(<SpaceDecision collection="drives" index={0} />);

    const names = within(options())
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(names).toEqual([
      "Deleting everything",
      "Shrinking if needed",
      "Keeping everything",
      "Custom",
    ]);
  });

  it("says what the plan is doing, which is the one that reads pressed", () => {
    plainRender(<SpaceDecision collection="drives" index={0} />);

    expect(screen.getByRole("button", { name: "Keeping everything", pressed: true }));
    expect(screen.getByRole("button", { name: "Deleting everything", pressed: false }));
  });

  describe("when another answer is chosen", () => {
    it("writes it to the configuration", async () => {
      const { user } = plainRender(<SpaceDecision collection="drives" index={0} />);
      await user.click(screen.getByRole("button", { name: "Shrinking if needed" }));

      expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 0, { type: "resize" });
    });
  });

  describe("when custom is chosen", () => {
    it("goes to where it is settled, since custom is not an answer but the rest of the question", async () => {
      const { user } = plainRender(<SpaceDecision collection="drives" index={0} />);
      await user.click(screen.getByRole("button", { name: "Custom" }));

      expect(mockSetSpacePolicy).not.toHaveBeenCalled();
      expect(mockNavigateFn).toHaveBeenCalledWith("/storage/drives/0/space-policy/edit");
    });
  });

  describe("when the device follows no rule yet", () => {
    beforeEach(() => {
      mockDeviceConfig.mockReturnValue(drive());
    });

    it("reads as keeping everything, which is what an unset rule does", () => {
      plainRender(<SpaceDecision collection="drives" index={0} />);

      expect(screen.getByRole("button", { name: "Keeping everything", pressed: true }));
    });
  });
});

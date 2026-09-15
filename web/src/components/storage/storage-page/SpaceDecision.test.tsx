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
import { useSearchParams } from "react-router";
import { installerRender } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import SpaceDecision from "~/components/storage/storage-page/SpaceDecision";
import { SpacePolicyMemory } from "~/components/storage/shared/space-policy";

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

/**
 * The address, so a test can read what a control wrote to it.
 *
 * The setter behind these params is the router's own, not the navigate spy, so
 * what it does is visible in the address and nowhere else.
 */
const Address = () => {
  const [params] = useSearchParams();
  return <output>{params.toString()}</output>;
};

const address = () => screen.getByRole("status").textContent;

describe("SpaceDecision", () => {
  beforeEach(() => {
    mockDeviceConfig.mockReturnValue(drive("keep"));
  });

  it("offers the four answers at once, so the reader sees the whole decision", () => {
    installerRender(<SpaceDecision collection="drives" index={0} />);

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
    installerRender(<SpaceDecision collection="drives" index={0} />);

    expect(screen.getByRole("button", { name: "Keeping everything", pressed: true }));
    expect(screen.getByRole("button", { name: "Deleting everything", pressed: false }));
  });

  describe("when another answer is chosen", () => {
    it("writes it to the configuration", async () => {
      const { user } = installerRender(<SpaceDecision collection="drives" index={0} />);
      await user.click(screen.getByRole("button", { name: "Shrinking if needed" }));

      expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 0, { type: "resize" });
    });
  });

  describe("when custom is chosen", () => {
    it("writes it, and opens where the rest of the question is answered", async () => {
      const { user } = installerRender(
        <>
          <SpaceDecision collection="drives" index={0} />
          <Address />
        </>,
      );
      await user.click(screen.getByRole("button", { name: "Custom" }));

      /* Written, since nothing decides partition by partition until it is, and
         with nothing decided yet, which leaves everything kept. */
      expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 0, { type: "custom" });
      expect(address()).toBe("sheet=drives.0&sheetTab=current");
    });
  });

  describe("when custom is chosen and the configuration reports keeping everything", () => {
    it("stays on custom, which is an answer the configuration cannot hold", async () => {
      const { user } = installerRender(
        <SpacePolicyMemory>
          <SpaceDecision collection="drives" index={0} />
        </SpacePolicyMemory>,
      );
      await user.click(screen.getByRole("button", { name: "Custom" }));

      /* The device still reads "keep", and will until something is decided
         under it: custom with no exceptions is the same configuration, and the
         service works the answer out from what it can see. Were the answer read
         back rather than remembered, the control would spring back and the
         per-partition controls it was asked for would never appear. */
      screen.getByRole("button", { name: "Custom", pressed: true });
      screen.getByRole("button", { name: "Keeping everything", pressed: false });
    });
  });

  describe("when the answer already taken is pressed again", () => {
    beforeEach(() => {
      mockDeviceConfig.mockReturnValue(drive("custom"));
    });

    it("leaves the configuration alone, rather than clearing what was decided under it", async () => {
      const { user } = installerRender(<SpaceDecision collection="drives" index={0} />);
      await user.click(screen.getByRole("button", { name: "Custom" }));

      expect(mockSetSpacePolicy).not.toHaveBeenCalled();
    });
  });

  describe("when the device follows no rule yet", () => {
    beforeEach(() => {
      mockDeviceConfig.mockReturnValue(drive());
    });

    it("reads as keeping everything, which is what an unset rule does", () => {
      installerRender(<SpaceDecision collection="drives" index={0} />);

      expect(screen.getByRole("button", { name: "Keeping everything", pressed: true }));
    });
  });
});

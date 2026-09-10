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
import type { ConfigModel } from "~/model/storage/config-model";
import RetargetOffer from "~/components/storage/shared/RetargetOffer";

const mockConfig = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
  useConvertDevice: () => jest.fn(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useAvailableDevices: () => [],
}));

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

const offer = () => screen.getByRole("button", { name: /Use another device/ });

describe("RetargetOffer", () => {
  describe("when the plan can move", () => {
    it("offers the act, ready to press", () => {
      const entry = { name: "/dev/sda", partitions: [{ mountPath: "/" }] };
      mockConfig.mockReturnValue(config({ drives: [entry] }));
      installerRender(<RetargetOffer entry={entry} device={null} />);

      expect(offer()).not.toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("when something holds the plan where it is", () => {
    const entry = { name: "/dev/sda", partitions: [], filesystem: { default: false, reuse: true } };

    beforeEach(() => {
      mockConfig.mockReturnValue(config({ drives: [entry] }));
    });

    it("keeps the act's own name and says what would have to change first", () => {
      installerRender(<RetargetOffer entry={entry} device={null} />);

      offer();
      screen.getByText(/a file system cannot be moved/);
    });

    it("stays reachable, and is described by the reason rather than sitting near it", () => {
      installerRender(<RetargetOffer entry={entry} device={null} />);

      expect(offer()).toHaveAttribute("aria-disabled", "true");
      expect(offer()).not.toBeDisabled();
      const describedBy = offer().getAttribute("aria-describedby");
      expect(document.getElementById(describedBy)).toHaveTextContent(
        /a file system cannot be moved/,
      );
    });
  });
});

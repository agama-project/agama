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
import { installerRender, mockNavigateFn } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import TopLine from "~/components/storage/storage-page/TopLine";

const mockConfig = jest.fn();
const mockReset = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

jest.mock("~/hooks/model/config/storage", () => ({
  ...jest.requireActual("~/hooks/model/config/storage"),
  useReset: () => mockReset,
}));

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [{ name: "/dev/sda" }],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

describe("TopLine", () => {
  beforeEach(() => {
    mockConfig.mockReturnValue(config());
  });

  it("says what the page is for, naming no technology", () => {
    installerRender(<TopLine />);

    screen.getByText("Choose devices to use and how to structure them");
  });

  describe("the two installation decisions", () => {
    it("reads both as values, without opening anything to find them", () => {
      installerRender(<TopLine />);

      /* Queried by their words rather than by role and name: a `dt` takes no
         accessible name from what is written in it, and a screen reader reads
         the pair together as one entry of the list. */
      screen.getByText("Boot");
      screen.getByText("Encryption");
    });

    it("says the installer will work out where to boot from, where it will", () => {
      mockConfig.mockReturnValue(config({ boot: { configure: true, device: { default: true } } }));
      installerRender(<TopLine />);

      screen.getByRole("link", { name: "Automatic" });
    });

    it("names the disk the reader chose instead", () => {
      mockConfig.mockReturnValue(
        config({
          drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
          boot: { configure: true, device: { default: false, name: "/dev/sdb" } },
        }),
      );
      installerRender(<TopLine />);

      screen.getByRole("link", { name: "sdb" });
    });

    it("says so where nothing will be set up for booting", () => {
      mockConfig.mockReturnValue(config({ boot: { configure: false } }));
      installerRender(<TopLine />);

      screen.getByRole("link", { name: "Not configured" });
    });

    it("tells an unencrypted installation from one with a key in the machine", () => {
      installerRender(<TopLine />);
      screen.getByRole("link", { name: "Not encrypted" });

      mockConfig.mockReturnValue(config({ encryption: { password: "secret", tpm: true } }));
      installerRender(<TopLine />);
      screen.getByRole("link", { name: "LUKS2 with TPM" });
    });

    it("sends each to a page of its own, which is where every form lives", async () => {
      const { user } = installerRender(<TopLine />);
      await user.click(screen.getByRole("link", { name: "Not configured" }));

      expect(mockNavigateFn).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/storage/boot-device/edit" }),
        expect.anything(),
      );
    });
  });

  describe("the configuration's own menu", () => {
    it("offers starting again, which is about the plan rather than the machine", async () => {
      const { user } = installerRender(<TopLine />);
      await user.click(screen.getByRole("button", { name: "Actions for this configuration" }));
      await user.click(screen.getByRole("menuitem", { name: /Reset to defaults/ }));

      expect(mockReset).toHaveBeenCalled();
    });
  });
});

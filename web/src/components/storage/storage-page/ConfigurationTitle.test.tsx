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
import type { Storage } from "~/model/system";
import ConfigurationTitle from "~/components/storage/storage-page/ConfigurationTitle";

const mockConfig = jest.fn();
const mockDevice = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: (name: string) => mockDevice(name),
}));

const vdd = { name: "/dev/vdd", block: { size: 21474836480 } } as Storage.Device;

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

/** What the page ends up saying, once every part of the sentence is in place. */
const sentence = () => document.body.textContent;

beforeEach(() => {
  mockDevice.mockReturnValue(vdd);
});

describe("when the configuration is one disk", () => {
  it("names the disk and what it is for", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/vdd" }] }));
    installerRender(<ConfigurationTitle />);

    expect(sentence()).toBe("Use disk vdd (20 GiB) as installation device");
  });

  describe("and it starts the machine too", () => {
    it("says so, rather than leaving it to the sheet", () => {
      mockConfig.mockReturnValue(
        config({
          drives: [{ name: "/dev/vdd" }],
          boot: { configure: true, device: { name: "/dev/vdd", default: false } },
        }),
      );
      installerRender(<ConfigurationTitle />);

      expect(sentence()).toBe("Use disk vdd (20 GiB) as installation and boot device");
    });
  });

  it("makes the device it names the way into it, with no button under the sentence", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/vdd" }] }));
    installerRender(<ConfigurationTitle />);

    screen.getByRole("link", { name: /vdd/ });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("when the configuration is one software RAID", () => {
  it("calls it a RAID rather than a disk", () => {
    mockConfig.mockReturnValue(config({ mdRaids: [{ name: "/dev/md0" }] }));
    installerRender(<ConfigurationTitle />);

    expect(sentence()).toBe("Use RAID md0 (20 GiB) as installation device");
  });
});

describe("when there are volume groups over one disk", () => {
  it("names a single group", () => {
    mockConfig.mockReturnValue(
      config({ drives: [{ name: "/dev/vdd" }], volumeGroups: [{ vgName: "system" }] }),
    );
    installerRender(<ConfigurationTitle />);

    expect(sentence()).toBe("Create LVM volume group system on disk vdd (20 GiB)");
  });

  it("names both of a pair", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/vdd" }],
        volumeGroups: [{ vgName: "system" }, { vgName: "another" }],
      }),
    );
    installerRender(<ConfigurationTitle />);

    expect(sentence()).toBe("Create LVM volume groups system and another on disk vdd (20 GiB)");
  });

  it("counts them past a pair, leaving the naming to the entries below", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/vdd" }],
        volumeGroups: [{ vgName: "system" }, { vgName: "another" }, { vgName: "third" }],
      }),
    );
    installerRender(<ConfigurationTitle />);

    expect(sentence()).toBe("Create 3 LVM volume groups on disk vdd (20 GiB)");
  });
});

describe("when the configuration spreads over several disks", () => {
  it("counts the disks", () => {
    mockConfig.mockReturnValue(
      config({ drives: [{ name: "/dev/vda" }, { name: "/dev/vdb" }, { name: "/dev/vdc" }] }),
    );
    installerRender(<ConfigurationTitle />);

    expect(sentence()).toBe("Set up the new system across 3 disks");
  });

  it("still counts them when volume groups sit over them", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/vda" }, { name: "/dev/vdb" }],
        volumeGroups: [{ vgName: "system" }],
      }),
    );
    installerRender(<ConfigurationTitle />);

    expect(sentence()).toBe("Set up the new system across 2 disks");
  });
});

describe("when there is no shorter true thing to say", () => {
  it("says what is being done and leaves the naming to the entries below", () => {
    mockConfig.mockReturnValue(
      config({ drives: [{ name: "/dev/vda" }], mdRaids: [{ name: "/dev/md0" }] }),
    );
    installerRender(<ConfigurationTitle />);

    expect(sentence()).toBe("Set up the new system across multiple devices");
  });
});

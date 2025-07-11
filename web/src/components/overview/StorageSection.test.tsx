/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { plainRender } from "~/test-utils";
import { StorageSection } from "~/components/overview";

let mockModel = {
  drives: [],
};

const sda = {
  sid: 59,
  name: "/dev/sda",
  description: "",
  isDrive: false,
  type: "drive",
  active: true,
  encrypted: false,
  shrinking: { unsuppored: [] },
  size: 536870912000,
  start: 0,
  systems: [],
  udevIds: [],
  udevPaths: [],
};

const sdb = {
  sid: 60,
  name: "/dev/sdb",
  description: "",
  isDrive: false,
  type: "drive",
  active: true,
  encrypted: false,
  shrinking: { unsuppored: [] },
  size: 697932185600,
  start: 0,
  systems: [],
  udevIds: [],
  udevPaths: [],
};

jest.mock("~/queries/storage/config-model", () => ({
  ...jest.requireActual("~/queries/storage/config-model"),
  useConfigModel: () => mockModel,
}));

const mockDevices = [sda, sdb];

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useDevices: () => mockDevices,
}));

let mockAvailableDevices = [sda, sdb];

jest.mock("~/hooks/storage/system", () => ({
  ...jest.requireActual("~/hooks/storage/system"),
  useAvailableDevices: () => mockAvailableDevices,
}));

let mockSystemErrors = [];

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useSystemErrors: () => mockSystemErrors,
}));

beforeEach(() => {
  mockSystemErrors = [];
});

describe("when the configuration does not include any device", () => {
  beforeEach(() => {
    mockModel = {
      drives: [],
    };
  });

  it("indicates that a device is not selected", async () => {
    plainRender(<StorageSection />);

    await screen.findByText(/No device selected/);
  });
});

describe("when the configuration contains one drive", () => {
  beforeEach(() => {
    mockModel = {
      drives: [{ name: "/dev/sda", spacePolicy: "delete" }],
    };
  });

  it("renders the proposal summary", async () => {
    plainRender(<StorageSection />);

    await screen.findByText(/Install using device/);
    await screen.findByText(/sda \(500 GiB\)/);
    await screen.findByText(/and deleting all its content/);
  });

  describe("and the space policy is set to 'resize'", () => {
    beforeEach(() => {
      mockModel = {
        drives: [{ name: "/dev/sda", spacePolicy: "resize" }],
      };
    });

    it("indicates that partitions may be shrunk", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/shrinking existing partitions as needed/);
    });
  });

  describe("and the space policy is set to 'keep'", () => {
    beforeEach(() => {
      mockModel = {
        drives: [{ name: "/dev/sda", spacePolicy: "keep" }],
      };
    });

    it("indicates that partitions will be kept", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/without modifying existing partitions/);
    });
  });

  describe("and the space policy is set to 'custom'", () => {
    beforeEach(() => {
      mockModel = {
        drives: [{ name: "/dev/sda", spacePolicy: "custom" }],
      };
    });

    it("indicates that custom strategy for allocating space is set", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/custom strategy to find the needed space/);
    });
  });

  describe("and the drive matches no disk", () => {
    beforeEach(() => {
      mockModel = {
        drives: [{ name: undefined, spacePolicy: "delete" }],
      };
    });

    it("indicates that a device is not selected", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/No device selected/);
    });
  });
});

describe("when the configuration contains several drives", () => {
  beforeEach(() => {
    mockModel = {
      drives: [
        { name: "/dev/sda", spacePolicy: "delete" },
        { name: "/dev/sdb", spacePolicy: "delete" },
      ],
    };
  });

  it("renders the proposal summary", async () => {
    plainRender(<StorageSection />);

    await screen.findByText(/Install using several devices/);
    await screen.findByText(/and deleting all its content/);
  });

  describe("but one of them has a different space policy", () => {
    beforeEach(() => {
      mockModel = {
        drives: [
          { name: "/dev/sda", spacePolicy: "delete" },
          { name: "/dev/sdb", spacePolicy: "resize" },
        ],
      };
    });

    it("indicates that custom strategy for allocating space is set", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/custom strategy to find the needed space/);
    });
  });
});

describe("when there is no configuration model (unsupported features)", () => {
  beforeEach(() => {
    mockModel = null;
  });

  describe("if the storage proposal succeeded", () => {
    describe("and there are no available devices", () => {
      beforeEach(() => {
        mockAvailableDevices = [];
      });

      it("indicates that an unhandled configuration was used", async () => {
        plainRender(<StorageSection />);
        await screen.findByText(/advanced configuration/);
      });
    });

    describe("and there are available disks", () => {
      beforeEach(() => {
        mockAvailableDevices = [sda];
      });

      it("indicates that an unhandled configuration was used", async () => {
        plainRender(<StorageSection />);
        await screen.findByText(/advanced configuration/);
      });
    });
  });

  describe("if the storage proposal was not possible", () => {
    beforeEach(() => {
      mockSystemErrors = [
        {
          description: "System error",
          kind: "storage",
          details: "",
          source: 1,
          severity: 1,
        },
      ];
    });

    describe("and there are no available devices", () => {
      beforeEach(() => {
        mockAvailableDevices = [];
      });

      it("indicates that there are no available disks", async () => {
        plainRender(<StorageSection />);
        await screen.findByText(/no disks available/);
      });
    });

    describe("and there are available devices", () => {
      beforeEach(() => {
        mockAvailableDevices = [sda];
      });

      it("indicates that an unhandled configuration was used", async () => {
        plainRender(<StorageSection />);
        await screen.findByText(/advanced configuration/);
      });
    });
  });
});

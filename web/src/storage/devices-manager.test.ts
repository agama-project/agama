/*
 * Copyright (c) [2024] SUSE LLC
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

import DevicesManager from "~/storage/devices-manager";
import type { Storage as System } from "~/model/system";
import type { Storage as Proposal } from "~/model/proposal";

const block = (systems: string[]): System.Block => ({
  size: 1024,
  start: 0,
  shrinking: { supported: false },
  systems,
});

let system_devices: System.Device[];
let proposal_devices: Proposal.Device[];
let actions: Proposal.Action[];

beforeEach(() => {
  system_devices = [];
  proposal_devices = [];
  actions = [];
});

describe("systemDevice", () => {
  beforeEach(() => {
    proposal_devices = [{ sid: 60, name: "/dev/sda" }];
  });

  describe("if there is no system device with the given SID", () => {
    it("returns undefined", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.systemDevice(60)).toBeUndefined();
    });
  });

  describe("if there is a system device with the given SID", () => {
    beforeEach(() => {
      system_devices = [{ sid: 60, name: "/dev/sdb" }];
    });

    it("returns the system device", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.systemDevice(60).name).toEqual("/dev/sdb");
    });
  });
});

describe("stagingDevice", () => {
  beforeEach(() => {
    system_devices = [{ sid: 60, name: "/dev/sda" }];
  });

  describe("if there is no staging device with the given SID", () => {
    it("returns undefined", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.stagingDevice(60)).toBeUndefined();
    });
  });

  describe("if there is a staging device with the given SID", () => {
    beforeEach(() => {
      proposal_devices = [{ sid: 60, name: "/dev/sdb" }];
    });

    it("returns the staging device", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.stagingDevice(60).name).toEqual("/dev/sdb");
    });
  });
});

describe("existInSystem", () => {
  beforeEach(() => {
    system_devices = [{ sid: 61, name: "/dev/sda2" }];
    proposal_devices = [{ sid: 60, name: "/dev/sda1" }];
  });

  describe("if the given device does not exist in system", () => {
    it("returns false", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.existInSystem({ sid: 60, name: "/dev/sda1" })).toEqual(false);
    });
  });

  describe("if the given device exists in system", () => {
    it("returns true", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.existInSystem({ sid: 61, name: "/dev/sda2" })).toEqual(true);
    });
  });
});

describe("existInStaging", () => {
  beforeEach(() => {
    system_devices = [{ sid: 61, name: "/dev/sda2" }];
    proposal_devices = [{ sid: 60, name: "/dev/sda1" }];
  });

  describe("if the given device does not exist in staging", () => {
    it("returns false", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.existInStaging({ sid: 61, name: "/dev/sda2" })).toEqual(false);
    });
  });

  describe("if the given device exists in staging", () => {
    it("returns true", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.existInStaging({ sid: 60, name: "/dev/sda1" })).toEqual(true);
    });
  });
});

describe("hasNewFilesystem", () => {
  describe("if the given device has no file system", () => {
    beforeEach(() => {
      system_devices = [{ sid: 60, name: "/dev/sda1", filesystem: { sid: 61, type: "ext4" } }];
      proposal_devices = [{ sid: 60, name: "/dev/sda1" }];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.hasNewFilesystem(device)).toEqual(false);
    });
  });

  describe("if the given device has no new file system", () => {
    beforeEach(() => {
      system_devices = [{ sid: 60, name: "/dev/sda1", filesystem: { sid: 61, type: "ext4" } }];
      proposal_devices = [{ sid: 60, name: "/dev/sda1", filesystem: { sid: 61, type: "ext4" } }];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.hasNewFilesystem(device)).toEqual(false);
    });
  });

  describe("if the given device has a new file system", () => {
    beforeEach(() => {
      system_devices = [{ sid: 60, name: "/dev/sda1", filesystem: { sid: 61, type: "ext4" } }];
      proposal_devices = [{ sid: 60, name: "/dev/sda1", filesystem: { sid: 62, type: "ext4" } }];
    });

    it("returns true", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.hasNewFilesystem(device)).toEqual(true);
    });
  });
});

describe("isShrunk", () => {
  describe("if the device is new", () => {
    beforeEach(() => {
      system_devices = [];
      proposal_devices = [{ sid: 60, name: "/dev/sda1" }];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.isShrunk(device)).toEqual(false);
    });
  });

  describe("if the device does not exist anymore", () => {
    beforeEach(() => {
      system_devices = [{ sid: 60, name: "/dev/sda1" }];
      proposal_devices = [];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.systemDevice(60);
      expect(manager.isShrunk(device)).toEqual(false);
    });
  });

  describe("if the size is kept", () => {
    beforeEach(() => {
      system_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 2048, shrinking: { supported: true } },
        },
      ];
      proposal_devices = [...system_devices];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.isShrunk(device)).toEqual(false);
    });
  });

  describe("if the size is more than initially", () => {
    beforeEach(() => {
      system_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 2048, shrinking: { supported: true } },
        },
      ];
      proposal_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 4096, shrinking: { supported: true } },
        },
      ];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.isShrunk(device)).toEqual(false);
    });
  });

  describe("if the size is less than initially", () => {
    beforeEach(() => {
      system_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 2048, shrinking: { supported: true } },
        },
      ];
      proposal_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 1024, shrinking: { supported: true } },
        },
      ];
    });

    it("returns true", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.isShrunk(device)).toEqual(true);
    });
  });
});

describe("shrinkSize", () => {
  describe("if the device is new", () => {
    beforeEach(() => {
      system_devices = [];
      proposal_devices = [{ sid: 60, name: "/dev/sda1" }];
    });

    it("returns 0", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.shrinkSize(device)).toEqual(0);
    });
  });

  describe("if the device does not exist anymore", () => {
    beforeEach(() => {
      system_devices = [{ sid: 60, name: "/dev/sda1" }];
      proposal_devices = [];
    });

    it("returns 0", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.systemDevice(60);
      expect(manager.shrinkSize(device)).toEqual(0);
    });
  });

  describe("if the size is kept", () => {
    beforeEach(() => {
      system_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 2048, shrinking: { supported: true } },
        },
      ];
      proposal_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 2048, shrinking: { supported: true } },
        },
      ];
    });

    it("returns 0", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.shrinkSize(device)).toEqual(0);
    });
  });

  describe("if the size is more than initially", () => {
    beforeEach(() => {
      system_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 2048, shrinking: { supported: true } },
        },
      ];
      proposal_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 4096, shrinking: { supported: true } },
        },
      ];
    });

    it("returns 0", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.shrinkSize(device)).toEqual(0);
    });
  });

  describe("if the size is less than initially", () => {
    beforeEach(() => {
      system_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 2048, shrinking: { supported: true } },
        },
      ];
      proposal_devices = [
        {
          sid: 60,
          name: "/dev/sda1",
          block: { start: 0, size: 1024, shrinking: { supported: true } },
        },
      ];
    });

    it("returns the shrink amount", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const device = manager.stagingDevice(60);
      expect(manager.shrinkSize(device)).toEqual(1024);
    });
  });
});

describe("usedDevices", () => {
  beforeEach(() => {
    system_devices = [
      { sid: 61, class: "drive", name: "/dev/sda" },
      { sid: 62, class: "drive", name: "/dev/sdb", partitions: [{ sid: 67, name: "/dev/sdb1" }] },
      { sid: 63, class: "drive", name: "/dev/sdc" },
      { sid: 64, class: "volumeGroup", name: "/dev/vg0" },
      { sid: 65, class: "volumeGroup", name: "/dev/vg1" },
      {
        sid: 66,
        class: "volumeGroup",
        name: "/dev/vg2",
        logicalVolumes: [{ sid: 68, name: "/dev/vg2/lv0" }],
      },
      { sid: 72, class: "drive", name: "/dev/sdd" },
    ];
    proposal_devices = [
      { sid: 60, class: "mdRaid", name: "/dev/md1" },
      // Partition removed
      { sid: 62, class: "drive", name: "/dev/sdb", partitions: [] },
      // Partition added
      { sid: 63, class: "drive", name: "/dev/sdc", partitions: [{ sid: 69, name: "/dev/sdc1" }] },
      { sid: 64, class: "volumeGroup", name: "/dev/vg0" },
      // Logical volume added
      {
        sid: 65,
        class: "volumeGroup",
        name: "/dev/vg1",
        logicalVolumes: [
          { sid: 70, name: "/dev/vg1/lv0" },
          { sid: 71, name: "/dev/vg1/lv1" },
        ],
      },
      // Logical volume removed
      { sid: 66, class: "volumeGroup", name: "/dev/vg2" },
      // Not modified
      { sid: 72, class: "drive", name: "/dev/sdd" },
    ];
  });

  describe("if there are no actions", () => {
    beforeEach(() => {
      actions = [];
    });

    it("returns an empty list if no argument is passed", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.usedDevices()).toEqual([]);
    });

    it("returns an empty list if non-existent names are passed", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      expect(manager.usedDevices(["/dev/nodisk"])).toEqual([]);
    });

    it("returns a list including only the disks passed by argument", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const devs = manager.usedDevices(["/dev/sdb", "/dev/sdb"]);
      expect(devs.length).toEqual(1);
      expect(devs[0].sid).toEqual(62);
    });
  });

  describe("if there are actions", () => {
    beforeEach(() => {
      actions = [
        // This device is ignored because it is neither a drive nor a LVM VG.
        { device: 60, text: "" },
        // This device was removed.
        { device: 61, text: "" },
        // This partition was removed (belongs to device 62).
        { device: 67, text: "" },
        // This logical volume was removed (belongs to device 66).
        { device: 68, text: "" },
        // This partition was added (belongs to device 63).
        { device: 69, text: "" },
        // This logical volume was added (belongs to device 65).
        { device: 70, text: "" },
        // This logical volume was added (belongs to device 65).
        { device: 71, text: "" },
      ];
    });

    it("does not include removed disk devices or LVM volume groups", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const sids = manager
        .usedDevices()
        .map((d) => d.sid)
        .sort();
      expect(sids).not.toContain(61);
    });

    it("includes all the devices affected by the actions", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const sids = manager
        .usedDevices()
        .map((d) => d.sid)
        .sort();
      expect(sids).toEqual([60, 62, 63, 65, 66]);
    });

    it("also includes extra disks passed as argument without repeating redundant ones", () => {
      const manager = new DevicesManager(system_devices, proposal_devices, actions);
      const sids = manager
        .usedDevices(["/dev/sdb", "/dev/sdd"])
        .map((d) => d.sid)
        .sort();
      expect(sids).toEqual([60, 62, 63, 65, 66, 72]);
    });
  });
});

describe("resizedDevices", () => {
  beforeEach(() => {
    system_devices = [
      { sid: 60, class: "volumeGroup", name: "/dev/vg0" },
      { sid: 62, class: "volumeGroup", name: "/dev/vg1" },
      { sid: 63, class: "volumeGroup", name: "/dev/vg2" },
      { sid: 64, class: "volumeGroup", name: "/dev/vg3" },
      { sid: 65, class: "drive", name: "/dev/sda" },
    ];
    actions = [
      { device: 60, delete: true, text: "" },
      // This device does not exist in system.
      { device: 61, delete: true, text: "" },
      { device: 62, delete: false, resize: true, text: "" },
      { device: 63, delete: false, resize: true, text: "" },
      { device: 65, delete: true, text: "" },
    ];
  });

  it("includes all resized devices", () => {
    const manager = new DevicesManager(system_devices, proposal_devices, actions);
    const sids = manager
      .resizedDevices()
      .map((d) => d.sid)
      .sort();
    expect(sids).toEqual([62, 63]);
  });
});

describe("resizedSystems", () => {
  beforeEach(() => {
    system_devices = [
      { sid: 60, name: "/dev/sda", block: { ...block(["Windows XP"]) } },
      { sid: 62, name: "/dev/sdb", block: { ...block(["Ubuntu"]) } },
      {
        sid: 63,
        name: "/dev/sdc",
        block: { ...block(["openSUSE Leap", "openSUSE Tumbleweed"]) },
        partitions: [
          { sid: 65, name: "/dev/sdc1", block: { ...block(["openSUSE Leap"]) } },
          { sid: 66, name: "/dev/sdc2", block: { ...block(["openSUSE Tumbleweed"]) } },
        ],
      },
      { sid: 64, name: "/dev/sdd" },
    ];
    actions = [
      { device: 60, delete: false, resize: true, text: "" },
      // This device does not exist in system.
      { device: 61, delete: true, text: "" },
      { device: 62, delete: false, text: "" },
      { device: 63, delete: false, resize: true, text: "" },
      { device: 65, delete: true, resize: true, text: "" },
      { device: 66, delete: false, resize: true, text: "" },
    ];
  });

  it("includes all resized systems", () => {
    const manager = new DevicesManager(system_devices, proposal_devices, actions);
    const systems = manager.resizedSystems();
    expect(systems.length).toEqual(3);
    expect(systems).toContain("Windows XP");
    expect(systems).toContain("openSUSE Leap");
    expect(systems).toContain("openSUSE Tumbleweed");
  });
});

describe("deletedDevices", () => {
  beforeEach(() => {
    system_devices = [
      { sid: 60, class: "volumeGroup", name: "/dev/vg0" },
      { sid: 62, class: "volumeGroup", name: "/dev/vg1" },
      { sid: 63, class: "volumeGroup", name: "/dev/vg2" },
      { sid: 64, class: "volumeGroup", name: "/dev/vg3" },
      { sid: 65, class: "drive", name: "/dev/sda" },
    ];
    actions = [
      { device: 60, delete: true, text: "" },
      // This device does not exist in system.
      { device: 61, delete: true, text: "" },
      { device: 62, delete: false, text: "" },
      { device: 63, delete: true, text: "" },
      { device: 65, delete: true, text: "" },
    ];
  });

  it("includes all deleted devices", () => {
    const manager = new DevicesManager(system_devices, proposal_devices, actions);
    const sids = manager
      .deletedDevices()
      .map((d) => d.sid)
      .sort();
    expect(sids).toEqual([60, 63]);
  });
});

describe("deletedSystems", () => {
  beforeEach(() => {
    system_devices = [
      { sid: 60, name: "/dev/sda", block: { ...block(["Windows XP"]) } },
      { sid: 62, name: "/dev/sdb", block: { ...block(["Ubuntu"]) } },
      {
        sid: 63,
        name: "/dev/sdc",
        block: { ...block(["openSUSE Leap", "openSUSE Tumbleweed"]) },
        partitions: [
          { sid: 65, name: "/dev/sdc1", block: { ...block(["openSUSE Leap"]) } },
          { sid: 66, name: "/dev/sdc2", block: { ...block(["openSUSE Tumbleweed"]) } },
        ],
      },
      { sid: 64, name: "/dev/sdd" },
    ];
    actions = [
      { device: 60, delete: true, text: "" },
      // This device does not exist in system.
      { device: 61, delete: true, text: "" },
      { device: 62, delete: false, text: "" },
      { device: 63, delete: true, text: "" },
      { device: 65, delete: true, text: "" },
      { device: 66, delete: true, text: "" },
    ];
  });

  it("includes all deleted systems", () => {
    const manager = new DevicesManager(system_devices, proposal_devices, actions);
    const systems = manager.deletedSystems();
    expect(systems.length).toEqual(3);
    expect(systems).toContain("Windows XP");
    expect(systems).toContain("openSUSE Leap");
    expect(systems).toContain("openSUSE Tumbleweed");
  });
});

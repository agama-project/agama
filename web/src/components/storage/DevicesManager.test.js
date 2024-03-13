/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import DevicesManager from "./DevicesManager";

let system;
let staging;
let actions;

beforeEach(() => {
  system = [];
  staging = [];
  actions = [];
});

describe("systemDevice", () => {
  beforeEach(() => {
    staging = [{ sid: 60, name: "/dev/sda" }];
  });

  describe("if there is no system device with the given SID", () => {
    it("returns undefined", () => {
      const manager = new DevicesManager(system, staging, actions);
      expect(manager.systemDevice(60)).toBeUndefined();
    });
  });

  describe("if there is a system device with the given SID", () => {
    beforeEach(() => {
      system = [{ sid: 60, name: "/dev/sdb" }];
    });

    it("returns the system device", () => {
      const manager = new DevicesManager(system, staging, actions);
      expect(manager.systemDevice(60).name).toEqual("/dev/sdb");
    });
  });
});

describe("stagingDevice", () => {
  beforeEach(() => {
    system = [{ sid: 60, name: "/dev/sda" }];
  });

  describe("if there is no staging device with the given SID", () => {
    it("returns undefined", () => {
      const manager = new DevicesManager(system, staging, actions);
      expect(manager.stagingDevice(60)).toBeUndefined();
    });
  });

  describe("if there is a staging device with the given SID", () => {
    beforeEach(() => {
      staging = [{ sid: 60, name: "/dev/sdb" }];
    });

    it("returns the staging device", () => {
      const manager = new DevicesManager(system, staging, actions);
      expect(manager.stagingDevice(60).name).toEqual("/dev/sdb");
    });
  });
});

describe("existInSystem", () => {
  beforeEach(() => {
    system = [{ sid: 61, name: "/dev/sda2" }];
    staging = [{ sid: 60, name: "/dev/sda1" }];
  });

  describe("if the given device does not exist in system", () => {
    it("returns false", () => {
      const manager = new DevicesManager(system, staging, actions);
      expect(manager.existInSystem({ sid: 60 })).toEqual(false);
    });
  });

  describe("if the given device exists in system", () => {
    it("returns true", () => {
      const manager = new DevicesManager(system, staging, actions);
      expect(manager.existInSystem({ sid: 61 })).toEqual(true);
    });
  });
});

describe("existInStaging", () => {
  beforeEach(() => {
    system = [{ sid: 61, name: "/dev/sda2" }];
    staging = [{ sid: 60, name: "/dev/sda1" }];
  });

  describe("if the given device does not exist in staging", () => {
    it("returns false", () => {
      const manager = new DevicesManager(system, staging, actions);
      expect(manager.existInStaging({ sid: 61 })).toEqual(false);
    });
  });

  describe("if the given device exists in staging", () => {
    it("returns true", () => {
      const manager = new DevicesManager(system, staging, actions);
      expect(manager.existInStaging({ sid: 60 })).toEqual(true);
    });
  });
});

describe("hasNewFilesystem", () => {
  describe("if the given device has no file system", () => {
    beforeEach(() => {
      system = [{ sid: 60, name: "/dev/sda1", fileystem: { sid: 61 } }];
      staging = [{ sid: 60, name: "/dev/sda1" }];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.hasNewFilesystem(device)).toEqual(false);
    });
  });

  describe("if the given device has no new file system", () => {
    beforeEach(() => {
      system = [{ sid: 60, name: "/dev/sda1", filesystem: { sid: 61 } }];
      staging = [{ sid: 60, name: "/dev/sda1", filesystem: { sid: 61 } }];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.hasNewFilesystem(device)).toEqual(false);
    });
  });

  describe("if the given device has a new file system", () => {
    beforeEach(() => {
      system = [{ sid: 60, name: "/dev/sda1", fileystem: { sid: 61 } }];
      staging = [{ sid: 60, name: "/dev/sda1", filesystem: { sid: 62 } }];
    });

    it("returns true", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.hasNewFilesystem(device)).toEqual(true);
    });
  });
});

describe("isShrunk", () => {
  describe("if the device is new", () => {
    beforeEach(() => {
      system = [];
      staging = [{ sid: 60, size: 2048 }];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.isShrunk(device)).toEqual(false);
    });
  });

  describe("if the device does not exist anymore", () => {
    beforeEach(() => {
      system = [{ sid: 60, size: 2048 }];
      staging = [];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.systemDevice(60);
      expect(manager.isShrunk(device)).toEqual(false);
    });
  });

  describe("if the size is kept", () => {
    beforeEach(() => {
      system = [{ sid: 60, size: 1024 }];
      staging = [{ sid: 60, size: 1024 }];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.isShrunk(device)).toEqual(false);
    });
  });

  describe("if the size is more than initially", () => {
    beforeEach(() => {
      system = [{ sid: 60, size: 1024 }];
      staging = [{ sid: 60, size: 2048 }];
    });

    it("returns false", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.isShrunk(device)).toEqual(false);
    });
  });

  describe("if the size is less than initially", () => {
    beforeEach(() => {
      system = [{ sid: 60, size: 1024 }];
      staging = [{ sid: 60, size: 512 }];
    });

    it("returns true", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.isShrunk(device)).toEqual(true);
    });
  });
});

describe("shrinkSize", () => {
  describe("if the device is new", () => {
    beforeEach(() => {
      system = [];
      staging = [{ sid: 60, size: 2048 }];
    });

    it("returns 0", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.shrinkSize(device)).toEqual(0);
    });
  });

  describe("if the device does not exist anymore", () => {
    beforeEach(() => {
      system = [{ sid: 60, size: 2048 }];
      staging = [];
    });

    it("returns 0", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.systemDevice(60);
      expect(manager.shrinkSize(device)).toEqual(0);
    });
  });

  describe("if the size is kept", () => {
    beforeEach(() => {
      system = [{ sid: 60, size: 1024 }];
      staging = [{ sid: 60, size: 1024 }];
    });

    it("returns 0", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.shrinkSize(device)).toEqual(0);
    });
  });

  describe("if the size is more than initially", () => {
    beforeEach(() => {
      system = [{ sid: 60, size: 1024 }];
      staging = [{ sid: 60, size: 2048 }];
    });

    it("returns 0", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.shrinkSize(device)).toEqual(0);
    });
  });

  describe("if the size is less than initially", () => {
    beforeEach(() => {
      system = [{ sid: 60, size: 1024 }];
      staging = [{ sid: 60, size: 512 }];
    });

    it("returns the shrink amount", () => {
      const manager = new DevicesManager(system, staging, actions);
      const device = manager.stagingDevice(60);
      expect(manager.shrinkSize(device)).toEqual(512);
    });
  });
});

describe("usedDevices", () => {
  beforeEach(() => {
    system = [
      { sid: 60, isDrive: false },
      { sid: 61, isDrive: true },
      { sid: 62, isDrive: true, partitionTable: { partitions: [{ sid: 67 }] } },
      { sid: 63, isDrive: true, partitionTable: { partitions: [] } },
      { sid: 64, isDrive: false, type: "lvmVg", logicalVolumes: [] },
      { sid: 65, isDrive: false, type: "lvmVg", logicalVolumes: [] },
      { sid: 66, isDrive: false, type: "lvmVg", logicalVolumes: [{ sid: 68 }] }
    ];
    staging = [
      { sid: 60, isDrive: false },
      // Partition removed
      { sid: 62, isDrive: true, partitionTable: { partitions: [] } },
      // Partition added
      { sid: 63, isDrive: true, partitionTable: { partitions: [{ sid: 69 }] } },
      { sid: 64, isDrive: false, type: "lvmVg", logicalVolumes: [] },
      // Logical volume added
      { sid: 65, isDrive: false, type: "lvmVg", logicalVolumes: [{ sid: 70 }, { sid: 71 }] },
      // Logical volume removed
      { sid: 66, isDrive: false, type: "lvmVg", logicalVolumes: [] }
    ];
  });

  describe("if there are no actions", () => {
    beforeEach(() => {
      actions = [];
    });

    it("returns an empty list", () => {
      const manager = new DevicesManager(system, staging, actions);
      expect(manager.usedDevices()).toEqual([]);
    });
  });

  describe("if there are actions", () => {
    beforeEach(() => {
      actions = [
        // This device is ignored because it is neither a drive nor a LVM VG.
        { device: 60 },
        // This device was removed.
        { device: 61 },
        // This partition was removed (belongs to device 62).
        { device: 67 },
        // This logical volume was removed (belongs to device 66).
        { device: 68 },
        // This partition was added (belongs to device 63).
        { device: 69 },
        // This logical volume was added (belongs to device 65).
        { device: 70 },
        // This logical volume was added (belongs to device 65).
        { device: 71 }
      ];
    });

    it("does not include removed disk devices or LVM volume groups", () => {
      const manager = new DevicesManager(system, staging, actions);
      const sids = manager.usedDevices().map(d => d.sid)
        .sort();
      expect(sids).not.toContain(61);
    });

    it("includes all disk devices and LVM volume groups affected by the actions", () => {
      const manager = new DevicesManager(system, staging, actions);
      const sids = manager.usedDevices().map(d => d.sid)
        .sort();
      expect(sids).toEqual([62, 63, 65, 66]);
    });
  });
});

/*
 * Copyright (c) [2023] SUSE LLC
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

import { deviceSize, deviceLabel } from "./utils";

describe("deviceSize", () => {
  it("returns undefined is size is -1", () => {
    const result = deviceSize(-1);
    expect(result).toBeUndefined();
  });

  it("returns the size with units", () => {
    const result = deviceSize(1024);
    expect(result).toEqual("1 KiB");
  });
});

describe("deviceLabel", () => {
  it("returns the device name and size", () => {
    const result = deviceLabel({ name: "/dev/sda", size: 1024 });
    expect(result).toEqual("/dev/sda, 1 KiB");
  });

  it("returns only the device name if the device has no size", () => {
    const result = deviceLabel({ name: "/dev/sda" });
    expect(result).toEqual("/dev/sda");
  });
});

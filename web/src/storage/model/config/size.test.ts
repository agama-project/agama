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

import * as model from "~/storage/model/config/size";

describe("#generate", () => {
  it("returns the expected size object from a size section", () => {
    expect(
      model.generate(
        {},
        {
          size: "1 KiB",
        },
      ),
    ).toEqual({ auto: true, min: 1024, max: 1024 });

    expect(
      model.generate(
        {},
        {
          size: "1KiB",
        },
      ),
    ).toEqual({ auto: true, min: 1024, max: 1024 });

    expect(
      model.generate(
        {},
        {
          size: "1kb",
        },
      ),
    ).toEqual({ auto: true, min: 1000, max: 1000 });

    expect(
      model.generate(
        {},
        {
          size: "1k",
        },
      ),
    ).toEqual({ auto: true, min: 1000, max: 1000 });

    expect(
      model.generate(
        {},
        {
          size: "665.284 TiB",
        },
      ),
    ).toEqual({ auto: true, min: 731487493773328, max: 731487493773328 });

    expect(model.generate({ size: 1024 }, { size: { min: 1024, max: 1024 } })).toEqual({
      auto: false,
      min: 1024,
      max: 1024,
    });

    expect(model.generate({}, { size: { min: 1024, max: 1024 } })).toEqual({
      auto: true,
      min: 1024,
      max: 1024,
    });

    expect(model.generate({}, { size: [1024] })).toEqual({ auto: true, min: 1024 });

    expect(model.generate({}, { size: [1024, 2048] })).toEqual({
      auto: true,
      min: 1024,
      max: 2048,
    });

    expect(
      model.generate(
        {},
        {
          size: ["1 kib", "2 KIB"],
        },
      ),
    ).toEqual({ auto: true, min: 1024, max: 2048 });

    expect(model.generate({}, { size: { min: 1024 } })).toEqual({ auto: true, min: 1024 });

    expect(model.generate({}, { size: { min: 1024, max: 2048 } })).toEqual({
      auto: true,
      min: 1024,
      max: 2048,
    });

    expect(
      model.generate(
        {},
        {
          size: {
            min: "1 kib",
            max: "2 KiB",
          },
        },
      ),
    ).toEqual({ auto: true, min: 1024, max: 2048 });
  });

  // This scenario should not happen because the solved config does not return "custom" value.
  it("returns undefined for 'custom' value", () => {
    expect(model.generate({}, { size: { min: "custom", max: 2048 } })).toEqual({
      auto: true,
      min: undefined,
      max: 2048,
    });
  });

  it("returns undefined if there is no size section", () => {
    expect(model.generate({}, {})).toBeUndefined;
  });
});

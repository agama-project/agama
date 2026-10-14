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
import { plainRender } from "~/test-utils";
import type { Storage as System } from "~/model/system";
import {
  recoverableText,
  shrinkReason,
  ShrinkRefusal,
} from "~/components/storage/device-sheet/partition-space";

const GiB = 1024 ** 3;

/** A partition the machine already has, with what it says about shrinking it. */
const partition = (shrinking: System.Device["block"]["shrinking"]): System.Device => ({
  sid: 41,
  name: "/dev/vda1",
  class: "partition",
  block: { start: 0, size: 80 * GiB, shrinking } as System.Device["block"],
});

describe("recoverableText", () => {
  it("says how much shrinking can free at most", () => {
    expect(recoverableText(partition({ supported: true, minSize: 35 * GiB }))).toBe(
      "Up to 45 GiB can be freed.",
    );
  });

  it("says nothing where the partition cannot be shrunk", () => {
    expect(recoverableText(partition({ supported: false, reasons: [] }))).toBeUndefined();
  });
});

describe("shrinkReason", () => {
  it("gives only the first reason, however many there are", () => {
    expect(
      shrinkReason(
        partition({
          supported: false,
          reasons: ["The file system is full.", "A password is required."],
        }),
      ),
    ).toBe("The file system is full.");
  });

  it("gives nothing where the machine gives no reason", () => {
    expect(shrinkReason(partition({ supported: false, reasons: [] }))).toBeUndefined();
  });
});

describe("ShrinkRefusal", () => {
  it("reads a single reason as one sentence", () => {
    plainRender(
      <ShrinkRefusal
        partition={partition({ supported: false, reasons: ["The file system is full."] })}
      />,
    );

    screen.getByText("The file system is full.");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("reads several reasons as a list, every one of them", () => {
    plainRender(
      <ShrinkRefusal
        partition={partition({
          supported: false,
          reasons: ["The file system is full.", "A password is required."],
        })}
      />,
    );

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "The file system is full.",
      "A password is required.",
    ]);
  });

  it("offers nothing to open or close, however many reasons there are", () => {
    plainRender(
      <ShrinkRefusal
        partition={partition({ supported: false, reasons: ["One.", "Two.", "Three."] })}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("still answers where the machine gives no reason", () => {
    plainRender(<ShrinkRefusal partition={partition({ supported: false, reasons: [] })} />);

    screen.getByText("This partition cannot be made smaller.");
  });
});

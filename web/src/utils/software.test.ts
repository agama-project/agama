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

import type { Pattern } from "~/model/system/software";
import type { PatternsSelection } from "~/model/proposal/software";
import { SelectedBy } from "~/model/proposal/software";
import { filterPatterns, groupPatterns, isPatternSelected, sortGroupNames } from "./software";

describe("groupPatterns", () => {
  const patterns: Pattern[] = [
    {
      name: "pattern1",
      category: "Base",
      summary: "Pattern 1",
      description: "Description 1",
      order: 2,
      icon: "icon1",
      preselected: false,
      desktop: false,
    },
    {
      name: "pattern2",
      category: "Desktop",
      summary: "Pattern 2",
      description: "Description 2",
      order: 1,
      icon: "icon2",
      preselected: false,
      desktop: false,
    },
    {
      name: "pattern3",
      category: "Base",
      summary: "Pattern 3",
      description: "Description 3",
      order: 2,
      icon: "icon3",
      preselected: false,
      desktop: false,
    },
    {
      name: "pattern4",
      category: "Base",
      summary: "Pattern 4",
      description: "Description 4",
      order: 1,
      icon: "icon4",
      preselected: false,
      desktop: false,
    },
  ];

  it("groups patterns by category", () => {
    const result = groupPatterns(patterns);

    expect(Object.keys(result)).toEqual(expect.arrayContaining(["Base", "Desktop"]));
    expect(result.Base).toHaveLength(3);
    expect(result.Desktop).toHaveLength(1);
  });

  it("sorts patterns within each group by order, then by name", () => {
    const result = groupPatterns(patterns);

    expect(result.Base[0].name).toBe("pattern4");
    expect(result.Base[1].name).toBe("pattern1");
    expect(result.Base[2].name).toBe("pattern3");
  });
});

describe("sortGroupNames", () => {
  it("sorts group names based on the order of their first pattern", () => {
    const groups = {
      Desktop: [{ order: 10 } as Pattern],
      Base: [{ order: 5 } as Pattern],
      Server: [{ order: 15 } as Pattern],
    };

    const result = sortGroupNames(groups);

    expect(result).toEqual(["Base", "Desktop", "Server"]);
  });
});

describe("filterPatterns", () => {
  const patterns: Pattern[] = [
    {
      name: "multimedia",
      category: "Desktop",
      summary: "Multimedia",
      description: "Audio and video tools",
      order: 1,
      icon: "icon1",
      preselected: false,
      desktop: false,
    },
    {
      name: "office",
      category: "Desktop",
      summary: "Office Software",
      description: "Productivity applications",
      order: 2,
      icon: "icon2",
      preselected: false,
      desktop: false,
    },
    {
      name: "development",
      category: "Base",
      summary: "Development Tools",
      description: "Compilers and multimedia libraries",
      order: 3,
      icon: "icon3",
      preselected: false,
      desktop: false,
    },
  ];

  it("returns all patterns when search value is empty", () => {
    expect(filterPatterns(patterns, "")).toEqual(patterns);
    expect(filterPatterns(patterns, "   ")).toEqual(patterns);
  });

  it("filters patterns by name (case-insensitive)", () => {
    const result = filterPatterns(patterns, "office");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("office");
  });

  it("filters patterns by description (case-insensitive)", () => {
    const result = filterPatterns(patterns, "multimedia");

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.name)).toEqual(
      expect.arrayContaining(["multimedia", "development"]),
    );
  });

  it("performs case-insensitive search", () => {
    const result = filterPatterns(patterns, "OFFICE");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("office");
  });

  it("returns empty array when no patterns match", () => {
    const result = filterPatterns(patterns, "nonexistent");

    expect(result).toEqual([]);
  });
});

describe("isPatternSelected", () => {
  const selection: PatternsSelection = {
    pattern1: SelectedBy.USER,
    pattern2: SelectedBy.AUTO,
    pattern3: SelectedBy.NONE,
    pattern4: SelectedBy.REMOVED,
  };

  it("returns true for USER-selected patterns", () => {
    expect(isPatternSelected(selection, "pattern1")).toBe(true);
  });

  it("returns true for AUTO-selected patterns", () => {
    expect(isPatternSelected(selection, "pattern2")).toBe(true);
  });

  it("returns false for NONE patterns", () => {
    expect(isPatternSelected(selection, "pattern3")).toBe(false);
  });

  it("returns false for REMOVED patterns", () => {
    expect(isPatternSelected(selection, "pattern4")).toBe(false);
  });

  it("returns false for unknown patterns", () => {
    expect(isPatternSelected(selection, "unknown")).toBe(false);
  });
});

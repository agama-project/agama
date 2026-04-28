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

import { renderHook } from "@testing-library/react";
// NOTE: check notes about mockSystemQuery in its documentation
import { clearMockedQueries, mockQuery, mockSystemQuery } from "~/test-utils/tanstack-query";
import { SelectedBy } from "~/model/proposal/software";
import type { Product, Software } from "~/model/system";
import {
  useAvailablePatterns,
  useIsDesktopMissing,
  useSelectedPatterns,
} from "~/hooks/model/system/software";

const gnomePattern: Software.Pattern = {
  name: "gnome",
  category: "Graphical Environments",
  summary: "GNOME Desktop Environment",
  description: "The GNOME desktop environment",
  order: 1010,
  icon: "./gnome",
  preselected: false,
  desktop: true,
};

const basePattern: Software.Pattern = {
  name: "yast2_basis",
  category: "Base Technologies",
  summary: "YaST Base Utilities",
  description: "YaST tools for basic system administration.",
  order: 1220,
  icon: "./yast",
  preselected: false,
  desktop: false,
};

const kdePattern: Software.Pattern = {
  name: "kde",
  category: "Graphical Environments",
  summary: "KDE Plasma Desktop",
  description: "The KDE desktop environment",
  order: 1020,
  icon: "./kde",
  preselected: false,
  desktop: true,
};

const lampPattern: Software.Pattern = {
  name: "lamp_server",
  category: "Server Functions",
  summary: "Web and LAMP Server",
  description: "Apache, MySQL, and PHP",
  order: 2010,
  icon: "./lamp",
  preselected: false,
  desktop: false,
};

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  registration: false,
  desktopSelection: "suggested",
  modes: [],
};

const sles: Product = {
  ...tumbleweed,
  id: "SLES",
  name: "SUSE Linux Enterprise Server",
  desktopSelection: "optional",
};

const legacyProduct: Product = {
  ...tumbleweed,
  id: "Legacy",
  name: "Legacy",
  desktopSelection: undefined,
};

type Selection = Record<string, SelectedBy>;

function mockScenario(product: Product, patterns: Software.Pattern[], selection: Selection) {
  mockSystemQuery({
    products: [product],
    software: { patterns, addons: [], repositories: [] },
  });
  mockQuery(["extendedConfig"], { product: { id: product.id } });
  mockQuery(["proposal"], { software: { patterns: selection, usedSpace: 0 } });
}

describe("useAvailablePatterns", () => {
  beforeEach(() => {
    clearMockedQueries();
  });

  it("returns all patterns in the 'all' property", () => {
    mockScenario(tumbleweed, [gnomePattern, kdePattern, basePattern, lampPattern], {});

    const { result } = renderHook(() => useAvailablePatterns());

    expect(result.current.all).toEqual([gnomePattern, kdePattern, basePattern, lampPattern]);
  });

  it("returns desktop patterns into 'desktops' property", () => {
    mockScenario(tumbleweed, [gnomePattern, kdePattern, basePattern, lampPattern], {});

    const { result } = renderHook(() => useAvailablePatterns());

    expect(result.current.desktops).toEqual([gnomePattern, kdePattern]);
  });

  it("returns non-desktop patterns into 'other' property", () => {
    mockScenario(tumbleweed, [gnomePattern, kdePattern, basePattern, lampPattern], {});

    const { result } = renderHook(() => useAvailablePatterns());

    expect(result.current.other).toEqual([basePattern, lampPattern]);
  });

  it("returns empty arrays when no patterns are available", () => {
    mockScenario(tumbleweed, [], {});

    const { result } = renderHook(() => useAvailablePatterns());

    expect(result.current.all).toEqual([]);
    expect(result.current.desktops).toEqual([]);
    expect(result.current.other).toEqual([]);
  });

  it("returns empty 'desktops' when only non-desktop patterns exist", () => {
    mockScenario(sles, [basePattern, lampPattern], {});

    const { result } = renderHook(() => useAvailablePatterns());

    expect(result.current.all).toEqual([basePattern, lampPattern]);
    expect(result.current.desktops).toEqual([]);
    expect(result.current.other).toEqual([basePattern, lampPattern]);
  });

  it("returns empty 'other' when only desktop patterns exist", () => {
    mockScenario(tumbleweed, [gnomePattern, kdePattern], {});

    const { result } = renderHook(() => useAvailablePatterns());

    expect(result.current.all).toEqual([gnomePattern, kdePattern]);
    expect(result.current.desktops).toEqual([gnomePattern, kdePattern]);
    expect(result.current.other).toEqual([]);
  });
});

describe("useIsDesktopMissing", () => {
  beforeEach(() => {
    clearMockedQueries();
  });

  it("returns false when the product does not declare desktopSelection", () => {
    mockScenario(legacyProduct, [gnomePattern, basePattern], {});

    const { result } = renderHook(() => useIsDesktopMissing());

    expect(result.current).toBe(false);
  });

  it("returns false when the product's desktopSelection is 'optional'", () => {
    mockScenario(sles, [gnomePattern, basePattern], {});

    const { result } = renderHook(() => useIsDesktopMissing());

    expect(result.current).toBe(false);
  });

  describe("when the product's desktopSelection is 'suggested'", () => {
    it("returns true if no patterns are selected", () => {
      mockScenario(tumbleweed, [gnomePattern, basePattern], {});

      const { result } = renderHook(() => useIsDesktopMissing());

      expect(result.current).toBe(true);
    });

    it("returns true if only non-desktop patterns are selected", () => {
      mockScenario(tumbleweed, [gnomePattern, basePattern], {
        yast2_basis: SelectedBy.USER,
      });

      const { result } = renderHook(() => useIsDesktopMissing());

      expect(result.current).toBe(true);
    });

    it("returns false if a desktop pattern is selected", () => {
      mockScenario(tumbleweed, [gnomePattern, basePattern], {
        gnome: SelectedBy.USER,
      });

      const { result } = renderHook(() => useIsDesktopMissing());

      expect(result.current).toBe(false);
    });

    it("returns false if no desktop patterns are available", () => {
      mockScenario(tumbleweed, [basePattern, lampPattern], {});

      const { result } = renderHook(() => useIsDesktopMissing());

      expect(result.current).toBe(false);
    });
  });
});

describe("useSelectedPatterns", () => {
  beforeEach(() => {
    clearMockedQueries();
  });

  it("returns an empty list when no pattern is selected", () => {
    mockScenario(tumbleweed, [gnomePattern, basePattern], {});

    const { result } = renderHook(() => useSelectedPatterns());

    expect(result.current).toEqual([]);
  });

  it("returns patterns selected by the user", () => {
    mockScenario(tumbleweed, [gnomePattern, basePattern], {
      gnome: SelectedBy.USER,
    });

    const { result } = renderHook(() => useSelectedPatterns());

    expect(result.current).toEqual([gnomePattern]);
  });

  it("returns patterns auto-pulled as dependencies", () => {
    mockScenario(tumbleweed, [gnomePattern, basePattern], {
      yast2_basis: SelectedBy.AUTO,
    });

    const { result } = renderHook(() => useSelectedPatterns());

    expect(result.current).toEqual([basePattern]);
  });

  it("excludes patterns explicitly marked as removed", () => {
    mockScenario(tumbleweed, [gnomePattern, basePattern], {
      gnome: SelectedBy.USER,
      yast2_basis: SelectedBy.REMOVED,
    });

    const { result } = renderHook(() => useSelectedPatterns());

    expect(result.current).toEqual([gnomePattern]);
  });

  it("excludes patterns marked as not selected", () => {
    mockScenario(tumbleweed, [gnomePattern, basePattern], {
      gnome: SelectedBy.USER,
      yast2_basis: SelectedBy.NONE,
    });

    const { result } = renderHook(() => useSelectedPatterns());

    expect(result.current).toEqual([gnomePattern]);
  });
});

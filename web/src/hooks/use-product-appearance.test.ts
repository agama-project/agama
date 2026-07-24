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
import { resetLocalStorage } from "~/test-utils";
import useProductAppearance from "./use-product-appearance";

const getLink = () => document.getElementById("agm-product-appearance") as HTMLLinkElement | null;

describe("useProductAppearance", () => {
  beforeEach(() => {
    resetLocalStorage();
    document.getElementById("agm-product-appearance")?.remove();
  });

  it("does nothing when no product id is given", () => {
    renderHook(() => useProductAppearance());

    expect(getLink()).toBeNull();
    expect(window.localStorage.getItem("agm-product-id")).toBeNull();
  });

  it("injects the product's stylesheet link and persists the product id", () => {
    renderHook(() => useProductAppearance("Tumbleweed"));

    expect(getLink()?.getAttribute("href")).toBe("assets/appearance/Tumbleweed.css");
    expect(window.localStorage.getItem("agm-product-id")).toBe("Tumbleweed");
  });

  it("updates the existing link and the persisted id when the product changes", () => {
    const { rerender } = renderHook(({ productId }) => useProductAppearance(productId), {
      initialProps: { productId: "Tumbleweed" },
    });

    rerender({ productId: "SLES" });

    expect(getLink()?.getAttribute("href")).toBe("assets/appearance/SLES.css");
    expect(window.localStorage.getItem("agm-product-id")).toBe("SLES");
    // Reuses the same element instead of creating a duplicate.
    expect(document.querySelectorAll("#agm-product-appearance").length).toBe(1);
  });
});

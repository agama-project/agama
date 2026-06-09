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

import { useEffect } from "react";

const LINK_ID = "agm-product-appearance";

/**
 * Loads the optional per-product appearance stylesheet into the document head.
 *
 * A product can ship `src/assets/products/<product-id>.css` (served at
 * `assets/appearance/<product-id>.css`) to override appearance tokens (brand
 * colors and more) for any of the light, dark and high-contrast themes. The
 * stylesheet is appended after the Agama styles, so its `:root` token overrides
 * win by source order. A missing file is harmless: the browser ignores the
 * failed stylesheet and no overrides apply.
 *
 * @param productId - active product id; the stylesheet is named after it.
 */
export default function useProductAppearance(productId?: string): void {
  useEffect(() => {
    if (!productId) return;

    const href = `assets/appearance/${productId}.css`;
    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  }, [productId]);
}

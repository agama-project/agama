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

import React, { useEffect, useState } from "react";
import { sprintf } from "sprintf-js";
import { useAppearance } from "~/context/appearance";
import { _ } from "~/i18n";

/**
 * Builds the dark-variant filename for a logo (e.g. "SUSE.svg" -> "SUSE-dark.svg").
 */
function darkVariant(icon: string): string {
  const dot = icon.lastIndexOf(".");
  return dot === -1 ? `${icon}-dark` : `${icon.slice(0, dot)}-dark${icon.slice(dot)}`;
}

export default function ProductLogo({ product, width = "80px" }) {
  const { isDark } = useAppearance();
  // Prefer the dark variant on the dark theme, falling back to the light logo
  // for products that do not ship one (handled by onError below).
  const [useDark, setUseDark] = useState(isDark);

  useEffect(() => setUseDark(isDark), [isDark]);

  if (!product || !product.icon) return;

  const lightSrc = `assets/logos/${product.icon}`;
  const darkSrc = `assets/logos/${darkVariant(product.icon)}`;
  // TRANSLATORS: %s will be replaced by a product name. E.g., "openSUSE Tumbleweed"
  const logoAltText = sprintf(_("%s logo"), product.name);

  return (
    <img
      aria-hidden
      src={useDark ? darkSrc : lightSrc}
      alt={logoAltText}
      width={width}
      onError={() => useDark && setUseDark(false)}
      style={{ verticalAlign: "middle", width }}
    />
  );
}

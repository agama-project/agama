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
import Text from "~/components/core/Text";

interface LabelTextProps {
  /** The main label text. */
  children: string;
  /**
   * An optional suffix, e.g. "(optional)".
   *
   * It is rendered in a subtler style to distinguish it from
   * the main label text.
   */
  suffix?: string;
}

/**
 * A form field label with an optional styled suffix.
 *
 * The suffix is rendered in a subtler color to visually distinguish it from
 * the main label while keeping both accessible as a single label string.
 *
 * See `src/components/form/conventions.md` for guidance on when and how to
 * use suffixes.
 */
export default function LabelText({ children, suffix }: LabelTextProps) {
  return (
    <>
      {children}
      {suffix && (
        <>
          {" "}
          <Text textStyle={["textColorSubtle", "fontSizeXs", "fontWeightNormal"]}>{suffix}</Text>
        </>
      )}
    </>
  );
}

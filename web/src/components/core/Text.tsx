/*
 * Copyright (c) [2025] SUSE LLC
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
import { Page } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { capitalize } from "radashi";

type PageBreakPoints = ReturnType<NonNullable<typeof Page.defaultProps.getBreakpoint>>;

type TextProps = React.HTMLProps<HTMLSpanElement> &
  React.PropsWithChildren<{
    /** Whether apply bold font weight */
    isBold?: boolean;
    /**
     * Whether the text should be visually hidden but kept accessible to screen readers.
     * Takes precedence over `srOn` if both are provided.
     */
    srOnly?: boolean;
    /**
     * Makes text only accessible to screen readers at a specific breakpoint.
     * Ignored if `srOnly` is true.
     */
    srOn?: PageBreakPoints;
  }>;

/**
 * Simple text wrapper that optionally applies bold styling and
 * screen-reader-only visibility.
 *
 * Accessibility behavior is controlled by `srOnly` and `srOn`, with `srOnly`
 * taking precedence.
 */
export default function Text({
  isBold = false,
  srOnly = false,
  srOn,
  className,
  children,
  ...props
}: TextProps) {
  return (
    <span
      {...props}
      className={[
        className,
        isBold && textStyles.fontWeightBold,
        (srOnly || srOn === "default") && a11yStyles.screenReader,
        !srOnly && srOn && srOn !== "default" && a11yStyles[`screenReaderOn${capitalize(srOn)}`],
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

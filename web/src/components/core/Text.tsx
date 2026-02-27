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
import { capitalize, isArray, isString } from "radashi";
import { Page } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";

type PageBreakPoints = ReturnType<NonNullable<typeof Page.defaultProps.getBreakpoint>>;
type TextStyleKey = keyof typeof textStyles;

type TextProps = React.HTMLProps<HTMLSpanElement> &
  React.PropsWithChildren<{
    /** The HTML element to use for wrapping given children */
    component?: "small" | "span";
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
    /**
     * One or more PatternFly text utility class keys to apply to the element.
     * These map directly to keys of the `textStyles` utility object, e.g.
     * `"textColorDisabled"` or `["textColorDisabled", "fontSizeSm"]`.
     *
     * @see https://www.patternfly.org/utility-classes/text
     *
     * @example
     * // Single style
     * <Text textStyle="textColorDisabled" />
     *
     * @example
     * // Multiple styles
     * <Text textStyle={["textColorDisabled", "fontSizeSm"]} />
     */
    textStyle?: TextStyleKey | TextStyleKey[];
  }>;

/**
 * Simple text wrapper that optionally applies bold styling and
 * screen-reader-only visibility.
 *
 * Accessibility behavior is controlled by `srOnly` and `srOn`, with `srOnly`
 * taking precedence.
 */
export default function Text({
  component = "span",
  isBold = false,
  srOnly = false,
  srOn,
  children,
  textStyle,
  className,
  ...props
}: TextProps) {
  const Wrapper = component;

  return (
    <Wrapper
      {...props}
      className={[
        className,
        isString(textStyle) && textStyles[textStyle],
        isArray(textStyle) && textStyle.map((s) => textStyles[s]),
        isBold && textStyles.fontWeightBold,
        (srOnly || srOn === "default") && a11yStyles.screenReader,
        !srOnly && srOn && srOn !== "default" && a11yStyles[`screenReaderOn${capitalize(srOn)}`],
      ]
        .filter(Boolean)
        // flat() is needed because join() only applies the separator at the top level,
        // using commas for nested arrays instead.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/join#description
        .flat()
        .join(" ")}
    >
      {children}
    </Wrapper>
  );
}

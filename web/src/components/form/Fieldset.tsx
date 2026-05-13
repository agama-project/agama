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
import NestedContent from "~/components/core/NestedContent";
import Text from "~/components/core/Text";

export interface FieldsetProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  /**
   * Text displayed as the fieldset legend
   */
  legend: string;
  /**
   * Optional descriptive text displayed below the legend
   */
  description?: string;
  /**
   * Content to render inside the fieldset
   */
  children: React.ReactNode;
}

/**
 * Wrapper for semantic HTML fieldset elements with consistent styling.
 *
 * Provides a legend and optional description text, wrapping children in
 * NestedContent for consistent spacing.
 *
 * Accepts all native fieldset HTML attributes (disabled, form, name, etc.).
 *
 * @example
 * ```tsx
 * <Fieldset
 *   legend={_("Network Settings")}
 *   description={_("Configure network interfaces and connections")}
 * >
 *   <TextField form={form} name="interface" />
 * </Fieldset>
 * ```
 *
 * @example
 * ```tsx
 * <Fieldset
 *   legend={_("Optional Settings")}
 *   disabled={!isEnabled}
 * >
 *   <TextField form={form} name="option" />
 * </Fieldset>
 * ```
 */
export function Fieldset({ legend, description, children, ...props }: FieldsetProps) {
  return (
    <fieldset {...props}>
      <legend>{legend}</legend>
      <NestedContent margin="mxLg">
        {description && <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{description}</Text>}
        {children}
      </NestedContent>
    </fieldset>
  );
}

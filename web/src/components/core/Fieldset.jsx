/*
 * Copyright (c) [2022] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

// @ts-check

import React from "react";
import { Stack } from "@patternfly/react-core";

/**
 * Convenient component for grouping form fields in "sections"
 * by using the native fieldset element
 *
 * @component
 *
 * @example <caption>Simple usage</caption>
 *   <Fieldset legend="Encryption options">
 *     <EncryptionType />
 *     <EncryptionPassword />
 *   </Fieldset>
 *
 * @param {object} props
 * @param {React.ReactNode} props.legend - The legend
 * @param {string} [props.className] - additionally CSS class names
 * @param {JSX.Element} [props.children] - the section content
 * @param {object} [props.otherProps] fieldset element attributes, see {@link https://html.spec.whatwg.org/#the-fieldset-element}
 */
export default function Fieldset({ legend, children, ...otherProps }) {
  return (
    <fieldset {...otherProps}>
      <Stack hasGutter>
        {legend && <legend>{legend}</legend>}
        {children}
      </Stack>
    </fieldset>
  );
}

/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check
// cspell:ignore labelable

import React from "react";
import styles from "@patternfly/react-styles/css/components/Form/form";

/**
 * Renders a read-only form value with a label that visually looks identically
 * that a a label of an editable form value, without using the `label` HTML tag.
 *
 * Basically, this "mimicking component" is needed for two reasons:
 *
 * - The HTML specification limits the use of labels to "labelable elements".
 *
 *   > Some elements, not all of them form-associated, are categorized as labelable
 *   > elements. These are elements that can be associated with a label element.
 *   >   => button, input (if the type attribute is not in the Hidden state), meter,
 *   >      output, progress, select, textarea, form-associated custom elements
 *   >
 *   > https://html.spec.whatwg.org/multipage/forms.html#categories
 *
 * - Agama does not use disabled form controls for rendering a value that users
 *   have no chance to change by any means, but a raw text instead.
 *
 * Based on PatternFly Form styles to maintain consistency.
 *
 * @typedef {import("react").ComponentProps<"div">} HTMLDivProps
 * @param {HTMLDivProps & { label: string }} props
 */
export default function FormReadOnlyField({ label, children, className = "", ...props }) {
  return (
    <div className={`${className} ${styles.formGroup}`.trim()} {...props}>
      <div className={styles.formGroupLabel} {...props}>
        <span className={styles.formLabelText}>{label}</span>
      </div>
      {children}
    </div>
  );
}

/*
 * Copyright (c) [2022] SUSE LLC
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
import styles from "@patternfly/react-styles/css/components/Form/form";

/**
 * A missing PatternFly FormLabel, see:
 * https://github.com/patternfly/patternfly-react/blob/d68f302609a6abf8da34d1c33b153f604d6b329d/packages/react-core/src/components/Form/FormGroup.tsx#L108-L123
 *
 * @param {object} props - component props
 * @param {boolean} [props.isRequired=false] - whether the associated field is mandatory
 * @param {string} [props.fieldId] - the id of the associated field, if any
 * @param {React.ReactNode} props.children - the label content
 *
 */
export default function FormLabel({ isRequired = false, fieldId, children }) {
  return (
    <label className={styles.formLabel} {...(fieldId && { htmlFor: fieldId })}>
      <span className={styles.formLabelText}>{children}</span>
      {isRequired && (
        <span className={styles.formLabelRequired} aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );
}

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
import { useFieldContext } from "~/hooks/form-contexts";

import formStyles from "@patternfly/react-styles/css/components/Form/form";

type ReadOnlyFieldProps = {
  label: React.ReactNode;
};

/**
 * Displays read-only information from a TanStack Form field.
 * Must be used inside a `form.AppField` render prop.
 *
 * Use this when you need to show contextual information alongside editable
 * fields without using disabled inputs. The label and value are read
 * sequentially by screen readers, which is appropriate for simple read-only
 * data display.
 *
 * @see useFieldContext for field component conventions.
 *
 * @example
 * <form.AppField name="connectionType">
 *   {(field) => <field.ReadOnlyField label={_("Type")} />}
 * </form.AppField>
 */
export default function ReadOnlyField({ label }: ReadOnlyFieldProps) {
  const field = useFieldContext<React.ReactNode>();

  return (
    <div className={formStyles.formGroup}>
      <div className={formStyles.formLabel}>
        <span className={formStyles.formLabelText}>{label}</span>
      </div>
      <Text>{field.state.value}</Text>
    </div>
  );
}

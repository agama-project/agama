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
import { Checkbox } from "@patternfly/react-core";
import { useFieldContext } from "~/hooks/form-contexts";

type CheckboxFieldProps = {
  label: string;
  description?: React.ReactNode;
};

/**
 * A checkbox tied to a TanStack Form field via `useFieldContext`.
 * Must be used inside a `form.AppField` render prop.
 *
 * @see useFieldContext for field component conventions.
 */
export default function CheckboxField({ label, description }: CheckboxFieldProps) {
  const field = useFieldContext<boolean>();

  return (
    <Checkbox
      id={field.name}
      label={label}
      description={description}
      isChecked={field.state.value}
      onChange={(_, checked) => field.handleChange(checked)}
    />
  );
}

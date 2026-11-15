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
import { Flex } from "@patternfly/react-core";

/**
 * Form fields side by side, each as wide as its content, wrapping to the next
 * line when there is no room.
 *
 * Aligned at the top, so a helper text or an error below one field does not
 * push the others out of line.
 *
 * @example
 * <FieldsRow>
 *   <form.AppField name="fullName">
 *     {(field) => <field.TextField label={_("Full name")} />}
 *   </form.AppField>
 *   <form.AppField name="userName">
 *     {(field) => <field.TextField label={_("Username")} />}
 *   </form.AppField>
 * </FieldsRow>
 */
export default function FieldsRow({ children }: React.PropsWithChildren) {
  return (
    <Flex gap={{ default: "gapMd" }} alignItems={{ default: "alignItemsFlexStart" }}>
      {children}
    </Flex>
  );
}

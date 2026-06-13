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
import NestedContent from "~/components/core/NestedContent";

type FieldNestedContentProps = {
  children: React.ReactNode;
  margin?: React.ComponentProps<typeof NestedContent>["margin"];
};

/**
 * Wrapper for nested content inside a form field.
 *
 * Renders children inside a NestedContent with a Flex column layout.
 * Used for stacking multiple pieces of conditional content (hints, warnings)
 * within a FormGroup, with explicit control over spacing instead of relying
 * on the default PatternFly FormGroup gap.
 *
 * The caller is responsible for deciding whether to render this component.
 * Mounting it with no visible children will still reserve the space taken
 * by its margins, creating an unintended visual gap.
 *
 * @example
 * <form.AppField name="filesystem">
 *   {(field) => (
 *     <field.DropdownField label={_("File system")} options={options}>
 *       {(value) => {
 *         const showHint = value === "auto" && !!mountPoint;
 *         const showWarning = value !== "reuse";
 *
 *         if (!showHint && !showWarning) return null;
 *
 *         return (
 *           <FieldNestedContent>
 *             {showHint && <Hint />}
 *             {showWarning && <Warning />}
 *           </FieldNestedContent>
 *         );
 *       }}
 *     </field.DropdownField>
 *   )}
 * </form.AppField>
 */
export default function FieldNestedContent({
  children,
  margin = ["mlMd", "mtMd"],
}: FieldNestedContentProps) {
  return (
    <NestedContent margin={margin}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
        {children}
      </Flex>
    </NestedContent>
  );
}

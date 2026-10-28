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
import { Button, Content } from "@patternfly/react-core";
import { _ } from "~/i18n";

type PreservedValueFieldProps = {
  /** Message to display when preserving the existing value */
  preservedMessage: React.ReactNode;
  /** Label for the change button (defaults to "Change") */
  changeButtonLabel?: React.ReactNode;
  /** Whether currently preserving the value or allowing edit */
  isPreserving: boolean;
  /** Callback when user clicks the change button */
  onEdit: () => void;
  /** The fields to render when not preserving */
  children: React.ReactNode;
};

/**
 * A UI helper component for the preserve/edit toggle pattern.
 *
 * Displays either a preserved message with a change button, or renders
 * the child fields for editing. Common in forms that can preserve existing
 * sensitive values (hashed passwords, API keys, credentials) vs. provide new ones.
 *
 * @example
 * <form.Subscribe selector={(s) => s.values.usingHashedPassword}>
 *   {(usingHashedPassword) => (
 *     <PreservedValueField
 *       preservedMessage={_("Using a hashed password.")}
 *       isPreserving={usingHashedPassword}
 *       onEdit={() => form.setFieldValue("usingHashedPassword", false)}
 *     >
 *       <form.AppField name="password">
 *         {(field) => <field.PasswordConfirmationField ... />}
 *       </form.AppField>
 *     </PreservedValueField>
 *   )}
 * </form.Subscribe>
 */
export default function PreservedValueField({
  preservedMessage,
  changeButtonLabel = _("Change"),
  isPreserving,
  onEdit,
  children,
}: PreservedValueFieldProps) {
  if (isPreserving) {
    return (
      <Content isEditorial>
        {preservedMessage}{" "}
        <Button variant="link" isInline onClick={onEdit}>
          {changeButtonLabel}
        </Button>
      </Content>
    );
  }

  return <>{children}</>;
}

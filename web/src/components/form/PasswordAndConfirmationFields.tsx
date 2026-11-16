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

import React, { useId, useState } from "react";
import { Stack, Switch } from "@patternfly/react-core";
import FieldsRow from "~/components/form/FieldsRow";
import { _ } from "~/i18n";

type PasswordAndConfirmationFieldsProps = {
  /**
   * Renders the password and its confirmation, each a field of the form,
   * shown or hidden as told.
   */
  children: (isRevealed: boolean) => React.ReactNode;
};

/**
 * A password and its confirmation side by side, with one switch showing or
 * hiding both. The switch acts at once and is not a value of the form, which
 * is why it is a switch and not a checkbox.
 *
 * The fields belong to the caller's form, so it works with any form: give
 * each `MaskedField` the `isRevealed` it receives.
 *
 * @example
 * <PasswordAndConfirmationFields>
 *   {(isRevealed) => (
 *     <>
 *       <form.AppField name="password">
 *         {(field) => <field.MaskedField label={_("Password")} isRevealed={isRevealed} />}
 *       </form.AppField>
 *       <form.AppField name="passwordConfirmation">
 *         {(field) => (
 *           <field.MaskedField label={_("Password confirmation")} isRevealed={isRevealed} />
 *         )}
 *       </form.AppField>
 *     </>
 *   )}
 * </PasswordAndConfirmationFields>
 */
export default function PasswordAndConfirmationFields({
  children,
}: PasswordAndConfirmationFieldsProps) {
  const switchId = useId();
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <Stack hasGutter>
      <FieldsRow>{children(isRevealed)}</FieldsRow>
      <Switch
        id={switchId}
        // TRANSLATORS: switch showing the typed password and its confirmation
        label={_("Show password")}
        isChecked={isRevealed}
        onChange={(_e, checked) => setIsRevealed(checked)}
      />
    </Stack>
  );
}

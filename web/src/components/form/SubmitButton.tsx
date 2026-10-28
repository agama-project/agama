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
import { Button, ButtonProps } from "@patternfly/react-core";
import { useFormContext } from "~/hooks/form-contexts";
import { _ } from "~/i18n";

type SubmitButtonProps = Omit<ButtonProps, "type" | "label"> & {
  /** Button label, used when no children are provided. Defaults to "Accept". */
  label?: React.ReactNode;
};

/**
 * A submit button for use inside a form's action group.
 *
 * Reads `isSubmitting` from the form context to show a loading indicator
 * and disable the button while the form is being submitted. Registered as
 * a form component so it is available as `form.SubmitButton`, keeping
 * submit state handling out of form components.
 *
 * The button content is `children` when given, otherwise `label`. Any extra
 * `isLoading`/`isDisabled` are combined with the submitting state, so callers
 * can add their own conditions without losing the built-in one. Remaining
 * button props (e.g. `size`, `variant`) are forwarded as-is.
 *
 * @example
 * <ActionGroup>
 *   <form.SubmitButton />
 *   <form.CancelButton />
 * </ActionGroup>
 */
export default function SubmitButton({
  // TRANSLATORS: label for the form submit button.
  label = _("Accept"),
  children,
  isLoading,
  isDisabled,
  ...props
}: SubmitButtonProps) {
  const form = useFormContext();

  return (
    <form.Subscribe selector={(s) => s.isSubmitting}>
      {(isSubmitting) => (
        <Button
          type="submit"
          isLoading={isLoading || isSubmitting}
          isDisabled={isDisabled || isSubmitting}
          {...props}
        >
          {children ?? label}
        </Button>
      )}
    </form.Subscribe>
  );
}

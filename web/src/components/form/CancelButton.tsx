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
import { useNavigate } from "react-router";
import { _ } from "~/i18n";

type CancelButtonProps = Omit<ButtonProps, "onClick" | "type">;

/**
 * A Cancel button for use inside a form's action group.
 *
 * Navigates back to the previous page when clicked. Registered as a form
 * component so it is available as `form.CancelButton`, keeping navigation
 * logic out of form components.
 *
 * Button props (e.g. `size`, `variant`) are forwarded as-is, so it can be
 * paired with a submit button that is not using the default size.
 *
 * @example
 * <ActionGroup>
 *   <form.SubmitButton />
 *   <form.CancelButton />
 * </ActionGroup>
 */
export default function CancelButton({ children, ...props }: CancelButtonProps) {
  const navigate = useNavigate();

  return (
    <Button variant="link" onClick={() => navigate(-1)} {...props}>
      {children ??
        // TRANSLATORS: label for the form cancel button.
        _("Cancel")}
    </Button>
  );
}

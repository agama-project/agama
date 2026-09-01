/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { sprintf } from "sprintf-js";
import { Checkbox } from "@patternfly/react-core";
import LicenseButton from "~/components/product/LicenseButton";
import { Product } from "~/model/system";
import { _ } from "~/i18n";

/**
 * Props for EulaCheckbox component
 */
export type EulaCheckboxProps = {
  product: Product;
  onChange: (accepted: boolean) => void;
  isChecked: boolean;
};

/**
 * Checkbox for accepting a product's license agreement.
 * Includes a link to view the full license text.
 */
export default function EulaCheckbox({ product, onChange, isChecked }: EulaCheckboxProps) {
  const [eulaTextStart, eulaTextLink, eulaTextEnd] = sprintf(
    // TRANSLATORS: Text used for the license acceptance checkbox. %s will be
    // replaced with the product name and the text in the square brackets [] is
    // used for the link to show the license, please keep the brackets.
    _("I have read and accept the [license] for %s"),
    product?.name,
  ).split(/[[\]]/);

  return (
    <>
      <Checkbox
        isChecked={isChecked}
        onChange={(_, accepted) => onChange(accepted)}
        id="license-acceptance"
        label={
          <>
            {eulaTextStart}{" "}
            <LicenseButton product={product} variant="link" isInline>
              {eulaTextLink}
            </LicenseButton>{" "}
            {eulaTextEnd}
          </>
        }
      />
    </>
  );
}

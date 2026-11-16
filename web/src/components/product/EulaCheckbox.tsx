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
import Interpolate from "~/components/core/Interpolate";
import LicenseButton from "~/components/product/LicenseButton";
import { _ } from "~/i18n";

import type { License, Product } from "~/model/system";

/**
 * Props for EulaCheckbox component
 */
export type EulaCheckboxProps = {
  /** The license being accepted */
  license: License;
  /** The product the license belongs to */
  product: Product;
  /**
   * Whether the label names the license instead of the product. Meant for
   * products with several licenses, where each checkbox must tell which
   * license it is about.
   */
  namesLicense?: boolean;
  /** Callback fired when checkbox state changes */
  onChange: (accepted: boolean) => void;
  /** Whether the checkbox is currently checked (i.e., license accepted) */
  isChecked: boolean;
};

/**
 * Label naming the product, with a link to view its license.
 */
const ProductEulaLabel = ({ license, product }: Pick<EulaCheckboxProps, "license" | "product">) => {
  const [textStart, textLink, textEnd] = sprintf(
    // TRANSLATORS: Text used for the license acceptance checkbox. %s will be
    // replaced with the product name and the text in the square brackets [] is
    // used for the link to show the license, please keep the brackets.
    _("I have read and accept the [license] for %s"),
    product.name,
  ).split(/[[\]]/);

  return (
    <>
      {textStart}{" "}
      <LicenseButton license={license} dialogTitle={product.name} variant="link" isInline>
        {textLink}
      </LicenseButton>{" "}
      {textEnd}
    </>
  );
};

/**
 * Label naming the license, which works as a link to view it.
 */
const LicenseEulaLabel = ({ license }: Pick<EulaCheckboxProps, "license">) => (
  <Interpolate
    // TRANSLATORS: Text used for accepting one of the several licenses of a
    // product. %s will be replaced with the license name, which is also a link
    // to show the license.
    sentence={_("I have read and accept the %s")}
  >
    {() => (
      <LicenseButton license={license} variant="link" isInline>
        {license.name}
      </LicenseButton>
    )}
  </Interpolate>
);

/**
 * Checkbox for accepting a product license.
 * Includes a link to view the full license text.
 */
export default function EulaCheckbox({
  license,
  product,
  namesLicense = false,
  onChange,
  isChecked,
}: EulaCheckboxProps) {
  return (
    <Checkbox
      isChecked={isChecked}
      onChange={(_, accepted) => onChange(accepted)}
      id={`license-acceptance-${license.id}`}
      label={
        namesLicense ? (
          <LicenseEulaLabel license={license} />
        ) : (
          <ProductEulaLabel license={license} product={product} />
        )
      }
    />
  );
}

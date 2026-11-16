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

import React, { useState } from "react";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import { List } from "@patternfly/react-core";
import Popup from "~/components/core/Popup";
import ProductSummary from "~/components/product/ProductSummary";
import { n_, _ } from "~/i18n";

import type { Product } from "~/model/system";

type ProductSelectorModalProps = {
  isOpen: boolean;
  products: Product[];
  /** The product picked so far, if any. */
  selected?: string;
  /** Called with the id of the product picked in the dialog. */
  onSelect: (id: string) => void;
  onCancel: () => void;
};

/**
 * Dialog listing the products with their details, only to pick one. Its modes
 * and licenses are asked for back in the form, once the product is picked.
 */
export default function ProductSelectorModal({
  isOpen,
  products,
  selected,
  onSelect,
  onCancel,
}: ProductSelectorModalProps) {
  const [picked, setPicked] = useState(selected);

  const modesLabel = (product: Product) => {
    const count = product.modes?.length ?? 0;
    if (count === 0) return undefined;
    // TRANSLATORS: label of a product telling how many modes it can be
    // installed in. %d is the number of modes.
    return sprintf(n_("%d mode available", "%d modes available", count), count);
  };

  return (
    <Popup
      isOpen={isOpen}
      onClose={onCancel}
      // TRANSLATORS: title of the dialog listing the products to install
      title={_("Select a product")}
      actions={
        <>
          <Popup.Confirm isDisabled={isEmpty(picked)} onClick={() => onSelect(picked)}>
            {
              // TRANSLATORS: button picking the product chosen in the dialog
              _("Select")
            }
          </Popup.Confirm>
          <Popup.Cancel onClick={onCancel} />
        </>
      }
    >
      <List
        isPlain
        role="radiogroup"
        // TRANSLATORS: accessible name of the list of products to choose from
        aria-label={_("Products")}
      >
        {products.map((product) => (
          <ProductSummary
            key={product.id}
            product={product}
            isChecked={picked === product.id}
            onChange={() => setPicked(product.id)}
            modesLabel={modesLabel(product)}
          />
        ))}
      </List>
    </Popup>
  );
}

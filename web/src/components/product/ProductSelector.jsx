/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { Selector } from "~/components/core";

import { _ } from "~/i18n";
import { noop } from "~/utils";

export default function ProductSelector({ value, products = [], onChange = noop }) {
  if (products.length === 0) return <p>{_("No products available for selection")}</p>;

  const onSelectionChange = (selection) => onChange(selection[0]);

  return (
    <Selector
      aria-label={_("Available products")}
      selectedIds={[value]}
      onSelectionChange={onSelectionChange}
    >
      { products.map(p => (
        <Selector.Option id={p.id} key={p.id}>
          <div className="stack">
            <h3>{p.name}</h3>
            <p>{p.description}</p>
          </div>
        </Selector.Option>
      ))}
    </Selector>
  );
}

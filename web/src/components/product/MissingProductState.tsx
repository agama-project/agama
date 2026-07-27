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
import UnavailableState from "~/components/core/UnavailableState";
import { NETWORK } from "~/routes/paths";
import { _ } from "~/i18n";

export type MissingProductStateProps = {
  /** Short summary of what cannot be done because the product is missing. */
  title: React.ReactNode;
  /** Explanation of the situation, usually the description of the issue. */
  description: React.ReactNode;
};

/**
 * Empty state shown when the product cannot be found in the repositories.
 *
 * Besides the given explanation, it points to the network settings since a
 * faulty connection is the most likely cause.
 *
 * @example
 * <MissingProductState
 *   title={_("Product not found")}
 *   description={missingProduct.description}
 * />
 */
export default function MissingProductState({ title, description }: MissingProductStateProps) {
  return (
    <UnavailableState
      icon="search_off"
      title={title}
      description={description}
      hint={
        // TRANSLATORS: additional hint when the product is missing
        _("This might be due to network connectivity.")
      }
      actionLink={{
        to: NETWORK.root,
        label:
          // TRANSLATORS: link to go to network settings
          _("Go to network settings"),
      }}
    />
  );
}

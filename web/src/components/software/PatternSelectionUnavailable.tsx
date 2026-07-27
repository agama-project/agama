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
import Link from "~/components/core/Link";
import UnavailableState from "~/components/core/UnavailableState";
import MissingProductState from "~/components/product/MissingProductState";
import { useIssues } from "~/hooks/model/issue";
import { useAvailablePatterns } from "~/hooks/model/system/software";
import { REGISTRATION } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Software issues indicating the product is unavailable.
 *
 * These issues signal that the product cannot be found, either because
 * registration is required but missing, or because product detection failed.
 */
export const PRODUCT_AVAILABILITY_ISSUES = ["missing_registration", "missing_product"];

/**
 * Empty state shown when software selection is unavailable.
 *
 * Displays contextual messages and actions based on why software cannot be
 * selected:
 *
 *   - Missing registration: prompts to complete product registration
 *   - Missing product: suggests checking network connectivity and settings
 *   - No software available: informs that software can be added after
 *     installation
 */
export default function PatternSelectionUnavailable() {
  const issues = useIssues("software");
  const { all: patterns } = useAvailablePatterns();

  const missingRegistration = issues.find((i) => i.class === "missing_registration");
  const missingProduct = issues.find((i) => i.class === "missing_product");

  // TRANSLATORS: empty state title when software cannot be selected
  const title = _("Software selection is not available");

  if (missingRegistration) {
    return (
      <UnavailableState
        title={title}
        description={missingRegistration.description}
        actions={
          <Link to={REGISTRATION.root} variant="link" isInline>
            {/* TRANSLATORS: link to go to registration settings */}
            {_("Go to registration")}
          </Link>
        }
      />
    );
  }

  if (missingProduct) {
    return <MissingProductState title={title} description={missingProduct.description} />;
  }

  if (patterns.length === 0) {
    return (
      <UnavailableState
        title={title}
        description={
          // TRANSLATORS: shown when the product provides zero patterns
          _(
            "This product does not allow selecting software at installation time. Additional software can be added after the installation is complete.",
          )
        }
      />
    );
  }

  return (
    <UnavailableState
      title={title}
      description={
        // TRANSLATORS: shown when software selection cannot be determined
        _("The software selection could not be loaded.")
      }
    />
  );
}

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
import {
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import Link from "~/components/core/Link";
import { useIssues } from "~/hooks/model/issue";
import { useAvailablePatterns } from "~/hooks/model/system/software";
import { REGISTRATION, NETWORK } from "~/routes/paths";
import { _ } from "~/i18n";

const EmptyStateIcon = () => <Icon name="apps_outage" />;

type UnavailableStateProps = {
  /** Optional title for the empty state. */
  title?: React.ReactNode;
  /** Main description text explaining why software selection is unavailable. */
  description: React.ReactNode;
  /** Optional additional hint text displayed below the description. */
  hint?: string;
  /** Optional action link with destination path and label. */
  actionLink?: { to: string; label: string };
};

/**
 * Base empty state component for unavailable software selection scenarios.
 *
 * Renders a consistent empty state with an icon, title, description, optional
 * hint, and optional action link. Used to display different messages based on
 * why software selection is unavailable.
 */
const UnavailableState = ({
  // TRANSLATORS: empty state title when software cannot be selected
  title = _("Software selection is not available"),
  description,
  hint,
  actionLink,
}: UnavailableStateProps) => {
  return (
    <EmptyState headingLevel="h2" titleText={title} variant="lg" icon={EmptyStateIcon}>
      <EmptyStateBody>
        <Content component="p" isEditorial>
          {description}
        </Content>
        {hint && <Content component="small">{hint}</Content>}
      </EmptyStateBody>
      {actionLink && (
        <EmptyStateFooter>
          <EmptyStateActions>
            <Link to={actionLink.to} variant="link" isInline>
              {actionLink.label}
            </Link>
          </EmptyStateActions>
        </EmptyStateFooter>
      )}
    </EmptyState>
  );
};

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
  const issues = useIssues("product");
  const { all: patterns } = useAvailablePatterns();

  const missingRegistration = issues.find((i) => i.class === "missing_registration");
  const missingProduct = issues.find((i) => i.class === "missing_product");

  if (missingRegistration) {
    return (
      <UnavailableState
        description={missingRegistration.description}
        actionLink={{
          to: REGISTRATION.root,
          label:
            // TRANSLATORS: link to go to registration settings
            _("Go to registration"),
        }}
      />
    );
  }

  if (missingProduct) {
    return (
      <UnavailableState
        description={missingProduct.description}
        hint={
          // TRANSLATORS: additional hint when base product is missing
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

  if (patterns.length === 0) {
    return (
      <UnavailableState
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
      description={
        // TRANSLATORS: shown when software selection cannot be determined
        _("The software selection could not be loaded.")
      }
    />
  );
}

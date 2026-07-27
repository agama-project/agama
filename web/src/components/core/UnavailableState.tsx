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

const EmptyStateIcon = () => <Icon name="apps_outage" />;

export type UnavailableStateProps = {
  /** Short summary of what is not available. */
  title: React.ReactNode;
  /** Main description text explaining why it is not available. */
  description: React.ReactNode;
  /** Optional additional hint text displayed below the description. */
  hint?: React.ReactNode;
  /** Optional action link with destination path and label. */
  actionLink?: { to: string; label: string };
};

/**
 * Empty state for sections that cannot be used because something is missing or
 * could not be loaded.
 *
 * Use it to explain the situation and, when possible, to offer a way out
 * through `actionLink`.
 *
 * @example
 * <UnavailableState
 *   title={_("Registration is not available")}
 *   description={_("The product must be registered first.")}
 *   actionLink={{ to: REGISTRATION.root, label: _("Go to registration") }}
 * />
 */
export default function UnavailableState({
  title,
  description,
  hint,
  actionLink,
}: UnavailableStateProps) {
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
}

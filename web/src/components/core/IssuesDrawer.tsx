/*
 * Copyright (c) [2024] SUSE LLC
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

import React, { forwardRef } from "react";
import {
  HelperText,
  HelperTextItem,
  NotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerHeader,
  Stack,
} from "@patternfly/react-core";
import Link from "~/components/core/Link";
import { useAllIssues } from "~/queries/issues";
import { useInstallerStatus } from "~/queries/status";
import { IssueSeverity } from "~/types/issues";
import { InstallationPhase } from "~/types/status";
import { _ } from "~/i18n";

/**
 * Drawer for displaying installation issues
 */
const IssuesDrawer = forwardRef(({ onClose }: { onClose: () => void }, ref) => {
  const issues = useAllIssues();
  const { phase } = useInstallerStatus({ suspense: true });
  const { issues: issuesByScope } = issues;

  // FIXME: share below headers with navigation menu
  const scopeHeaders = {
    users: _("Users"),
    storage: _("Storage"),
    software: _("Software"),
  };

  if (issues.isEmpty || phase === InstallationPhase.Install) return;

  return (
    <NotificationDrawer ref={ref}>
      <NotificationDrawerHeader title={_("Pre-installation checks")} onClose={onClose} />
      <NotificationDrawerBody className="agama-issues-drawer-body">
        <Stack hasGutter>
          <p>
            {_(
              "Before installing, you have to make some decisions. Click on each section to review the settings.",
            )}
          </p>
          {Object.entries(issuesByScope).map(([scope, issues], idx) => {
            if (issues.length === 0) return null;
            const ariaLabelId = `${scope}-issues-section`;

            return (
              <section key={idx} aria-labelledby={ariaLabelId}>
                <Stack hasGutter>
                  <h4 id={ariaLabelId}>
                    <Link variant="link" isInline to={`/${scope}`}>
                      {scopeHeaders[scope]}
                    </Link>
                  </h4>
                  <ul>
                    {issues.map((issue, subIdx) => {
                      const variant = issue.severity === IssueSeverity.Error ? "warning" : "info";

                      return (
                        <li key={subIdx}>
                          <HelperText>
                            {/** @ts-expect-error TS complain about variant, let's fix it after PF6 migration */}
                            <HelperTextItem variant={variant} hasIcon>
                              {issue.description}
                            </HelperTextItem>
                          </HelperText>
                        </li>
                      );
                    })}
                  </ul>
                </Stack>
              </section>
            );
          })}
        </Stack>
      </NotificationDrawerBody>
    </NotificationDrawer>
  );
});

export default IssuesDrawer;

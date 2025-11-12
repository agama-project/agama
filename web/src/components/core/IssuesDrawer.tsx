/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { useIssues } from "~/hooks/api";
import { useInstallerStatus } from "~/queries/status";
import { IssueSeverity } from "~/api/issue";
import { InstallationPhase } from "~/types/status";
import { _ } from "~/i18n";

/**
 * Drawer for displaying installation issues
 */
const IssuesDrawer = forwardRef(({ onClose }: { onClose: () => void }, ref) => {
  const issues = useIssues().filter((i) => i.severity === IssueSeverity.Error);
  const { phase } = useInstallerStatus({ suspense: true });

  // FIXME: share below headers with navigation menu
  const scopeHeaders = {
    users: _("Authentication"),
    storage: _("Storage"),
    software: _("Software"),
    product: _("Registration"),
    localization: _("Localization"),
    iscsi: _("iSCSI"),
  };

  if (issues.length === 0 || phase === InstallationPhase.Install) return;

  return (
    <NotificationDrawer ref={ref}>
      <NotificationDrawerHeader title={_("Pre-installation checks")} onClose={onClose} />
      <NotificationDrawerBody className="agm-issues-drawer-body">
        <Stack hasGutter>
          <p>
            {_(
              "Before installing, you have to make some decisions. Click on each section to review the settings.",
            )}
          </p>
          {Object.keys(scopeHeaders).map((scope, idx) => {
            const scopeIssues = issues.filter((i) => i.scope === scope);
            if (scopeIssues.length === 0) return null;
            // FIXME: address this better or use the /product(s)? namespace instead of
            // /registration.
            const section = scope === "product" ? "registration" : scope;
            const ariaLabelId = `${scope}-issues-section`;

            return (
              <section key={idx} aria-labelledby={ariaLabelId}>
                <Stack hasGutter>
                  <h4 id={ariaLabelId}>
                    <Link variant="link" isInline onClick={onClose} to={`/${section}`}>
                      {scopeHeaders[scope]}
                    </Link>
                  </h4>
                  <ul>
                    {scopeIssues.map((issue, subIdx) => {
                      const variant = issue.severity === IssueSeverity.Error ? "warning" : "info";

                      return (
                        <li key={subIdx}>
                          <HelperText>
                            {/** @ts-expect-error TS complain about variant, let's fix it after PF6 migration */}
                            <HelperTextItem variant={variant} screenReaderText="">
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

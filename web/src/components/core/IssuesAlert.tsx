/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { isEmpty } from "radashi";
import { Alert, AlertProps, List, ListItem } from "@patternfly/react-core";
import { _ } from "~/i18n";

import type { Issue } from "~/model/issue";

export default function IssuesAlert({ issues }: { issues: Issue[] }) {
  if (isEmpty(issues)) return;
  const props: Partial<AlertProps> = { isInline: true, variant: "warning" };

  if (issues.length === 1) {
    return <Alert {...props} title={issues[0].description} />;
  }

  return (
    <Alert {...props} title={_("You must fix these issues")}>
      <List>
        {issues.map((i, idx) => (
          <ListItem key={idx}>{i.description}</ListItem>
        ))}
      </List>
    </Alert>
  );
}

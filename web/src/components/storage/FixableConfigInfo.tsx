/*
 * Copyright (c) [2025] SUSE LLC
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
import { Alert, List, ListItem } from "@patternfly/react-core";
import { n_ } from "~/i18n";
import type { Issue } from "~/api/issue";

const Description = ({ errors }: { errors: Issue[] }) => {
  return (
    <List isPlain>
      {errors.map((e, i) => (
        <ListItem key={i}>{e.description}</ListItem>
      ))}
    </List>
  );
};

/**
 * Information about a wrong but fixable storage configuration
 *
 */
export default function FixableConfigInfo({ issues }: { issues: Issue[] }) {
  const title = n_(
    "The configuration must be adapted to address the following issue:",
    "The configuration must be adapted to address the following issues:",
    issues.length,
  );

  return (
    <Alert variant="warning" title={title}>
      <Description errors={issues} />
    </Alert>
  );
}

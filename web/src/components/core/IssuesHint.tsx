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
import { Hint, HintBody, List, ListItem, Stack } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { Issue } from "~/types/issues";

export default function IssuesHint({ issues }) {
  if (issues === undefined || issues.length === 0) return;

  return (
    <Hint>
      <HintBody>
        <Stack hasGutter>
          <p>
            {_("Before starting the installation, you need to address the following problems:")}
          </p>
          <List>
            {issues.map((i: Issue, idx: number) => (
              <ListItem key={idx}>{i.description}</ListItem>
            ))}
          </List>
        </Stack>
      </HintBody>
    </Hint>
  );
}

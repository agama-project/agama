/*
 * Copyright (c) [2022] SUSE LLC
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
import { EmptyState, EmptyStateIcon, EmptyStateHeader, Spinner } from "@patternfly/react-core";
import { Center } from "~/components/layout";
import { _ } from "~/i18n";

const LoadingIcon = () => <Spinner size="xl" />;

function Loading({ text = _("Loading installation environment, please wait.") }) {
  return (
    <Center>
      <EmptyState variant="xl">
        <EmptyStateHeader
          titleText={text}
          headingLevel="h1"
          icon={<EmptyStateIcon icon={LoadingIcon} />}
        />
      </EmptyState>
    </Center>
  );
}

export default Loading;

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
import { Title, EmptyState, EmptyStateIcon } from "@patternfly/react-core";

import Center from "./Center";
import { SectionTitle } from "./layout/SectionTitle";

import { EOS_THREE_DOTS_LOADING_ANIMATED as LoadingIcon } from "eos-icons-react";

function LoadingEnvironment() {
  return (
    <Center>
      <EmptyState>
        <EmptyStateIcon icon={LoadingIcon} />
        <Title headingLevel="h4" size="lg">
          Loading installation environment, please wait.
        </Title>
      </EmptyState>
    </Center>
  );
}

export default LoadingEnvironment;

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

import Center from "./Center";
import { Title, PageIcon } from "./Layout";
import ProgressReport from "./ProgressReport";

import { EOS_MULTISTATE as Icon } from "eos-icons-react";

const ProbingProgress = () => (
  <>
    <Title>Probing</Title>
    <PageIcon><Icon /></PageIcon>
    <Center><ProgressReport /></Center>
  </>
);

export default ProbingProgress;

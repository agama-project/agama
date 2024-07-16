/*
 * Copyright (c) [2023] SUSE LLC
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

// @ts-check

import React from "react";
import { Split, Text } from "@patternfly/react-core";

/**
 * Progress description
 *
 * @component
 *
 * @param {object} props
 * @param {string} [props.message] Progress message
 * @param {number} [props.current] Current step
 * @param {number} [props.total] Number of steps
 */
export default function ProgressText({ message, current, total }) {
  const text = current === 0 ? message : `${message} (${current}/${total})`;
  return (
    <Split hasGutter>
      <Text>{text}</Text>
    </Split>
  );
}

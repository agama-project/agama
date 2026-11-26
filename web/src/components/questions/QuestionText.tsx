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
import { Content } from "@patternfly/react-core";

/**
 * Component for rendering question text, splitting it into paragraphs
 * wherever the text contains a blank line.
 *
 * @param text - the question text to display
 * @param isEditorial - forwarded to each paragraph's Content
 */
export default function QuestionText({
  text,
  isEditorial,
}: {
  text: string;
  isEditorial?: boolean;
}): React.ReactNode {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <Content>
      {paragraphs.map((paragraph, index) => (
        <Content key={index} component="p" isEditorial={isEditorial}>
          {paragraph}
        </Content>
      ))}
    </Content>
  );
}

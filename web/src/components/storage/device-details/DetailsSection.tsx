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

import React, { createContext, useContext, useId } from "react";
import { Flex, Title } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

const TitleIdContext = createContext<string | undefined>(undefined);

/**
 * The id of the enclosing section title, or undefined outside a section. Use it
 * to name something after the section, with `aria-labelledby`.
 */
export function useDetailsSectionTitleId() {
  return useContext(TitleIdContext);
}

export type DetailsSectionProps = {
  /** The section title, such as "Current content". */
  title: React.ReactNode;
  /** The section content. */
  children: React.ReactNode;
};

/**
 * A section of the device details, with a heading one level under the panel
 * title.
 *
 * @example
 * <DetailsSection title={_("Current content")}>
 *   <CurrentContentSection entry={entry} subject={subject} />
 * </DetailsSection>
 */
export default function DetailsSection({ title, children }: DetailsSectionProps) {
  const titleId = useId();
  return (
    <Flex component="section" direction={{ default: "column" }} gap={{ default: "gapMd" }}>
      <Title id={titleId} headingLevel="h3" size="md" className={textStyles.textColorBrand}>
        {title}
      </Title>
      <Flex
        direction={{ default: "column" }}
        gap={{ default: "gapMd" }}
        className="agm-details-section__content"
      >
        <TitleIdContext.Provider value={titleId}>{children}</TitleIdContext.Provider>
      </Flex>
    </Flex>
  );
}

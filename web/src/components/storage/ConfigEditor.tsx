/*
 * Copyright (c) [2024] SUSE LLC
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
import { _ } from "~/i18n";
import { useConfig, useSolvedConfig } from "~/queries/storage";
import { config as type } from "~/api/storage/types";
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from "@patternfly/react-core";

type DriveEditorProps = { config: type.Drive };

const DriveEditor: React.FunctionComponent = ({ config }: DriveEditorProps) => {
  const search = config.search as type.AdvancedSearch;

  return (
    <DescriptionListGroup>
      <DescriptionListTerm>{search.condition.name}</DescriptionListTerm>
      <DescriptionListDescription>{_("Example")}</DescriptionListDescription>
    </DescriptionListGroup>
  );
};

export default function ConfigEditor() {
  const config: type.Config = useConfig();
  const solvedConfig = useSolvedConfig();

  console.log("config: ", config);
  console.log("solved config: ", solvedConfig);

  if (!solvedConfig) return null;

  return (
    <DescriptionList isHorizontal>
      {solvedConfig.drives.map((d, i) => (
        <DriveEditor key={i} config={d} />
      ))}
    </DescriptionList>
  );
}

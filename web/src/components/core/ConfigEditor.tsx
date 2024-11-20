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

import { _ } from "~/i18n";
import React, { useState } from "react";
import { Button, Stack, Split } from "@patternfly/react-core";
import { CodeEditor, Language } from '@patternfly/react-code-editor';
import { useConfigMutation, useConfig } from '~/queries/config';
import { useSearchParams } from "react-router-dom";

const ConfigEditor = ({ sections }): React.ReactNode => {
  const setConfig = useConfigMutation();
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchConfigJson = () => {
    let { product, scripts, ...data } = useConfig({ "suspense": true });

    if (sections && sections.length > 0) {
      data = sections.reduce((obj, key) => ({ ...obj, [key]: data[key] }), {});
    }
    return JSON.stringify(data, undefined, 2)
  };

  const [configJson, setConfigJson] = useState(fetchConfigJson());

  const onChange = (code) => {
    setConfigJson(code);
  };

  const updateConfig = () => {
    setConfig.mutate(JSON.parse(configJson));
  };

  const closeEditor = () => {
    searchParams.delete("ui");
    setSearchParams(searchParams);
  };

  return (
    <Stack hasGutter>
      <CodeEditor height="65vh" isUploadEnabled onCodeChange={onChange} language={Language.json} code={configJson} />
      <Split hasGutter>
        <Button variant="secondary" onClick={closeEditor}>
          {_("Cancel")}
        </Button>
        <Button onClick={updateConfig}>
          {_("Save")}
        </Button>
      </Split>
    </Stack>
  );
};

export default ConfigEditor;

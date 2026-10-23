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

import React, { Suspense, useMemo, useState } from "react";
import {
  Alert,
  Bullseye,
  CodeBlock,
  Content,
  ExpandableSection,
  Flex,
  Spinner,
} from "@patternfly/react-core";
import Popup from "~/components/core/Popup";
import { _ } from "~/i18n";
import { putConfig } from "~/api";
import type { AxiosError } from "axios";

type ConfigDialogProps = {
  onClose: () => void;
};

type ApiErrorResponse = {
  title?: string;
  detail?: string;
  errors?: string[];
  [key: string]: unknown;
};

type ErrorState = {
  title: string;
  details?: string;
};

// load the component and its dependencies dynamically when needed, do not
// include it in the default index.js file, the Monaco editor is huge
const ConfigEditor = React.lazy(
  () =>
    import(
      /* webpackChunkName: "config-editor" */
      "~/components/core/ConfigEditor"
    ),
);

/**
 * Dialog showing the current installation configuration in JSON format, with
 * options to copy, download, and edit the content.
 */
export default function ConfigDialog({ onClose }: ConfigDialogProps) {
  const [configCode, setConfigCode] = useState<string | undefined>(undefined);
  const [error, setError] = useState<ErrorState | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isSchemaValid, setIsSchemaValid] = useState(true);

  const fallback = (
    <Bullseye>
      <Spinner />
    </Bullseye>
  );

  const isJsonValid = useMemo(() => {
    if (configCode === undefined || configCode.trim() === "") return false;
    try {
      JSON.parse(configCode);
      return true;
    } catch {
      return false;
    }
  }, [configCode]);

  const handleConfigChange = (newCode: string) => {
    setConfigCode(newCode);
    if (error) {
      setError(null);
    }
  };

  const handleApply = async () => {
    if (configCode === undefined) return;
    setError(null);
    try {
      const parsed = JSON.parse(configCode);
      setIsApplying(true);
      await putConfig(parsed);
      onClose();
    } catch (e: unknown) {
      setIsApplying(false);
      const axiosError = e as AxiosError<ApiErrorResponse>;
      const data = axiosError?.response?.data;
      let details: string | undefined;

      if (data) {
        if (typeof data === "string") {
          details = data;
        } else if (typeof data === "object") {
          if (Array.isArray(data.errors) && data.errors.length > 0) {
            details = data.errors.join("\n");
            if (data.detail) {
              details = `${data.detail}\n\n${details}`;
            }
          } else if (data.detail) {
            details = data.detail;
          } else {
            details = JSON.stringify(data, null, 2);
          }
        }
      } else if (axiosError?.message) {
        details = axiosError.message;
      }

      const title = (typeof data === "object" && data?.title) || _("Failed to apply configuration");

      setError({
        title,
        details,
      });
    }
  };

  return (
    <Popup
      isOpen
      // TRANSLATORS: dialog title
      title={_("Installation settings in JSON format")}
      onClose={onClose}
      variant="medium"
      actions={
        <>
          <Popup.PrimaryAction
            onClick={handleApply}
            isLoading={isApplying}
            isDisabled={!isJsonValid || !isSchemaValid || isApplying}
          >
            {_("Apply")}
          </Popup.PrimaryAction>
          <Popup.SecondaryAction onClick={onClose}>{_("Close")}</Popup.SecondaryAction>
        </>
      }
    >
      <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
        <Content>
          {_(
            "Use this to reproduce this installation later using the installer command-line interface or the unattended mode.",
          )}
        </Content>
        {error && (
          <Alert variant="danger" isInline title={error.title}>
            {error.details && (
              <ExpandableSection
                toggleTextExpanded={_("Hide details")}
                toggleTextCollapsed={_("Show details")}
              >
                <CodeBlock>
                  <pre style={{ whiteSpace: "pre-wrap", maxHeight: "150px", overflowY: "auto" }}>
                    {error.details}
                  </pre>
                </CodeBlock>
              </ExpandableSection>
            )}
          </Alert>
        )}
        <Suspense fallback={fallback}>
          <ConfigEditor onChange={handleConfigChange} onValidationChange={setIsSchemaValid} />
        </Suspense>
      </Flex>
    </Popup>
  );
}

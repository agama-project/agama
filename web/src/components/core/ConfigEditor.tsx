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

import React, { useEffect, useRef, useState } from "react";
import { Spinner } from "@patternfly/react-core";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import { useAppearance } from "~/context/appearance";
import { ROOT } from "~/routes/paths";
import { isoTimestamp } from "~/utils";
import { _ } from "~/i18n";

type MonacoWithJson = typeof monaco & {
  languages?: {
    json?: {
      jsonDefaults?: {
        setDiagnosticsOptions: (options: object) => void;
      };
    };
  };
};

const setMonacoSchema = (monacoInstance: unknown, schemaObj: object, modelUri?: string) => {
  const m = monacoInstance as MonacoWithJson;
  if (!m?.languages?.json?.jsonDefaults?.setDiagnosticsOptions) {
    return;
  }
  const fileMatch = ["*"];
  if (modelUri) {
    fileMatch.push(modelUri);
  }
  m.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    enableSchemaRequest: true,
    schemaValidation: "error",
    schemas: [
      {
        uri: ROOT.configSchema,
        fileMatch,
        schema: schemaObj,
      },
    ],
  });
};
export type ConfigEditorProps = {
  onChange?: (code: string) => void;
  onValidationChange?: (isValid: boolean) => void;
};

/**
 * Component showing the installation configuration in JSON format, with
 * options to copy, download, and edit the content with schema validation.
 */
export default function Editor({ onChange, onValidationChange }: ConfigEditorProps) {
  const { isDark } = useAppearance();
  const [config, setConfig] = useState<string | undefined>(undefined);
  const [schema, setSchema] = useState<object | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<unknown>(null);
  const editorModelUriRef = useRef<string | undefined>(undefined);
  // CodeEditor appends the extension based on the language, so it must be omitted here.
  const [downloadFileName, setDownloadFileName] = useState("agama-config");

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onValidationChangeRef = useRef(onValidationChange);
  onValidationChangeRef.current = onValidationChange;

  // avoid downloading the monaco editor parts from the CDN, load the locally bundled files
  loader.config({ monaco });

  useEffect(() => {
    const loadConfigAndSchema = async () => {
      try {
        const response = await fetch(ROOT.config);
        const text = await response.text();
        const formatted = JSON.stringify(JSON.parse(text), null, 2);
        setConfig(formatted);
        onChangeRef.current?.(formatted);
        setDownloadFileName(`agama-config-${isoTimestamp()}`);
      } catch (error) {
        console.error("Failed to load config:", error);
        setConfig("");
        onChangeRef.current?.("");
      }

      try {
        const schemaResponse = await fetch(ROOT.configSchema);
        if (schemaResponse?.ok) {
          const schemaJson =
            typeof schemaResponse.json === "function"
              ? await schemaResponse.json()
              : typeof schemaResponse.text === "function"
                ? JSON.parse(await schemaResponse.text())
                : null;
          if (schemaJson) {
            setSchema(schemaJson);
            setMonacoSchema(monaco, schemaJson);
          }
        }
      } catch (error) {
        console.error("Failed to load schema:", error);
      }
    };

    loadConfigAndSchema();
  }, []);

  useEffect(() => {
    if (monacoInstance && schema) {
      setMonacoSchema(monacoInstance, schema, editorModelUriRef.current);
    }
  }, [monacoInstance, schema]);

  const handleCodeChange = (newCode: string) => {
    setConfig(newCode);
    onChangeRef.current?.(newCode);
  };

  return (
    <CodeEditor
      isDarkTheme={isDark}
      isCopyEnabled
      isDownloadEnabled
      copyButtonAriaLabel={_("Copy to the clipboard")}
      copyButtonToolTipText={_("Copy to the clipboard")}
      copyButtonSuccessTooltipText={_("Configuration added to clipboard")}
      downloadButtonAriaLabel={_("Download configuration")}
      downloadButtonToolTipText={_("Download configuration")}
      downloadFileName={downloadFileName}
      code={config}
      onChange={handleCodeChange}
      emptyState={<Spinner />}
      language={Language.json}
      height="360px"
      // PatternFly merges this into its own monaco options, so settings it
      // derives from props are preserved.
      // Based on https://microsoft.github.io/monaco-editor/playground.html?source=v0.55.1#example-customizing-the-appearence-scrollbars
      options={{
        contextmenu: false,
        scrollBeyondLastLine: false,
        hideCursorInOverviewRuler: true,
      }}
      // Runs in addition to PatternFly's own mount logic (e.g. Shift+Tab
      // focus handling). Disables the command palette, based on
      // https://microsoft.github.io/monaco-editor/playground.html?source=v0.55.1#example-interacting-with-the-editor-listening-to-key-events
      onEditorDidMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyCode.F1, () => null);
        setMonacoInstance(monaco);
        const model = editor.getModel();
        const modelUri = model?.uri?.toString();
        editorModelUriRef.current = modelUri;
        if (schema) {
          setMonacoSchema(monaco, schema, modelUri);
        }

        const checkMarkers = () => {
          const currentModel = editor.getModel();
          if (!currentModel || currentModel.isDisposed()) return;
          const markers = monaco.editor.getModelMarkers({ resource: currentModel.uri });
          const hasProblems = markers.some(
            (m) =>
              m.severity === monaco.MarkerSeverity.Error ||
              m.severity === monaco.MarkerSeverity.Warning,
          );
          onValidationChangeRef.current?.(!hasProblems);
        };

        const disposable = monaco.editor.onDidChangeMarkers(() => {
          checkMarkers();
        });

        checkMarkers();

        editor.onDidDispose(() => {
          disposable.dispose();
        });
      }}
    />
  );
}

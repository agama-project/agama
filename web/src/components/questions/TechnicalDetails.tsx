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

import React, { useId, useState } from "react";
import { ClipboardCopyButton, CodeBlock, CodeBlockCode } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import Text from "~/components/core/Text";
import { _ } from "~/i18n";

/**
 * Component for rendering technical details (e.g., a backend error message)
 * in a scrollable, always-visible code block, with a button to copy it.
 *
 * Unlike a collapsed section, this is never hidden: an error the user needs
 * to act on (retry, report it, ...) should not start out of sight.
 *
 * @param text - the technical details to display
 */
export default function TechnicalDetails({ text }: { text?: string }): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const labelId = useId();

  if (!text) return null;

  const onCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <NestedContent>
      <CodeBlock
        className="agm-technical-details"
        role="figure"
        aria-labelledby={labelId}
        actions={
          <>
            {/* TRANSLATORS: label of the block showing a technical error message */}
            <Text id={labelId} isBold>
              {_("Technical details")}
            </Text>
            <ClipboardCopyButton
              id="technical-details-copy-button"
              aria-label={_("Copy to clipboard")}
              onClick={onCopy}
              onTooltipHidden={() => setCopied(false)}
              exitDelay={copied ? 1500 : 600}
              maxWidth="110px"
              variant="plain"
            >
              {copied ? _("Copied") : _("Copy to clipboard")}
            </ClipboardCopyButton>
          </>
        }
      >
        <CodeBlockCode id="technical-details-code" className="mh-30dvh">
          {text}
        </CodeBlockCode>
      </CodeBlock>
    </NestedContent>
  );
}

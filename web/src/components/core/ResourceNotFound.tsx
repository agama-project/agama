/*
 * Copyright (c) [2025] SUSE LLC
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
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import Icon from "../layout/Icon";
import Link from "../core/Link";
import { _, TranslatedString } from "~/i18n";

type ResourceNotFoundProps = {
  title?: TranslatedString;
  body?: React.ReactNode;
  linkText: TranslatedString;
  linkPath: string;
};

export default function ResourceNotFound({
  title = _("Resource not found or lost"),
  body = _("It doesn't exist or can't be reached."),
  linkText,
  linkPath,
}: ResourceNotFoundProps) {
  return (
    <EmptyState headingLevel="h2" titleText={title} icon={() => <Icon name="error" />}>
      <EmptyStateBody>{body}</EmptyStateBody>
      {linkText && linkPath && (
        <EmptyStateFooter>
          <EmptyStateActions>
            <Link to={linkPath} variant="link" isInline>
              {linkText}
            </Link>
          </EmptyStateActions>
        </EmptyStateFooter>
      )}
    </EmptyState>
  );
}

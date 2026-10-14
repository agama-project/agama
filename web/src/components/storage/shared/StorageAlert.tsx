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
import { Alert } from "@patternfly/react-core";

export type StorageAlertProps = {
  /** How it is presented, from a neutral report to something needing care. */
  variant: "custom" | "info" | "warning";
  /** The one sentence the reader needs first. */
  title: React.ReactNode;
  /** Optional details under the title. */
  children?: React.ReactNode;
  /** Optional links or buttons, shown together in a row at the end. */
  actions?: React.ReactNode;
};

/**
 * A report shown at the top of the storage page, above the devices it is
 * about: what the configuration will do, or why it cannot be done.
 *
 * Every report has the same shape: a title, optional details, and optional
 * actions in a row. Only the variant and the words change.
 *
 * The title is a paragraph rather than a heading, because the report does not
 * open a section of the page.
 *
 * See https://www.patternfly.org/components/alert
 *
 * @example
 * <StorageAlert
 *   variant="custom"
 *   title={_("The installer will need 8 actions.")}
 *   actions={<SheetOpener subject="result" tab="actions">{_("View actions")}</SheetOpener>}
 * />
 */
export default function StorageAlert({ variant, title, children, actions }: StorageAlertProps) {
  return (
    <Alert isInline variant={variant} component="p" title={title} actionLinks={actions}>
      {children}
    </Alert>
  );
}

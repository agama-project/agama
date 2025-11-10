/*
 * Copyright (c) [2024-2025] SUSE LLC
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

/**
 * Known scopes for issues.
 */
type IssuesScope = "localization" | "product" | "software" | "storage" | "users" | "iscsi";

/**
 * Source of the issue
 *
 * Which is the origin of the issue (the system, the configuration or unknown).
 */
enum IssueSource {
  /** Unknown source (it is kind of a fallback value) */
  Unknown = "unknown",
  /** An unexpected situation in the system (e.g., missing device). */
  System = "system",
  /** Wrong or incomplete configuration (e.g., an authentication mechanism is not set) */
  Config = "config",
}

/**
 * Issue severity
 *
 * It indicates how severe the problem is.
 */
enum IssueSeverity {
  /** Just a warning, the installation can start */
  Warn = "warn",
  /** An important problem that makes the installation not possible */
  Error = "error",
}

/**
 * Pre-installation issue as they come from the API.
 */
type ApiIssue = {
  /** Issue description */
  description: string;
  /** Issue kind **/
  kind: string;
  /** Issue details */
  details?: string;
  /** Where the issue comes from */
  source: IssueSource;
  /** How severe is the issue */
  severity: IssueSeverity;
};

/**
 * Issues grouped by scope as they come from the API.
 */
type IssuesMap = {
  localization?: ApiIssue[];
  software?: ApiIssue[];
  product?: ApiIssue[];
  storage?: ApiIssue[];
  iscsi?: ApiIssue[];
  users?: ApiIssue[];
};

/**
 * Pre-installation issue augmented with the scope.
 */
type Issue = ApiIssue & { scope: IssuesScope };

/**
 * Validation error
 */
type ValidationError = {
  message: string;
};

export { IssueSource, IssueSeverity };
export type { ApiIssue, IssuesMap, IssuesScope, Issue, ValidationError };

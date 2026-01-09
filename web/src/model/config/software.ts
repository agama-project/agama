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

/**
 * List of user-selected patterns to install
 */
export type PatternsArray = string[];

/**
 * Software configuration.
 */
export interface Config {
  patterns?: PatternsArray | PatternsObject;
  /**
   * List of packages to install
   */
  packages?: string[];
  /**
   * Flag if only minimal hard dependencies should be used in solver
   */
  onlyRequired?: boolean;
  /**
   * List of user specified repositories that will be used on top of default ones
   */
  extraRepositories?: Repository[];
  [k: string]: unknown;
}
/**
 * Modifications for the list of user-selected patterns to install
 */
export interface PatternsObject {
  /**
   * List of user-selected patterns to add to the list
   */
  add?: string[];
  /**
   * List of user-selected patterns to remove from the list
   */
  remove?: string[];
}
/**
 * Packages repository
 */
export interface Repository {
  /**
   * alias used for repository. Acting as identifier
   */
  alias?: string;
  /**
   * URL pointing to repository
   */
  url?: string;
  /**
   * Repository priority
   */
  priority?: number;
  /**
   * User visible name. Defaults to alias
   */
  name?: string;
  /**
   * product directory on multi repo DVD. Usually not needed
   */
  productDir?: string;
  /**
   * If repository should be enabled. Defaults to true. Useful when adding additional repo that should not be immediately use.
   */
  enabled?: boolean;
  /**
   * If unsigned repositories are allowed. Mainly useful for repositories that is hand crafted without GPG signature.
   */
  allowUnsigned?: boolean;
  /**
   * List of GPG fingerprints that is accepted for this repository. Useful for own repositories with proper GPG signature.
   */
  gpgFingerprints?: string[];
}

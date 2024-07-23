/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

type Registration = {
  /** Registration requirement (i.e., "not-required", "optional", "mandatory") */
  requirement: string;
  /** Registration code, if any */
  code?: string;
  /** Registration email, if any */
  email?: string;
};

type RegistrationFailure = {
  /** @property {Number} id - ID of error */
  id: number;
  /** Failure message */
  message: string;
};

export type { Registration, RegistrationFailure };

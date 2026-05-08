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

/**
 * Form IP mode values.
 *
 * These control UI behavior (which fields are shown) and map to ConnectionMethod:
 * - AUTO: no address/gateway fields shown → ConnectionMethod.AUTO
 * - ADVANCED_AUTO: addresses required, gateway optional → ConnectionMethod.AUTO
 * - MANUAL: addresses and gateway required → ConnectionMethod.MANUAL
 */
export const FormIpMode = {
  AUTO: "auto",
  ADVANCED_AUTO: "advanced-auto",
  MANUAL: "manual",
} as const;

export type FormIpMode = (typeof FormIpMode)[keyof typeof FormIpMode];

/**
 * Modes that require at least one address to be provided.
 */
export const ADDRESS_REQUIRED_MODES: readonly FormIpMode[] = [
  FormIpMode.MANUAL,
  FormIpMode.ADVANCED_AUTO,
];

/**
 * Default values for IP settings fields.
 */
export const ipDefaults = {
  ipv4Mode: FormIpMode.AUTO as FormIpMode,
  addresses4: [] as string[],
  gateway4: "",
  ipv6Mode: FormIpMode.AUTO as FormIpMode,
  addresses6: [] as string[],
  gateway6: "",
  nameservers: [] as string[],
  dnsSearchList: [] as string[],
  customDns: false,
  customDnsSearch: false,
};

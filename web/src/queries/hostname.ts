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

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { fetchHostname, updateHostname } from "~/model/hostname";

/**
 * Returns a query for retrieving the hostname configuration
 */
const hostnameQuery = () => ({
  queryKey: ["system", "hostname"],
  queryFn: fetchHostname,
});

/**
 * Hook that returns the hostname configuration
 */
const useHostname = () => {
  const { data: hostname } = useSuspenseQuery(hostnameQuery());
  return hostname;
};

/*
 * Hook that returns a mutation to change the hostname
 */
const useHostnameMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: updateHostname,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["system", "hostname"] }),
  };
  return useMutation(query);
};

export { useHostname, useHostnameMutation };

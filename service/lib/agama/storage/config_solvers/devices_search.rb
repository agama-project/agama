# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the search of a set of device configs.
      class DevicesSearch
        # @param candidate_devices [Array<Y2Storage::Device>] Candidate devices for solving.
        def initialize(candidate_devices)
          @candidate_devices = candidate_devices
        end

        # Solves the search configs by assigning devices from the candidate devices according to the
        # search condition.
        #
        # @param device_configs [Array<#search>]
        # @yield [device_config] builds the search condition.
        # @yieldparam device_config [#search]
        # @yieldreturn [Proc]
        #
        # @return [Array<#search>] Device configs with solved search.
        def solve(device_configs, &condition_builder)
          reset
          device_configs.flat_map { |d| solve_search(d, &condition_builder) }
        end

      private

        # @return [Array<Y2Storage::Device>]
        attr_reader :candidate_devices

        # SIDs of the assigned candidate devices.
        #
        # @return [Array<Integer>]
        attr_reader :assigned_sids

        # Resets state before start solving.
        def reset
          @assigned_sids = []
        end

        # Solves the search of given device config.
        #
        # As result, one or several configs can be generated. For example, if the search condition
        # matches 3 unassigned candidate devices, then 3 configs are generated, one per device.
        #
        # @param device_config [#search]
        # @yield [device_config] see {#solve}.
        #
        # @return [#search, Array<#search>] Device configs with solved search.
        def solve_search(device_config, &condition_builder)
          return device_config unless device_config.search

          devices = find_devices(device_config, &condition_builder)
          return solve_without_device(device_config) if devices.none?

          devices.map { |d| solve_with_device(device_config, d) }
        end

        # Finds unassigned candidate devices that matches the search condition.
        #
        # @param device_config [#search]
        # @yield [device_config] see {#solve}.
        #
        # @return [Array<Y2Storage::Device>]
        def find_devices(device_config, &condition_builder)
          search_condition = condition_builder.call(device_config)

          devices = unassigned_candidate_devices
            .select(&search_condition)
            .sort_by(&:name)

          devices.first(device_config.search.max || devices.size)
        end

        # Candidate devices that are not assigned yet.
        #
        # @return [Array<Y2Storage::Device>]
        def unassigned_candidate_devices
          candidate_devices.reject { |d| assigned_sids.include?(d.sid) }
        end

        # Solves the search of the given device config without assigning a device.
        #
        # @param device_config [#search]
        # @return [#search] A device config
        def solve_without_device(device_config)
          device_config.copy.tap { |d| d.search.solve }
        end

        # Solves the search of the given device config by assigning a device.
        #
        # @param device_config [#search]
        # @param device [Y2Storage::Device]
        #
        # @return [#search] A device config
        def solve_with_device(device_config, device)
          @assigned_sids << device.sid
          device_config.copy.tap { |d| d.search.solve(device) }
        end
      end
    end
  end
end

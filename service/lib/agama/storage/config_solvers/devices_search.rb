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

require "agama/storage/configs/sort_criteria"

module Agama
  module Storage
    module ConfigSolvers
      # Base class for solving search configs.
      class DevicesSearch
        # Solves the search configs by assigning devices from the candidate devices according to the
        # search condition.
        #
        # @param device_configs [Array<#search>]
        # @param candidate_devices [Array<Y2Storage::Device>]
        #
        # @return [Array<#search>] Device configs with solved search.
        def solve(device_configs, candidate_devices)
          @candidate_devices = candidate_devices
          @assigned_sids = []
          device_configs.flat_map { |d| solve_search(d) }
        end

      private

        # @return [Array<Y2Storage::Device>]
        attr_reader :candidate_devices

        # SIDs of the assigned candidate devices.
        #
        # @return [Array<Integer>]
        attr_reader :assigned_sids

        # Whether the given device matches the search condition.
        #
        # @note Derived classes must define this method.
        #
        # @param _device_config [#search]
        # @param _device [Y2Storage#device]
        #
        # @return [Boolean]
        def match_condition?(_device_config, _device)
          raise NotImplementedError
        end

        # Compares the order of two devices, based on the configuration.
        #
        # @param device_config [#search]
        # @param dev_a [Y2Storage#device]
        # @param dev_b [Y2Storage#device]
        #
        # @return [Integer] less than 0 when b follows a, greater than 0 when a follows b
        def order(device_config, dev_a, dev_b)
          criteria = device_config.search&.sort_criteria || []
          criteria.each do |criterion|
            comparison = criterion.compare(dev_a, dev_b)
            return comparison unless comparison.zero?
          end

          fallback_sort_criterion.compare(dev_a, dev_b)
        end

        # Solves the search of given device config.
        #
        # As result, one or several configs can be generated. For example, if the search condition
        # matches 3 unassigned candidate devices, then 3 configs are generated, one per device.
        #
        # @param device_config [#search]
        # @return [#search, Array<#search>] Device configs with solved search.
        def solve_search(device_config)
          return device_config unless device_config.search

          devices = find_devices(device_config)
          return solve_without_device(device_config) if devices.none?

          devices.map { |d| solve_with_device(device_config, d) }
        end

        # Finds unassigned candidate devices that matches the search condition.
        #
        # @param device_config [#search]
        # @return [Array<Y2Storage::Device>]
        def find_devices(device_config)
          devices = unassigned_candidate_devices
            .select { |d| match_condition?(device_config, d) }
            .sort { |a, b| order(device_config, a, b) }

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

        # Sorting criterion to use when none is given or to resolve ties in the criteria specified
        # in the configuration.
        #
        # NOTE: To ensure consistency between different executions, comparisons by this criterion
        # should never return zero. Bear that in mind if this method is redefined in any subclass.
        #
        # @return [Configs::SortCriteria]
        def fallback_sort_criterion
          @fallback_sort_criterion = Configs::SortCriteria::Name.new
        end
      end
    end
  end
end

# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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

require_relative "../../test_helper"
require "rspec"
require "y2storage"

module Agama
  module RSpec
    # RSpec extension to add Y2Storage specific helpers
    module StorageHelpers
      # See {#mock_storage_probing} and {#mock_hwinfo}
      def mock_storage(devicegraph: "empty-hd-50GiB.yaml", hwinfo: Y2Storage::HWInfoDisk.new)
        mock_hwinfo(hwinfo)
        mock_storage_probing(devicegraph)
      end

      # Mocks the Y2Storage probing process using the devicegraph described by the
      # provided fixture file
      #
      # @param devicegraph_file [String] name of the XML or Yaml file in the fixtures directory
      def mock_storage_probing(devicegraph_file)
        manager = Y2Storage::StorageManager.create_test_instance

        path = File.join(FIXTURES_PATH, devicegraph_file)
        if path.end_with?(".xml")
          manager.probe_from_xml(path)
        else
          manager.probe_from_yaml(path)
        end
      end

      # Mocks all Y2Storage calls to HWInfo with the information provided by the given struct
      #
      # @param hwinfo [Y2Storage::HWInfoDisk] disk information used for all the calls
      def mock_hwinfo(hwinfo)
        allow_any_instance_of(Y2Storage::HWInfoReader).to receive(:for_device).and_return(hwinfo)
      end

      def planned_partition(attrs = {})
        part = Y2Storage::Planned::Partition.new(nil)
        add_planned_attributes(part, attrs)
      end

      def add_planned_attributes(device, attrs)
        attrs = attrs.dup

        if device.respond_to?(:filesystem_type)
          type = attrs.delete(:type)
          device.filesystem_type =
            if type.is_a?(::String) || type.is_a?(Symbol)
              Y2Storage::Filesystems::Type.const_get(type.to_s.upcase)
            else
              type
            end
        end

        attrs.each_pair do |key, value|
          device.send(:"#{key}=", value)
        end
        device
      end
    end
  end
end

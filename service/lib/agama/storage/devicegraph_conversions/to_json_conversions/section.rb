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
    module DevicegraphConversions
      module ToJSONConversions
        # Base class for all the sub-sections that are only included for certain types of devices.
        class Section
          # Whether it makes sense to export this section as part of the hash.
          #
          # To be redefined by every subclass.
          #
          # @param _storage_device [Y2Storage::Device] device to describe
          # @return [Boolean]
          def self.apply?(_storage_device)
            false
          end

          # @param storage_device [Y2Storage::Device]
          def initialize(storage_device)
            @storage_device = storage_device
          end

          # Hash representing the section with information about the Y2Storage device.
          #
          # @return [Hash]
          def convert
            { section_name => conversions.compact }
          end

        private

          # Device to convert
          # @return [Y2Storage::Device]
          attr_reader :storage_device

          # Name of the section
          #
          # @return [Symbol]
          def section_name
            name = class_basename
            (name[0].downcase + name[1..-1]).to_sym
          end

          # Properties included in the section
          #
          # To be defined by every subclass
          #
          # @return [Hash]
          def conversions
            {}
          end

          # @see #section_name
          def class_basename
            self.class.name.split("::").last
          end
        end
      end
    end
  end
end

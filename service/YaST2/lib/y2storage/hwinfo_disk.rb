# Copyright (c) [2021] SUSE LLC
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

require "ostruct"

module Y2Storage
  # Hardware information for a storage device
  #
  # This class encapsulates the result of `hwinfo --disk` for a given block device.
  # Since the structure of the information returned by `hwinfo` is dynamic by nature (new fields
  # can be added or removed between versions) and AutoYaST relies on that flexibility (allowing
  # to use several fields in the skip lists), this is a subclass of OpenStruct.
  #
  class HWInfoDisk < OpenStruct
    # @return [Array<Symbol>] list of methods all HWInfoDisk objects are expected to respond to
    KNOWN_PROPERTIES = [:vendor, :model, :bus, :driver, :driver_modules, :device_files].freeze
    private_constant :KNOWN_PROPERTIES

    # @return [Array<Symbol>] list of multi-valued properties (see KNOWN_PROPERTIES)
    MULTI_VALUED = [:driver, :driver_modules, :device_files].freeze
    private_constant :MULTI_VALUED

    # Whether the given attribute should store and return arrays with multiple values
    #
    # @return [Boolean]
    def self.multi_valued?(property)
      MULTI_VALUED.include?(property.to_sym)
    end

    # Macro used to define the methods all HWInfoDisks should respond to
    def self.define_property(name, multi: false)
      define_method(name) do
        if multi
          self[name] || []
        else
          self[name]
        end
      end
    end

    KNOWN_PROPERTIES.each do |name|
      define_property(name, multi: multi_valued?(name))
    end

    # Whether the object corresponds to an empty struct
    #
    # @return [Boolean]
    def empty?
      to_h.empty?
    end
  end
end

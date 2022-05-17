# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

module DInstaller
  # This class is responsible for reading DInstaller kernel cmdline options
  class CmdlineArgs
    CMDLINE_PATH = "/proc/cmdline"
    CMDLINE_PREFIX = "dinst."

    attr_accessor :config_url
    attr_reader :data

    # Constructor
    #
    # @param data [Hash]
    def initialize(data = {})
      @data = data
    end

    # Reads the kernel command line options
    def self.read_from(path)
      options = File.read(path)
      args = new({})

      options.split.each do |option|
        next unless option.start_with?(CMDLINE_PREFIX)

        key, value = option.split("=")
        key.gsub!(CMDLINE_PREFIX, "")
        # Omit config_url from Config options
        next args.config_url = value if key == "config_url"

        # TODO: Add some kind of schema or 'knowledge' of attribute types to convert them properly
        # by now we will just convert Boolean values
        value = normalize(value)
        if key.include?(".")
          section, key = key.split(".")
          args.data[section] = {} unless args.data.keys.include?(section)
          args.data[section][key] = value
        else
          args.data[key.gsub(CMDLINE_PREFIX, "")] = value
        end
      end

      args
    end

    # Convenience method to normalize the given value by now it just convert "true" and "false"
    # strings to {Boolean}s
    #
    # @param value [String]
    # @return [Object] normalized value
    def self.normalize(value)
      val = value.to_s.downcase
      return value unless ["false", "true"].include?(val)

      (val == "true")
    end

    private_class_method :normalize
  end
end

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

    attr_reader :config_url
    attr_reader :args
    attr_reader :workdir

    # Constructor
    #
    # @param workdir [String] root directory to read the configuration from
    def initialize(workdir: "/")
      @workdir = workdir
    end

    # Reads the kernel command line options
    def read
      options = File.read(File.join(workdir, CMDLINE_PATH))
      @config_url = nil
      @args = {}

      options.split.each do |option|
        next unless option.start_with?(CMDLINE_PREFIX)

        key, value = option.split("=")
        key.gsub!(CMDLINE_PREFIX, "")
        # Omit config_url from Config options
        next @config_url = value if key == "config_url"

        if key.include?(".")
          section, key = key.split(".")
          @args[section] = {} unless @args.keys.include?(section)
          @args[section][key] = value
        else
          @args[key.gsub(CMDLINE_PREFIX, "")] = value
        end
      end
    end
  end
end

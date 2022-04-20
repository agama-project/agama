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

require "yaml"

module DInstaller
  # class responsible for getting current configuration.
  # It is smarter then just plain yaml reader as it also evaluates
  # conditions in it, so it is result of all conditions in file.
  # This also means that config needs to be re-evaluated if conditions
  # data change, like if user pick different distro to install.
  class Config
    SYSTEM_PATH = "/etc/d-installer.yaml"
    GIT_PATH = File.expand_path("#{__dir__}/../../etc/d-installer.yaml")

    def initialize(logger)
      @logger = logger
      load_file
      parse_file
    end

    attr_reader :data

    # parse loaded yaml file, so it properly applies conditions
    # with default options it load file without conditions
    def parse_file(arch = nil, distro = nil)
      # TODO: move to internal only. public one should be something
      # like evaluate or just setter for distro and arch
      logger.info "parse file with #{arch} and #{distro}"
      # TODO: do real evaluation of conditions
      @data = @pure_data
    end

  private

    attr_reader :logger

    # loads correct yaml file
    def load_file
      if File.exist?(GIT_PATH)
        file = File.read(GIT_PATH)
      elsif File.exist?(SYSTEM_PATH)
        file = File.read(SYSTEM_PATH)
      else
        raise "Missing config file at #{SYSTEM_PATH}"
      end
      @pure_data = YAML.safe_load(file)
    end
  end
end

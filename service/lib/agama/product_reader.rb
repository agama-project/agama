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

require "yast"
require "yaml"
require "logger"


module Agama
  # This class is responsible for reading available products definition
  class ProductReader
    include Yast::I18n

    # Default system path
    SYSTEM_PATH = "/usr/share/agama/products.d"
    GIT_PATH = File.expand_path("#{__dir__}/../../products.d")
    GIT_DIR = File.expand_path("#{__dir__}/../../../.git")

    attr_reader :logger
    # Constructor
    #
    # @param logger [Logger]
    # @param workdir [String] Root directory to read the configuration from
    def initialize(logger: nil, workdir: "/")
      @logger = logger || ::Logger.new($stdout)
      @workdir = workdir
    end

    def load_products
      glob = File.join(default_path, "*.{yaml,yml}")
      Dir.glob(glob).each_with_object do |path, result|
        # support also single product file
        products = Array(load_file(path))
        result.concat(products)
      end
    end

  private

    def default_path
      Dir.exist?(GIT_DIR) ? GIT_PATH : SYSTEM_PATH
    end

    def load_file(path)
      YAML.safe_load(File.read(path.to_s))
    end
  end
end

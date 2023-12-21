# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
  # either from system path (`/usr/share/agama/products.d) or the git repo.
  class ProductReader
    include Yast::I18n

    # Default system path
    SYSTEM_PATH = "/usr/share/agama/products.d"
    GIT_PATH = File.expand_path("#{__dir__}/../../../products.d")
    GIT_DIR = File.expand_path("#{__dir__}/../../../.git")

    attr_reader :logger

    # Constructor
    #
    # @param logger [Logger]
    def initialize(logger: nil)
      @logger = logger || ::Logger.new($stdout)
    end

    # Loads products definitions
    #
    # It supports a product per file or multiple products in a single file.
    def load_products
      glob = File.join(default_path, "*.{yaml,yml}")
      Dir.glob(glob).each_with_object([]) do |path, result|
        products = YAML.safe_load_file(path)
        products = [products] unless products.is_a?(Array)
        result.concat(products)
      end
    end

  private

    def default_path
      Dir.exist?(GIT_DIR) ? GIT_PATH : SYSTEM_PATH
    end
  end
end

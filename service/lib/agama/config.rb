# frozen_string_literal: true

# Copyright (c) [2022-2026] SUSE LLC
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

require "agama/copyable"
require "yast2/equatable"

module Agama
  # Class representing the current product configuration.
  class Config
    include Copyable
    include Yast2::Equatable

    # @return [Hash] configuration data
    attr_reader :data

    eql_attr :data

    # Constructor
    #
    # @param config_data [Hash] configuration data
    def initialize(config_data = {})
      @data = config_data
    end

    # Default paths to be created for the product.
    #
    # @return [Array<String>]
    def default_paths
      data.dig("storage", "volumes") || []
    end

    # Mandatory paths to be created for the product.
    #
    # @return [Array<String>]
    def mandatory_paths
      default_paths.select { |p| mandatory_path?(p) }
    end

    # Default policy to make space.
    #
    # @return [String]
    def space_policy
      data.dig("storage", "space_policy") || "keep"
    end

    # Whether LVM must be used by default.
    #
    # @return [Boolean]
    def lvm?
      data.dig("storage", "lvm") || false
    end

    # Mandatory packages required by the product.
    #
    # @return [Array<String>]
    def mandatory_packages
      data.dig("software", "mandatory_packages") || []
    end

    # Optional packages required by the product.
    #
    # @return [Array<String>]
    def optional_packages
      data.dig("software", "optional_packages") || []
    end

  private

    def mandatory_path?(path)
      templates = data.dig("storage", "volume_templates") || []
      template = templates.find { |t| t["mount_path"] == path }

      return false unless template

      template.dig("outline", "required") || false
    end
  end
end

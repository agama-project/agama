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

require "agama/copyable"

module Agama
  # Class representing the current product configuration.
  class Config
    include Copyable
    include Yast2::Equatable

    # @return [Hash] configuration data
    attr_reader :data

    # Constructor
    #
    # @param config_data [Hash] configuration data
    def initialize(config_data = {})
      @data = config_data
    end

    # Updates the internal values if needed
    #
    # This update mechanism exists because the current implementation of Agama relies on the
    # previous behavior of this class, in which a single shared Config object was constructed only
    # once (when the configuration files were read) and the values returned by that object were
    # later adjusted by subsequent calls to #pick_product on that shared object.
    #
    # To keep a similar behavior, this method provides a way to update the configuration values
    # without creating a new Config object.
    #
    # @param new_config_data [Hash] new values for the configuration data
    # @return [boolean] true if the internal values were really modified, false if there was no need
    #   to do so because the values are the same
    def update(new_config_data)
      return false if new_config_data == @data

      @data = new_config_data
      true
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

    # Boot strategy for the product
    #
    # @return [String, nil]
    def boot_strategy
      data.dig("storage", "boot_strategy")
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

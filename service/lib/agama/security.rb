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
require "y2security/lsm"
require "yast2/execute"
require "agama/config"
require "agama/http"

Yast.import "Bootloader"

# FIXME: monkey patching of security config to not read control.xml and
# instead use Agama::Config
# TODO: add ability to set product features in LSM::Base
module Y2Security
  module LSM
    # modified LSM Base class to use Agama config
    class Base
      def product_feature_settings
        return @product_feature_settings unless @product_feature_settings.nil?

        value = ::Agama::Config.current.data["security"]["available_lsms"][id.to_s]
        res = if value
          {
            selectable:   true,
            configurable: true,
            patterns:     (value["patterns"] || []).join(" "),
            mode:         value["policy"]
          }
        else
          {
            selectable:   false,
            configurable: false,
            patterns:     "",
            mode:         nil
          }
        end
        @product_feature_settings = res
      end
    end
  end
end

module Agama
  # Backend class between dbus service and yast code
  class Security
    # @return [Logger]
    attr_reader :logger

    # Constructor
    #
    # @param logger [Logger]
    # @param config [Agama::Config]
    def initialize(logger, config)
      @config = config
      @logger = logger
    end

    def write
      # at first clear previous kernel params
      selected = lsm_selected
      selected&.reset_kernel_params

      candidate = select_software_lsm
      return unless candidate

      lsm_config.select(candidate)
      kernel_params = lsm_selected.kernel_params
      # write manually here to bootloader as lsm_config.save do more than agama wants (bsc#1247046)
      @logger.info("Modifying Bootlooader kernel params using #{kernel_params}")
      Yast::Bootloader.modify_kernel_params(kernel_params)
    end

  private

    attr_reader :config

    def select_software_lsm
      candidates = [lsm_selected&.id&.to_s].compact | available_lsms.keys

      candidates.find { |c| proposal_patterns_include?(c) }
    end

    def available_lsms
      config.data.dig("security", "available_lsms") || {}
    end

    def proposal_patterns_include?(lsm_id)
      patterns = available_lsms.dig(lsm_id.to_s, "patterns") || []

      (patterns - proposal_patterns).empty?
    end

    def lsm_config
      Y2Security::LSM::Config.instance
    end

    def lsm_selected
      lsm_config.selected
    end

    def lsm_patterns(lsm_id)
      config.data.dig("security", "available_lsms", lsm_id.to_s, "patterns") || []
    end

    def proposal_patterns
      return @proposal_patterns if @proposal_patterns

      proposal = software_client.proposal || {}

      @proposal_patterns =
        (proposal["patterns"] || {}).select { |_p, v| [0, 1].include? v }.keys
    end

    # Returns the client to ask the software service
    #
    # @return [Agama::HTTP::Clients::Software]
    def software_client
      @software_client ||= Agama::HTTP::Clients::Software.new(logger)
    end
  end
end

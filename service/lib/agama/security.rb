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
      return if lsm_patterns.empty?

      if (lsm_patterns - proposal_patterns).empty?
        logger.info("The proposal patterns #{proposal_patterns.inspect} includes #{lsm_patterns.inspect}")
        lsm_config.save
      else
        logger.error("The proposal patterns #{proposal_patterns.inspect} DO NOT include #{lsm_patterns.inspect}")
      end
    end

    def probe
      logger.info("The product security data is #{config.data["security"].inspect}")
      lsm_config.select(config.data.dig("security", "lsm"))
    end

  private

    attr_reader :config

    def lsm_config
      Y2Security::LSM::Config.instance
    end

    def lsm_selected
      lsm_config.selected
    end

    def proposal_patterns
      proposal = software_client.proposal || {}

      (proposal.dig("patterns") || []).select { |p,v| [0, 1].include? v }.keys
    end

    def lsm_patterns
      return [] unless lsm_selected
      config.data.dig("security","available_lsms", lsm_selected.id.to_s, "patterns") || []
    end

    # Returns the client to ask the software service
    #
    # @return [Agama::HTTP::Clients::Software]
    def software_client
      @software_client ||= Agama::HTTP::Clients::Software.new(logger)
    end
  end
end

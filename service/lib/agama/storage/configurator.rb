# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

module Agama
  module Storage
    # Class used for configuring storage.
    class Configurator
      def initialize(proposal)
        @proposal = proposal
      end

      def configure(config_json = nil)
        configs = [config_json] || generate_configs

        configs.each do |config|
          proposal.calculate_from_json(config)
          break if proposal.success?
        end

        proposal.success?
      end

    private

      MAX_CONFIGS = 5

      attr_reader :proposal

      def generate_configs
        candidate_devices
          .first(MAX_CONFIGS)
          .map { |d| generate_config(d) }
      end

      def generate_config(device)
        config_generator.generate(device)
      end

      def candidate_devices
        # TODO sort
        system.candidate_devices
      end

      def config_generator
        @config_generator ||= ConfigGenerator.new
      end

      def system
        @system ||= Storage::System.new
      end
    end
  end
end

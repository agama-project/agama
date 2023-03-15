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

require "abstract_method"

module DInstaller
  module Storage
    module DASD
      # Base class for operations that are performed one by one over a set of DASDs
      class SequentialOperation
        # Constructor
        #
        # @param dasds [Array<Y2S390:Dasd>] see {#dasds}
        # @param logger [Logger] see {#logger}
        def initialize(dasds, logger)
          @dasds = dasds
          @logger = logger
        end

        # Executes the action on all the DASDs
        #
        # @return [Boolean] true if the operation succeeds for all the DASDs
        def run
          results = {}
          dasds.each { |dasd| results[dasd.id] = process_dasd(dasd) }
          logger.info "DASD operation (#{self.class.name}) results: #{results}"
          results.values.all?
        end

      private

        # @return [Array<Y2S390::Dasd>]
        attr_reader :dasds

        # @return [Logger]
        attr_reader :logger

        # @!method process_dasd(dasd)
        #   Executes the action on a given DASD
        #
        #   @param dasd [Y2S390::Dasd]
        #   @return [Boolean] whether the operation on the DASD succeeds
        abstract_method :process_dasd
      end
    end
  end
end

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
require "y2packager/repository"

module Agama
  module Software
    # This class represents a software repository
    #
    # It extends the `Y2Packager::Repository` with some methods in the context
    # of Agama.
    #
    # @see RepositoriesManager
    class Repository < Y2Packager::Repository
      # delay before retrying (in seconds)
      RETRY_DELAY = 5
      # number of automatic retries
      RETRY_COUNT = 1

      # Probes a repository
      #
      # @return [Boolean] true if the repository can be read; false otherwise
      def probe
        attempt = 1
        type = nil

        loop do
          # on a timeout error the result is nil, retry automatically in that case,
          # note: callbacks are disabled during repo probing call
          type = Yast::Pkg.RepositoryProbe(url.to_s, product_dir)
          break if !type.nil? || attempt > RETRY_COUNT

          sleep(RETRY_DELAY)
          attempt += 1
        end

        !!type && type != "NONE"
      end

      def loaded?
        @loaded
      end

      def refresh
        attempt = 1

        loop do
          @loaded = !!super
          break if @loaded || attempt > RETRY_COUNT

          sleep(RETRY_DELAY)
          attempt += 1
        end

        @loaded
      end
    end
  end
end

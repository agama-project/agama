# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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

require "agama/progress_manager"

module Agama
  # Mixin that allows to start a progress and configure callbacks
  module WithProgressManager
    # @return [ProgressManager]
    def progress_manager
      @progress_manager ||= Agama::ProgressManager.new
    end

    # @return [Progress, nil]
    def progress
      progress_manager.progress
    end

    # Creates a new progress with a given number of steps
    #
    # @param size [Integer] Number of steps
    def start_progress_with_size(size)
      progress_manager.start_with_size(size)
    end

    # Creates a new progress with a given set of steps
    #
    # @param descriptions [Array<String>] Steps descriptions
    def start_progress_with_descriptions(*descriptions)
      progress_manager.start_with_descriptions(*descriptions)
    end

    # Finishes the current progress
    def finish_progress
      progress_manager.finish
    end

    # Registers an on_change callback to be added to the progress
    #
    # @param block [Proc]
    def on_progress_change(&block)
      progress_manager.on_change(&block)
    end

    # Registers an on_finish callback to be added to the progress
    #
    # @param block [Proc]
    def on_progress_finish(&block)
      progress_manager.on_finish(&block)
    end
  end
end

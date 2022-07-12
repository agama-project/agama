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

require "dinstaller/progress"

module DInstaller
  # Mixin that allows to start a progress and configure callbacks
  module WithProgress
    # @return [Progress, nil]
    attr_reader :progress

    # Creates a new progress
    #
    # @raise [RuntimeError] if there is an unfinished progress.
    #
    # @param total_steps [Integer] total number of the steps for the progress.
    def start_progress(total_steps)
      raise "There already is an unfinished progress" if progress && !progress.finished?

      on_change_callbacks = @on_progress_change_callbacks || []
      on_finish_callbacks = @on_progress_finish_callbacks || []

      @progress = Progress.new(total_steps).tap do |progress|
        progress.on_change { on_change_callbacks.each(&:call) }
        progress.on_finish { on_finish_callbacks.each(&:call) }
      end
    end

    # Registers an on_change callback to be added to the progress
    #
    # @param block [Proc]
    def on_progress_change(&block)
      @on_progress_change_callbacks ||= []
      @on_progress_change_callbacks << block
    end

    # Registers an on_finish callback to be added to the progress
    #
    # @param block [Proc]
    def on_progress_finish(&block)
      @on_progress_finish_callbacks ||= []
      @on_progress_finish_callbacks << block
    end
  end
end

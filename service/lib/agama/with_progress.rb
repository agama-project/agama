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

require "agama/progress"

module Agama
  # Mixin that allows to start a progress and configure callbacks
  module WithProgress
    # There is an unfinished progress
    class NotFinishedProgress < StandardError; end

    # @return [Progress, nil]
    attr_reader :progress

    # Creates a new progress with a given number of steps
    #
    # @param size [Integer] Number of steps
    def start_progress_with_size(size)
      start_progress(size: size)
    end

    # Creates a new progress with a given set of steps
    #
    # @param descriptions [Array<String>] Steps descriptions
    def start_progress_with_descriptions(*descriptions)
      start_progress(descriptions: descriptions)
    end

    # Creates a new progress
    #
    # @raise [RuntimeError] if there is an unfinished progress.
    #
    # @param args [*Hash] Progress constructor arguments.
    def start_progress(args)
      raise NotFinishedProgress if progress && !progress.finished?

      on_change_callbacks = @on_progress_change_callbacks || []
      on_finish_callbacks = @on_progress_finish_callbacks || []

      @progress = Progress.new(**args).tap do |progress|
        progress.on_change { on_change_callbacks.each(&:call) }
        progress.on_finish { on_finish_callbacks.each(&:call) }
      end
    end
    private :start_progress

    # Finishes the current progress
    def finish_progress
      return if progress.nil? || progress.finished?

      progress.finish
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

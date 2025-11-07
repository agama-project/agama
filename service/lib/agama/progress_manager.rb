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

require "agama/old_progress"

module Agama
  # There is an unfinished progress.
  class NotFinishedProgress < StandardError; end

  # Class for managing the progress.
  class ProgressManager
    # @return [Progress, nil]
    attr_reader :progress

    def initialize
      @on_change_callbacks = []
      @on_finish_callbacks = []
    end

    # Creates a new progress with a given number of steps.
    #
    # @param size [Integer] Number of steps.
    def start_with_size(size)
      start_progress(size: size)
    end

    # Creates a new progress with a given set of steps.
    #
    # @param descriptions [Array<String>] Steps descriptions.
    def start_with_descriptions(*descriptions)
      start_progress(descriptions: descriptions)
    end

    # Finishes the current progress.
    def finish
      return if progress.nil? || progress.finished?

      progress.finish
    end

    # Registers an on_change callback to be added to the progress.
    #
    # @param block [Proc]
    def on_change(&block)
      @on_change_callbacks << block
    end

    # Registers an on_finish callback to be added to the progress.
    #
    # @param block [Proc]
    def on_finish(&block)
      @on_finish_callbacks << block
    end

  private

    # @return [Array<Proc>]
    attr_reader :on_change_callbacks

    # @return [Array<Proc>]
    attr_reader :on_finish_callbacks

    # Creates a new progress.
    #
    # @raise [RuntimeError] if there is an unfinished progress.
    #
    # @param args [*Hash] Progress constructor arguments.
    def start_progress(args)
      raise NotFinishedProgress if progress && !progress.finished?

      @progress = OldProgress.new(**args).tap do |progress|
        progress.on_change { on_change_callbacks.each(&:call) }
        progress.on_finish { on_finish_callbacks.each(&:call) }
      end
    end
  end
end

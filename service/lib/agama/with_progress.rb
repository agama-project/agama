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

require "agama/progress"

module Agama
  module WithProgress
    attr_reader :progress

    def start_progress(size, step)
      @progress = Progress.new(size, step)
      progress_change
    end

    def start_progress_with_steps(steps)
      @progress = Progress.new_with_steps(steps)
      progress_change
    end

    def next_progress_step(step = nil)
      return unless @progress

      step ? @progress.next_with_step(step) : @progress.step
      progress_change
    end

    def finish_progress
      return unless @progress

      @progress = nil
      progress_finish
    end

    def progress_change
      @on_progress_change_callbacks.each(&:call)
    end

    def progress_finish
      @on_progress_finish_callbacks.each(&:call)
    end

    # @param block [Proc]
    def on_progress_change(&block)
      @on_progress_change_callbacks ||= []
      @on_progress_change_callbacks << block
    end

    # @param block [Proc]
    def on_progress_finish(&block)
      @on_progress_finish_callbacks ||= []
      @on_progress_finish_callbacks << block
    end
  end
end

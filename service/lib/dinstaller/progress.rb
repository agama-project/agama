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

module DInstaller
  # Class to pass around to get progress info. Intention is to allow
  # in long run methods like probe or commit to pass its progress report
  # when UI asks for it.
  #
  # The class contain major and minor steps. Intention is that
  # top level manager knows about major steps and sets total and current step.
  # On other hand each step called by manager class sets minor steps and messages if needed.
  #
  # @example manager interaction
  #
  #   progress = Progress.new
  #   progress.init_progress(3, "Doing step1")
  #   step1(progress)
  #   progress.next_step("Doing step2")
  #   step2(progress)
  #   progress.next_step("Doing step3")
  #   step3(progress)
  #   progress.next_step("Finished with step3")
  #
  # @example module interaction
  #
  #   def step2(progress)
  #     progress.init_minor_steps(2, "Doing subtask1")
  #     subtask1
  #     progress.next_minor_step("Doing subtask2")
  #     subtask2
  #     progress.next_minor_step("Finished subtask2")
  class Progress
    def initialize
      @message = ""
      @total_steps = @current_step = @total_minor_steps = @current_minor_step = 0
      @callbacks = []
    end

    attr_reader :message
    attr_reader :total_steps
    attr_reader :current_step
    attr_reader :total_minor_steps
    attr_reader :current_minor_step

    # Adds callback that is called when progress changed
    def add_on_change_callback(&block)
      @callbacks << block
    end

    def init_progress(amount_of_major_steps, message)
      @total_steps = amount_of_major_steps
      @message = message
      trigger_callbacks
    end

    def next_step(message)
      reset_minor_steps
      @message = message
      @current_step += 1
      trigger_callbacks
    end

    def init_minor_steps(amount_of_minor_steps, message)
      @total_minor_steps = amount_of_minor_steps
      @message = message
      trigger_callbacks
    end

    def next_minor_step(message)
      @message = message
      @current_minor_step += 1
      trigger_callbacks
    end

    def assign_error(message)
      @message = message
      trigger_callbacks
    end

  private

    def trigger_callbacks
      @callbacks.each(&:call)
    end

    def reset_minor_steps
      @total_minor_steps = @current_minor_step = 0
    end
  end
end

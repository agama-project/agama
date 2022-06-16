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
  # Class to manage progress
  #
  # It uses callbacks to report the progress, specially useful for long run actions like probing or
  # committing. The progress supports major and minor steps.
  #
  # @example
  #   def long_action
  #     progress = Progress.new
  #     progress.on_chage { puts progress.message }
  #
  #     progress.init_progress(3, "Doing step1")    # steps 0/3
  #     step1(progress)
  #     progress.next_step("Doing step2")           # steps 1/3
  #     step2(progress)
  #     progress.next_step("Doing step3")           # steps 2/3
  #     step3(progress)
  #     progress.next_step("Finished action")       # steps 3/3, progress is done
  #   end
  #
  #   def step2(progress)
  #     progress.init_minor_steps(2, "Doing subtask1")  # sub-steps 0/2
  #     subtask1
  #     progress.next_minor_step("Doing subtask2")      # sub-steps 1/2
  #     subtask2
  #     progress.next_minor_step("Finished step")       # sub-steps 2/2
  #   end
  class Progress
    # Message of the current progress step (or sub-step)
    #
    # @return [String]
    attr_reader :message

    # Total number of steps
    #
    # @return [Integer]
    attr_reader :total_steps

    # Number of the current step (first step is 0)
    #
    # @return [Integer]
    attr_reader :current_step

    # Total number of sub-steps
    #
    # @return [Integer]
    attr_reader :total_minor_steps

    # Number of the current sub-step
    #
    # @return [Integer]
    attr_reader :current_minor_step

    def initialize
      @message = ""
      @total_steps = @current_step = @total_minor_steps = @current_minor_step = 0
      @on_change_callbacks = []
    end

    # Adds callback that is called when progress changed
    def on_change(&block)
      @on_change_callbacks << block
    end

    def init_progress(amount_of_major_steps, message)
      @total_steps = amount_of_major_steps
      @current_step = 0
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

    # Returns an array containing the progress information
    #
    # Useful to expose the progress information as a D-Bus property.
    #
    # @return [Array<String,Integer,Integer,Integer,Integer>]
    def to_a
      [message, total_steps, current_step, total_minor_steps, current_minor_step].freeze
    end

  private

    def trigger_callbacks
      @on_change_callbacks.each(&:call)
    end

    def reset_minor_steps
      @total_minor_steps = @current_minor_step = 0
    end
  end
end

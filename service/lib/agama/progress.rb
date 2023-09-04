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

module Agama
  # Class to manage progress
  #
  # It allows to configure callbacks to be called on each step and also when the progress finishes.
  #
  # @example
  #
  #   progress = Progress.new(3)                    # 3 steps
  #   progress.on_change { puts progress.message }  # configures callbacks
  #   progress.on_finish { puts "finished"  }       # configures callbacks
  #
  #   progress.step("Doing step1") { step1 }        # calls on_change callbacks and executes step1
  #   progress.step("Doing step2") { step2 }        # calls on_change callbacks and executes step2
  #
  #   progress.current_step                         #=> <Step>
  #   progress.current_step.id                      #=> 2
  #   progress.current_step.description             #=> "Doing step2"
  #
  #   progress.finished?                            #=> false

  #   progress.step("Doing step3") do               # calls on_change callbacks, executes the given
  #     progress.current_step.description           # block and calls on_finish callbacks
  #   end                                           #=> "Doing step3"
  #
  #   progress.finished?                            #=> true
  #   progress.current_step                         #=> nil
  class Progress
    # Step of the progress
    class Step
      # Id of the step
      #
      # @return [Integer]
      attr_reader :id

      # Description of the step
      #
      # @return [String]
      attr_reader :description

      # Constructor
      #
      # @param id [Integer]
      # @param description [String]
      def initialize(id, description)
        @id = id
        @description = description
      end
    end

    # Total number of steps
    #
    # @return [Integer]
    attr_reader :total_steps

    # Constructor
    #
    # @param total_steps [Integer] total number of steps
    def initialize(total_steps)
      @total_steps = total_steps
      @current_step = nil
      @counter = 0
      @finished = false
      @on_change_callbacks = []
      @on_finish_callbacks = []
    end

    # Current progress step, if any
    #
    # @return [Step, nil] nil if the progress is already finished or not stated yet.
    def current_step
      return nil if finished?

      @current_step
    end

    # Runs a progress step
    #
    # It calls the `on_change` callbacks and then runs the given block, if any. It also calls
    # `on_finish` callbacks after the last step.
    #
    # @param description [String] description of the step
    # @param block [Proc]
    #
    # @return [Object, nil] result of the given block or nil if no block is given
    def step(description, &block)
      return if finished?

      @counter += 1
      @current_step = Step.new(@counter, description)
      @on_change_callbacks.each(&:call)

      result = block_given? ? block.call : nil

      finish if @counter == total_steps

      result
    end

    # Whether the last step was already done
    #
    # @return [Boolean]
    def finished?
      total_steps == 0 || @finished
    end

    # Finishes the progress and runs the callbacks
    #
    # This method can be called to force the progress to finish before of running all the steps.
    def finish
      @finished = true
      @on_finish_callbacks.each(&:call)
    end

    # Adds a callback to be called when progress changes
    #
    # @param block [Proc]
    def on_change(&block)
      @on_change_callbacks << block
    end

    # Adds a callback to be called when progress finishes
    #
    # @param block [Proc]
    def on_finish(&block)
      @on_finish_callbacks << block
    end

    # Returns a string-based representation of the progress
    #
    # @return [String]
    def to_s
      return "Finished" if finished?

      "#{current_step.description} (#{@counter}/#{total_steps})"
    end
  end
end

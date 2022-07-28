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
  # Manager for questions
  #
  # Allows to configure callbacks with the actions to perform when adding, deleting or waiting for
  # questions.
  class QuestionsManager
    # @return [Array<Question>]
    attr_reader :questions

    # Constructor
    #
    # @params logger [Logger]
    def initialize(logger)
      @logger = logger
      @questions = []
      @on_add_callbacks = []
      @on_delete_callbacks = []
      @on_wait_callbacks = []
    end

    # Adds a question
    #
    # Callbacks are called after adding the question, see {#on_add}.
    #
    # @yieldparam question [Question] added question
    #
    # @param question [Question]
    # @return [Question,nil] the actually added question (to be passed to {#delete} later)
    def add(question)
      return nil if include?(question)

      questions << question
      on_add_callbacks.each { |c| c.call(question) }

      question
    end

    # Deletes the given question
    #
    # Callbacks are called after deleting the question, see {#on_delete}.
    #
    # @yieldparam question [Question] deleted question
    #
    # @param question [Question]
    # @return [Question,nil] whether the question was deleted
    def delete(question)
      return nil unless include?(question)

      questions.delete(question)
      on_delete_callbacks.each { |c| c.call(question) }

      question
    end

    # Waits until all questions are answered
    #
    # Callbacks are periodically called while waiting, see {#on_wait}.
    def wait(_questions)
      logger.info "Waiting for questions to be answered"

      loop do
        on_wait_callbacks.each(&:call)
        sleep(0.1)
        break if questions_answered?
      end
    end

    # Registers a callback to be called when a new question is added
    #
    # @param block [Proc]
    def on_add(&block)
      on_add_callbacks << block
    end

    # Registers a callback to be called when a question is deleted
    #
    # @param block [Proc]
    def on_delete(&block)
      on_delete_callbacks << block
    end

    # Registers a callback to be called while waiting for questions be answered
    #
    # @param block [Proc]
    def on_wait(&block)
      on_wait_callbacks << block
    end

  private

    # @return [Logger]
    attr_reader :logger

    # Callbacks to be called when the a new question is added
    #
    # @return [Array<Proc>]
    attr_reader :on_add_callbacks

    # Callbacks to be called when the a question is deleted
    #
    # @return [Array<Proc>]
    attr_reader :on_delete_callbacks

    # Callbacks to be called when waiting for answers
    #
    # @return [Array<Proc>]
    attr_reader :on_wait_callbacks

    # Whether a question with the same id as the given question is already in the list of questions
    #
    # @param question [Question]
    # @return [Boolean]
    def include?(question)
      questions.any? { |q| q.id == question.id }
    end

    # Whether all questions are already answered
    #
    # @return [Boolean]
    def questions_answered?
      questions.all?(&:answered?)
    end
  end
end

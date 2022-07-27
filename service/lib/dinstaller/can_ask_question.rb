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
  # Mixin providing a method to ask a question and wait
  module CanAskQuestion
    # @!method questions_manager
    #   @note Classes including this mixin must define a #questions_manager method
    #   @return [QuestionsManager]

    # Asks the given question and waits until the question is answered
    #
    # @example
    #   ask(question1)                           #=> Symbol
    #   ask(question2) { |q| q.answer == :yes }  #=> Boolean
    #
    # @param question [Question]
    # @yield [Question,DBus::Clients::Question] Gives the answered question to the block.
    # @return [Symbol, Object] The question answer, or the result of the block in case a block is
    #   given.
    def ask(question)
      # asked_question has the same interface as question
      # but it may be a D-Bus proxy, if our questions_manager is also one
      asked_question = questions_manager.add(question)
      questions_manager.wait
      result = block_given? ? yield(asked_question) : asked_question.answer
      questions_manager.delete(asked_question)

      result
    end
  end
end

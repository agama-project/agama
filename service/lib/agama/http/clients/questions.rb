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

require "agama/http/clients/base"
require "agama/question"

module Agama
  module HTTP
    module Clients
      # HTTP client to interact with the files API.
      class Questions < Base
        class CouldNotAddQuestion < StandardError; end

        # Adds a question
        #
        # @param question [Agama::Question]
        # @return [Question, nil] created question or nil if the request failed
        def add(question)
          response = post("v2/questions", question.to_api)
          response ? Question.from_api(JSON.parse(response.body)) : nil
        end

        def questions
          JSON.parse(get("v2/questions")).map { |q| Question.from_api(q) }
        end

        # Deletes the given question
        #
        # @param id [Integer] question ID
        # @return [void]
        def delete(id)
          payload = { "delete" => { "id" => id } }
          patch("v2/questions", payload)
        end

        # Waits until specified question is answered
        #
        # @param id [Integer] question ID
        # @return [void]
        def wait_answer(id)
          @logger.info "Waiting for question #{id} to be answered"

          # TODO: detect if no UI showed up to display the questions and time out?
          # for example:
          # (0..Float::INFINITY).each { |i| break if i > 100 && !question.displayed; ... }
          loop do
            found = questions.find { |q| q.id == id }
            # raise an error if the question is not found.
            return found.answer if found&.answer

            sleep(0.5)
          end
        end

        # Asks the given question and waits until the question is answered
        #
        # @example
        #   ask(question1) #=> Symbol
        #   ask(question2) { |a| a.action == :yes }  #=> Boolean
        #
        # @param question [Agama::Question]
        # @yield [Agama::Answer] Gives the answered question to the block.
        # @return [Agama::Answer] The question answer, or the result of the block in case a block
        #   is given.
        def ask(question)
          added_question = add(question)
          if added_question.nil?
            @logger.error "Could not add a question with data: {question.inspect}"
            raise CouldNotAddQuestion
          end

          answer = wait_answer(added_question.id)

          @logger.info("#{added_question.text} #{answer.inspect}")

          result = block_given? ? yield(answer) : answer
          delete(added_question.id)

          result
        end
      end
    end
  end
end

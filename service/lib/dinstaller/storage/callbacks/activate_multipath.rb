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

require "dinstaller/question"
require "dinstaller/can_ask_question"

module DInstaller
  module Storage
    module Callbacks
      # Callbacks for multipath activation
      class ActivateMultipath
        include CanAskQuestion

        # Constructor
        #
        # @param questions_manager [QuestionsManager]
        # @param logger [Logger]
        def initialize(questions_manager, logger)
          @questions_manager = questions_manager
          @logger = logger
        end

        # Asks whether to activate multipath devices
        #
        # @note The process waits until the question is answered.
        #
        # @param looks_like_real_multipath [Boolean] see {Callbacks::Activate#multipath}.
        # @return [Boolean]
        def call(looks_like_real_multipath)
          return false unless looks_like_real_multipath

          ask(question) do |q|
            logger.info("#{q.text} #{q.answer}")

            q.answer == :yes
          end
        end

      private

        # @return [QuestionsManager]
        attr_reader :questions_manager

        # @return [Logger]
        attr_reader :logger

        # Question to ask for multipath activation
        #
        # @return [Question]
        def question
          text = "The system seems to have multipath hardware. " \
                 "Do you want to activate multipath?"

          Question.new(text, options: [:yes, :no])
        end
      end
    end
  end
end

# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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

require "agama/question_with_password"
require "y2storage/disk_size"

module Agama
  module Storage
    module Callbacks
      # Callbacks for LUKS activation
      class ActivateLuks
        # Constructor
        #
        # @param questions_client [Agama::HTTP::Clients::Questions]
        # @param logger [Logger]
        def initialize(questions_client, logger)
          @questions_client = questions_client
          @logger = logger
        end

        # Asks whether to activate a LUKS device
        #
        # @note The process waits until the question is answered.
        #
        # @param info [Storage::LuksInfo]
        # @param attempt [Numeric]
        #
        # @return [Array(Boolean, String)] The first value is whether to activate the device, and
        #   the second one is the LUKS password. Note that the password would only be considered
        #   when the first value is true.
        def call(info, attempt)
          question = question(info, attempt)

          questions_client.ask(question) do |answer|
            activate = answer.action == :decrypt
            password = answer.value

            [activate, password]
          end
        end

      private

        # @return [Agama::HTTP::Clients::Questions]
        attr_reader :questions_client

        # @return [Logger]
        attr_reader :logger

        # Question to ask for LUKS activation
        #
        # @return [QuestionWithPassword]
        def question(info, attempt)
          data = {
            "device"  => info.device_name,
            "label"   => info.label,
            "size"    => formatted_size(info.size),
            "attempt" => attempt.to_s
          }
          QuestionWithPassword.new(
            qclass:         "storage.luks_activation",
            text:           generate_text(data),
            options:        [:skip, :decrypt],
            default_option: :decrypt,
            data:           data
          )
        end

        # Generates a formatted representation of the size
        #
        # @param value [Y2Storage::DiskSize]
        # @return [String]
        def formatted_size(value)
          Y2Storage::DiskSize.new(value).to_human_string
        end

        # Generate the text for the question
        #
        # @return [String]
        def generate_text(data)
          "The device #{device_info(data)} is encrypted."
        end

        # Device information to include in the question
        #
        # @return [String]
        def device_info(data)
          info = [data["device"]]
          info << data["label"] unless data["label"].to_s.empty?
          info << "(#{data["size"]})" unless data["size"].to_s.empty?

          info.join(" ")
        end
      end
    end
  end
end

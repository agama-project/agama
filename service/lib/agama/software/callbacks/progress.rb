# frozen_string_literal: true

# Copyright (c) [2021-2025] SUSE LLC
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

require "logger"
require "yast"
require "agama/question"
require "agama/http/clients"
require "agama/software/callbacks/base"

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # This class represents the installer status
      class Progress < Base
        class << self
          def setup(pkg_count, progress, logger)
            new(pkg_count, progress, logger).setup
          end
        end

        def initialize(pkg_count, progress, logger)
          super(questions_client, logger)

          textdomain "agama"

          @total = pkg_count
          @installed = 0
          @progress = progress
          @logger = logger || ::Logger.new($stdout)
        end

        def setup
          Yast::Pkg.CallbackStartPackage(
            Yast::FunRef.new(
              method(:start_package), "void (string, string, string, integer, boolean)"
            )
          )

          Yast::Pkg.CallbackDonePackage(
            Yast::FunRef.new(
              method(:done_package), "string (integer, string)"
            )
          )
        end

      private

        # @return [Agama::Progress]
        attr_reader :progress

        # @return [String,nil]
        attr_accessor :current_package

        # @return [Logger]
        attr_reader :logger

        # @return [Agama::HTTP::Clients::Questions]
        def questions_client
          @questions_client ||= Agama::HTTP::Clients::Questions.new(logger)
        end

        def start_package(package, _file, _summary, _size, _other)
          progress.step("Installing #{package}")
          self.current_package = package
        end

        def done_package(error_code, description)
          return "" if error_code == 0

          logger.error("Package #{current_package} failed: #{description}")

          question = Agama::Question.new(
            qclass:  "software.package_error.install_error",
            text:    description,
            # FIXME: temporarily removed the "Abort" option until the final failed
            # state is handled properly
            options: [retry_label.to_sym, continue_label.to_sym],
            data:    { "package" => current_package }
          )

          questions_client.ask(question) do |answer|
            case answer
            when retry_label.to_sym
              "R"
            # FIXME: temporarily disabled
            # when abort_label.to_sym
            #   "C"
            when continue_label.to_sym
              "I"
            else
              logger.error("Unexpected response #{question_client.answer.inspect}, " \
                           "ignoring the package error")
              "I"
            end
          end
        end

        def msg
          "Installing packages (#{@total - @installed} remains)"
        end
      end
    end
  end
end

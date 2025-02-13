# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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
require "agama/dbus/clients/questions"

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # This class represents the installer status
      class Progress
        include Yast::I18n

        class << self
          def setup(pkg_count, progress, logger)
            new(pkg_count, progress, logger).setup
          end
        end

        def initialize(pkg_count, progress, logger)
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

        # @return [Agama::DBus::Clients::Questions]
        def questions_client
          @questions_client ||= Agama::DBus::Clients::Questions.new(logger: logger)
        end

        def start_package(package, _file, _summary, _size, _other)
          progress.step("Installing #{package}")
          self.current_package = package
        end

        def done_package(error_code, description)
          return "" if error_code == 0

          logger.error("Package #{current_package} failed: #{description}")

          # TRANSLATORS: %s is a package name
          text = _("Package %s could not be installed.") % current_package

          question = Agama::Question.new(
            qclass:         "software.install_error",
            text:           text,
            options:        [:Retry, :Cancel, :Ignore],
            default_option: :Retry,
            data:           { "description" => description }
          )

          questions_client.ask(question) do |question_client|
            case question_client.answer
            when :Retry
              "R"
            when :Cancel
              "C"
            when :Ignore
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

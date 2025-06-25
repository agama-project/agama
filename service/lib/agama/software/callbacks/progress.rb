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
require "agama/software/callbacks/base"

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # This class represents the installer status
      class Progress < Base
        include Yast::I18n

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
          # new libzypp callbacks
          Yast::Pkg.CallbackStartInstallResolvableSA(
            Yast::FunRef.new(
              method(:start_resolvable), "void (map)"
            )
          )

          Yast::Pkg.CallbackFinishInstallResolvableSA(
            Yast::FunRef.new(
              method(:done_resolvable), "void (map)"
            )
          )

          Yast::Pkg.CallbackStartProvide(
            Yast::FunRef.new(method(:start_provide), "void (string, integer, boolean)")
          )

          # NOTE: The Pkg.CallbackDoneProvide callback is registered in the
          # Agama:Software:Callbacks:Provide class. DO NOT use it here because pkg-bindings can
          # handle only a single function call for each callback, it would ignore all previously
          # registered callback functions!
        end

      private

        # @return [Agama::Progress]
        attr_reader :progress

        # @return [Logger]
        attr_reader :logger

        # @return [Agama::DBus::Clients::Questions]
        def questions_client
          @questions_client ||= Agama::DBus::Clients::Questions.new(logger: logger)
        end

        def start_resolvable(resolvable)
          logger.info "Started installing resolvable #{resolvable.inspect}"
          return if resolvable["kind"] != "package"

          name = resolvable["name"]
          # TRANSLATORS: progress message, %s is the package name
          progress.step(_("Installing %s") % name)
        end

        def done_resolvable(resolvable)
          logger.info "Finished installing resolvable #{resolvable.inspect}"
          @installed += 1 if resolvable["kind"] == "package"
        end

        def start_provide(name, _size, _remote)
          # TRANSLATORS: progress message, %s is the package name
          progress.step(_("Downloading %s") % name)
        end

        def msg
          "Installing packages (#{@total - @installed} remains)"
        end
      end
    end
  end
end

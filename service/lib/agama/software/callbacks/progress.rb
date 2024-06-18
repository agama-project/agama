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

require "yast"

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # This class represents the installer status
      class Progress
        class << self
          def setup(pkg_count, progress)
            new(pkg_count, progress).setup
          end
        end

        def initialize(pkg_count, progress)
          @total = pkg_count
          @installed = 0
          @progress = progress
        end

        def setup
          Yast::Pkg.CallbackStartPackage(
            fun_ref(method(:start_package), "void (string, string, string, integer, boolean)")
          )
        end

      private

        # @return [Agama::Progress]
        attr_reader :progress

        def fun_ref(method, signature)
          Yast::FunRef.new(method, signature)
        end

        def start_package(package, _file, _summary, _size, _other)
          progress.step("Installing #{package}")
        end

        def msg
          "Installing packages (#{@total - @installed} remains)"
        end
      end
    end
  end
end

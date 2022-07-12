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
require "dinstaller/with_progress"

Yast.import "Pkg"

# YaST specific code lives under this namespace
module DInstaller
  # This class represents the installer status
  class PackageCallbacks
    include WithProgress

    class << self
      def setup(pkg_count)
        new(pkg_count).setup
      end
    end

    def initialize(pkg_count)
      @total = pkg_count
      @installed = 0
    end

    def setup
      Yast::Pkg.CallbackDonePackage(
        fun_ref(method(:package_installed), "string (integer, string)")
      )

      start_progress(@total)
    end

  private

    def fun_ref(method, signature)
      Yast::FunRef.new(method, signature)
    end

    # TODO: error handling
    def package_installed(_error, _reason)
      @installed += 1
      progress.step(msg)

      ""
    end

    def msg
      "Installing packages (#{@total - @installed} remains)"
    end
  end
end

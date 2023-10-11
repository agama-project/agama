# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "agama/software/repositories_manager"

module Agama
  module Software
    # Represents a product that Agama can install.
    class Product
      attr_reader :id

      attr_accessor :display_name

      attr_accessor :description

      attr_accessor :name

      attr_accessor :version

      attr_accessor :repositories

      attr_accessor :mandatory_packages

      attr_accessor :optional_packages

      attr_accessor :mandatory_patterns

      attr_accessor :optional_patterns

      def initialize(id)
        @id = id
        @repositories = []
        @mandatory_packages = []
        @optional_packages = []
        @mandatory_patterns = []
        @optional_patterns = []
      end
    end
  end
end

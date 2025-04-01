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

module Agama
  # Module containing common errors
  module Errors
    # Invalid value given by the user
    class InvalidValue < StandardError; end

    # Registration specific errors
    module Registration
      # The requested extension was not found
      class ExtensionNotFound < StandardError
        def initialize(name)
          super("#{name.inspect} is not available")
        end
      end

      # The requested extension exists in multiple versions
      class MultipleExtensionsFound < StandardError
        def initialize(name, versions)
          super("#{name.inspect} is available in multiple versions: #{versions.join(", ")}")
        end
      end
    end
  end
end

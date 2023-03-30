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
  # Represents a validation error
  #
  # These are errors related to the logic of the backends. For instance,
  # not defining neither a first user nor a root authentication method might
  # be a problem.
  class ValidationError
    # @return [String] Error message
    attr_reader :message

    # @param message [String] Error message
    def initialize(message)
      @message = message
    end

    # Determines whether two errors are equivalent
    #
    # @param other [ValidationError] Validation error to compare to
    # @return [Boolean]
    def ==(other)
      @message == other.message
    end
  end
end

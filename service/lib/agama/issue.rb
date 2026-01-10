# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
  # This class represents an issue in Agama
  #
  # An issue is used for notifying about some unexpected or problematic situation, for example, to
  # indicate that there is no device for installing the system.
  #
  # Issues have a description, details, source and severity:
  # * Description: describes the issue, typically with a single sentence.
  # * Details: provides more details about the problem. It is useful to report the output of a
  #   command failure.
  # * Source: indicates the source of the problem. In Agama, the issues usually comes from some
  #   unexpected situation in the system (e.g., missing device, etc) or from a wrong config (e.g.,
  #   missing user, etc).
  # * Severity: sets the severity of the issue. For now, issues could have warn or error severity.
  #   Error severity indicates that the installation cannot start.
  class Issue
    # Description of the issue
    #
    # @return [String]
    attr_reader :description

    # Details of the isssue, if any
    #
    # @return [String, nil]
    attr_reader :details

    # Kind of error
    #
    # It helps to identify the error without having to rely on the message
    # @return [Symbol]
    attr_reader :kind

    # Constructor
    #
    # @param description [String]
    # @param details [String, nil]
    def initialize(description, kind: :generic, details: "")
      @description = description
      @kind = kind
      @details = details
    end
  end
end

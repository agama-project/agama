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
Yast.import "HTML"
Yast.import "RichText"

module Y2Issues
  # This class converts a list of issues into a message for users
  #
  # @todo Separate by severity, group items, etc.
  class Presenter
    include Yast::I18n

    # @return [List] List of issues to present
    attr_reader :issues

    # @param issues [List] Issues list
    def initialize(issues)
      textdomain "base"
      @issues = issues
    end

    # Return the text to be shown to the user regarding the list of issues
    #
    # @return [String] Plain text
    def to_plain
      Yast::RichText.Rich2Plain(to_html)
    end

    # Return the HTML representation of a list of issues
    #
    # @return [String] HTML representing the list of issues
    def to_html
      errors, warnings = issues.partition(&:error?)
      parts = []
      parts << error_text(errors) unless errors.empty?
      parts << warning_text(warnings) unless warnings.empty?

      parts.join
    end

  private

    # Return warning message with a list of issues
    #
    # @param issues [Array<Issue>] List of issues to include in the message
    # @return [String] Message
    def warning_text(issues)
      Yast::HTML.Para(
        _("Minor issues were detected:")
      ) + issues_list_content(issues)
    end

    # Return error message with a list of issues
    #
    # @param issues [Array<Issue>] List of issues to include in the message
    # @return [String] Message
    def error_text(issues)
      Yast::HTML.Para(
        _("Important issues were detected:")
      ) + issues_list_content(issues)
    end

    # Return an HTML representation for a list of issues
    #
    # The issues are grouped by the location where they were detected. General issues (with no
    # specific location) are listed first.
    #
    # @return [String] Issues list content
    #
    # @see issues_by_location
    def issues_list_content(issues)
      all_issues = []
      issues_map = issues_by_location(issues)

      if issues_map[:nolocation]
        all_issues += issues_map[:nolocation].map(&:message)
        issues_map.delete(:nolocation)
      end

      issues_map.each do |group, items|
        messages = Yast::HTML.List(
          items.map { |i| "#{i.location.id}: #{i.message}" }
        )
        path = group.split(":").last
        all_issues << "#{path}:#{messages}"
      end

      Yast::HTML.List(all_issues)
    end

    # Return issues grouped by location where they were found
    #
    # @return [Hash<String,Issue>]
    #         Issues grouped by location type and path.
    def issues_by_location(issues)
      issues.each_with_object({}) do |issue, all|
        group = if issue.location
          "#{issue.location.type}:#{issue.location.path}"
        else
          :nolocation
        end
        all[group] ||= []
        all[group] << issue
      end
    end
  end
end

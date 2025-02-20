# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "agama/autoyast/profile_description"

module Agama
  module Tasks
    # Generates the AutoYaST compatibility reference
    #
    # The document describes which elements are supported, unsupported or planned to be supported.
    # It uses markdown to make it easier to integrate the document in Agama's website.
    class AutoYaSTCompatGenerator
      attr_reader :description

      def initialize
        @description = Agama::AutoYaST::ProfileDescription.load
      end

      # Generates the document in Markdown format
      def generate
        lines = ["# AutoYaST compatibility reference"]

        top_level = description.elements.select(&:top_level?)
          .sort_by(&:short_key)
        unsupported, rest = top_level.partition { |e| e.support == :no }

        rest.each do |e|
          lines.concat(section(e))
        end

        lines.join("\n")

        lines.concat(unsupported_elements(unsupported))
      end

    private

      def section(element, level = 1)
        title = "#" * (level + 1)
        lines = ["#{title} #{element.key}"]

        lines << ""
        lines << notes_for(element)
        lines << ""

        scalar, complex = element.children.partition do |e|
          e.children.empty?
        end

        lines.concat(elements_table(scalar))

        complex.each_with_object(lines) do |e, all|
          all.concat(section(e, level + 1))
        end
      end

      # Generates a table describing the support level of the elements.
      #
      # @param elements [Array<ProfileElement>] Elements to describe.
      def elements_table(elements)
        return [] if elements.empty?

        lines = [
          "| AutoYaST | Supported | Agama | Notes |",
          "|----------|-----------|-------|-------|"
        ]
        elements.each do |e|
          agama_key = e.agama ? "`#{e.agama}`" : ""
          lines << "| `#{e.short_key}` | #{e.support} | #{agama_key} | #{e.notes} |"
        end
        lines << ""
        lines
      end

      def unsupported_elements(elements)
        lines = []
        lines << "## Unsupported sections"
        lines << ""
        lines << "The following sections are not supported and we do not plan to " \
                 "support them  in the future."
        lines << ""
        elements.each_with_object(lines) do |e, all|
          line = "* `#{e.short_key}`"
          line << ": #{e.notes}" if e.notes
          all << line
        end
      end

      # Generates the notes for a given element.
      #
      # @param element [ProfileElement] Profile element to generate the notes for
      def notes_for(element)
        content = case element.support
        when :yes
          "This section is supported."
        when :no
          "This section is not supported."
        when :planned
          "There are plans to support this section in the future."
        when :partial
          "There is partial support for this section."
        else
          "Support for this element is still undecided."
        end

        element.notes ? "#{content} #{element.notes}" : content
      end
    end
  end
end

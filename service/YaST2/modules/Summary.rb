# ***************************************************************************
#
# Copyright (c) 2002 - 2012 Novell, Inc.
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************
# File:  modules/Summary.ycp
# Module:  yast2
# Summary:  Support for summaries of the configured devices
# Authors:  Jan Holesovsky <kendy@suse.cz>
#    Stefan Hundhammer <sh@suse.de>
#
# $Id$
#
# Create a unified-looking RichText description of the not configured
# and configured devices.

# Example of Summary.ycp usage
#
# @example  {
# @example      import "Summary";
# @example
# @example      return Summary::DevicesList(
# @example      [
# @example          Summary::Device("Cannon BJC-6100", "Configured as lp."),
# @example          Summary::Device("Epson Stylus Color", Summary::NotConfigured())
# @example      ]);
# @example  }
#
# Another example of Summary.ycp usage
#
# @example  {
# @example      import "Summary";
# @example
# @example      return Summary::DevicesList([]);
# @example  }
require "yast"

module Yast
  class SummaryClass < Module
    def main
      textdomain "base"

      Yast.import "Mode"
    end

    # Function that creates a 'Not configured.' message.
    # @return String with the message.
    def NotConfigured
      # translators: summary if the module has not been used yet in AutoYaST profile
      _("Not configured yet.")
    end

    # Function that creates the whole final product. "Not detected" will be returned
    # if the list is empty.
    #
    # @param [Array<String>] devices A list of output of the summaryDevice() calls
    # @return [String] The resulting text.
    def DevicesList(devices)
      devices = deep_copy(devices)
      text = ""
      if Builtins.size(devices) == 0
        text = if Mode.config
          Builtins.sformat("<ul><li>%1</li></ul>", NotConfigured())
        else
          # translators: summary if no hardware was detected
          Builtins.sformat("<ul><li>%1</li></ul>", _("Not detected."))
        end
      else
        Builtins.foreach(devices) { |dev| text = Ops.add(text, dev) }
        text = Builtins.sformat("<ul>%1</ul>", text)
      end

      text
    end

    # Function that creates description of one device.
    #
    # @param [String] name The name of the device given by probing
    # @param [String] description Additional description (how it was confgured or so)
    # @return [String] String with the item.
    def Device(name, description)
      Builtins.sformat("<li><p>%1<br>%2</p></li>", name, description)
    end

    # Add a RichText section header to an existing summary.
    #
    # @param [String] summary  previous RichText (HTML) summary to add to
    # @param [String] header  header to add (plain text, no HTML)
    # @return [String]  the new summary including the new header
    def AddHeader(summary, header)
      Ops.add(Ops.add(Ops.add(summary, "<h3>"), header), "</h3>")
    end

    # Add a line to an existing summary.
    #
    # @param [String] summary  previous RichText (HTML) summary to add to
    # @param [String] line  line to add (plain text, no HTML)
    # @return [String]  the new summary including the new line
    def AddLine(summary, line)
      Ops.add(Ops.add(Ops.add(summary, "<p>"), line), "</p>")
    end

    # Add a newline to an existing summary.
    #
    # @param [String] summary  previous RichText (HTML) summary to add to
    # @return [String]  the new summary
    def AddNewLine(summary)
      Ops.add(summary, "<br>")
    end

    # Start a list within a summary.
    #
    # @param [String] summary  previous RichText (HTML) summary to add to
    # @return [String]  the new summary
    def OpenList(summary)
      Ops.add(summary, "<ul>")
    end

    # End a list within a summary.
    #
    # @param [String] summary  previous RichText (HTML) summary to add to
    # @return [String]  the new summary
    def CloseList(summary)
      Ops.add(summary, "</ul>")
    end

    # Add a list item to an existing summary.
    # Requires a previous call to 'summaryOpenList()'.
    #
    # @param [String] summary  previous RichText (HTML) summary to add to
    # @param [String] item  item to add (plain text, no HTML)
    # @return [String]  the new summary including the new line
    def AddListItem(summary, item)
      Ops.add(Ops.add(Ops.add(summary, "\n<li>"), item), "</li>")
    end

    # Add a simple section to an existing summary,
    # consisting of a header and one single item.
    #
    # @param [String] summary  previous RichText (HTML) summary to add to
    # @param [String] header  section header (plain text, no HTML)
    # @param [String] item  section item   (plain text, no HTML)
    # @return [String]  the new summary including the new line
    def AddSimpleSection(summary, header, item)
      summary = AddHeader(summary, header)
      summary = OpenList(summary)
      summary = AddListItem(summary, item)
      CloseList(summary)
    end

    publish function: :NotConfigured, type: "string ()"
    publish function: :DevicesList, type: "string (list <string>)"
    publish function: :Device, type: "string (string, string)"
    publish function: :AddHeader, type: "string (string, string)"
    publish function: :AddLine, type: "string (string, string)"
    publish function: :AddNewLine, type: "string (string)"
    publish function: :OpenList, type: "string (string)"
    publish function: :CloseList, type: "string (string)"
    publish function: :AddListItem, type: "string (string, string)"
    publish function: :AddSimpleSection, type: "string (string, string, string)"
  end

  Summary = SummaryClass.new
  Summary.main
end

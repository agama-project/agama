# Copyright (c) [2017] SUSE LLC
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
require "y2storage"
require "y2storage/dump_manager"

Yast.import "HTML"

module Y2Storage
  # Presenter for actions of an actiongraph
  class ActionsPresenter
    include Yast::I18n

    def initialize(actiongraph)
      textdomain "storage"

      @actiongraph = actiongraph
      @collapsed_subvolumes = true
    end

    # Changes the status of the presenter
    #
    # @param event [#to_s] event that change the status
    def update_status(event)
      toggle_subvolumes if event.to_s == toggle_subvolumes_event
    end

    # HTML representation for the actions of an actiongraph
    #
    # @return [Yast::Term]
    def to_html
      items = general_actions_items + subvolume_actions_items
      html = Yast::HTML.Para(html_list(items))
      html.gsub("\n", "<br>")
    end

    # Whether the event can be managed by the presenter
    #
    # @return [Boolean]
    def can_handle?(event)
      events.include?(event)
    end

    # List of events that the presenter can manage
    #
    # @return [Array<String>]
    def events
      [toggle_subvolumes_event]
    end

    # Checks whether the list of actions is empty
    #
    # @return [Boolean] true if there are no actions to show
    def empty?
      actiongraph.nil? || actiongraph.empty?
    end

    # Plain text representation
    #
    # @return [String] multi-line text
    def to_s
      lines = actions_to_text(general_actions)
      subvolume_lines = actions_to_text(subvolume_actions)

      if !subvolume_lines.empty?
        lines << ""
        lines.append(subvolume_lines)
      end

      return "Nothing to do" if lines.empty?

      lines.join("\n")
    end

    # Save the actions to a plain text file
    #
    # @param filename [String]
    def save(filename)
      File.open(filename, "w") do |file|
        file.puts(Time.now.to_s)
        file.puts
        file.puts(to_s)
      end
    end

    # Dump the actions to a plain text file.
    #
    # @param file_base_name [String] File base name to use.
    #   Leave this empty to use a generated name.
    def dump(file_base_name = nil)
      DumpManager.dump(self, file_base_name)
    end

    protected

    attr_reader :actiongraph
    attr_reader :collapsed_subvolumes

    TOGGLE_SUBVOLUMES_EVENT = "actions_presenter--subvolumes"

    def toggle_subvolumes_event
      TOGGLE_SUBVOLUMES_EVENT
    end

    def toggle_subvolumes
      @collapsed_subvolumes = !@collapsed_subvolumes
    end

    def collapsed_subvolumes?
      @collapsed_subvolumes
    end

    def general_actions_items
      actions_to_items(general_actions)
    end

    def subvolume_actions_items
      actions = subvolume_actions
      return [] if actions.empty?

      event = toggle_subvolumes_event
      if collapsed_subvolumes?
        # TRANSLATORS: %d is the amount of actions, %s an URL
        [format(_("%d subvolume actions (<a href=\"%s\">see details</a>)"), actions.size, event)]
      else
        # TRANSLATORS: %d is the amount of actions, %s an URL
        header = format(_("%d subvolume actions (<a href=\"%s\">hide details</a>)"), actions.size, event)
        list = html_list(actions_to_items(actions))
        [header, list]
      end
    end

    def general_actions
      return [] if actiongraph.nil?

      actions = actiongraph.compound_actions.reject { |a| a.device_is?(:btrfs_subvolume) }
      sort_actions(actions)
    end

    def subvolume_actions
      return [] if actiongraph.nil?

      actions = actiongraph.compound_actions.select { |a| a.device_is?(:btrfs_subvolume) }
      sort_actions(actions)
    end

    def sort_actions(actions)
      delete, other = actions.partition(&:delete?)
      delete.concat(other)
    end

    def actions_to_items(actions)
      actions.map { |a| action_to_item(a) }
    end

    def action_to_item(action)
      action.delete? ? Yast::HTML.Bold(action.sentence) : action.sentence
    end

    def actions_to_text(actions)
      actions.map(&:sentence)
    end

    def html_list(items)
      Yast::HTML.List(items)
    end
  end
end

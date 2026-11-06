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

require "yast"
require "y2storage/equal_by_instance_variables"
require "y2storage/space_actions"

module Y2Storage
  # Class to encapsulate all the GuidedProposal settings related to the process of making space
  # to allocate the new operating system
  class ProposalSpaceSettings
    include EqualByInstanceVariables

    # @see .delete_modes
    # TODO: enum?
    DELETE_MODES = [:none, :all, :ondemand].freeze
    private_constant :DELETE_MODES

    # @return [Array<String>] list of possible delete strategies
    def self.delete_modes
      DELETE_MODES
    end

    # Strategy followed to calculate the actions executed while making space and to
    # decide in which order execute those actions.
    #
    #   - :auto is the traditional YaST approach. The actions and the moment to execute them are
    #     auto-calculated based on settings like {#resize_windows}, {#windows_delete_mode},
    #     {#linux_delete_mode} and {#other_delete_mode}.
    #   - :bigger_resize uses the actions from {#actions}, executing the optional actions in a
    #     simple order. First it executes the resize actions (sorted by "recoverable" size) and
    #     then the more destructive ones.
    #
    # @return [Symbol] :auto is the default
    attr_accessor :strategy

    # @return [Boolean] whether to resize Windows systems if needed
    attr_accessor :resize_windows

    # What to do regarding removal of existing partitions hosting a Windows system.
    #
    # Options:
    #
    # * :none Never delete a Windows partition.
    # * :ondemand Delete Windows partitions as needed by the proposal.
    # * :all Delete all Windows partitions, even if not needed.
    #
    # @raise ArgumentError if any other value is assigned
    #
    # @return [Symbol]
    attr_accessor :windows_delete_mode

    # @return [Symbol] what to do regarding removal of existing Linux
    #   partitions. See {DiskAnalyzer} for the definition of "Linux partitions".
    #   @see #windows_delete_mode for the possible values and exceptions
    attr_accessor :linux_delete_mode

    # @return [Symbol] what to do regarding removal of existing partitions that
    #   don't fit in #windows_delete_mode or #linux_delete_mode.
    #   @see #windows_delete_mode for the possible values and exceptions
    attr_accessor :other_delete_mode

    # Whether the delete mode of the partitions and the resize option for windows can be
    # configured. When this option is set to `false`, the {#windows_delete_mode}, {#linux_delete_mode},
    # {#other_delete_mode} and {#resize_windows} options cannot be modified by the user.
    #
    # @return [Boolean]
    attr_accessor :delete_resize_configurable

    # What to do with existing partitions if they are involved in the process of making space.
    #
    # Entries for devices that are not involved in the proposal are ignored. For example, if all
    # the volumes are configured to be placed at /dev/sda but there is an entry like
    # Delete<device: "/dev/sdb1", mandatory: true>, the corresponding /dev/sdb1 partition will NOT
    # be deleted because there is no reason for the proposal to process the disk /dev/sdb.
    #
    # Device names corresponding to extended partitions are also ignored. The storage proposal only
    # considers actions for primary and logical partitions.
    #
    # @return [Array<SpaceActions::Base>]
    attr_accessor :actions

    def initialize
      @strategy = :auto
      @actions = []
    end

    # Whether the settings disable deletion of a given type of partitions
    #
    # @see #windows_delete_mode
    # @see #linux_delete_mode
    # @see #other_delete_mode
    #
    # @param type [#to_s] :linux, :windows or :other
    # @return [Boolean]
    def delete_forbidden(type)
      send(:"#{type}_delete_mode") == :none
    end

    alias_method :delete_forbidden?, :delete_forbidden

    # Whether the settings enforce deletion of a given type of partitions
    #
    # @see #windows_delete_mode
    # @see #linux_delete_mode
    # @see #other_delete_mode
    #
    # @param type [#to_s] :linux, :windows or :other
    # @return [Boolean]
    def delete_forced(type)
      send(:"#{type}_delete_mode") == :all
    end

    alias_method :delete_forced?, :delete_forced

    # All delete actions
    #
    # @see #actions
    #
    # @return [Array<SpaceActions::Delete>]
    def delete_actions
      actions.select { |a| a.is?(:delete) }
    end

    # All resize actions
    #
    # @see #actions
    #
    # @return [Array<SpaceActions::Resize>]
    def resize_actions
      actions.select { |a| a.is?(:resize) }
    end
  end
end

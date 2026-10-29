# Copyright (c) [2015-2019] SUSE LLC
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
require "y2storage/blk_device"
require "securerandom"

module Y2Storage
  module Planned
    # Abstract base class for the different devices templates in the
    # Planned namespace.
    #
    # Most classes in the {Planned} namespace represent an specification
    # of a given device that must be created in a devicegraph (thus, finally in
    # the system) by the storage proposal or by AutoYaST. That specification is,
    # of course, less concrete than the real device object.
    #
    # Those templates clases inherit from this and implement most of the
    # functionality and properties by composition, including several of the
    # mixins defined in the {Planned} namespace.
    #
    # FIXME: having separate setters for reuse_name and reuse_sid is dangerous
    # and makes some parts of the code cumbersome.
    # We need to fix this class to ensure they are in sync but adapting the mocks in
    # the test cases was too much work.
    class Device
      include Yast::Logger

      # @return [String] device name of an existing device to reuse for this
      #   purpose. As a result, some of the others attributes could be ignored.
      attr_accessor :reuse_name

      # @return [Integer] storage id of an existing device to reuse for this
      #   purpose. As a result, some of the others attributes could be ignored.
      #
      # @note This attribute is preferred over {reuse_name}.
      attr_accessor :reuse_sid

      # @return [String] planned device identifier. Planned devices are cloned/modified
      #   when calculating the proposal. This identifier allows to identify if two planned
      #   devices are related.
      attr_reader :planned_id

      def initialize
        @planned_id = SecureRandom.uuid
      end

      def to_s
        attrs = self.class.to_string_attrs.map do |attr|
          value = send(attr)
          value = "nil" if value.nil?
          "#{attr}=#{value}"
        end
        "#<#{self.class} " + attrs.join(", ") + ">"
      end

      def ==(other)
        other.class == self.class && other.internal_state == internal_state
      end

      # Attributes to display in {#to_s}
      #
      # This method is expected to be redefined in the subclasses
      #
      # @return [Array<Symbol>]
      def self.to_string_attrs
        [:reuse_name, :reuse_sid]
      end

      # Returns the (possibly processed) device to be used for the planned
      # device.
      #
      # FIXME: temporary API. It should be improved.
      def final_device!(plain_device)
        plain_device.encrypted? ? plain_device.encryption : plain_device
      end

      # Finds the device to reuse and sets its properties to match the planned device.
      #
      # @param devicegraph [Devicegraph] Device graph to adjust
      def reuse!(devicegraph)
        device = device_to_reuse(devicegraph)
        return unless device

        log.info "Reusing sid #{reuse_sid} (#{reuse_name}) (#{device.inspect}) for #{self}"
        reuse_device!(device)
      end

      # Whether this planned device is expected to reuse an existing one
      def reuse?
        !(reuse_name.nil? || reuse_name.empty?) || !reuse_sid.nil?
      end

      # Sets both #reuse_sid and #reuse_name according to the given device
      #
      # The description of the class states that having separate setters for both attributes
      # is unwanted but hard to fix. This method helps to overcome that problem.
      #
      # @param device [Y2Storage::Device]
      def assign_reuse(device)
        @reuse_sid = device.sid
        @reuse_name = device.name if device.respond_to?(:name)
      end

      # Determines whether the device is used as part of another device (VG, MD, Bcache, Btrfs, etc)
      #
      # This method is implemented by each mixin (e.g., CanBePv, CanBeMdMember, etc).
      #
      # @return [Boolean]
      def component?
        false
      end

      protected

      # @see reuse!
      #
      # Derived classed must define this method.
      #
      # @param _device [Device]
      def reuse_device!(_device)
        nil
      end

      def device_to_reuse(devicegraph)
        return nil unless reuse?

        device = devicegraph.find_device(reuse_sid) if reuse_sid
        device ||= BlkDevice.find_by_name(devicegraph, reuse_name)

        if device
          log.info "reused: sid #{device.sid} (#{reuse_name})"
        else
          log.info "reused device not found: sid #{reuse_sid} (#{reuse_name})"
        end

        device
      end

      def internal_state
        instance_variables.sort.map { |v| instance_variable_get(v) }
      end
    end
  end
end

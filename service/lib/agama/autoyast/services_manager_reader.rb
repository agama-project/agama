# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
  module AutoYaST
    # Converts AutoYaST's <services-manager> section into post-install script(s). See the
    # ScriptsReader for further details.
    #
    # Conversion is not done in one-to-one manner. Several services are currently joined into one
    # post script.
    class ServicesManagerReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash with list of post-install script(s).
      #
      # @return [Array] list of scripts. See Agama scripts definition
      def read
        return [] if services_section.empty?

        [script([
          target_to_cmd,
          disabled_to_cmd,
          enabled_to_cmd,
          ondemand_to_cmd
        ].compact.join("\n"))]
      end

    private

      attr_reader :profile

      SYSTEMD_VALID_TARGETS = ["graphical", "multi-user"].freeze

      def services_manager_section
        @services_manager_section ||= profile.fetch("services-manager", {})
      end

      def services_section
        @services_section ||= services_manager_section.fetch("services", {})
      end

      def disabled_services
        services_section.fetch("disable", [])
      end

      def enabled_services
        services_section.fetch("enable", [])
      end

      def ondemand_services
        services_section.fetch("on_demand", [])
      end

      def script(body)
        return nil if body.nil? || body.empty?

        {
          "name"    => "agama-services-manager",
          "chroot"  => true,
          "content" => "#!/bin/bash\n#{body}"
        }
      end

      def target_to_cmd
        target = services_manager_section["default_target"].to_s
        return unless SYSTEMD_VALID_TARGETS.include?(target)

        "systemctl set-default #{target}.target"
      end

      def disabled_to_cmd
        disabled_services.map do |service|
          "systemctl disable #{service}"
        end.join("\n")
      end

      def enabled_to_cmd
        enabled_services.map do |service|
          "systemctl enable #{service}"
        end.join("\n")
      end

      def ondemand_to_cmd
        ondemand_services.map do |service|
          "systemctl enable #{service}.socket"
        end.join("\n")
      end
    end
  end
end

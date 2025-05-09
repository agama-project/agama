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

require "yast"
Yast.import "URL"

# :nodoc:
module Agama
  module AutoYaST
    # Converts AutoYaST's <services-manager> section into post-install script(s). See the
    # ScriptsReader for a details.
    #
    # Conversion is not done in one-to-one manner. Several services can be joined into one
    # post script.
    class ServicesManagerReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
        @index = 0
      end

      # Returns a hash with list of post-install script(s).
      #
      # @return [Array] list of scripts. See Agama scripts definition
      def read
        return [] if services_section.empty?

        # 1) create "post" => [... list of hashes defining a scipt ...]"
        # 2) each script has to contain name ("randomized/indexed" one or e.g. based on service
        #    name) and chroot option
        # 3) script body is one or two lines per service, particular command depends on AY's service
        #    type
        [
          script(target_to_cmd),
          script(disabled_to_cmd),
          script(enabled_to_cmd),
          script(ondemand_to_cmd)
        ].compact
      end

    private

      attr_reader :profile

      SYSTEMD_MULTIUSER_TARGET = "systemctl set-default multi-user.target"
      SYSTEMD_GRAPHICAL_TARGET = "systemctl set-default graphical.target"

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

        @index += 1

        {
          "name"    => "agama-services-manager-#{@index}",
          "chroot"  => true,
          "content" => "#!/bin/bash\n#{body}"
        }
      end

      def target_to_cmd
        # May we raise an exception if nothing matches?
        case services_manager_section["default_target"]
        when "muti_user"
          SYSTEMD_MULTIUSER_TARGET
        when "graphical"
          SYSTEMD_GRAPHICAL_TARGET
        end
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

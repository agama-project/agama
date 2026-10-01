# Copyright (c) [2020] SUSE LLC
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

# Vendored from yast-autoyast2's autoinstallation/src/lib/autoinstall/entries/description.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.

module Y2Autoinstallation
  # Entries module represents code related to manipulation with implementation
  # that handles each section of autoyast profile. Originally known as
  # Modules or ModuleConfig which is not used to avoid confusion with over
  # using module name.
  module Entries
    # Represents single entry description. It is stored in desktop files.
    class Description
      # Values used in this class. It is needed to pass it to Desktop.Read.
      USED_VALUES = [
        "X-SuSE-YaST-AutoInstResource",
        "X-SuSE-YaST-AutoInstResourceAliases",
        "X-SuSE-YaST-AutoInstMerge",
        "X-SuSE-YaST-AutoInstClonable",
        "X-SuSE-YaST-AutoInstClient",
        "X-SuSE-YaST-AutoInstRequires",
        "X-SuSE-YaST-AutoInst",
        "X-SuSE-DocTeamID",
        "X-SuSE-YaST-Group",
        "Hidden",
        "Icon",
        "Name"
      ].freeze

      # creates new description with values passed
      # @param values[Hash] hash from Desktop.Modules
      def initialize(values, fallback_name)
        @values = values
        @fallback_name = fallback_name
      end

      def name
        values["Name"]
      end

      def mode
        values["X-SuSE-YaST-AutoInst"]
      end

      # section name for single section entries
      def resource_name
        values["X-SuSE-YaST-AutoInstResource"] || module_name
      end

      # module name used e.g. in desktop file name
      def module_name
        @fallback_name
      end

      def aliases
        val = values["X-SuSE-YaST-AutoInstResourceAliases"]
        return [] unless val

        val.split(",").map(&:strip)
      end

      # which autoyast profile sections are managed by this entry
      # Example of multiple ones is users which manager users and groups keys.
      def managed_keys
        multiple = values["X-SuSE-YaST-AutoInstMerge"]
        if multiple
          multiple.split(",").map(&:strip)
        else
          [resource_name]
        end
      end

      ALWAYS_CLONABLE_MODULES = ["software", "partitioning", "bootloader"].freeze
      private_constant :ALWAYS_CLONABLE_MODULES

      def clonable?
        values["X-SuSE-YaST-AutoInstClonable"] == "true" ||
          ALWAYS_CLONABLE_MODULES.include?(resource_name)
      end

      def client_name
        values["X-SuSE-YaST-AutoInstClient"] || (module_name + "_auto")
      end

      def hidden?
        values["Hidden"] == "true"
      end

      def group
        values["X-SuSE-YaST-Group"]
      end

      def icon
        values["Icon"]
      end

      # @return [Array<String>] list of description {#module_name} which needs
      #   to run before this description
      def required_modules
        (values["X-SuSE-YaST-AutoInstRequires"] || "").split(",").map(&:strip)
      end

      def translated_name
        desktop_file = (values["X-SuSE-DocTeamID"] || "")[4..-1] || ""
        string_to_translate = "Name(#{desktop_file}.desktop): #{name}"
        # TODO: it is builtins but we do not have alternative for such call.
        # Maybe having it in Yast::I18n directly?
        result = Yast::Builtins.dpgettext(
          "desktop_translations", "/usr/share/locale", string_to_translate
        )
        result = name if result == string_to_translate
        result
      end

    private

      attr_reader :values
    end
  end
end

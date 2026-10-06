# ***************************************************************************
#
# Copyright (c) 2002 - 2014 Novell, Inc.
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
# File:  modules/ProductFetures.ycp
# Package:  installation
# Summary:  Product features
# Authors:  Anas Nashif <nashif@suse.de>
#              Jiri Srain <jsrain@suse.cz>
#
# $Id$
require "yast"

module Yast
  class ProductFeaturesClass < Module
    def main
      textdomain "base"

      Yast.import "Misc"
      Yast.import "Mode"
      Yast.import "Stage"

      # Map of all features
      # See defaults map below for sample contents
      @features = nil

      # See SetOverlay and ClearOverlay
      @backup_features = nil

      # Default values for features
      # two-level map, section_name -> [ feature -> value ]
      @defaults = {
        "globals"                  => {
          "additional_kernel_parameters"    => "",
          # FATE #304865
          "base_product_license_directory"  => "/usr/share/licenses/product/base/",
          # jsc#SLE-22667
          "boot_timeout"                    => 8,
          "default_target"                  => "",
          "disable_os_prober"               => false,
          "enable_autologin"                => true,
          "enable_clone"                    => false,
          "enable_firewall"                 => true,
          "enable_local_users"              => true,
          "enable_sshd"                     => false,
          "fam_local_only"                  => "never",
          "firewall_enable_ssh"             => false,
          "flags"                           => [],
          "full_system_download_url"        => "",
          "full_system_media_name"          => "",
          "incomplete_translation_treshold" => "95",
          "keyboard"                        => "",
          "language"                        => "",
          "propose_hibernation"             => true,
          "relnotesurl"                     => "",
          "run_you"                         => true,
          "save_y2logs"                     => true,
          "skip_language_dialog"            => false,
          "timezone"                        => "",
          "ui_mode"                         => "expert",
          "vendor_url"                      => ""
        },
        "partitioning"             => {
          "use_flexible_partitioning"    => false,
          "flexible_partitioning"        => {},
          "vm_keep_unpartitioned_region" => false
        },
        "software"                 => {
          "software_proposal"                    => "selection",
          "selection_type"                       => :auto,
          "delete_old_packages"                  => true,
          "only_update_installed"                => false,
          "packages_transmogrify"                => "",
          "base_selection"                       => "",
          "packages"                             => [],
          "kernel_packages"                      => [],
          "addon_selections"                     => [],
          "inform_about_suboptimal_distribution" => false
        },
        "network"                  => { "force_static_ip" => false },
        # Defaults are defined in the ConfigurationManagement::Configurations classes:
        # https://github.com/yast/yast-configuration-management/blob/27c93ba9d592271a299706aca323d9d371d44058/src/lib/configuration_management/configurations/base.rb#L13
        "configuration_management" => {}
      }
    end

    # Initialize default values of features
    # @param [Boolean] force boolean drop all settings which were set before
    def InitFeatures(force)
      return if @features && !force

      @features = deep_copy(@defaults)

      nil
    end

    # Set a feature section
    # Default values will be used where value not defined
    # @note This is a stable API function
    # @param section name string the name of the section
    # @param [Hash{String => Object}] section_map a map containing data of the section
    def SetSection(section_name, section_map)
      section_map = deep_copy(section_map)
      InitFeatures(false)
      Builtins.y2debug("Setting section: %1", section_name)
      section_map = Convert.convert(
        Builtins.union(Ops.get(@defaults, section_name, {}), section_map),
        from: "map",
        to:   "map <string, any>"
      )
      Ops.set(@features, section_name, section_map)

      nil
    end

    # Get a complete section for evaluation
    # @note This is a stable API function
    # @param [String] section_name string name of the section
    # @return a map key->value, options in the section
    def GetSection(section_name)
      InitFeatures(false)
      Ops.get(@features, section_name, {})
    end

    # Save product features
    # @note This is a stable API function
    def Save
      InitFeatures(false)
      if Mode.update # in case of update old file has different format
        SCR.Execute(
          path(".target.bash"),
          "test -f /etc/YaST2/ProductFeatures && /bin/rm /etc/YaST2/ProductFeatures"
        )
      end
      Builtins.foreach(@features) do |group, options|
        Builtins.foreach(options) do |key, value|
          if Ops.is_map?(value) || Ops.is_list?(value) || Ops.is_symbol?(value)
            Builtins.y2debug("Skipping option %1", key)
          else
            strval = GetStringFeature(group, key)
            SCR.Write(
              Ops.add(Ops.add(path(".product.features.value"), group), key),
              strval
            )
          end
        end
      end
      SCR.Write(path(".product.features"), nil) # flush

      nil
    end

    # Restore product features in running system
    # @note This is a stable API function
    def Restore
      InitFeatures(false)

      groups = SCR.Dir(path(".product.features.section"))
      Builtins.foreach(groups) do |group|
        Ops.set(@features, group, Ops.get(@features, group, {}))
        values = SCR.Dir(Ops.add(path(".product.features.value"), group))
        Builtins.foreach(values) do |v|
          Ops.set(
            @features,
            [group, v],
            SCR.Read(
              Ops.add(Ops.add(path(".product.features.value"), group), v)
            )
          )
        end
      end

      nil
    end

    # Initialize the features structure if needed
    #
    # @note The values are normally read from a control file or set to default values. But, in normal
    # mode, the values are taken from /etc/YaST2/ProductFeatures. Also note that for firstboot mode, the
    # values are taken from the firstboot.xml control file.
    #
    # @note This is a stable API function
    def InitIfNeeded
      if Stage.normal
        Restore()
      else
        InitFeatures(false)
      end

      nil
    end

    # Get value of a feature
    # @note This is a stable API function
    # @param [String] section string section of the feature
    # @param features string feature name
    # @return [Object] the feature value, "" if not found
    def GetFeature(section, feature)
      InitIfNeeded()
      ret = Ops.get(@features, [section, feature])
      ret = "" if ret.nil?
      deep_copy(ret)
    end

    # Get value of a feature
    # @note This is a stable API function
    # @param [String] section string section of the feature
    # @param features string feature name
    # @return [String] the feature value, "" if not found
    def GetStringFeature(section, feature)
      value = GetFeature(section, feature)

      case value
      when ::String
        value
      when true, false
        value ? "yes" : "no"
      else
        Builtins.sformat("%1", value)
      end
    end

    # Get value of a feature
    # If the feature is missing `false` is returned. So it is not possible to
    # distingush between a missing value and a false value.
    # @note This is a stable API function
    # @param [String] section string section of the feature
    # @param features string feature name
    # @return [Boolean] the feature value
    def GetBooleanFeature(section, feature)
      value = GetFeature(section, feature)
      return value if Ops.is_boolean?(value)

      Ops.is_string?(value) && Builtins.tolower(Convert.to_string(value)) == "yes"
    end

    # Get value of a boolean feature with a fallback value.
    #
    # @note This is a stable API function
    # @param [String] section string section of the feature
    # @param [String] feature feature name
    # @param [Boolean] fallback
    #
    # @return [Boolean] the feature value or fallback if not specified
    def GetBooleanFeatureWithFallback(section, feature, fallback)
      value = GetFeature(section, feature)
      return fallback if value.nil?
      return value if Ops.is_boolean?(value)

      if value.respond_to?(:downcase)
        return true  if ["yes", "true"].include?(value.downcase)
        return false if ["no", "false"].include?(value.downcase)
      end

      fallback
    end

    # Get value of a feature
    # @note This is a stable API function
    # @param [String] section string section of the feature
    # @param features string feature name
    # @return [Fixnum] the feature value, nil if not found
    def GetIntegerFeature(section, feature)
      value = GetFeature(section, feature)
      if Ops.is_integer?(value)
        value
      elsif Ops.is_string?(value)
        Builtins.tointeger(Convert.to_string(value))
      end
    end

    # Set value of a feature
    # @note This is a stable API function
    # @param [String] section string section of the feature
    # @param features string feature name
    # @param [Object] value any the feature value
    def SetFeature(section, feature, value)
      value = deep_copy(value)
      InitIfNeeded()
      Ops.set(@features, section, {}) if !Builtins.haskey(@features, section)
      Ops.set(@features, [section, feature], value)

      nil
    end

    # Set value of a feature
    # @note This is a stable API function
    # @param [String] section string section of the feature
    # @param features string feature name
    # @param [String] value string the feature value
    def SetStringFeature(section, feature, value)
      SetFeature(section, feature, value)

      nil
    end

    # Set value of a feature
    # @note This is a stable API function
    # @param [String] section string section of the feature
    # @param features string feature name
    # @param [Boolean] value boolean the feature value
    def SetBooleanFeature(section, feature, value)
      SetFeature(section, feature, value)

      nil
    end

    # Set value of a feature
    # @note This is a stable API function
    # @param [String] section string section of the feature
    # @param features string feature name
    # @param [Fixnum] value integer the feature value
    def SetIntegerFeature(section, feature, value)
      SetFeature(section, feature, value)

      nil
    end

    # Exports the current set of ProductFeatures
    #
    # @return [Hash <String, Hash{String => Object>}] features
    def Export
      deep_copy(@features)
    end

    # Imports product features
    #
    # @param map <string, map <string, any> > features
    def Import(import_settings)
      @features = deep_copy(import_settings)

      nil
    end

    # Overlay, or override, some features.
    # The intended use is to use SetOverlay to apply some features
    # specified by a system role (FATE#317481).
    # Clear would be called only when coming Back
    # to the role selection dialog (and then SetOverlay with a different one)
    # @param features [Hash{String => Hash{String => Object}}] in the same
    #   format as `@features` or `@defaults`
    # @return void
    # @raise RuntimeError if called twice without {ClearOverlay}
    def SetOverlay(features)
      raise "SetOverlay called when old overlay was not cleared" if @backup_features

      @backup_features = deep_copy(@features)

      features.each do |section_name, section|
        section.each do |k, v|
          SetFeature(section_name, k, v)
        end
      end
    end

    # Remove a `@features` overlay; does nothing if SetOverlay was never called.
    # @see SetOverlay
    # @return void
    def ClearOverlay
      return if @backup_features.nil?

      @features = deep_copy(@backup_features)
      # when overlay is cleared, remove backup as it can become invalid over-time
      # when new extensions is applied
      @backup_features = nil
    end

    publish function: :GetStringFeature, type: "string (string, string)"
    publish function: :SetSection, type: "void (string, map <string, any>)"
    publish function: :GetSection, type: "map <string, any> (string)"
    publish function: :Save, type: "void ()"
    publish function: :Restore, type: "void ()"
    publish function: :InitIfNeeded, type: "void ()"
    publish function: :GetFeature, type: "any (string, string)"
    publish function: :GetBooleanFeature, type: "boolean (string, string)"
    publish function: :GetBooleanFeatureWithFallback, type: "boolean (string, string, boolean)"
    publish function: :GetIntegerFeature, type: "integer (string, string)"
    publish function: :SetFeature, type: "void (string, string, any)"
    publish function: :SetStringFeature, type: "void (string, string, string)"
    publish function: :SetBooleanFeature, type: "void (string, string, boolean)"
    publish function: :SetIntegerFeature, type: "void (string, string, integer)"
    publish function: :Export, type: "map <string, map <string, any>> ()"
    publish function: :Import, type: "void (map <string, map <string, any>>)"
  end

  ProductFeatures = ProductFeaturesClass.new
  ProductFeatures.main
end

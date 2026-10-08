# File:  modules/Profile.ycp
# Module:  Auto-Installation
# Summary:  Profile handling
# Authors:  Anas Nashif <nashif@suse.de>
#
# $Id$
#
# Vendored from yast-autoyast2's autoinstallation/src/modules/Profile.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.
require "yast"
require "yast2/popup"

require "autoinstall/entries/registry"
require "ui/password_dialog"

module Yast
  # Wrapper class around Hash to hold the autoyast profile.
  #
  # Rationale:
  #
  # The profile parser returns an empty String for empty elements like
  # <foo/> - and not nil. This breaks the code assumption that you can write
  # xxx.fetch("foo", {}) in a lot of code locations.
  #
  # To make access to profile elements easier this class provides methods
  # #fetch_as_hash and #fetch_as_array that check the expected type and
  # return the default value also if there is a type mismatch.
  #
  # See bsc#1180968 for more details.
  #
  # The class constructor converts an existing Hash to a ProfileHash.
  #
  class ProfileHash < Hash
    include Yast::Logger

    # Replace Hash -> ProfileHash recursively.
    def initialize(default = {})
      super()

      default.each_pair do |key, value|
        self[key] = value.is_a?(Hash) ? ProfileHash.new(value) : value
      end
    end

    # Read element from ProfileHash.
    #
    # @param key [String] the key
    # @param default [Hash] default value - returned if element does not exist or has wrong type
    #
    # @return [ProfileHash]
    def fetch_as_hash(key, default = {})
      fetch_as(key, Hash, default)
    end

    # Read element from ProfileHash.
    #
    # @param key [String] the key
    # @param default [Array] default value - returned if element does not exist or has wrong type
    #
    # @return [Array]
    def fetch_as_array(key, default = [])
      fetch_as(key, Array, default)
    end

  private

    # With an explicit default it's possible to check for the presence of an
    # element vs. empty element, if needed.
    def fetch_as(key, type, default = nil)
      tmp = fetch(key, nil)
      if !tmp.is_a?(type)
        f = caller_locations(2, 1).first
        if !tmp.nil?
          log.warn "AutoYaST profile type mismatch (from #{f}): " \
                   "#{key}: expected #{type}, got #{tmp.class}"
        end
        tmp = default.is_a?(Hash) ? ProfileHash.new(default) : default
      end
      tmp
    end
  end

  class ProfileClass < Module
    include Yast::Logger

    def main
      Yast.import "UI"
      textdomain "autoinst"

      Yast.import "AutoinstConfig"
      Yast.import "GPG"
      Yast.import "Stage"
      Yast.import "XML"

      Yast.include self, "autoinstall/xml.rb"

      # The Complete current Profile
      @current = Yast::ProfileHash.new

      Profile()
    end

    # Constructor
    # @return [void]
    def Profile
      #
      # setup profile XML parameters for writing
      #
      profileSetup
      SCR.Execute(path(".target.mkdir"), AutoinstConfig.profile_dir) if Stage.initial
      nil
    end

    def softwareCompat
      @current["software"] = @current.fetch_as_hash("software")

      # workaround for missing "REQUIRES" in content file to stay backward compatible
      # FIXME: needs a more sophisticated or compatibility breaking solution after SLES11
      patterns = @current["software"].fetch_as_array("patterns")
      patterns = ["base"] if patterns.empty?
      @current["software"]["patterns"] = patterns

      nil
    end

    # compatibility to new language,keyboard and timezone client in 10.1
    def generalCompat
      if Builtins.haskey(@current, "general")
        if Builtins.haskey(Ops.get_map(@current, "general", {}), "keyboard")
          Ops.set(
            @current,
            "keyboard",
            Ops.get_map(@current, ["general", "keyboard"], {})
          )
          Ops.set(
            @current,
            "general",
            Builtins.remove(Ops.get_map(@current, "general", {}), "keyboard")
          )
        end
        if Builtins.haskey(Ops.get_map(@current, "general", {}), "language")
          Ops.set(
            @current,
            "language",
            "language" => Ops.get_string(
              @current,
              ["general", "language"],
              ""
            )
          )
          Ops.set(
            @current,
            "general",
            Builtins.remove(Ops.get_map(@current, "general", {}), "language")
          )
        end
        if Builtins.haskey(Ops.get_map(@current, "general", {}), "clock")
          Ops.set(
            @current,
            "timezone",
            Ops.get_map(@current, ["general", "clock"], {})
          )
          Ops.set(
            @current,
            "general",
            Builtins.remove(Ops.get_map(@current, "general", {}), "clock")
          )
        end
        if Ops.get_boolean(@current, ["general", "mode", "final_halt"], false) &&
            !Ops.get_list(@current, ["scripts", "init-scripts"], []).include?(HALT_SCRIPT)

          Ops.set(@current, "scripts", {}) if !Builtins.haskey(@current, "scripts")
          if !Builtins.haskey(
            Ops.get_map(@current, "scripts", {}),
            "init-scripts"
          )
            Ops.set(@current, ["scripts", "init-scripts"], [])
          end
          Ops.set(
            @current,
            ["scripts", "init-scripts"],
            Builtins.add(
              Ops.get_list(@current, ["scripts", "init-scripts"], []),
              HALT_SCRIPT
            )
          )
        end
        if Ops.get_boolean(@current, ["general", "mode", "final_reboot"], false) &&
            !Ops.get_list(@current, ["scripts", "init-scripts"], []).include?(REBOOT_SCRIPT)

          Ops.set(@current, "scripts", {}) if !Builtins.haskey(@current, "scripts")
          if !Builtins.haskey(
            Ops.get_map(@current, "scripts", {}),
            "init-scripts"
          )
            Ops.set(@current, ["scripts", "init-scripts"], [])
          end
          Ops.set(
            @current,
            ["scripts", "init-scripts"],
            Builtins.add(
              Ops.get_list(@current, ["scripts", "init-scripts"], []),
              REBOOT_SCRIPT
            )
          )
        end
        if Builtins.haskey(
          Ops.get_map(@current, "software", {}),
          "additional_locales"
        )
          Ops.set(@current, "language", {}) if !Builtins.haskey(@current, "language")
          Ops.set(
            @current,
            ["language", "languages"],
            Builtins.mergestring(
              Ops.get_list(@current, ["software", "additional_locales"], []),
              ","
            )
          )
          Ops.set(
            @current,
            "software",
            Builtins.remove(
              Ops.get_map(@current, "software", {}),
              "additional_locales"
            )
          )
        end
      end

      nil
    end

    # Read Profile properties and Version
    # @param properties [ProfileHash] Profile Properties
    # @return [void]
    def check_version(properties)
      version = properties["version"]
      if version == "3.0"
        log.info("AutoYaST Profile Version #{version} detected.")
      else
        log.info("Wrong profile version #{version}")
      end
    end

    # Import Profile
    # @param [Hash{String => Object}] profile
    # @return [void]
    def Import(profile)
      log.info("importing profile")

      profile = deep_copy(profile)
      @current = Yast::ProfileHash.new(profile)

      check_version(@current.fetch_as_hash("properties"))

      # old style
      if Builtins.haskey(profile, "configure") ||
          Builtins.haskey(profile, "install")
        configure = Ops.get_map(profile, "configure", {})
        install = Ops.get_map(profile, "install", {})
        @current = Builtins.remove(@current, "configure") if Builtins.haskey(profile, "configure")
        @current = Builtins.remove(@current, "install") if Builtins.haskey(profile, "install")
        tmp = Convert.convert(
          Builtins.union(configure, install),
          from: "map",
          to:   "map <string, any>"
        )
        @current = Convert.convert(
          Builtins.union(tmp, @current),
          from: "map",
          to:   "map <string, any>"
        )
      end

      merge_resource_aliases!
      generalCompat # compatibility to new language,keyboard and timezone (SL10.1)
      @current = Yast::ProfileHash.new(@current)
      softwareCompat
      log.info "Current Profile = #{@current}"

      nil
    end

    # Read XML into  YCP data
    # @param file [String] path to file
    # @return [Boolean]
    def ReadXML(file)
      if GPG.encrypted_symmetric?(file)
        AutoinstConfig.ProfileEncrypted = true
        label = _("Encrypted AutoYaST profile.")

        begin
          if AutoinstConfig.ProfilePassword.empty?
            pwd = ::UI::PasswordDialog.new(label).run
            return false unless pwd
          else
            pwd = AutoinstConfig.ProfilePassword
          end

          content = GPG.decrypt_symmetric(file, pwd)
          AutoinstConfig.ProfilePassword = pwd
        rescue GPGFailed => e
          res = Yast2::Popup.show(_("Decryption of profile failed."),
            details: e.message, headline: :error, buttons: :continue_cancel)
          if res == :continue
            retry
          else
            return false
          end
        end
      else
        content = File.read(file)
      end
      @current = XML.XMLToYCPString(content)

      # FIXME: rethink and check for sanity of that!
      # save decrypted profile for modifying pre-scripts
      if Stage.initial
        SCR.Write(
          path(".target.string"),
          file,
          content
        )
      end

      Import(@current)
      true
    rescue Yast::XMLDeserializationError => e
      # autoyast has read the autoyast configuration file but something went wrong
      message = _(
        "The XML parser reported an error while parsing the autoyast profile. " \
        "The error message is:\n"
      )
      message += e.message
      log.info "xml parsing error #{e.inspect}"
      Yast2::Popup.show(message, headline: :error)
      false
    end

    # @!attribute current
    #   @return [Hash<String, Object>] current working profile
    publish variable: :current, type: "map <string, any>"
    publish function: :Import, type: "void (map <string, any>)"
    publish function: :ReadXML, type: "boolean (string)"

  private

    REBOOT_SCRIPT = {
      "filename" => "zzz_reboot",
      "source"   => "shutdown -r now"
    }.freeze

    HALT_SCRIPT = {
      "filename" => "zzz_halt",
      "source"   => "shutdown -h now"
    }.freeze

  protected

    # Merge resource aliases in the profile
    #
    # When a resource is aliased, the configuration with the aliased name will
    # be renamed to the new name. For example, if we have a
    # services-manager.desktop file containing
    # X-SuSE-YaST-AutoInstResourceAliases=runlevel, if a "runlevel" key is found
    # in the profile, it will be renamed to "services-manager".
    #
    # The rename won't take place if a "services-manager" resource already exists.
    #
    # @see merge_aliases_map
    def merge_resource_aliases!
      reg = Y2Autoinstallation::Entries::Registry.instance
      alias_map = reg.descriptions.each_with_object({}) do |d, r|
        d.aliases.each { |a| r[a] = d.resource_name || d.name }
      end
      alias_map.each do |alias_name, resource_name|
        aliased_config = current.delete(alias_name)
        next if aliased_config.nil? || current.key?(resource_name)

        current[resource_name] = aliased_config
      end
    end
  end

  Profile = ProfileClass.new
  Profile.main
end

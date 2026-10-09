# Vendored from yast-autoyast2's autoinstallation/src/modules/AutoinstScripts.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.

require "yast"

require "autoinstall/script"

module Yast
  # Module responsible for autoyast scripts support.
  # See Autoyast Guide Scripts section for user documentation and some parameters explanation.
  # https://doc.opensuse.org/projects/autoyast/#createprofile-scripts
  #
  # ### Scripts WorkFlow
  # Each script type is executed from different place. Below is described each one. Execution is
  # done by calling {Yast::AutoinstScriptsClass#Write} unless mentioned differently.
  #
  # #### Pre Scripts
  # Runs before any other actions in autoyast and is executed from inst_autosetup client
  # {Yast::InstAutosetupClient}
  #
  # #### Chroot Scripts
  # Runs before installation chroot or after chroot depending on chrooted parameter.
  # The first non-chrooted variant is called from {Yast::AutoinstScripts1FinishClient}.
  # The second chrooted variant is called from {Yast::AutoinstScripts2FinishClient}.
  #
  # #### Post Scripts
  # Runs after finish of second stage. It is downloaded from {Yast::AutoinstScripts2FinishClient}.
  # Then it is executed by {Yast::InstAutoconfigureClient}.
  #
  # #### Init Scripts
  # Runs after finish of second stage. It is created at {Yast::AutoinstScripts2FinishClient} and
  # also during second stage at {Yast::InstAutoconfigureClient}. TODO: why twice?
  # Then it is executed from systemd service autoyast-initscripts.service which lives in scripts
  # directory.
  #
  # #### Post Partitioning Scripts
  # Runs after partitioning from {Yast::InstKickoffClient}
  #

  require "autoinstall/script_runner"

  class AutoinstScriptsClass < Module
    include Yast::Logger

    # list of all scripts
    # @return [Array<Y2Autoinstallation::Script>]
    attr_reader :scripts

    def main
      Yast.import "UI"
      textdomain "autoinst"

      Yast.import "Mode"
      Yast.import "AutoinstConfig"
      Yast.import "URL"
      Yast.import "Popup"
      Yast.import "Label"
      Yast.import "Report"

      # Scripts list
      @scripts = []

      # default value of settings modified
      @modified = false

      @check_for_duplicates = true
    end

    # Function sets internal variable, which indicates, that any
    # settings were modified, to "true"
    def SetModified
      @modified = true

      nil
    end

    # Functions which returns if the settings were modified
    # @return [Boolean]  settings were modified
    def GetModified
      @modified
    end

    # TODO: maybe private?
    def pre_scripts
      scripts.select { |s| s.is_a?(Y2Autoinstallation::PreScript) }
    end

    def post_scripts
      scripts.select { |s| s.is_a?(Y2Autoinstallation::PostScript) }
    end

    def chroot_scripts
      scripts.select { |s| s.is_a?(Y2Autoinstallation::ChrootScript) }
    end

    def init_scripts
      scripts.select { |s| s.is_a?(Y2Autoinstallation::InitScript) }
    end

    def postpart_scripts
      scripts.select { |s| s.is_a?(Y2Autoinstallation::PostPartitioningScript) }
    end

    # Dump the settings to a map, for autoinstallation use.
    # @return [Hash]
    def Export
      log.info "Exporting scripts #{scripts.inspect}"

      groups = scripts.group_by { |s| s.class.type }

      groups.transform_values { |scs| scs.map(&:to_hash) }
    end

    # Get all the configuration from a map.
    # When called by autoinst_<module name> (preparing autoinstallation data)
    # the map may be empty.
    # @param s [Hash] scripts section from an AutoYaST profile
    # @return [Boolean]
    def Import(s)
      # take only hash entries (bnc#986049)
      @scripts = []
      @scripts.concat(valid_scripts_for(s, "pre-scripts")
        .map { |h| Y2Autoinstallation::PreScript.new(h) })
      @scripts.concat(valid_scripts_for(s, "init-scripts")
        .map { |h| Y2Autoinstallation::InitScript.new(h) })
      @scripts.concat(valid_scripts_for(s, "post-scripts")
        .map { |h| Y2Autoinstallation::PostScript.new(h) })
      @scripts.concat(valid_scripts_for(s, "chroot-scripts")
        .map { |h| Y2Autoinstallation::ChrootScript.new(h) })
      @scripts.concat(valid_scripts_for(s, "postpartitioning-scripts")
        .map { |h| Y2Autoinstallation::PostPartitioningScript.new(h) })

      if @check_for_duplicates
        # check for duplicite filenames
        known = []
        duplicates = @scripts.each_with_object([]) do |script, d|
          path = script.script_path
          if known.include?(path)
            d << script
          else
            known << path
          end
        end

        if !duplicates.empty?
          # check it only because after pre scripts it is reimport, resulting in multiple warnings
          # so show warning only once
          @check_for_duplicates = false

          duplicates.each do |dup|
            conflicting = @scripts.select { |script| script.script_path == dup.script_path }
            Report.Warning(_("Following scripts will overwrite each other:") + "\n" +
              conflicting.map(&:inspect).join("\n"))
          end
        end
      end

      true
    end

    # delete a script from a list
    # @param scriptName [String] script name
    # @return [void]
    def deleteScript(scriptName)
      scripts.delete_if { |s| s.filename == scriptName }

      nil
    end

    # Add or edit a script
    # @param [String] scriptName script name
    # @param [String] source source of script
    # @param [String] interpreter interpreter to be used with script
    # @param [String] type type of script
    # @return [void]
    def AddEditScript(scriptName, source, interpreter, type, chrooted, debug,
      feedback, feedback_type, location, notification)

      deleteScript(scriptName)

      script_hash = {
        "filename"      => scriptName,
        "source"        => source,
        "interpreter"   => interpreter,
        "chrooted"      => chrooted,
        "debug"         => debug,
        "feedback"      => feedback,
        "feedback_type" => feedback_type,
        "location"      => location,
        "notification"  => notification
      }

      klass = Y2Autoinstallation::SCRIPT_TYPES.find { |script_class| script_class.type == type }
      scripts << klass.new(script_hash)

      nil
    end

    # return type of script as formatted string
    # @param type [String] script type
    # @return [String] type as translated string
    def typeString(type)
      # TODO: move to script class
      case type
      when "pre-scripts"
        return _("Pre")
      when "post-scripts"
        return _("Post")
      when "init-scripts"
        return _("Init")
      when "chroot-scripts"
        return _("Chroot")
      when "postpartitioning-scripts"
        return _("Postpartitioning")
      end

      _("Unknown")
    end

    # Execute pre scripts
    # @param type [String] type of script
    # @param special [Boolean] if script should be executed in chroot env.
    # @return [Boolean] true on success
    def Write(type, special)
      return true if !Mode.autoinst && !Mode.autoupgrade

      target_scripts = scripts.select { |s| s.class.type == type }
      target_scripts.select! { |s| s.chrooted == special } if type == "chroot-scripts"

      target_scripts.each(&:create_script_file)

      return true if type == "init-scripts" # we just write init scripts and systemd execute them
      # We are in the first installation stage
      # where post-scripts have been downloaded only.
      return true if type == "post-scripts" && special

      script_runner = Y2Autoinstall::ScriptRunner.new
      target_scripts.each { |s| script_runner.run(s) }

      true
    end

    publish variable: :modified, type: "boolean"
    publish function: :SetModified, type: "void ()"
    publish function: :GetModified, type: "boolean ()"
    publish function: :Export, type: "map <string, list> ()"
    publish function: :Import, type: "boolean (map)"
    publish function: :deleteScript, type: "void (string)"
    publish function: :AddEditScript,
      type:     "void (string, string, string, string, boolean, boolean, " \
                "boolean, boolean, string, string, string)"
    publish function: :typeString, type: "string (string)"
    publish function: :Write, type: "boolean (string, boolean)"

  private

    # Checking if the script has the right format
    # @param tree [Yast::ProfileHash] scripts section of the AutoYast configuration
    # @param key [String] kind of script (pre, post,..)
    # @return [Array<String>] of scripts
    def valid_scripts_for(tree, key)
      tree.fetch_as_array(key).select do |h|
        next true if h.is_a?(Hash)

        log.warn "Cannot evaluate #{key}: #{h.inspect}"
        false
      end
    end
  end

  AutoinstScripts = AutoinstScriptsClass.new
  AutoinstScripts.main
end

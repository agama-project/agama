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
      Yast.import "Summary"
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

    # Return Summary
    # @return [String] summary
    def Summary
      summary = ""

      scripts_desc = {
        _("Preinstallation Scripts")  => pre_scripts,
        _("Postinstallation Scripts") => post_scripts,
        _("Chroot Scripts")           => chroot_scripts,
        _("Init Scripts")             => init_scripts,
        _("Postpartitioning Scripts") => postpart_scripts
      }

      scripts_desc.each_pair do |label, scs|
        summary = Summary.AddHeader(summary, label)
        if scs.empty?
          summary = Summary.AddLine(summary, Summary.NotConfigured)
        else
          summary = Summary.OpenList(summary)
          scs.each { |s| summary = Summary.AddListItem(summary, s.filename) }
          summary = Summary.CloseList(summary)
        end
      end

      summary
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
    publish function: :Summary, type: "string ()"
    publish function: :Write, type: "boolean (string, boolean)"
  end

  AutoinstScripts = AutoinstScriptsClass.new
  AutoinstScripts.main
end

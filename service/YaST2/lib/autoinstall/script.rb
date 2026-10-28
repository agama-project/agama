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

# Vendored from yast-autoyast2's autoinstallation/src/lib/autoinstall/script.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.

require "yast"

require "shellwords"
require "fileutils"

require "transfer/file_from_url"

Yast.import "AutoinstConfig"

module Y2Autoinstallation
  # Base class representing custom user script that runs during various phases of installation.
  # User docs, rendered:
  # https://documentation.suse.com/sles/15-SP1/html/SLES-all/configuration.html#createprofile-scripts
  # source: https://github.com/SUSE/doc-sle/blob/master/xml/ay_custom_user_scripts.xml
  class Script
    include Yast::Logger
    include Yast::Transfer::FileFromUrl
    include Yast::I18n

    # filename of script, used as ID. If it is empty then it is extracted from location or from
    # file type.
    # @see {#script_name} to get always non empty string for script name
    # @return [String]
    #
    # @example of values
    #   "test.sh"
    #   "script.pl"
    attr_reader :filename

    # Source code of script. Either source or location should be defined.
    # @return [String] empty string means not defined
    attr_reader :source

    # URI for location from which download script. Either source or location should be defined.
    # @note supported URIs are all that Yast::Transfer::FileFromUrl supports + `relurl://`
    # @return [String] empty string means not defined
    attr_reader :location

    # Flag if script runs in debug mode.
    # @note works only for interpreter defined by keyword
    # @return [Boolean]
    attr_reader :debug

    def initialize(hash)
      @filename = hash["filename"] || ""
      @source = hash["source"] || ""
      @location = hash["location"] || ""
      @debug = hash.fetch("debug", true)

      resolve_location
    end

    # returns string id of script type
    # @abstract all children have to define it
    # @return type
    def self.type
      raise NotImplementedError, "#{self.class.inspect} does not define type"
    end

    # Serialize object to hash, that can be used for exporting scripts
    def to_hash
      {
        "filename" => filename,
        "source"   => source,
        "location" => location,
        "debug"    => debug
      }
    end

    # directory to which store logs. Can be overwritten in child if different dir is needed.
    # @note it is created when it does not exist by {ExecutedScript#execute}
    def logs_dir
      Yast::AutoinstConfig.logs_dir
    end

    # difference from {#filename} is that it always return non empty string
    # @return [String]
    def script_name
      return filename unless filename.empty?

      if location.empty?
        self.class.type
      else
        url = Yast::URL.Parse(location)
        File.basename(url["path"])
      end
    end

    # Full path of the script, eg. "/full/path/myscript"
    # @return [String]
    def script_path
      File.join(Yast::AutoinstConfig.scripts_dir, script_name)
    end

    # Downloads or writes down script file
    def create_script_file
      # ensure path are available
      Yast::SCR.Execute(Yast::Path.new(".target.mkdir"), File.dirname(script_path))
      Yast::SCR.Execute(Yast::Path.new(".target.mkdir"), logs_dir)
      if !location.empty?
        url = Yast::URL.Parse(location)
        res = get_file_from_url(
          scheme:    url["scheme"],
          host:      url["host"],
          urlpath:   url["path"],
          localfile: localfile,
          urltok:    url,
          destdir:   Yast::AutoinstConfig.destdir
        )
        # TODO: exception?
        log.error "script #{location} could not be retrieved" unless res
      elsif !source.empty?
        Yast::SCR.Write(Yast::Path.new(".target.string"), script_path, source)
      else
        log.error "Neither location or source specified for #{inspect}"
      end
    end

  protected

    # where to download file for get_file_from_url which do not switch itself chroot
    # Just work-around for not respecting changed chroot (see bsc#897212 and bsc#889931)
    def localfile
      script_path
    end

  private

    # Trasforms location to valid location for downloading script
    def resolve_location
      return if location.empty?

      log.info "Resolving location #{location.inspect}"
      @location = location.strip
      return unless location.start_with?("relurl://")

      path = location[9..-1] # 9 is relurl:// size

      if Yast::AutoinstConfig.scheme == "relurl"
        log.info "autoyast profile was relurl too"
        newloc = Yast::SCR.Read(Yast::Path.new(".etc.install_inf.ayrelurl"))
        tok = Yast::URL.Parse(newloc)
        @location = "#{tok["scheme"]}://#{File.join(tok["host"], File.dirname(tok["path"]), path)}"
      else
        config = Yast::AutoinstConfig
        @location = "#{config.scheme}://#{File.join(config.host, config.directory, path)}"
      end
      log.info "resolved location #{@location.inspect}"
    end
  end

  class ScriptFeedback
    # feedback settings
    # @return [:message | :warning | :error | :popup | :no]
    attr_reader :value

    # @param hash [Hash] hash from which read script feedback value
    # @option hash [Boolean] "feedback" if feedback is enabled or not
    # @option hash [String] "feedback_value" how to show feedback
    def initialize(hash)
      @value = if hash["feedback"]
        case hash["feedback_type"]
        when "message" then :message
        when "warning" then :warning
        when "error" then :error
        when "", nil then :popup
        else
          raise "Unknown feedback type value #{hash["feedback_type"].inspect}"
        end
      else
        :no
      end
    end

    # serializes back feedback to hash
    # @return [Hash] for values see {#initialize}
    def to_hash
      case value
      when :message then { "feedback" => true, "feedback_type" => "message" }
      when :warning then { "feedback" => true, "feedback_type" => "warning" }
      when :error then { "feedback" => true, "feedback_type" => "error" }
      when :popup then { "feedback" => true, "feedback_type" => "" }
      when :no then { "feedback" => false, "feedback_type" => "" }
      else
        raise "Unknown value '#{value.inspect}"
      end
    end
  end

  # Scripts that are executed by YaST ( so all except init scripts )
  class ExecutedScript < Script
    # Sets if feedback after script finish should be shown
    # @return [ScriptFeedback]
    attr_reader :feedback

    # Interpreter to use to run script.
    # @note it is not escaped, so even interpreter parameters is allowed.
    # @return [String]
    #
    # @example values
    #   "shell" # keyword that use /bin/sh as interpreter
    #   "ruby" # it is not keyword and use ruby from PATH
    #   "/usr/bin/ruby" # full path to ruby
    #   "/usr/bin/ruby -w" # full path to ruby with parameter to print warnings
    attr_reader :interpreter

    # Notification message during script run
    # @see {Yast::Popup.Feedback} for string formatting
    # @return [String] empty string if no notification should be shown
    attr_reader :notification

    # Params passed to script. Parameters have to be already escaped
    # @return [Array]
    attr_reader :params

    # By default each script runs only once. This flag if set to true allow to run script everytime
    # when scripts running.
    # @return [Boolean]
    attr_reader :rerun

    def to_hash
      res = super
      res["interpreter"] = interpreter
      res["notification"] = notification
      res["param-list"] = params
      res["rerun"] = rerun
      res.merge(feedback.to_hash)
    end

    def initialize(hash)
      super

      @feedback = ScriptFeedback.new(hash)
      @interpreter = hash["interpreter"] || "shell"
      @notification = hash["notification"] || ""
      @params = hash["param-list"] || []
      @rerun = !!hash["rerun"]
    end

    # mapping of interpreter keywords and its debug flag
    DEBUG_FLAG_MAP = {
      "shell" => "-x",
      "perl"  => "-w",
      "ruby"  => "-w"
    }.freeze
    # mapping of interpreter keywords and its interpreter path
    INTERPRETER_MAP = {
      "shell"  => "/bin/sh",
      "perl"   => "/usr/bin/perl",
      "python" => "/usr/bin/python"
    }.freeze

    # Runs the script
    #
    # @param env [Hash] hash representing a set of environment variables
    # @return [Boolean,nil] if exit code is zero; nil if the script was not executed
    def execute(env = {})
      return if already_run? && !rerun

      # TODO: maybe own class for interpreters?
      cmd = INTERPRETER_MAP[interpreter] || interpreter
      debug_flag = debug ? (DEBUG_FLAG_MAP[interpreter] || "") : ""
      params_s = params.join(" ") # shell escaping is up to user, see documentation

      cmd_line = "#{env_vars(env)} #{cmd} #{debug_flag} #{script_path.shellescape} " \
                 "#{params_s} &> #{log_path.shellescape}"

      bash_path = Yast::Path.new(".target.bash")
      res = Yast::SCR.Execute(bash_path, cmd_line)
      Yast::SCR.Execute(bash_path, "/bin/touch #{run_file.shellescape}")

      res == 0
    end

    # full path to log file
    # @return [String]
    def log_path
      File.join(logs_dir, script_name + ".log")
    end

  private

    # checks if script was already run
    def already_run?
      Yast::SCR.Read(Yast::Path.new(".target.size"), run_file) != -1
    end

    # flag file if script was run
    def run_file
      script_path + "-run"
    end

    # Returns a set of environment variables into a string to be used when calling the script
    #
    # @param env [Hash] Environment variables
    # @return [String] String in the form "val1=var1 val2=var2"
    def env_vars(env)
      env.map { |k, v| "#{k}=#{v.to_s.shellescape}" }.join(" ")
    end
  end

  # Script that runs before any other and can modify autoyast profile
  class PreScript < ExecutedScript
    # Overwrites logs directory as it is expected to live in tmpdir from which log is copied
    def logs_dir
      File.join(Yast::AutoinstConfig.tmpDir, self.class.type, "logs")
    end

    def self.type
      "pre-scripts"
    end

    # Overwrites script path as it is expected to live in tmpdir from which script is copied
    def script_path
      File.join(Yast::AutoinstConfig.tmpDir, self.class.type, script_name)
    end
  end

  # Script that runs after finish of second stage
  class PostScript < ExecutedScript
    def self.type
      "post-scripts"
    end
  end

  # Script that runs before or after changing to chroot depending on chrooted parameter
  class ChrootScript < ExecutedScript
    # @return [Boolean] true: run after/inside the chroot; false: run before/outside the chroot
    # @return [Boolean]
    attr_reader :chrooted

    def initialize(hash)
      super

      @chrooted = !!hash["chrooted"]
    end

    def to_hash
      super.merge("chrooted" => chrooted)
    end

    def self.type
      "chroot-scripts"
    end

    # Overwrites directory to place it to expected location even when SCR is not yet switched
    def logs_dir
      if chrooted
        super
      else
        File.join(Yast::AutoinstConfig.destdir, super)
      end
    end

    # Overwrites script path to place it to expected location even when SCR is not yet switched
    def script_path
      if chrooted
        super
      else
        File.join(Yast::AutoinstConfig.destdir, super)
      end
    end

  protected

    def localfile
      if chrooted
        # SCR switched, so workaround is needed
        File.join(Yast::AutoinstConfig.destdir, super)
      else
        super
      end
    end
  end

  # Script that runs after partitioning before rpm install
  class PostPartitioningScript < ExecutedScript
    def self.type
      "postpartitioning-scripts"
    end

    # Logs into target dir
    def logs_dir
      File.join(Yast::AutoinstConfig.destdir, super)
    end

    # Also place script to target, but it runs in local context as SCR is not yet switched
    def script_path
      File.join(Yast::AutoinstConfig.destdir, super)
    end
  end

  # Runs after finish of second stage. It is executed by systemd and yast just write it down.
  class InitScript < Script
    def self.type
      "init-scripts"
    end

    def script_path
      File.join(Yast::AutoinstConfig.initscripts_dir, script_name)
    end

    # Returns the path to write the script
    #
    # The init-scripts always run in the target system.
    #
    # @return [String] Path to write the script
    def localfile
      File.join(Yast::AutoinstConfig.destdir, super)
    end
  end

  # Scripts that are used when processing the <ask-list> section
  class AskScript < Y2Autoinstallation::ExecutedScript
    attr_reader :environment, :rerun_on_error

    def self.type
      "ask-scripts"
    end

    # Constructor
    #
    # @note The 'rerun' key is ignored.
    def initialize(hash)
      super
      @environment = !!hash["environment"]
      @rerun_on_error = !!hash["rerun_on_error"]
      @rerun = true
    end

    def to_hash
      super.merge("environment" => environment)
    end

    # @see Y2Autoinstallation::Script
    def logs_dir
      File.join(Yast::AutoinstConfig.tmpDir, self.class.type, "logs")
    end

    # Overrides script path as it is expected to live in tmpdir from which script is copied
    def script_path
      File.join(Yast::AutoinstConfig.tmpDir, self.class.type, script_name)
    end
  end

  # Scripts that are used when processing the <ask-list> section
  class AskDefaultValueScript < Y2Autoinstallation::ExecutedScript
    # @return [String,nil] Standard output from the last execution
    attr_reader :stdout

    def self.type
      "ask-default-value-scripts"
    end

    # Overrides script path as it is expected to live in tmpdir from which script is copied
    def script_path
      File.join(Yast::AutoinstConfig.tmpDir, self.class.type, script_name)
    end

    # @return [String,nil] Script output or nil if the execution failed
    # @see Y2Autoinstallation::ExecutedScript
    def execute(_env = {})
      cmd = INTERPRETER_MAP[interpreter] || interpreter

      @stdout = Yast::Execute.on_target!(cmd, script_path.shellescape, stdout: :capture)
      true
    rescue Cheetah::ExecutionFailed
      false
    end
  end

  # List of known script. It does not include Ask scripts, as they are handled in a different
  # way.
  SCRIPT_TYPES = [PreScript, PostScript, InitScript, ChrootScript, PostPartitioningScript].freeze
end

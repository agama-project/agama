# File:  modules/AutoInstallRules.ycp
# Package:  Auto-installation
# Summary:  Process Auto-Installation Rules
# Author:  Anas Nashif <nashif@suse.de>
#
# $Id$
#
# Vendored from yast-autoyast2's autoinstallation/src/modules/AutoInstallRules.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.
require "yast"
require "autoinstall/xml_checks"
require "yast2/popup"
require "y2storage"

module Yast
  class AutoInstallRulesClass < Module
    include Yast::Logger

    def main
      Yast.import "UI"
      textdomain "autoinst"

      Yast.import "Arch"
      Yast.import "Stage"
      Yast.import "Installation"
      Yast.import "AutoinstConfig"
      Yast.import "XML"
      Yast.import "Kernel"
      Yast.import "Mode"
      Yast.import "Linuxrc"
      Yast.import "Profile"
      Yast.import "Label"
      Yast.import "Report"
      Yast.import "Popup"
      Yast.import "URL"
      Yast.import "IP"
      Yast.import "Product"
      Yast.import "Hostname"
      Yast.import "OSRelease"

      Yast.include self, "autoinstall/io.rb"

      reset
    end

    # Reset the module's state
    #
    # @return nil
    #
    # @see #AutoInstallRules
    def reset
      @userrules = false
      @dontmergeIsDefault = true
      @dontmergeBackup = []

      @Behaviour = :many

      # ///////////////////////////////////////////
      # Pre-defined Rules
      # ///////////////////////////////////////////

      # All system attributes;
      @ATTR = {}

      @installed_product = ""
      @installed_product_version = ""
      @hostname = ""
      @hostaddress = nil
      @network = ""
      @domain = ""
      @arch = ""
      @karch = ""

      # Taken from smbios
      @product = ""

      # Taken from smbios
      @product_vendor = ""

      # Taken from smbios
      @board_vendor = ""

      # Taken from smbios
      @board = ""

      @memsize = 0
      @disksize = []
      @totaldisk = 0
      @hostid = ""
      @mac = ""
      @efi = "no"
      @linux = 0
      @others = 0
      @xserver = ""

      # ///////////////////////////////////////////
      # ///////////////////////////////////////////
      @NonLinuxPartitions = []
      @LinuxPartitions = []
      @UserRules = {}

      # Local Variables
      @shell = ""
      @env = {}

      @tomerge = []
      @element2file = {}
      AutoInstallRules()
    end

    # Cleanup XML file from namespaces put by xslt
    #
    # @param in_ [String] Path to the profile to clean-up
    # @param out [String] Path to the output file
    def XML_cleanup(in_, out)
      ycpin = XML.XMLToYCPFile(in_)
      Builtins.y2debug("Writing clean XML file to  %1, YCP is (%2)", out, ycpin)
      XML.YCPToXMLFile(:profile, ycpin, out)
    end

    # StdErrLog()
    # Dialog for error messages
    def StdErrLog(stderr)
      UI.OpenDialog(
        Opt(:decorated),
        VBox(
          VSpacing(0.5),
          HSpacing(50),
          HBox(
            HSpacing(0.5),
            LogView(Id(:log), Label.ErrorMsg, 10, 100),
            HSpacing(0.5)
          ),
          VSpacing(0.2),
          PushButton(Id(:ok), Opt(:default), Label.OKButton),
          VSpacing(0.5)
        )
      )

      UI.ChangeWidget(Id(:log), :Value, stderr)
      UI.UserInput
      UI.CloseDialog

      nil
    end

    # getMAC()
    # Return MAC address of active device
    # @return [String] mac address
    def getMAC
      tmpmac = ""
      if Stage.initial
        cmd = 'ip link show | grep link/ether | head -1 | sed -e "s:^.*link/ether.::" -e "s: .*::"'
        ret = SCR.Execute(path(".target.bash_output"), cmd)
        Builtins.y2milestone("mac Addr ret:%1", ret)
        tmpmac = ret.fetch("stdout", "")
      end
      Builtins.y2milestone("mac Addr tmp:%1", tmpmac)
      cleanmac = Builtins.deletechars(tmpmac || "", ":\n")
      Builtins.y2milestone("mac Addr mac:%1", cleanmac)
      cleanmac
    end

    # Return the network part of the hostaddress
    #
    # @example
    #   AutoInstallRules.getNetwork #=> "192.168.122.0"
    #
    # @return [String] Network part of the hostaddress
    #
    # @see hostaddress
    def getNetwork
      ip_route = SCR.Execute(path(".target.bash_output"), "/usr/sbin/ip route")

      # Regexp to fetch match the network address.
      regexp = /([\h:.]+)\/\d+ .+src #{hostaddress}/
      ret = ip_route["stdout"][regexp, 1]
      log.warn "Cannot find network address through 'ip': #{ip_route}" unless ret

      ret
    end

    # Return host id (hex ip)
    #
    # @return [String] host ID
    def getHostid
      IP.ToHex(hostaddress)
    end

    # Return host name
    # @return [String] host name
    def getHostname
      ret = Convert.to_map(
        SCR.Execute(path(".target.bash_output"), "/bin/hostname")
      )
      Builtins.y2milestone("getHostname ret:%1", ret)
      name = ""
      if Ops.get_integer(ret, "exit", -1) == 0
        name = Ops.get(
          Builtins.splitstring(Ops.get_string(ret, "stdout", ""), "\n"),
          0,
          ""
        )
      end
      if Builtins.isempty(name)
        name = Convert.to_string(SCR.Read(path(".etc.install_inf.Hostname")))
      end
      Builtins.y2milestone("getHostname name:%1", name)
      name
    end

    # Probe all system data to build  a set of rules
    # @return [void]
    def ProbeRules
      return if !@ATTR.empty?

      # SMBIOS Data
      bios = Convert.to_list(SCR.Read(path(".probe.bios")))

      if Builtins.size(bios) != 1
        Builtins.y2warning("Warning: BIOS list size is %1", Builtins.size(bios))
      end

      biosinfo = Ops.get_map(bios, 0, {})
      smbios = Ops.get_list(biosinfo, "smbios", [])

      sysinfo = {}
      boardinfo = {}

      Builtins.foreach(smbios) do |inf|
        case Ops.get_string(inf, "type", "")
        when "sysinfo"
          sysinfo = deep_copy(inf)
        when "boardinfo"
          boardinfo = deep_copy(inf)
        end
      end

      if Ops.greater_than(Builtins.size(sysinfo), 0)
        @product = Ops.get_string(sysinfo, "product", "default")
        @product_vendor = Ops.get_string(sysinfo, "manufacturer", "default")
      end

      if Ops.greater_than(Builtins.size(boardinfo), 0)
        @board = Ops.get_string(boardinfo, "product", "default")
        @board_vendor = Ops.get_string(boardinfo, "manufacturer", "default")
      end

      Ops.set(@ATTR, "product", @product)
      Ops.set(@ATTR, "product_vendor", @product_vendor)
      Ops.set(@ATTR, "board", @board)
      Ops.set(@ATTR, "board_vendor", @board_vendor)

      #
      # Architecture
      #

      @arch = Arch.architecture
      @karch = Ops.get(Kernel.GetPackages, 0, "kernel-default")

      Ops.set(@ATTR, "arch", @arch)
      Ops.set(@ATTR, "karch", @karch)

      #
      # Memory
      #

      memories = Convert.to_list(SCR.Read(path(".probe.memory")))
      memory = Ops.get_integer(
        memories,
        [0, "resource", "phys_mem", 0, "range"],
        0
      )
      @memsize = Ops.divide(memory, 1024 * 1024)
      Ops.set(@ATTR, "memsize", @memsize)

      #
      # Disk sizes
      #
      @totaldisk = 0
      @disksize = []
      one_mega = Y2Storage::DiskSize.MiB(1)
      Y2Storage::StorageManager.instance.probed.disks.each do |disk|
        size = disk.size.ceil(one_mega).to_i / one_mega.to_i
        @totaldisk += size
        @disksize << { "device" => disk.name, "size" => size }
      end
      Builtins.y2milestone("disksize: %1", @disksize)
      Ops.set(@ATTR, "totaldisk", @totaldisk)
      #
      # MAC
      #
      Ops.set(@ATTR, "mac", @mac)

      #
      # EFI Boot
      @efi = boot_efi?
      @ATTR["efi"] = @efi

      #
      # Network
      #
      Ops.set(@ATTR, "hostaddress", hostaddress)

      #
      # Hostid (i.e. a8c00101);
      #
      Ops.set(@ATTR, "hostid", @hostid)

      Ops.set(@ATTR, "hostname", getHostname)
      @domain = Hostname.CurrentDomain
      Ops.set(@ATTR, "domain", @domain)
      @network = getNetwork
      Ops.set(@ATTR, "network", @network)
      @xserver = Convert.to_string(SCR.Read(path(".etc.install_inf.XServer")))
      Ops.set(@ATTR, "xserver", @xserver)

      probed_disks = Y2Storage::StorageManager.instance.probed_disk_analyzer
      @NonLinuxPartitions = probed_disks.windows_partitions
      @others = @NonLinuxPartitions.size
      Builtins.y2milestone("Other primaries: %1", @NonLinuxPartitions)
      @LinuxPartitions = probed_disks.linux_partitions
      @linux = @LinuxPartitions.size
      Builtins.y2milestone("Other linux parts: %1", @LinuxPartitions)

      @installed_product = Yast::OSRelease.ReleaseInformation
      @installed_product_version = Yast::OSRelease.ReleaseVersion
      Ops.set(@ATTR, "installed_product", @installed_product)
      Ops.set(@ATTR, "installed_product_version", @installed_product_version)

      log.info "Installing #{@installed_product}, " \
               "version: #{@installed_product_version}"
      log.info "ATTR=#{@ATTR}"

      nil
    end

    # Create shell command for rule verification
    # @param [Boolean] match
    # @param [String] var
    # @param [Object] val
    # @param [String] op
    # @param [String] matchtype
    # @return [void]
    def shellseg(match, var, val, op, matchtype)
      val = deep_copy(val)
      case op
      when "and"
        op = " && "
      when "or"
        op = " || "
      end

      tmpshell = " ( ["
      Builtins.y2debug("Match type: %1", matchtype)
      if Ops.is_string?(val) && Convert.to_string(val) == "*"
        # match anything
        tmpshell = Ops.add(tmpshell, " \"1\" = \"1\" ")
      elsif matchtype == "exact"
        tmpshell = Ops.add(
          tmpshell,
          Builtins.sformat(" \"$%1\" = \"%2\" ", var, val)
        )
      elsif matchtype == "greater"
        tmpshell = Ops.add(
          tmpshell,
          Builtins.sformat(" \"$%1\" -gt \"%2\" ", var, val)
        )
      elsif matchtype == "lower"
        tmpshell = Ops.add(
          tmpshell,
          Builtins.sformat(" \"$%1\" -lt \"%2\" ", var, val)
        )
      elsif matchtype == "range"
        range = Builtins.splitstring(Builtins.tostring(val), "-")
        Builtins.y2debug("Range: %1", range)
        tmpshell = Ops.add(
          tmpshell,
          Builtins.sformat(
            " \"$%1\" -ge \"%2\" -a \"$%1\" -le \"%3\" ",
            var,
            Ops.get(range, 0, "0"),
            Ops.get(range, 1, "0")
          )
        )
      elsif matchtype == "regex"
        tmpshell = Ops.add(
          tmpshell,
          Builtins.sformat("[ \"$%1\" =~ %2 ]", var, val)
        )
      end

      @shell = if match
        Ops.add(@shell, Builtins.sformat(" %1 %2] )", op, tmpshell))
      else
        Ops.add(tmpshell, "] ) ")
      end

      Builtins.y2milestone("var: %1, val: %2", var, val)
      Builtins.y2milestone("shell: %1", @shell)
      nil
    end

    # Verify rules using the shell
    # @return [Fixnum]
    def verifyrules
      script = Builtins.sformat("if %1; then exit 0; else exit 1; fi", @shell)
      ret = Convert.to_map(
        SCR.Execute(path(".target.bash_output"), script, @env)
      )

      Builtins.y2milestone("Bash return: %1 (%2) (%3)", script, ret, @env)

      Ops.get_integer(ret, "exit", -1)
    end

    def SubVars(file)
      Builtins.y2milestone("file: %1", file)
      var = ""
      first = Builtins.findfirstof(file, "@")
      last = Builtins.findlastof(file, "@")
      if !first.nil? && !last.nil?
        ffirst = Ops.add(Convert.to_integer(first), 1)
        llast = Convert.to_integer(last)
        var = Builtins.substring(file, ffirst, Ops.subtract(llast, ffirst)) if first != last
      end
      Builtins.y2milestone("var: %1", var)
      if var != ""
        val = Ops.get_string(@ATTR, var, "")
        new = Builtins.regexpsub(
          file,
          "(.*)@.*@(.*)",
          Builtins.sformat("\\1%1\\2", val)
        )
        return new if new != ""
      end
      Builtins.y2milestone("val: %1", file)
      file
    end

    # Read rules file
    # @return [void]
    def Read
      begin
        @UserRules = XML.XMLToYCPFile(AutoinstConfig.local_rules_file)
      rescue XMLDeserializationError => e
        message = _("Parsing the rules file failed. XML parser reports:\n")
        Popup.Error(message + e.message)
        @UserRules = nil
      end
      Builtins.y2milestone("Rules: %1", @UserRules)

      rulelist = Ops.get_list(@UserRules, "rules", [])
      if rulelist.nil? # check result of implicit type conversion
        Builtins.y2error("Key 'rules' has wrong type")
        rulelist = []
      end

      ismatch = false
      go_on = true
      AutoInstallRules.ProbeRules if !rulelist.empty?
      Builtins.foreach(rulelist) do |ruleset|
        Builtins.y2milestone("Ruleset: %1", ruleset)
        rls = ruleset.keys
        if rls.include?("result")
          rls.reject! { |r| r == "result" }
          rls.push("result")
        end
        op = Ops.get_string(ruleset, "operator", "and")
        rls.reject! { |r| r == "op" }
        Builtins.y2milestone("Orderes Rules: %1", rls)
        if go_on
          Builtins.foreach(rls) do |rule|
            ruledef = ruleset.fetch(rule, {})
            Builtins.y2milestone("Rule: %1", rule)
            Builtins.y2milestone("Ruledef: %1", ruledef)
            match = Ops.get_string(ruledef, "match", "undefined")
            matchtype = Ops.get_string(ruledef, "match_type", "exact")
            easy_rules = [
              "hostname",
              "hostaddress",
              "installed_product_version",
              "installed_product",
              "domain",
              "efi",
              "network",
              "mac",
              "karch",
              "hostid",
              "arch",
              "board",
              "board_vendor",
              "product_vendor",
              "product"
            ]
            if Builtins.contains(easy_rules, rule)
              shellseg(ismatch, rule, match, op, matchtype)
              ismatch = true
              Ops.set(@env, rule, Ops.get_string(@ATTR, rule, ""))
            elsif rule == "custom1" || rule == "custom2" || rule == "custom3" ||
                rule == "custom4" ||
                rule == "custom5"
              script = Ops.get_string(ruledef, "script", "exit -1")
              tmpdir = AutoinstConfig.tmpDir

              scriptPath = Builtins.sformat(
                "%1/%2",
                tmpdir,
                Ops.add("rule_", rule)
              )

              Builtins.y2milestone("Writing rule script into %1", scriptPath)
              SCR.Write(path(".target.string"), scriptPath, script)

              out = Convert.to_map(
                SCR.Execute(
                  path(".target.bash_output"),
                  Ops.add("/bin/sh ", scriptPath),
                  {}
                )
              )
              script_result = Ops.get_string(out, "stdout", "")
              shellseg(ismatch, rule, match, op, matchtype)
              ismatch = true
              Ops.set(@ATTR, rule, script_result)
              Ops.set(@env, rule, script_result)
            elsif rule == "linux"
              shellseg(ismatch, rule, match, op, matchtype)
              ismatch = true
              Ops.set(@env, rule, @linux)
            elsif rule == "others"
              shellseg(ismatch, rule, match, op, matchtype)
              ismatch = true
              Ops.set(@env, rule, @others)
            elsif rule == "xserver"
              shellseg(ismatch, rule, match, op, matchtype)
              ismatch = true
              Ops.set(@env, rule, @xserver)
            elsif rule == "memsize"
              shellseg(ismatch, rule, match, op, matchtype)
              ismatch = true
              Ops.set(@env, rule, @memsize)
            elsif rule == "totaldisk"
              shellseg(ismatch, rule, match, op, matchtype)
              ismatch = true
              Ops.set(@env, rule, @totaldisk)
            elsif rule == "disksize"
              Builtins.y2debug("creating rule check for disksize")
              disk = Builtins.splitstring(match, " ")
              i = 0
              t = ""
              t = if @shell == ""
                Ops.add(@shell, Builtins.sformat(" ( "))
              else
                Ops.add(
                  @shell,
                  Builtins.sformat(" %1 ( ", (op == "and") ? "&&" : "||")
                )
              end
              Builtins.foreach(@disksize) do |dev|
                var1 = Builtins.sformat("disksize_size%1", i)
                var2 = Builtins.sformat("disksize_device%1", i)
                case matchtype
                when "exact"
                  t = Ops.add(
                    t,
                    Builtins.sformat(
                      " [ \"$%1\" = \"%2\" -a \"$%3\" = \"%4\" ] ",
                      var1,
                      Ops.get(disk, 1, ""),
                      var2,
                      Ops.get(disk, 0, "")
                    )
                  )
                when "greater"
                  t = Ops.add(
                    t,
                    Builtins.sformat(
                      " [ \"$%1\" -gt \"%2\"  -a \"$%3\" = \"%4\" ] ",
                      var1,
                      Ops.get(disk, 1, ""),
                      var2,
                      Ops.get(disk, 0, "")
                    )
                  )
                when "lower"
                  t = Ops.add(
                    t,
                    Builtins.sformat(
                      " [ \"$%1\" -lt \"%2\" -a \"$%3\" = \"%4\" ] ",
                      var1,
                      Ops.get(disk, 1, ""),
                      var2,
                      Ops.get(disk, 0, "")
                    )
                  )
                end
                Ops.set(@env, var1, Ops.get_integer(dev, "size", -1))
                Ops.set(@env, var2, Ops.get_string(dev, "device", ""))
                i = Ops.add(i, 1)
                t = Ops.add(t, " || ") if Ops.greater_than(Builtins.size(@disksize), i)
              end
              t = Ops.add(t, " ) ")
              @shell = t
              Builtins.y2debug("shell: %1", @shell)
              ismatch = true
            elsif rule == "result"
              profile_name = Ops.get_string(ruledef, "profile", "")
              profile_name = SubVars(profile_name)
              if Builtins.haskey(ruleset, "dialog")
                Ops.set(
                  @element2file,
                  Ops.get_integer(ruleset, ["dialog", "element"], 0),
                  profile_name
                )
              end
              if verifyrules == 0
                Builtins.y2milestone("Final Profile name: %1", profile_name)
                if Ops.get_boolean(ruledef, "match_with_base", true)
                  @tomerge = Builtins.add(@tomerge, profile_name)
                end
                # backdoor for merging problems.
                if Builtins.haskey(ruledef, "dont_merge")
                  if @dontmergeIsDefault
                    @dontmergeBackup = deep_copy(AutoinstConfig.dontmerge)
                    AutoinstConfig.dontmerge = []
                  end
                  AutoinstConfig.dontmerge = Convert.convert(
                    Builtins.union(
                      AutoinstConfig.dontmerge,
                      Ops.get_list(ruledef, "dont_merge", [])
                    ),
                    from: "list",
                    to:   "list <string>"
                  )
                  @dontmergeIsDefault = false
                  Builtins.y2milestone(
                    "user defined dont_merge for rules found. dontmerge is %1",
                    AutoinstConfig.dontmerge
                  )
                end
                go_on = Ops.get_boolean(ruledef, "continue", false)
              else
                go_on = true
              end
              @shell = ""
              ismatch = false
            end
          end
        end
      end

      dialogOrder = []
      Builtins.y2milestone("element2file=%1", @element2file)
      Builtins.foreach(rulelist) do |rule|
        if Builtins.haskey(rule, "dialog") &&
            !Builtins.contains(
              dialogOrder,
              Ops.get_integer(rule, ["dialog", "dialog_nr"], 0)
            )
          dialogOrder = Builtins.add(
            dialogOrder,
            Ops.get_integer(rule, ["dialog", "dialog_nr"], 0)
          )
        end
      end
      dialogOrder = Builtins.sort(dialogOrder)

      dialogIndex = 0
      while Ops.less_or_equal(
        dialogIndex,
        Ops.subtract(Builtins.size(dialogOrder), 1)
      )
        dialogNr = Ops.get(dialogOrder, dialogIndex, 0)
        dialog_term = VBox()
        element_nr = 0
        timeout = 0
        title = "Choose XML snippets to merge"
        conflictsCounter = {}
        Builtins.foreach(rulelist) do |rule|
          if Builtins.haskey(rule, "dialog")
            element_nr = Ops.get_integer(
              rule,
              ["dialog", "element"],
              element_nr
            )
            file = Ops.get(@element2file, element_nr, "")
            element_nr = Ops.add(element_nr, 1)
            if Builtins.contains(@tomerge, file)
              Builtins.foreach(Ops.get_list(rule, ["dialog", "conflicts"], [])) do |c|
                conflictsCounter[c] = 0
              end
            end
          end
        end

        Builtins.foreach(rulelist) do |rule|
          if Builtins.haskey(rule, "dialog") &&
              Ops.get_integer(rule, ["dialog", "dialog_nr"], 0) == dialogNr
            element_nr = Ops.get_integer(
              rule,
              ["dialog", "element"],
              element_nr
            )
            title = Ops.get_string(rule, ["dialog", "title"], title)
            file = Ops.get(@element2file, element_nr, "")
            on = Builtins.contains(@tomerge, file) ? true : false
            button = Left(
              CheckBox(
                Id(element_nr),
                Opt(:notify),
                Ops.get_string(rule, ["dialog", "question"], file),
                on
              )
            )
            if Builtins.haskey(Ops.get(rule, "dialog", {}), "timeout")
              timeout = Ops.get_integer(rule, ["dialog", "timeout"], 0)
            end
            dialog_term = Builtins.add(dialog_term, button)
            element_nr = Ops.add(element_nr, 1)
          end
        end

        if Ops.greater_than(element_nr, 0)
          UI.OpenDialog(
            Opt(:decorated),
            VBox(
              Label(title),
              VSpacing(1),
              dialog_term,
              VSpacing(1),
              HBox(
                HStretch(),
                PushButton(Id(:back), Label.BackButton),
                PushButton(Id(:ok), Label.OKButton)
              )
            )
          )
          UI.ChangeWidget(Id(:back), :Enabled, false) if dialogIndex == 0

          # If there are conflicting items set them all to enabled/not_selected
          # in order to let the user decide at first.
          conflictsCounter.each do |c, _n|
            UI.ChangeWidget(Id(c), :Enabled, true)
            UI.ChangeWidget(Id(c), :Value, false)
          end

          loop do
            ret = nil
            ret = if timeout == 0
              UI.UserInput
            else
              UI.TimeoutUserInput(Ops.multiply(timeout, 1000))
            end
            timeout = 0
            element_nr = 0
            if ret == :ok || ret == :timeout || ret == :back
              dialogIndex = Ops.subtract(dialogIndex, 2) if ret == :back
              break
            else
              if Convert.to_boolean(UI.QueryWidget(Id(ret), :Value))
                @tomerge = Builtins.add(
                  @tomerge,
                  Ops.get(@element2file, Builtins.tointeger(ret), "")
                )
              else
                file = Ops.get(@element2file, Builtins.tointeger(ret), "")
                @tomerge = Builtins.filter(@tomerge) { |f| file != f }
              end
              conflicts = []
              Builtins.foreach(rulelist) do |r|
                if Ops.get_integer(r, ["dialog", "element"], -1) ==
                    Builtins.tointeger(ret)
                  conflicts = Ops.get_list(r, ["dialog", "conflicts"], [])
                  raise Break
                end
              end
              Builtins.foreach(conflicts) do |element|
                if Convert.to_boolean(UI.QueryWidget(Id(ret), :Value))
                  Ops.set(
                    conflictsCounter,
                    element,
                    Ops.add(Ops.get(conflictsCounter, element, 0), 1)
                  )
                elsif Ops.greater_than(Ops.get(conflictsCounter, element, 0), 0)
                  Ops.set(
                    conflictsCounter,
                    element,
                    Ops.subtract(Ops.get(conflictsCounter, element, 0), 1)
                  )
                end
              end
              Builtins.foreach(conflictsCounter) do |key, v|
                if Ops.greater_than(v, 0)
                  UI.ChangeWidget(Id(key), :Enabled, false)
                  UI.ChangeWidget(Id(key), :Value, false)
                else
                  UI.ChangeWidget(Id(key), :Enabled, true)
                end
              end
            end
            Builtins.y2milestone("tomerge is now = %1", @tomerge)
            Builtins.y2milestone(
              "conflictsCounter is now = %1",
              conflictsCounter
            )
          end
          UI.CloseDialog
          dialogIndex = Ops.add(dialogIndex, 1)
        end
        Builtins.y2milestone(
          "changing rules to merge to %1 because of user selection",
          @tomerge
        )
      end
      nil
    end

    # Return list of file to merge (Order matters)
    # @return [Array] list of files
    def Files
      deep_copy(@tomerge)
    end

    # Retrieves the rules files to merge
    #
    # @return [Boolean] true if the files were retrieved; false otherwise
    def GetRules
      Builtins.y2milestone("Getting Rules: %1", @tomerge)

      scheme = AutoinstConfig.scheme
      host = AutoinstConfig.host
      directory = AutoinstConfig.directory

      valid = []
      stop = false
      Builtins.foreach(@tomerge) do |file|
        if !stop
          dir = dirname(file)
          if dir != ""
            SCR.Execute(
              path(".target.mkdir"),
              Ops.add(Ops.add(AutoinstConfig.local_rules_location, "/"), dir)
            )
          end

          localfile = Ops.add(
            Ops.add(AutoinstConfig.local_rules_location, "/"),
            file
          )
          if !::File.exist?(localfile) && !Get(
            scheme,
            host,
            Ops.add(Ops.add(directory, "/"), file),
            localfile
          )
            Builtins.y2error(
              "Error while fetching file:  %1",
              Ops.add(Ops.add(directory, "/"), file)
            )
            # Download has produced an error which is stored in the target
            # file --> delete it.
            ::FileUtils.rm(localfile) if ::File.exist?(localfile)
          else
            stop = true if @Behaviour == :one
            valid = Builtins.add(valid, file)
          end
        end
      end
      @tomerge = deep_copy(valid)
      if Builtins.size(@tomerge) == 0
        Builtins.y2milestone("No files from rules found")
        false
      else
        true
      end
    end

    # TODO: Move the responsibility of merging profiles to a specific class
    # removing also the duplication of code between this module and the
    # AutoinstClass one.

    MERGE_CMD = "/usr/bin/xsltproc".freeze
    MERGE_DEFAULTS = "--novalid --maxdepth 10000 --maxvars 30000 --param replace \"'false'\"".freeze
    # Resolved relative to this file (service/YaST2/modules/AutoInstallRules.rb) instead of
    # a hardcoded OS path, so it works both from a git checkout/bundler context and from an
    # installed gem, without depending on install.sh having copied it anywhere. See
    # service/YaST2/README.md.
    MERGE_XSLT_PATH = File.expand_path("../xslt/merge.xslt", __dir__).freeze

    # Merges the given profiles
    #
    # @param base_profile [String] the base profile file path
    # @param with [String] the profile to be merged file path
    # @param to [String] the resulting control file path
    # @return [Hash] stdout and stderr output
    def merge_profiles(base_profile, with, to)
      dontmerge_str = ""
      AutoinstConfig.dontmerge.each_with_index do |dm, i|
        dontmerge_str << " --param dontmerge#{i + 1} \"'#{dm}'\""
      end
      merge_command =
        "#{MERGE_CMD} #{MERGE_DEFAULTS}" \
        "#{dontmerge_str} --param with \"'#{with}'\" " \
        "--output \"#{to}\" " \
        "#{MERGE_XSLT_PATH} #{base_profile}"

      out = SCR.Execute(path(".target.bash_output"), merge_command, {})
      log.info("Merge command: #{merge_command}")
      log.info("Merge stdout: #{out["stdout"]}, stderr: #{out["stderr"]}")
      out
    end

    # Merge Rule results
    # @param [String] result_profile the resulting control file path
    # @return [Boolean] true on success
    def Merge(result_profile)
      base_profile = File.join(AutoinstConfig.tmpDir, "base_profile.xml")
      merge_profile = File.join(AutoinstConfig.tmpDir, "result.xml")
      cleaned_profile = File.join(AutoinstConfig.tmpDir, "current.xml")
      ok = true
      error = false
      @tomerge.each_with_index do |file, iter|
        log.info("Working on file: #{file}")
        current_profile = File.join(AutoinstConfig.local_rules_location, file)

        if !Y2Autoinstallation::XmlChecks.instance.valid_profile?(current_profile)
          error = true
          next
        end

        dest_profile = (iter == 0) ? base_profile : cleaned_profile
        begin
          XML_cleanup(current_profile, dest_profile)
        rescue XMLDeserializationError => e
          log.error("Error reading XML file: #{e.inspect}")
          message = _(
            "The XML parser reported an error while parsing the autoyast profile. " \
            "The error message is:\n"
          )
          message += e.message
          Yast2::Popup.show(message, headline: :error)
          error = true
        end

        if error
          log.error("Error while merging control files")
        else
          next if iter == 0

          xsltret = merge_profiles(base_profile, cleaned_profile, merge_profile)

          log.info("Merge result: #{xsltret}")
          if xsltret["exit"] != 0 || xsltret.fetch("stderr", "") != ""
            log.error("Merge Failed")
            StdErrLog(xsltret.fetch("stderr", ""))
            ok = false
          end

          XML_cleanup(merge_profile, base_profile)
        end
      end

      return !error if error

      SCR.Execute(path(".target.bash"), "cp #{base_profile} #{result_profile}")
      Builtins.y2milestone("Ok=%1", ok)
      @dontmergeIsDefault = true
      AutoinstConfig.dontmerge = deep_copy(@dontmergeBackup)
      ok
    end

    def read_xml(profile)
      if !Profile.ReadXML(profile)
        Popup.Error(
          _(
            "Error while parsing the control file.\n" \
            "Check the log files for more details or fix the\n" \
            "control file and try again.\n"
          )
        )
        return false
      end

      true
    end

    # When there are classes defined in the profile it adds mergeable
    # configurations to the list of files to be merged.
    #
    # @return [Boolean] true when there are configurations to be merged; false
    #   otherwise
    def classes_to_merge
      # Now check if there are any classes defined in the pre final control file
      log.info("Checking classes...")
      return false unless (Profile.current || {}).keys.include?("classes")

      log.info("User defined classes available, processing....")
      classes = Profile.current["classes"]
      classes.each do |profile_class|
        # backdoor for merging problems.
        if profile_class.keys.include?("dont_merge")
          AutoinstConfig.dontmerge = [] if @dontmergeIsDefault
          not_mergeable = profile_class.fetch("dont_merge", [])
          AutoinstConfig.dontmerge = Builtins.union(AutoinstConfig.dontmerge || [], not_mergeable)
          @dontmergeIsDefault = false
          log.info("user defined dont_merge for class found. " \
                   "dontmerge is #{AutoinstConfig.dontmerge}")
        end
        class_name = profile_class.fetch("class_name", "none")
        file_name  = profile_class.fetch("configuration", "none")
        @tomerge << File.join("classes", class_name, file_name)
      end

      log.info("New files to process: #{@tomerge.inspect}")
      @Behaviour = :multiple

      true
    end

    # Process Rules
    # @param [String] result_profile
    # @return [Boolean]
    def Process(result_profile)
      prefinal = File.join(AutoinstConfig.local_rules_location, "prefinal_autoinst.xml")
      return false if !Merge(prefinal)
      return false if !read_xml(prefinal)

      ok = true
      @tomerge = []
      if classes_to_merge
        if GetRules()
          @tomerge.prepend("prefinal_autoinst.xml")
          ok = Merge(result_profile)
        else
          Report.Error(
            _(
              "\n" \
              "User-defined classes could not be retrieved.  Make sure all classes \n" \
              "are defined correctly and available for this system via the network\n" \
              "or locally. The system cannot be installed with the original control \n" \
              "file without using classes.\n"
            )
          )

          ok = false
          SCR.Execute(path(".target.bash"), "cp #{prefinal} #{result_profile}")
        end
      else
        SCR.Execute(path(".target.bash"), "cp #{prefinal} #{result_profile}")
      end

      log.info("returns=#{ok}")
      ok
    end

    # Create default rule in case no rules file is available
    # This adds a list of file starting from full hex ip representation to
    # only the first letter. Then default and finally mac address.
    # @return [void]
    def CreateDefault
      @Behaviour = :one
      if @hostid
        tmp_hex_ip = @hostid
        @tomerge << tmp_hex_ip
        while tmp_hex_ip.size > 1
          tmp_hex_ip = tmp_hex_ip[0..-2]
          @tomerge << tmp_hex_ip
        end
      end
      @tomerge << Builtins.toupper(@mac)
      @tomerge << Builtins.tolower(@mac)
      @tomerge << "default"
      Builtins.y2milestone("Created default rules=%1", @tomerge)
      nil
    end

    # Create default rule in case no rules file is available
    # (Only one file which is given by the user)
    # @param [String] filename file name
    # @return [void]
    def CreateFile(filename)
      @tomerge = Builtins.add(@tomerge, filename)
      Builtins.y2milestone("Created default rules: %1", @tomerge)
      nil
    end

    # Constructor
    #
    def AutoInstallRules
      @mac = getMAC
      @hostid = getHostid
      @efi = boot_efi?
      log.info "init mac:#{@mac} hostid: #{@hostid} efi: #{@efi}"
      nil
    end

    # @return [String] "yes" when the system is booted using EFI or "no" when not
    def boot_efi?
      Y2Storage::Arch.new.efiboot? ? "yes" : "no"
    end

    # Regexp to extract the IP from the routes table
    HOSTADDRESS_REGEXP = /src ([\w.]+) /.freeze

    # Return the IP through iproute2 tools
    #
    # @return [String] IP address
    def hostaddress
      return @hostaddress unless @hostaddress.nil?

      ip_route = SCR.Execute(path(".target.bash_output"), "/usr/sbin/ip route")
      ret = ip_route["stdout"][HOSTADDRESS_REGEXP, 1]
      if ret
        log.info "Found IP address: #{ret}"
      else
        log.warn "Cannot evaluate IP address: #{ip_route}"
      end

      ret
    end

    publish variable: :userrules, type: "boolean"
    publish variable: :dontmergeIsDefault, type: "boolean"
    publish variable: :dontmergeBackup, type: "list <string>"
    publish variable: :Behaviour, type: "symbol"
    publish variable: :installed_product, type: "string"
    publish variable: :installed_product_version, type: "string"
    publish variable: :hostname, type: "string"
    publish variable: :network, type: "string"
    publish variable: :domain, type: "string"
    publish variable: :arch, type: "string"
    publish variable: :karch, type: "string"
    publish variable: :product, type: "string"
    publish variable: :product_vendor, type: "string"
    publish variable: :board_vendor, type: "string"
    publish variable: :board, type: "string"
    publish variable: :memsize, type: "integer"
    publish variable: :disksize, type: "list <map <string, any>>"
    publish variable: :totaldisk, type: "integer"
    publish variable: :hostid, type: "string"
    publish variable: :mac, type: "string"
    publish variable: :linux, type: "integer"
    publish variable: :others, type: "integer"
    publish variable: :efi, type: "string"
    publish variable: :xserver, type: "string"
    publish variable: :NonLinuxPartitions, type: "list"
    publish variable: :LinuxPartitions, type: "list"
    publish variable: :UserRules, type: "map <string, any>"
    publish variable: :tomerge, type: "list <string>"
    publish function: :hostaddress, type: "string ()"
    publish function: :XML_cleanup, type: "boolean (string, string)"
    publish function: :StdErrLog, type: "void (string)"
    publish function: :getMAC, type: "string ()"
    publish function: :getHostid, type: "string ()"
    publish function: :getHostname, type: "string ()"
    publish function: :ProbeRules, type: "void ()"
    publish function: :Read, type: "void ()"
    publish function: :Files, type: "list <string> ()"
    publish function: :GetRules, type: "boolean ()"
    publish function: :Merge, type: "boolean (string)"
    publish function: :Process, type: "boolean (string)"
    publish function: :CreateDefault, type: "void ()"
    publish function: :CreateFile, type: "void (string)"
    publish function: :AutoInstallRules, type: "void ()"
  end

  AutoInstallRules = AutoInstallRulesClass.new
  AutoInstallRules.main
end

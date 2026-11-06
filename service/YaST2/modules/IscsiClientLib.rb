# encoding: utf-8

# |***************************************************************************
# |
# | Copyright (c) [2012-2025] SUSE LLC
# | All Rights Reserved.
# |
# | This program is free software; you can redistribute it and/or
# | modify it under the terms of version 2 of the GNU General Public License as
# | published by the Free Software Foundation.
# |
# | This program is distributed in the hope that it will be useful,
# | but WITHOUT ANY WARRANTY; without even the implied warranty of
# | MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# | GNU General Public License for more details.
# |
# | You should have received a copy of the GNU General Public License
# | along with this program; if not, contact SUSE LLC
# |
# | To contact Novell about this file by physical or electronic mail,
# | you may find current contact information at www.suse.com
# |
# |***************************************************************************
#
# Vendored from yast2-iscsi-client's src/modules/IscsiClientLib.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-iscsi-client`
# RPM is no longer a runtime dependency of Agama.
require "yast"
require "yast2/execute"
require "yast2/systemd/socket"
require "ipaddr"
require "y2iscsi_client/config"
require "y2iscsi_client/timeout_process"
require "y2iscsi_client/authentication"
require "cheetah"

require "shellwords"

module Yast
  class IscsiClientLibClass < Module
    include Yast::Logger

    Yast.import "Arch"

    # Script to configure iSCSI offload engines for use with open-iscsi
    #
    # Relying on our secure $PATH (set in y2start), not making assumptions
    # if the binary is in /sbin or in /usr/sbin (usr-merge in openSUSE!)
    # (bsc#1196086, bsc#1196086)
    OFFLOAD_SCRIPT = "iscsi_offload".freeze
    DISCOVERY_CMD = "iscsiadm -m discovery -P 1".freeze

    # Driver modules that depend on the iscsiuio service/socket
    #
    # @see #iscsiuio_relevant?
    #
    # The modules match with the ones specified as the fourth element of the relevant entries
    # at @offload.
    #
    # @return [Array<String>]
    ISCSIUIO_MODULES = ["bnx2i", "qedi"].freeze
    private_constant :ISCSIUIO_MODULES

    # Documentation for attributes that are initialized at #main

    # @!attribute iface_file
    #   Entries in the iscsi ifaces file which is initialized by #InitIfaceFile . Every network
    #   interface that supports open-iscsi can have one o more iscsi ifaces associated with it.
    #
    #   Each entry associates the iscsi file name with the iscsi iface name which is usually the same.
    #
    #   @return [Hash{String => String}] ex. { "bnx2i.9c:dc:71:df:cf:29.ipv4.0" => "bnx2i.9c:dc:71:df:cf:29.ipv4.0"}
    #
    # @!attribute sessions
    #   All connected nodes found via #readSessions
    #
    #   In Open-iscsi, the term "node" refers to a portal on a target
    #
    #   Each session is represented by a string of the form "portal target iface"
    #
    #   @return [Array<String>] ex. ["192.168.122.47:3260 iqn.2022-12.com.example:3dafafa2 default"]

    # @!attribute discovered
    # Entries in the local nodes database, populated via #getDiscovered
    #
    # Each node is represented by a string of the same form than in {#sessions}
    #
    # @return [Array<String>]

    # @!attribute targets
    #   List of nodes found by the latest discovery
    #
    #   Each target is represented by a string of the same form than in {#sessions}
    #
    #   @return [Array<String>]

    # @!attribute currentRecord
    #   Node used as a target for most operations offered by the IscsiClientLib module
    #
    #   Consists on an array in which the first element is the portal, the second is the target
    #   and the third is the iSCSI interface (ie. similar to the strings in {#sessions},
    #   {#discovered} or {#targets} but using an array instead of a space-separated string).
    #
    #   @return [Array<String>]

    # Constructor
    def main
      textdomain "iscsi-client"

      Yast.import "Service"
      Yast.import "Popup"
      Yast.import "Hostname"
      Yast.import "Stage"
      Yast.import "ModuleLoading"
      Yast.import "Mode"
      Yast.import "String"
      Yast.import "Arch"

      # For information about these variables, see the YARDoc documentation above
      @sessions = []
      @discovered = []
      @targets = []
      @currentRecord = []
      @iface_file = nil
      @iface_eth = []

      # Content of the main configuration file (/etc/iscsi/iscsid.conf)
      # Use {#getConfig} and {#setConfig} to deal with its content in a convenient way.
      @config = Y2IscsiClient::Config.new

      # iBFT (iSCSI Boot Firmware Table)
      @ibft = nil
      # InitiatorName file (/etc/iscsi/initiatorname.iscsi)
      @initiatorname = ""
      # map used for autoYaST
      @ay_settings = nil
      # iscsi interface for hardware offloading
      @offload_card = "default"
      # iscsi iface for discovering
      @iface = "default"

      # Types of offload cards
      # [<id>, <label>, <matching_modules>, <load_modules>]
      #
      # matching_modules => used to identify if a given netcard in the system belongs to this type.
      # That's the case if any of the modules used by the card (according to hwinfo) matches with
      # any module from this list
      # load_modules => modules to load if the given type of card is used
      @offload = [
        ["default", _("default (Software)"), [], []],
        ["all", _("all"), [], []],
        ["bnx2", "bnx2/bnx2i/bnx2x", ["bnx2", "bnx2i", "bnx2x"], ["bnx2i"]],
        ["cxgb3", "cxgb3/cxgb3i", ["cxgb3", "cxgb3i"], ["cxgb3i"]],
        ["enic", "enic/cnic/fnic", ["enic", "fnic"], ["fnic"]],
        [
          "qla4xxx",
          "qla3xxx/qla4xxx",
          ["qla4xxx", "qla3xxx", "qlcnic"],
          ["qla4xxx"]
        ],
        ["be2net", "be2net/be2iscsi", ["be2net", "be2iscsi"], ["be2iscsi"]],
        ["qed", "qede/qedi", ["qede", "qedi"], ["qedi"]]
      ]

      # Network cards in the system that can be used as offload card, grouped by its type.
      # This is a hash like this:
      # { <idx> => [ <card1>, <card2>, ...], ...}
      #
      # idx => index of the type of card at @offload
      # cardX => Array with 4 elements [ <iface>, <mac>, <iscsi>, <ipaddr> ]
      #   iface => device name of the interface (eg. eth0)
      #   mac => hardware address
      #   iscsi => name of the open-iscsi interface definition in the style <iface>-<module>
      #   ipaddr => IPv4 address
      #
      # Eg.
      # {
      #   2 => [ { "iface" => "eth4", "macaddr" =>  "00:11:22:33:44:55:66", "modules" => ["bnx2i"] } ],
      #   6 => [ { "iface" => "eth0", "macaddr" => "00:....:33", "modules => "be2iscsi" }
      #          { "iface" => "eth0", "macaddr" => "00:....:11", "modules => "be2iscsi" }]
      # }
      @offload_valid = nil

      # Very likely, these two instance variables should NOT be directly accessed everywhere in
      # this class. It would be more sane to rely on accessors with memoization like this:
      #
      #   def iscsid_socket
      #     @iscsid_socket ||= Yast2::Systemd::Socket.find!("iscsid")
      #   end
      #
      # Currently there are several methods that seem to rely on these variables been initialized,
      # which only happens during #getServiceStatus.
      #
      # But having sane accessors and breaking those dependencies between method calls would
      # introduce changes in behavior, so it must be done carefully. Maybe some functionality relies
      # on the current logic, even if it looks broken by design.
      @iscsid_socket = nil
      @iscsiuio_socket = nil
    end

    def socketActive?(socket)
      if socket
        socket.active?
      else
        log.error "socket not available"
        false
      end
    end

    def socketStart(socket)
      if socket
        socket.start
      else
        log.error "socket not available"
        false
      end
    end

    def socketStop(socket)
      if socket
        socket.stop
      else
        log.error "socket not available"
        false
      end
    end

    def socketEnabled?(socket)
      if socket
        socket.enabled?
      else
        log.error "socket not available"
        false
      end
    end

    def socketDisabled?(socket)
      if socket
        socket.disabled?
      else
        log.error "socket not available"
        false
      end
    end

    def socketEnable(socket)
      if socket
        socket.enable
      else
        log.error "socket not available"
        false
      end
    end

    def socketDisable(socket)
      if socket
        socket.disable
      else
        log.error "socket not available"
        false
      end
    end

    def GetOffloadCard
      @offload_card
    end

    def selected_iface
      @iface || "default"
    end

    def iface=(iface)
      return if @iface == iface
      log.info "Changing the iface from #{iface} to #{@iface}"
      @iface = iface
    end

    # Create and return complete iscsciadm command by adding the string
    # argument as options. If allowed, write the command to y2log file.
    #
    # @param  [String] params	options for iscsiadm command
    # @param  [Boolean] do_log  write command to y2log?
    # @return [String] complete command
    #
    def GetAdmCmd(params, do_log = true)
      ret = "LC_ALL=POSIX iscsiadm #{params}"
      log.info("GetAdmCmd: #{ret}") if do_log
      ret
    end

    def hidePassword(orig)
      hidden = deep_copy(orig)
      hidden.each do |key, _value|
        next unless key =~ /pass/i
        hidden[key] = "*****"
      end
      hidden
    end

    # Look for iSCSI boot firmware table (available only on special hardware/netcards)
    #
    # @return [String] stdout of command 'iscsiadm -m fw' (--mode fw)
    #
    def getFirmwareInfo
      bios_info = SCR.Execute(path(".target.bash_output"), GetAdmCmd("-m fw"))

      bios_info["stdout"] || ""
    end

    # Takes the output of 'iscsiadm' either in 'node', 'session' or 'fw' mode, i.e.
    # output where info is seperated by '=', like
    # iface.transport_name = tcp
    # iface.hwaddress = 42:52:54:00:8b:6a
    # iface.bootproto = DHCP
    #
    #  @param [String]   stdout (where info is seperated by '=') of iscsiadm command
    #  @return [Hash]    command output converted to hash
    #
    def nodeInfoToMap(stdout)
      retval = {}
      return retval if stdout.empty?

      stdout.lines.each do |row|
        key, val = row.split("=")

        key = key.to_s.strip
        retval[key] = val.to_s.strip if !key.empty? && !key.match?(/^#/)
      end

      retval
    end

    # Get iBFT (iSCSI boot firmware table) info
    #
    # @return [Hash] iBFT data converted to a hash (passwords are hidden)
    #
    def getiBFT
      if @ibft == nil
        @ibft = {}

        unless Arch.i386 || Arch.x86_64 || Arch.aarch64 || Arch.arm
          log.info "iscsi_ibft module is not available for #{Arch.arch_short} Architecture"
          log.info "not using iBFT"
          return @ibft
        end
        ret = SCR.Execute(path(".target.bash_output"),
          "lsmod | grep -q iscsi_ibft || modprobe iscsi_ibft")
        log.info "check and modprobe iscsi_ibft: #{ret}"

        @ibft = nodeInfoToMap(getFirmwareInfo)
      end

      log.info "iBFT: #{hidePassword(@ibft)}"
      @ibft
    end

    # get accessor for service status
    #
    # NOTE: this is reliable only if {#getServiceStatus} has been called before (since that's
    # the only way to initialize @iscsid_socket and @iscsiuio_socket). Not sure if that method
    # interdependency is intentional (looks dangerous).
    def GetStartService
      status_d = socketEnabled?(@iscsid_socket)
      status_uio = socketEnabled?(@iscsiuio_socket)
      status = Service.Enabled("iscsi")
      log.info "Start at boot enabled for iscsid.socket: #{status_d}, iscsi: #{status}, iscsiuio.socket: #{status_uio}"
      log.info "Is iscsiuio relevant? #{iscsiuio_relevant?}"
      return status_d && status && !(iscsiuio_relevant? && !status_uio)
    end

    # set accessor for service status
    #
    # NOTE: this can handle the iscsid and iscsiuio sockets only if {#getServiceStatus} has been
    # called before. Not sure if that method interdependency is intentional (looks dangerous).
    def SetStartService(status)
      msg =
        if iscsiuio_relevant?
          "Set start at boot for iscsid.socket, iscsiuio.socket and iscsi.service to #{status}"
        else
          "Set start at boot for iscsid.socket and iscsi.service to #{status}"
        end
      log.info msg

      if status == true
        Service.Enable("iscsi")
        socketEnable(@iscsid_socket)
        socketEnable(@iscsiuio_socket) if iscsiuio_relevant?
      else
        Service.Disable("iscsi")
        socketDisable(@iscsid_socket)
        socketDisable(@iscsiuio_socket) if iscsiuio_relevant?
      end

      nil
    end

    # Current configuration
    #
    # returns an array with all the entries of the configuration, each entry
    # represented by hash that follows the structure of the yast init-agent.
    #
    # @return [Array<Hash>]
    def getConfig
      # use cache if available
      @config.read if @config.empty?
      @config.entries
    end

    # Updates the in-memory representation of the configuration
    #
    # @see #getConfig
    #
    # @param new_config [Array<Hash>]
    def setConfig(new_config)
      @config.entries = deep_copy(new_config)
      nil
    end

    # do we use iSNS for targets?
    def useISNS
      isns_info = { "use" => false, "address" => "", "port" => "3205" }
      # validateISNS checks for not empty address and port,
      # storeISNS adds values to config
      getConfig.each do |row|
        if row["name"] == "isns.address"
          isns_info["address"] = row["value"]
          isns_info["use"] = true
        elsif row["name"] == "isns.port"
          isns_info["port"] = row["value"]
        end
      end
      isns_info
    end

    # write temporary changed old config
    def oldConfig
      Builtins.y2milestone("Store temporary config")
      @config.save
      nil
    end

    def getNode
      cmdline = GetAdmCmd("-S -m node -I #{current_iface} -T #{current_target} -p #{current_portal}")
      cmd = SCR.Execute(path(".target.bash_output"), cmdline)
      return {} if Ops.get_integer(cmd, "exit", 0) != 0
      auth = {}
      Builtins.foreach(
        Builtins.splitstring(Ops.get_string(cmd, "stdout", ""), "\n")
      ) do |row|
        key = Ops.get(Builtins.splitstring(row, " = "), 0, "")
        val = Ops.get(Builtins.splitstring(row, " = "), 3, "")
        val = "" if val == "<empty>"
        case key
        when "node.session.auth.authmethod"
          Ops.set(auth, "authmethod", val)
        when "node.session.auth.username"
          Ops.set(auth, "username", val)
        when "node.session.auth.password"
          Ops.set(auth, "password", val)
        when "node.session.auth.username_in"
          Ops.set(auth, "username_in", val)
        when "node.session.auth.password_in"
          Ops.set(auth, "password_in", val)
        end
      end
      deep_copy(auth)
    end

    # @see #save_auth_config
    #
    # Offered for backwards compatibility
    def saveConfig(user_in, pass_in, user_out, pass_out)
      values = {
        "username_in" => user_in, "password_in" => pass_in,
        "username" => user_out, "password" => pass_out
      }
      auth = Y2IscsiClient::Authentication.new_from_legacy(values)
      save_auth_config(auth)
    end

    # Temporary change config for discovery authentication
    #
    # Writes the authentication settings to the iscsid.conf file without altering the memory
    # representation of that file that is stored at @config. That makes possible to undo the
    # changes in the file later by calling {#oldConfig}.
    #
    # @param auth [Authentication] authentication settings to use for discovery operations
    def save_auth_config(auth)
      Builtins.y2milestone("Save config")
      tmp_conf = deep_copy(@config)

      tmp_conf.set_discovery_auth(auth)
      tmp_conf.save
      nil
    end

    # Executes an iSCSI discovery using Send Targets and stores the result (the found
    # nodes) at {#targets}.
    #
    # The discovery operation will update the local send_targets database, so a subsequent
    # call to {#getDiscovered} would report the discovered nodes in addition to the previously
    # known ones.
    #
    # @return [Boolean] whether the discovery operation succeeded and {#targets} contains a
    #   valid result
    def discover(host, port, auth, only_new: false, silent: false)
      # temporarily write authentication data to /etc/iscsi/iscsi.conf
      save_auth_config(auth)

      # The discovery command can take care of loading the needed kernel modules.
      # But that doesn't work when YaST is running (and thus executing the
      # discovery command) in a container. So this loads the modules in advance
      # in a way that works in containers.
      load_modules

      command = GetDiscoveryCmd(host, port, only_new: only_new, use_fw: false)
      success, trg_list = Y2IscsiClient::TimeoutProcess.run(command, silent: silent)

      if trg_list.empty?
        command = GetDiscoveryCmd(host, port, only_new: only_new, use_fw: true)
        success, trg_list = Y2IscsiClient::TimeoutProcess.run(command, silent: silent)
      end

      self.targets = ScanDiscovered(trg_list)
      # Restore into iscsi.conf the configuration previously saved in memory
      oldConfig

      success
    end

    # Discovers iSCSI targets from a portal.
    #
    # @note This method is required by Agama in order to mimic the AutoYaST behavior while importing
    #   the iSCSI config.
    #
    # @param portal [String]
    # @param interfaces [Array<String>]
    #
    # @return [Boolean] Whether the discovery action was done.
    def discover_from_portal(portal, interfaces)
      host, port = portal.split(":")
      command = GetDiscoveryCmd(host, port, interfaces: interfaces)
      Yast::Execute.locally!(*command, env: { "LC_ALL" => "POSIX" })
      true
    rescue Cheetah::ExecutionFailed
      false
    end

    def setISNSConfig(address, port)
      @config.set_isns(address, port)
    end

    # Called for data (output) of commands:
    #  iscsiadm -m node -P 1
    #  iscsiadm -m session -P 1
    #
    # @param data [Array<String>] output of the executed command, one array entry per line
    def ScanDiscovered(data)
      ret = []
      target = ""
      portal = ""
      iface = ""
      dumped = true
      log.info "Got data: #{data}"

      # Each entry starts with Target:, the other two values are optional
      # (except the first entry) and, if missing, are inherited from previous
      # entry. Therefore: Dump whatever is cached on Target: entry and once
      # again at the end. Example input in the test case.

      data.each do |r|
        row = r.strip
        if row.include? "Target:"
          if !dumped
            # don't add Scope:Link IPv6 address
            ret << "#{portal} #{target} #{iface}" if !portal.start_with?("[fe80:")
          end
          target = row.split[1]
          dumped = false
        elsif row.include? "Portal:"
          if /(Current|Persistent) Portal:/.match?(row)
            # 'Persistent Portal' overwrites current (is used for login)
            portal = row.split[2]
          else
            # read 'Portal' (from output of -m node)
            portal = row.split[1]
          end
          portal = portal.split(",")[0] if portal.include?(",")
        elsif row.include? "Iface Name:"
          iface = row.split[2]
          iface = (@iface_file || {}).dig(iface, :name) || iface
          # don't add Scope:Link IPv6 address
          ret << "#{portal} #{target} #{iface}" if !portal.start_with?("[fe80:")
          dumped = true
        end
      end
      if !dumped
        # don't add Scope:Link IPv6 address
        ret << "#{portal} #{target} #{iface}" if !portal.start_with?("[fe80:")
      end

      log.info "ScanDiscovered ret:#{ret}"
      ret
    end

    # Read all discovered targets from the local nodes database, storing the result in the
    # {#discovered} attribute
    def getDiscovered
      retcode = SCR.Execute(path(".target.bash_output"), GetAdmCmd("-m node -P 1"))
      @discovered =
        retcode["stderr"].to_s.empty? ? ScanDiscovered(retcode["stdout"].to_s.split("\n")) : []
    end

    def start_services_initial
      # start service 'iscsiuio' and daemon 'iscsid'
      Service.Start("iscsiuio")
      start_iscsid_initial
    end

    def restart_iscsid_initial
      retcode = SCR.Execute(path(".target.bash"), "pgrep iscsid")
      Service.Stop("iscsid") if retcode == 0
      start_iscsid_initial
    end

    def start_iscsid_initial
      SCR.Execute(path(".target.bash"), "pgrep iscsid || iscsid")
      10.times do |i|
        Builtins.sleep(1 * 1000)
        cmd = SCR.Execute(path(".target.bash_output"), GetAdmCmd("-m session"))
        Builtins.y2internal("iteration %1, retcode %2", i, cmd["exit"])
        # Both exit codes 0 and 21 may indicate success.
        # See discussion in bsc#1131049.
        if [0, 21].include?(cmd["exit"])
          Builtins.y2internal("Good response from daemon, exit.")
          break
        end
      end

      nil
    end

    # Get all connected targets storing the result in the #sessions attribute
    def readSessions
      log.info "reading current settings"
      ret = SCR.Execute(path(".target.bash_output"), GetAdmCmd("-m session -P 1"))
      @sessions = ScanDiscovered(ret.fetch("stdout", "").split("\n"))
      log.info "Return list from iscsiadm -m session: #{@sessions}"
      true
    end

    # write InitiatorName, create backup from previous if needed
    def writeInitiatorName(new_value)
      ret = true
      file = "/etc/iscsi/initiatorname.iscsi"
      dir = "/etc/iscsi"
      if Convert.to_map(SCR.Read(path(".target.stat"), dir)) == {}
        SCR.Execute(path(".target.mkdir"), dir)
        Builtins.y2milestone(
          "writeInitiatorName dir:%1",
          SCR.Read(path(".target.stat"), dir)
        )
      end
      if Ops.greater_than(
        Ops.get_integer(
          Convert.convert(
            SCR.Read(path(".target.lstat"), file),
            :from => "any",
            :to   => "map <string, any>"
          ),
          "size",
          0
        ),
        0
      )
        Builtins.y2milestone("%1 file exists, create backup", file)
        SCR.Execute(
          path(".target.bash"),
          Builtins.sformat("mv %1 /etc/iscsi/initiatorname.yastbackup", file.shellescape)
        )
      end
      ret = SCR.Write(
        path(".target.string"),
        [file, 384],
        Builtins.sformat("InitiatorName=%1\n", new_value)
      )
      if ret
        @initiatorname = new_value
        Builtins.y2milestone("Initiatorname %1 written", @initiatorname)
      end
      # reload service when initiatorname is changed to re-read new value (bnc#482429)
      # SLES12: restart the daemon (reload not supported in iscsid.service)
      if Stage.initial
        restart_iscsid_initial
      else
        Service.Restart("iscsid")
      end
      ret
    end

    def getReverseDomainName
      host_fq = Hostname.SplitFQ(
        Ops.get_string(
          SCR.Execute(path(".target.bash_output"), "hostname -f | tr -d '\n'"),
          "stdout",
          ""
        )
      )
      Builtins.y2internal("hostfw%1", host_fq)
      domain = ""

      Builtins.foreach(
        Builtins.splitstring(Ops.get(host_fq, 1, "example.com"), ".")
      ) do |item|
        Builtins.y2internal("item %1", item)
        domain = (Builtins.size(domain) == 0) ?
          item :
          Builtins.sformat("%1.%2", item, domain)
      end

      Builtins.y2milestone("domain %1", domain)
      domain
    end

    # check initiatorname if exist, if no - create it
    def checkInitiatorName(silent: false)
      ret = true
      file = "/etc/iscsi/initiatorname.iscsi"
      name_from_bios = getiBFT["iface.initiatorname"] || ""
      # if (size((map<string, any>)SCR::Read (.target.lstat, file)) == 0 || ((map<string, any>)SCR::Read (.target.lstat, file))["size"]:0==0){
      @initiatorname = Ops.get_string(
        SCR.Execute(
          path(".target.bash_output"),
          Builtins.sformat(
            "grep -v '^#' %1 | grep InitiatorName | cut -d'=' -f2 | tr -d '\n'",
            file.shellescape
          )
        ),
        "stdout",
        ""
      )
      # }
      if Builtins.size(@initiatorname) == 0
        if Ops.greater_than(Builtins.size(name_from_bios), 0)
          Builtins.y2milestone(
            "%1 is empty or doesnt exists - replace with name stored in iBFT",
            file
          )
          @initiatorname = name_from_bios
        else
          Builtins.y2milestone("InitiatorName does not exist - generate it")
          output = SCR.Execute(
            path(".target.bash_output"),
            Builtins.sformat(
              "iscsi-iname -p iqn.%1.%2:01 | tr -d '\n'",
              "`date +%Y-%m`",
              getReverseDomainName.shellescape
            ),
            {}
          )
          if Builtins.size(Ops.get_string(output, "stderr", "")) == 0
            @initiatorname = Ops.get_string(output, "stdout", "")
          else
            ret = false
          end
        end
        ret = writeInitiatorName(@initiatorname)
      else
        Builtins.y2milestone(
          "checkInitiatorName initiatorname=%1",
          @initiatorname
        )
        if Ops.greater_than(Builtins.size(name_from_bios), 0) &&
            name_from_bios != @initiatorname
          if !silent
            Popup.Warning(
              _(
                "InitiatorName from iBFT and from <tt>/etc/iscsi/initiatorname.iscsi</tt>\n" \
                  "differ. The old initiator name will be replaced by the value of iBFT and a \n" \
                  "backup created. If you want to use a different initiator name, change it \n" \
                  "in the BIOS.\n"
              )
            )
          end
          Builtins.y2milestone(
            "replacing old name %1 by name %2 from iBFT",
            @initiatorname,
            name_from_bios
          )
          @initiatorname = name_from_bios
          ret = writeInitiatorName(@initiatorname)
        end
      end
      ret
    end

    # Logout from the target (ie. remove the corresponding session)
    #
    # This does not delete the target from nodes database. The name of the method is plain wrong
    # for historical reasons.
    #
    # To delete a record from the database of discovered targets, see {#removeRecord} instead.
    #
    # @return [Boolean] false if the logout operation reports any error or true if it succeeds (note
    #   {#sessions} gets refreshed in the latter case)
    def deleteRecord
      ret = true
      log.info "Delete record #{@currentRecord}"

      retcode = SCR.Execute(
        path(".target.bash_output"),
        GetAdmCmd("-m node -I #{current_iface} -T #{current_target} -p #{current_portal} --logout")
      )
      return false unless retcode["stderr"].to_s.empty?

      readSessions
      ret
    end

    # Delete the current node from the database of discovered targets
    #
    # It does not check whether the node is connected. Bear in mind the result in that case is
    # uncertain. According to our manual tests, if you try to delete a node upon which a session is
    # based, iscsiadm will refuse the request leaving the node entry in the database intact. On the
    # other hand iscsiadm manpage states the following. "Delete should not be used on a running
    # session. If it is iscsiadm will stop the session and then delete the record."
    #
    # @return [Boolean] whether the operation succeeded with no incidences
    def removeRecord
      log.info "Remove record #{@currentRecord}"

      result = SCR.Execute(
        path(".target.bash_output"),
        GetAdmCmd("-m node -T #{current_target} -p #{current_portal} -I #{current_iface} --op=delete")
      )
      log.info(result.inspect)
      result["exit"].zero?
    end

    # Get info about current iSCSI node
    #
    # @return [Hash]    stdout of 'iscsiadm -m node -I <iface> -T <target> -p <ip>'
    #                   converted to a hash
    def getCurrentNodeValues
      ret = SCR.Execute(path(".target.bash_output"),
        GetAdmCmd("-m node -I #{current_iface} -T #{current_target} -p #{current_portal}"))
      return {} if ret["exit"] != 0

      nodeInfoToMap(ret["stdout"] || "")
    end

    # Check whether iSCSI nodes are equal
    #
    # @param n1  [Hash]    iSCSI node values as hash
    # @param n2  [Hash]    iSCSI node values as hash
    #
    # @return  [Bool]    nodes are equal?
    #
    def equalNodes?(n1, n2)
      return false if n1.empty? || n2.empty?

      # we're going to modify one key...
      n1 = n1.dup
      n2 = n2.dup

      # if unset, use default from /etc/iscsi/initiatorname.iscsi
      n1["iface.initiatorname"] = @initiatorname if n1["iface.initiatorname"] == "<empty>"
      n2["iface.initiatorname"] = @initiatorname if n2["iface.initiatorname"] == "<empty>"

      keys = [
        "iface.transport_name",
        "iface.initiatorname",
        "node.name",
        "node.conn[0].address"
      ]

      keys.all? { |key| n1[key] == n2[key] }
    end

    # Checks whether iSCSI session (values provided as hash) is iBFT session
    #
    # @param node_info [Hash]      iSCSI node values as hash
    # @return [Bool]      is iSCSI session booted from firmware?
    #
    def iBFT?(node_info)
      return equalNodes?(getiBFT, node_info)
    end

    # Get (manual/onboot/automatic) status of target connection
    #
    # @return [String]   startup status of the iSCSI node
    #
    def getStartupStatus
      log.info "Getting status of record #{@currentRecord}"
      curr_node = getCurrentNodeValues

      if iBFT?(curr_node)
        # always show status "onboot" for iBFT (startup value from node doesn't matter)
        log.info "Startup status for iBFT is always onboot"
        return "onboot"
      end
      status = curr_node["node.conn[0].startup"] || ""

      if Arch.s390 && status == "onboot"
        log.info "Startup status on S/390 changed from onboot to automatic"
        return "automatic"
      end

      log.info "Startup status for #{@currentRecord} is #{status}"

      status
    end

    # Default startup status (manual/onboot/automatic) for newly created sessions
    #
    # @see #setStartupStatus
    # @see #loginIntoTarget
    #
    # @return [String]
    def default_startup_status
      # Based on bnc#400610
      "onboot"
    end

    # update authentication value
    def setValue(name, value)
      log.info "set #{name} for record #{@currentRecord}"

      login = !name.include?("password")
      cmd = "-m node -I #{current_iface} -T #{current_target} -p #{current_portal} --op=update --name=#{name.shellescape}"

      command = GetAdmCmd("#{cmd} --value=#{value.shellescape}", login)
      if !login
        value = "*****" if !value.empty?
        log.info "AdmCmd:LC_ALL=POSIX iscsiadm #{cmd} --value=#{value}"
      end

      ret = true
      retcode = SCR.Execute(path(".target.bash_output"), command)
      unless retcode["stderr"].to_s.empty?
        log.error retcode["stderr"]
        return false
      end
      log.info "return value #{ret}"
      ret
    end

    # check whether two given IP addresses (including ports) are equal
    def ipEqual?(session_ip, current_ip)
      return false if !session_ip || !current_ip
      return false if session_ip.empty? || current_ip.empty?

      if !session_ip.start_with?("[") && !current_ip.start_with?("[")
        # both IPv4 - compare directly
        return session_ip == current_ip
      elsif session_ip.start_with?("[") && current_ip.start_with?("[")
        # both IPv6 - compare IPv6 and port separately
        ip_port_regex = /\[([:\w]+)\](:(\d+))?/

        if match_data = session_ip.match(ip_port_regex)
          s_ip = IPAddr.new(match_data[1] || "")
          s_port = match_data[3] || ""
        else
          Builtins.y2error("Session IP %1 not matching", session_ip)
          return false
        end
        if match_data = current_ip.match(ip_port_regex)
          c_ip = IPAddr.new(match_data[1] || "")
          c_port = match_data[3] || ""
        else
          Builtins.y2error("Current IP %1 not matching", current_ip)
          return false
        end
        return (s_ip == c_ip) && (s_port == c_port)
      else
        # comparing IPv4 and IPv6
        return false
      end
    rescue ArgumentError => e
      Builtins.y2error("Invalid IP address, error: %1", e.to_s)
      false
    end

    # check if given target is connected
    def connected(check_ip)
      log.info "check connected status for #{@currentRecord} with IP check:#{check_ip}"
      !!find_session(check_ip)
    end

    # Find the current record in the list of sessions
    #
    # @param check_ip [Boolean] whether the ip address must be considered in the comparison
    # @return [String, nil] corresponding entry from #sessions or nil if not found
    def find_session(check_ip)
      @sessions.find do |row|
        ip_ok = true
        list_row = row.split
        log.info "Session row: #{list_row}"
        if check_ip
          session_ip = list_row[0].to_s.split(",")[0].to_s
          current_ip = @currentRecord[0].to_s.split(",")[0].to_s
          ip_ok = ipEqual?(session_ip, current_ip)
        end

        (list_row[1] == @currentRecord[1]) && (list_row[2] == @currentRecord[2]) && ip_ok
      end
    end

    # change startup status (manual/onboot) for target
    def setStartupStatus(status)
      log.info "Set startup status for #{@currentRecord} to #{status}"
      ret = true
      retcode = SCR.Execute(
        path(".target.bash_output"),
        GetAdmCmd(
          Builtins.sformat(
            "-m node -I %3 -T %1 -p %2 --op=update --name=node.conn[0].startup --value=%4",
            current_target,
            current_portal,
            current_iface,
            status.shellescape
          )
        )
      )
      if retcode["stderr"].to_s.empty?
        retcode = SCR.Execute(
          path(".target.bash_output"),
          GetAdmCmd(
            Builtins.sformat(
              "-m node -I %3 -T %1 -p %2 --op=update --name=node.startup --value=%4",
              current_target,
              current_portal,
              current_iface,
              status.shellescape
            )
          )
        )
      else
        ret = false
      end

      log.info "retcode #{retcode}"
      ret
    end

    # Logs into the targets specified by iBFT
    def autoLogOn
      ret = true
      log.info "begin of autoLogOn function"
      if !getiBFT.empty?
        result = SCR.Execute(path(".target.bash_output"), GetAdmCmd("-m fw -l"))
        ret = false if result["exit"] != 0
        log.info "Autologin into iBFT : #{result}"
        # Give iSCSI some time, even if logon was not 100% successful
        autologon_delay
      end
      log.info "end of autoLogOn function"
      ret
    end

    # Perform an iSCSI login operation into the specified target
    #
    # Modifies {#currentRecord}
    # @see #login_into_current
    #
    # @param target [Hash{String => String}] a hash with the mandatory keys "portal", "target" and
    #   "iface" and with the optional "authmethod", "username", "username_in", "password" and
    #   "password_in".
    def loginIntoTarget(target)
      target = deep_copy(target)
      @currentRecord = [target["portal"].to_s, target["target"].to_s, target["iface"].to_s]

      auth = Y2IscsiClient::Authentication.new_from_legacy(target)
      login_into_current(auth)

      # This line was added a long time ago (in the context of bnc#400610) when the YaST UI didn't
      # offer the possibility of specifying the startup mode as part of the login action.
      # The effect back then was to set "onboot" as the default mode. Likely its only effect
      # nowadays in YaST is to set the status twice with no benefit, first to "onboot" and then to
      # the value specified by the user. Nevertheless, we decided to keep the line to not alter the
      # behavior of loginIntoTarget, which is part of the module API.
      setStartupStatus(default_startup_status) if !Mode.autoinst
      true
    end

    # Perform an iSCSI login operation into the node described at {#currentRecord}
    #
    # @param auth [Y2IscsiClient::Authentication] auth information for the login operation
    # @param silent [Boolean] whether visual error reporting should be suppressed
    # @return [Boolean] whether the operation succeeded with no incidences
    def login_into_current(auth, silent: false)
      if auth.chap?
        setValue("node.session.auth.authmethod", "CHAP")
        setValue("node.session.auth.username", auth.username)
        setValue("node.session.auth.password", auth.password)
        if auth.by_initiator?
          setValue("node.session.auth.username_in", auth.username_in)
          setValue("node.session.auth.password_in", auth.password_in)
        end
      else
        setValue("node.session.auth.authmethod", "None")
      end

      output = SCR.Execute(
        path(".target.bash_output"),
        GetAdmCmd("-m node -I #{current_iface} -T #{current_target} -p #{current_portal} --login")
      )

      Builtins.y2internal("output %1", output)

      # Only log the fact that the session is already present (not an error at all)
      # to avoid a popup for AutoYaST install (bsc#981693)
      if output["exit"] == 15
        Builtins.y2milestone("Session already present %1", output["stderr"] || "")
        return false
      # Report a warning (not an error) if login failed for other reasons
      # (also related to bsc#981693, warning popups usually are skipped)
      elsif output["exit"] != 0
        if silent
          Builtins.y2milestone("Target connection failed %1", output["stderr"] || "")
        else
          Report.Warning(_("Target connection failed.\n") + output["stderr"] || "")
        end
        return false
      end

      true
    end

    # Starts iscsi-related services if they are not running
    #
    # As a side effect, it also takes care of initializing the @iscsid_socket and @iscsiuio_socket
    # instance variables that are basic for other methods to work as expected.
    #
    # FIXME: The name gives a totally wrong impression on the method responsibilities and
    # functionality. It seems to suggest it should simply return the status of the services.
    #
    # @return [Boolean] true in all cases, which looks suspicious
    def getServiceStatus
      ret = true
      if Stage.initial
        load_modules
        # start daemon manually (systemd not available in inst-sys)
        start_services_initial
      else
        # find sockets (only in installed system)
        # throw exception if socket not found
        @iscsid_socket = Yast2::Systemd::Socket.find!("iscsid")
        @iscsiuio_socket = Yast2::Systemd::Socket.find!("iscsiuio")

        iscsi_service_stat = Service.active?("iscsi")
        iscsid_socket_stat = socketActive?(@iscsid_socket)
        iscsiuio_socket_stat = socketActive?(@iscsiuio_socket)

        log.info "Status of iscsi.service: #{iscsi_service_stat}, iscsid.socket: #{iscsid_socket_stat}, iscsiuio.socket: #{iscsiuio_socket_stat}"

        # if not running, start iscsi.service, iscsid.socket and iscsiuio.socket
        if !iscsid_socket_stat
          Service.Stop("iscsid") if Service.active?("iscsid")
          log.error "Cannot start iscsid.socket" if !socketStart(@iscsid_socket)
        end
        if !iscsiuio_socket_stat
          Service.Stop("iscsiuio") if Service.active?("iscsiuio")
          log.error "Cannot start iscsiuio.socket" if !socketStart(@iscsiuio_socket)
        end
        if !iscsi_service_stat && !Service.Start("iscsi")
          log.error "Cannot start iscsi.service"
        end
      end
      ret
    end

    # Stops immediately all iscsi-related services and sockets if those services are disabled and
    # there are no running sessions.
    #
    # NOTE: this only works in the installed system, it does nothing during installation.
    #
    # NOTE: this is reliable only if {#getServiceStatus} has been called before (since that's
    # the only way to initialize @iscsid_socket and @iscsiuio_socket). Not sure if that method
    # interdependency is intentional (looks dangerous).
    #
    # FIXME: The name gives a totally wrong impression on the method functionality. This method
    # is only useful to stop services, it never starts/enables/disables any service.
    #
    # @return [Boolean] true in all cases, which looks suspicious
    def setServiceStatus
      ret = true
      # only makes sense in installed system
      if !Stage.initial
        # if disabled and no connected targets - stop it
        # otherwise keep it running
        if !GetStartService()
          readSessions
          if Builtins.size(@sessions) == 0
            log.info "No active sessions - stopping iscsi service and iscsid/iscsiuio service and socket"
            # stop iscsid.socket and iscsid.service
            socketStop(@iscsid_socket)
            Service.Stop("iscsid")
            # stop iscsiuio.socket and iscsiuio.service
            socketStop(@iscsiuio_socket)
            Service.Stop("iscsiuio")
            # stop iscsi.service
            Service.Stop("iscsi")
          end
        end
      end
      log.info "Status service for iscsid: #{ret}"
      ret
    end

    def autoyastPrepare
      @initiatorname = Ops.get_string(@ay_settings, "initiatorname", "")
      if Ops.greater_than(Builtins.size(@initiatorname), 0)
        file = "/etc/iscsi/initiatorname.iscsi"
        SCR.Write(
          path(".target.string"),
          [file, 384],
          Builtins.sformat("InitiatorName=%1\n", @initiatorname)
        )
      else
        checkInitiatorName
      end
      # start daemon before
      start_services_initial

      nil
    end

    def autoyastWrite
      # do discovery first
      portals = []
      ifaces = []
      ifacepar = ""
      @ay_settings.fetch("targets", []).each do |target|
        iface = target.fetch("iface", "default")
        next if ifaces.include?(iface) # already added

        ifacepar << " " unless ifacepar.empty?
        ifacepar << "-I " << iface.shellescape
        ifaces << iface
      end

      # rubocop:disable Style/CombinableLoops
      @ay_settings.fetch("targets", []).each do |target|
        next if portals.include? target["portal"]
        SCR.Execute(
          path(".target.bash"),
          GetAdmCmd(%(-m discovery #{ifacepar} -t st -p #{target["portal"].shellescape}))
        )
        portals << target["portal"]
        log.info "login into target #{target}"
        loginIntoTarget(target)
        @currentRecord = [target["portal"], target["target"], target["iface"]]
        setStartupStatus(target.fetch("startup", "manual"))
      end
      # rubocop:enable Style/CombinableLoops
      true
    end

    def Overview
      overview = _("Configuration summary...")
      unless (@ay_settings || {}).empty?
        overview = ""
        initiatorname = @ay_settings.fetch("initiatorname", "")
        targets = @ay_settings.fetch("targets", [])
        unless initiatorname.empty?
          overview << "<p><b>Initiatorname: </b>#{initiatorname}</p>"
        end
        unless targets.empty?
          targets.each do |t|
            overview << "<p>#{t["portal"]}, #{t["target"]}, #{t["iface"]}, #{t["startup"]}</p>"
          end
        end
      end
      overview
    end

    def InitIface
      ret = "default"
      retcode = SCR.Execute(path(".target.bash_output"), GetAdmCmd("-m node -P 1"))
      ifaces = []
      if retcode["stderr"].empty?
        ScanDiscovered(retcode["stdout"].split("\n")).each do |s|
          iface_name = s.split[2].to_s
          next if iface_name.empty? || ifaces.include?(iface_name)

          ifaces << iface_name
        end
      end
      log.info "InitIface ifaces:#{ifaces}"
      if ifaces.size > 1
        ret = "all"
      elsif (@iface_file || {}).keys.include?(ifaces.first)
        ret = ifaces.first
      end
      log.info "InitIface ret:#{ret}"
      @iface = ret
    end

    def iface_value(content, field)
      content.find { |l| l.include? field }.to_s.gsub(/[[:space:]]/, "").split("=")[1]
    end

    def read_ifaces
      InitIfaceFile()
      InitIface()
    end

    def InitIfaceFile
      @iface_file = {}
      files = SCR.Read(path(".target.dir"), "/etc/iscsi/ifaces") || []
      log.info "InitIfaceFile files: #{files}"
      if files.empty?
        cmd = GetAdmCmd("-m iface")
        res = SCR.Execute(path(".target.bash_output"), cmd)
        log.info "InitIfaceFile cmd: #{cmd}\nres: #{res.inspect}"
        files = SCR.Read(path(".target.dir"), "/etc/iscsi/ifaces") || []
        log.info "InitIfaceFile files: #{files}"
      end
      files.each do |file|
        ls = SCR.Read(path(".target.string"), "/etc/iscsi/ifaces/#{file}").split("\n")
        log.info "InitIfaceFile file: #{file}\nInitIfaceFile ls: #{ls}"
        ls.reject! { |l| l.start_with?(/\s*#/) }
        iface_name = ls.find { |l| l.include? "iface.iscsi_ifacename" }.to_s
        log.info "InitIfaceFile ls: #{iface_name}"
        next if iface_name.empty?
        name = iface_name.gsub(/[[:space:]]/, "").split("=")[1]
        dev_name = iface_value(ls, "iface.net_ifacename")
        transport = iface_value(ls, "iface.transport")
        hwaddress = iface_value(ls, "iface.hwaddress")
        ipaddress = iface_value(ls, "iface.ipaddress")
        @iface_file[name] = { :name => name, :dev => dev_name, :transport => transport, :hwaddress => hwaddress, :ip => ipaddress }
      end
      log.info "InitIfaceFile iface_file: #{@iface_file}"

      nil
    end

    def default_item
      Item(Id(@offload[0][0]), @offload[0][1], @iface == @offload[0][0])
    end

    def all_item
      Item(Id(@offload[1][0]), @offload[1][1], @iface == @offload[1][0])
    end

    def iface_items
      if @iface_file.nil?
        InitIfaceFile()
        InitIface()
      end

      items = [default_item]
      items << all_item if @iface_file.any?

      @iface_file.each { |n, e| items << Item(Id(n), iface_label(e), @iface == n) }
      items
    end

    # Modules to use for all the cards detected in the system and that support hardware
    # offloading, no matter whether those cards are indeed configured
    #
    # The module to use for each card is determined by the fourth element of the
    # corresponding entry at @offload.
    #
    # @return [Array<String>]
    def GetOffloadModules
      InitOffloadValid() if @offload_valid == nil
      modules = []
      @offload_valid.each { |i, _| modules.concat(@offload[i][3]) }
      log.info "GetOffloadModules #{modules}"
      modules.uniq
    end

    def LoadOffloadModules
      mods = GetOffloadModules()
      mods.each do |s|
        log.info "Loading module #{s}"
        ModuleLoading.Load(s, "", "", "", false, true)
      end
      mods
    end

    # It returns a list of iscsi ifaces corresponding to the current offload card selection, "default" will return
    # an array with the current offload card while all will return an array with all the offlocad valid ifaces
    #
    # @return [Array<String>] List os iscsi ifaces for the current offload card selection, ex. ["eth2-bnx2i"]
    def GetDiscIfaces
      ifaces = (@iface == "all") ? @iface_file.keys : [@iface]
      log.info "GetDiscIfaces:#{ifaces}"
      ifaces
    end

    # Obtains the parameters for calling iscsiadm in discovery mode depending on the current
    # iSNS configuration as well as the parameters given
    #
    # ex.
    #   GetDiscoveryCmd("192.168.0.100", "3260") =>
    #     ["iscsiadm", "-m", "discovery", "-P", "1", "-t", "st", "-p", "192.168.0.100:3260"]
    #
    # @param ip [String] Portal IP address
    # @param port [String] Portal port number
    # @param interfaces [Array<String>, nil] Interfaces for discovering. If nil, discover without a
    #   specific interface.
    # @param use_fw [Boolean] whether the target should be fw or not
    # @param only_new [Boolean] whether a new record should be created
    # @return [Array<String>]
    def GetDiscoveryCmd(ip, port, interfaces: nil, use_fw: false, only_new: false)
      log.info "GetDiscoveryCmd ip:#{ip} port:#{port} fw:#{use_fw} only new:#{only_new}"

      command = DISCOVERY_CMD.split
      isns_info = useISNS
      if isns_info["use"]
        command << "-t" << "isns"
      else
        ifs = interfaces || GetDiscIfaces()
        log.info "ifs=#{ifs}"
        ifs = ifs.map { |i| ["-I", i] }.flatten
        log.info "ifs=#{ifs}"
        tgt = "st"
        tgt = "fw" if use_fw
        command << "-t" << tgt
        command.concat(ifs)
      end

      command << "-p" << "#{ip}:#{port}"
      command << "-o" << "new" if only_new

      log.info "GetDiscoveryCmd #{command}"
      command
    end

    # Whether the system contains any offload card that would need the iscsiuio user-space
    # I/O driver (see bsc#1194432)
    #
    # No matter where the card is configured or not
    #
    # @return [Boolean]
    def iscsiuio_relevant?
      # qedi devices could not have any network device associated with it therefore reading the
      # system netcard could be wrong and in that case we will check also the configured iscsi
      # ifaces (bsc#1236433).
      configured = (@iface_file || {}).values.map { |i| i[:transport] }.uniq

      (ISCSIUIO_MODULES & (GetOffloadModules() | configured)).any?
    end

    # Loads the kernel modules needed to configure the iscsi client
    def load_modules
      ModuleLoading.Load("iscsi_tcp", "", "", "", false, true)
    end

    publish :variable => :sessions, :type => "list <string>"
    publish :variable => :discovered, :type => "list <string>"
    publish :variable => :targets, :type => "list <string>"
    publish :variable => :currentRecord, :type => "list <string>"
    publish :variable => :initiatorname, :type => "string"
    publish :variable => :ay_settings, :type => "map"
    publish :function => :GetAdmCmd, :type => "string (string)"
    publish :function => :hidePassword, :type => "map <string, any> (map <string, any>)"
    publish :function => :getiBFT, :type => "map <string, any> ()"
    publish :function => :GetStartService, :type => "boolean ()"
    publish :function => :SetStartService, :type => "void (boolean)"
    publish :function => :getConfig, :type => "list <map <string, any>> ()"
    publish :function => :setConfig, :type => "void (list)"
    publish :function => :useISNS, :type => "map <string, any> ()"
    publish :function => :oldConfig, :type => "void ()"
    publish :function => :getNode, :type => "map <string, any> ()"
    publish :function => :saveConfig, :type => "void (string, string, string, string)"
    publish :function => :setISNSConfig, :type => "void (string, string)"
    publish :function => :ScanDiscovered, :type => "list <string> (list <string>)"
    publish :function => :getDiscovered, :type => "list <string> ()"
    publish :function => :start_services_initial, :type => "void ()"
    publish :function => :readSessions, :type => "boolean ()"
    publish :function => :writeInitiatorName, :type => "boolean (string)"
    publish :function => :checkInitiatorName, :type => "boolean ()"
    publish :function => :deleteRecord, :type => "boolean ()"
    publish :function => :getStartupStatus, :type => "string ()"
    publish :function => :setValue, :type => "boolean (string, string)"
    publish :function => :connected, :type => "boolean (boolean)"
    publish :function => :setStartupStatus, :type => "boolean (string)"
    publish :function => :autoLogOn, :type => "boolean ()"
    publish :function => :loginIntoTarget, :type => "boolean (map)"
    publish :function => :getServiceStatus, :type => "boolean ()"
    publish :function => :setServiceStatus, :type => "boolean ()"
    publish :function => :autoyastPrepare, :type => "boolean ()"
    publish :function => :autoyastWrite, :type => "boolean ()"
    publish :function => :Overview, :type => "string ()"
    publish :function => :iface_items, :type => "list <term> ()"
    publish :function => :GetOffloadModules, :type => "list <string> ()"
    publish :function => :LoadOffloadModules, :type => "list <string> ()"
    publish :function => :getCurrentNodeValues, :type => "map <string, any> ()"
    publish :function => :iBFT?, :type => "boolean (map <string, any>)"

  private

    def current_target
      @currentRecord[1].to_s.shellescape
    end

    def current_portal
      @currentRecord[0].to_s.shellescape
    end

    def current_iface
      @currentRecord.fetch(2, "default").shellescape
    end

    def bring_up(card_names)
      log.info "Bringing up #{card_names}"

      card_names.each { |n| Yast::Execute.locally!("ip", "link", "set", "dev", n, "up") }
    end

    def InitOffloadValid
      read_ifaces if @iface_file.nil?
      card_names = []

      @offload_valid = potential_offload_cards
      @offload_valid.values.flatten(1).each do |card|
        next if card["iface"].to_s.empty?
        next if card_names.include? card["iface"]
        card_names << card["iface"]
      end

      bring_up(card_names) unless card_names.empty?
      log.info "OffloadValid entries: #{@offload_valid}"
      nil
    end

    # List of modules for the given card description
    #
    # The card description must be a hash in the format returned by the
    # probe.netcard agent (ie. libhd, a.k.a. hwinfo).
    #
    # Such a netcard hash contains a "drivers" entry which is an array in which
    # every element represents a driver.
    #
    # Such a driver is represented by a hash with the following structure:
    # {
    #   "active"   => [Boolean] whether the corresponding modules are already loaded
    #   "modprobe" => [Boolean] whether modprobe or insmod is to be used for loading
    #   "modules   => [Array<Array<String>>] list of modules, with this structure:
    #                 [ [<modname1>, <modargs1>], [<modname2>, <modargs2>], ... ]
    # }
    #
    # @param card [Hash] description of a netcard as returned by the probe.netcard agent
    # @return [Array<String>] names of modules
    def netcard_modules(card)
      return [] unless card.key?("drivers")

      card["drivers"].flat_map { |d| d["modules"].map(&:first) }
    end

    # Cards in the system that match with the types described by @offload
    #
    # return [Hash] cards grouped by type, in the same format used by @offload_valid
    #   (with a small exception, the cards don't include a field for the IP address)
    def potential_offload_cards
      # Store into hw_mods information about all the cards in the system
      cards = SCR.Read(path(".probe.netcard"))
      hw_mods = cards.map do |c|
        log.info "GetOffloadItems card:#{c}"
        hw_mod = {
          "modules" => netcard_modules(c),
          "iface"   => c["dev_name"] || "",
          "macaddr" => c.dig("resource", "hwaddr", 0, "addr") || ""
        }
        log.info "OffloadCards hw:#{hw_mod}"
        hw_mod
      end

      result = {}
      @offload.each.with_index do |offload_entry, idx|
        modules = offload_entry[2]
        # Ignore this offload entry if it does not specify any module to do the match
        next if modules.empty?

        hw_mods.each do |hw|
          # Ignore this card unless it has some module in common with the offload entry
          next if (modules & hw["modules"]).empty?

          log.info "GetOffloadItems l:#{offload_entry}"
          log.info "GetOffloadItems valid:#{hw}"
          result[idx] ||= []
          result[idx] << hw
        end
      end

      result
    end

    # Current IP address of the given network interface
    def ip_addr(dev_name)
      stdout = Yast::Execute.on_target!("ip", "addr", "show", dev_name,
        stdout:             :capture,
        stderr:             :capture,
        allowed_exitstatus: 0..127,
        env:                { "LC_ALL" => "POSIX" })[0]
      # Search for lines containing "inet", means IPv4 address.
      # Regarding the IPv6 support there are no changes needed here because
      # the IP address is not used farther.
      address_line = stdout.split("\n").find { |l| l.start_with?(/\s*inet /) } || ""
      log.info "IP Address Line for #{dev_name}: #{address_line}"

      ipaddr = "unknown"

      return ipaddr if address_line.empty?

      ipaddr = address_line.gsub!(/\s*inet /, "").split("/").first
      log.info "IP Address for #{dev_name}: #{ipaddr}"

      ipaddr
    end

    def iface_label(data)
      [data[:name], data[:ip]].compact.join(" - ")
    end

    def card_label(card, type_label)
      dev_name = card[0]
      hwaddr = card[1]
      hwaddr = nil if hwaddr&.empty?

      [dev_name, hwaddr, type_label].compact.join(" - ")
    end

    # Method to be called after an iBFT login, to mitigate some known timing issues.
    #
    # See bsc#1247711 for some background.
    #
    # When this method is called, we are already logged into the iSCSI targets. But device detection
    # in the kernel is asynchronous and the corresponding iSCSI devices may take some time to appear
    # in the system. Moreover, there is no guarantee that the devices will all show up. According to
    # a comment at bsc#1247711: "One or more paths being down is an acceptable situation. They
    # may/should come up later, but there is no requirement that they be there at any given time".
    #
    # That could be a big problem for yast-storage-ng, which expects a complete and stable set of
    # devices during its probing phase (eg. to properly detect multipath).
    def autologon_delay
      log.info "Giving some time to iSCSI"
      sleep(10)
      # Execute the following command just for logging purposes, it shows the relationship between
      # existing sessions and kernel device names. Theoretically it could be used to detect whether
      # all devices are available before the hard-coded delay of the previous line, but we decided
      # to keep the code simple.
      res = SCR.Execute(path(".target.bash_output"), GetAdmCmd("-m session -P3"))
      log.info "iscsiadm result: #{res}"
      # Invoking udevadm just in case some of the devices showed up but it is not ready yet.
      # This probably makes no difference, but it will not hurt either.
      Yast::Execute.locally("/usr/bin/udevadm", "settle", "--timeout=15")
    end
  end

  IscsiClientLib = IscsiClientLibClass.new
  IscsiClientLib.main
end

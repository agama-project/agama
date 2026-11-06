# |***************************************************************************
# |
# | Copyright (c) [2023] SUSE LLC
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

# Vendored from yast2-iscsi-client's src/lib/y2iscsi_client/finish_client.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-iscsi-client`
# RPM is no longer a runtime dependency of Agama.

require "yast"
require "installation/finish_client"
require "yast2/systemd/socket"
require "yast2/execute"
require "fileutils"

Yast.import "IscsiClientLib"
Yast.import "Installation"
Yast.import "Service"

module Y2IscsiClient
  # Finish client implementing the operations needed to transfer the iSCSI configuration to the
  # target system at the end of installation
  class FinishClient < ::Installation::FinishClient
    include Yast::I18n

    def initialize
      super
      textdomain "iscsi-client"
    end

    def title
      _("Saving iSCSI configuration...")
    end

    def modes
      [:installation, :update, :autoinst]
    end

    def write
      copy_configuration
      enable
    end

  private

    # Copies open-iscsi configuration and databases to the target system
    def copy_configuration
      copy_directory("/etc/iscsi")
      copy_directory("/var/lib/iscsi")
    end

    # Copies the content of the given directory to the target system only if the
    # directory exists in the int-sys
    #
    # @param dir [String] path of the directory to copy
    def copy_directory(dir)
      return unless File.directory?(dir)

      log.info "Copying iSCSI configuration from #{dir}"
      ::FileUtils.mkdir_p(File.join(Yast::Installation.destdir, dir))
      ::FileUtils.cp_r(
        Dir[File.join(dir, "*")], File.join(Installation.destdir, dir, "/"), preserve: true
      )
    rescue SystemCallError
      log.error "Failed to copy the iSCSI configuration from #{dir}"
    end

    # Enables all needed open-iscsi sockets and services
    def enable
      enable_iscsid
      enable_iscsi
      enable_iscsiuio
    end

    # Enables the iscsid socket (or service) if needed
    def enable_iscsid
      return unless sessions?

      enable_socket_or_service("iscsid")
    end

    # Enables the iscsi service if needed
    def enable_iscsi
      return unless sessions?

      Yast::Service.Enable("iscsi")
    end

    # Enables the iscsiuio socket (or service) if needed
    def enable_iscsiuio
      if !sessions? || !Yast::IscsiClientLib.iscsiuio_relevant?
        log.info "iscsiuio is not needed"
        return
      end

      Yast::Service.Enable("iscsiuio")
    end

    # Enables the socket with the given name or the corresponding service if the socket
    # does not exist
    #
    # @param name [String]
    def enable_socket_or_service(name)
      log.info "Enabling #{name} service/socket"
      socket = Yast2::Systemd::Socket.find(name)
      if socket
        socket.enable
      else
        Yast::Service.Enable(name)
      end
    end

    # Whether there is any active iSCSI session
    #
    # @return [Boolean]
    def sessions?
      Yast::IscsiClientLib.sessions.any?
    end
  end
end

# ------------------------------------------------------------------------------
# Copyright (c) 2016 SUSE, LLC. All Rights Reserved.
#
#
# This program is free software; you can redistribute it and/or modify it under
# the terms of version 2 of the GNU General Public License as published by the
# Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with
# this program; if not, contact SUSE.
#
# To contact SUSE about this file by physical or electronic mail, you may find
# current contact information at www.suse.com.
# ------------------------------------------------------------------------------

# Vendored from yast-installation's installation/src/lib/transfer/file_from_url.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-installation`
# RPM is no longer a runtime dependency of Agama. Only used by the vendored
# Y2Autoinstallation::PreScript/Script classes when a pre-script uses a `location`
# URL instead of inline `source` text.

require "yast"
require "yast2/execute"
require "yast2/rel_url"

# rubocop:disable all
module Yast::Transfer
  module FileFromUrl
    include Yast
    include Yast::Logger

    # lazy initialization
    def initialize_file_from_url
      return if @file_from_url_initialized
      @file_from_url_initialized = true

      textdomain "installation"

      Yast.import "URL"
      Yast.import "FTP"
      Yast.import "Installation"
      Yast.import "HTTP"
      Yast.import "TFTP"
      Yast.import "InstURL"
    end

    # Basename
    # @param filePath [String] path
    # @return [String]  basename
    def basename(filePath)
      pathComponents = Builtins.splitstring(filePath, "/")
      ret = Ops.get_string(
        pathComponents,
        Ops.subtract(Builtins.size(pathComponents), 1),
        ""
      )
      ret
    end

    # Get directory name
    # @param filePath [String] path
    # @return  [String] dirname
    def dirname(filePath)
      pathComponents = Builtins.splitstring(filePath, "/")
      last = Ops.get_string(
        pathComponents,
        Ops.subtract(Builtins.size(pathComponents), 1),
        ""
      )
      ret = Builtins.substring(
        filePath,
        0,
        Ops.subtract(Builtins.size(filePath), Builtins.size(last))
      )
      ret
    end

    # Copy a file from a URL to a local path
    # The URL allows autoyast-specific schemes:
    # https://www.suse.com/documentation/sles-12/singlehtml/book_autoyast/book_autoyast.html#Commandline.ay
    #
    # @note Some arguments are duplicated in the urltok hash. Where they
    #   differ, the explicitly passed arguments replace their counterparts in urltok.
    #
    # @param scheme    [String] ftp, tftp, http, https, cifs, nfs, device, cd, dvd, hd, usb, file, label, repo
    # @param host      [String]
    # @param urlpath   [String]
    # @param localfile [String] destination filename
    # @param urltok    [Hash{String => String}] same url as above, but better
    # @param destdir   [String] chroot (with crazy juggling)
    #
    # @return [Boolean] true on success
    def get_file_from_url(scheme:, host:, urlpath:, localfile:,
      urltok:, destdir:)
      # adapt sane API to legacy implementation
      _Scheme    = scheme
      _Host      = host
      _Path      = urlpath
      _Localfile = localfile

      initialize_file_from_url

      @GET_error = ""
      ok = false
      res = {}

      # ensure both sets of parameters are in sync
      toks = deep_copy(urltok)
      toks["scheme"] = _Scheme
      toks["host"] = _Host
      toks["path"] = _Path

      Builtins.y2milestone(
        "Scheme:%1 Host:%2 Path:%3 Localfile:%4",
        _Scheme,
        _Host,
        _Path,
        _Localfile
      )

      log.info "toks initial: #{hide_password(toks).inspect}"

      if _Scheme == "repo"
        base_url = InstURL.installInf2Url("")
        if base_url.empty?
          log.err "no ZyppRepoURL in /etc/install.inf"
          return false
        end

        log.info("installation path from install.inf: #{URL.HidePassword(base_url)}")

        toks["scheme"] = "relurl"
        rel_url = URL.Build(toks)
        log.info("relative url: #{rel_url}")

        absolute_url = Yast2::RelURL.from_installation_repository(rel_url).absolute_url.to_s
        log.info("absolute url: #{URL.HidePassword(absolute_url)}")

        toks = URL.Parse(absolute_url)
        log.info "toks absolute: #{hide_password(toks).inspect}"
      end

      # convert 'cd', "dvd', and 'hd' Zypp schemes to 'device' schema
      if ["cd", "dvd", "hd"].include?(toks["scheme"])
        dev_name = toks["query"].match(/devices?=\/dev\/(.*)/)
        if !dev_name.nil?
          toks["scheme"] = "device"
          toks["host"] = dev_name[1]
          toks["query"] = ""
        end
      end

      # convert 'label' scheme to 'device' scheme
      if toks["scheme"] == "label"
        toks["scheme"] = "device"
        toks["host"] = "disk/by-label/#{toks["host"]}"
      end

      _Scheme = toks["scheme"]
      _Host = toks["host"]
      _Path = toks["path"]

      if Builtins.regexpsub(_Path, "(.*)//(.*)", "\\1/\\2") != nil
        _Path = Builtins.regexpsub(_Path, "(.*)//(.*)", "\\1/\\2")
        log.info "path changed from #{toks["path"]} to #{_Path}"
      end
      toks["path"] = _Path

      log.info "toks final: #{hide_password(toks).inspect}"

      # URL.Build does not reconstruct the URL in all cases; notably it has
      # some ideas about what the host part might look like - which conflicts
      # with the host part being used for device names in local disk URIs.
      #
      # It does not matter much as full_url is only used for ftp/http(s).
      full_url = URL.Build(toks)
      log.info("full url (host part might be missing): #{URL.HidePassword(full_url)}")

      tmp_dir = Convert.to_string(WFM.Read(path(".local.tmpdir"), []))
      mount_point = Ops.add(tmp_dir, "/tmp_mount")
      mp_in_local = mount_point
      chr = WFM.SCRGetName(WFM.SCRGetDefault)
      if Builtins.search(chr, "chroot=/mnt:") == 0
        mp_in_local = Ops.add(destdir, mount_point)
      end
      Builtins.y2milestone("Chr:%3 TmpDir:%1 Mp:%2", tmp_dir, mp_in_local, chr)
      WFM.Execute(path(".local.mkdir"), mp_in_local)

      if _Scheme == "http" || _Scheme == "https"
        HTTP.easySSL(true)
        if Ops.greater_than(
          SCR.Read(
            path(".target.size"),
            "/etc/ssl/clientcerts/client-cert.pem"
          ),
          0
        )
          HTTP.clientCertSSL("/etc/ssl/clientcerts/client-cert.pem")
        end
        if Ops.greater_than(
          SCR.Read(
            path(".target.size"),
            "/etc/ssl/clientcerts/client-key.pem"
          ),
          0
        )
          HTTP.clientKeySSL("/etc/ssl/clientcerts/client-key.pem")
        end
        res = HTTP.Get(full_url, _Localfile)
        if Ops.get_integer(res, "code", 0) == 200
          @GET_error = ""
          return true
        else
          Builtins.y2error("Can't find URL: %1", full_url)
          # autoyast tried to read a file but had no success.
          @GET_error = Builtins.sformat(
            _(
              "Cannot find URL '%1' via protocol HTTP(S). Server returned code %2."
            ),
            full_url,
            Ops.get_integer(res, "code", 0)
          )
          return false
        end
      end
      if _Scheme == "ftp"
        res = FTP.Get(full_url, _Localfile)
        if Ops.greater_or_equal(Ops.get_integer(res, "code", -1), 200) &&
            Ops.less_than(Ops.get_integer(res, "code", -1), 300) &&
            Ops.greater_than(SCR.Read(path(".target.size"), _Localfile), 0)
          @GET_error = ""
          return true
        else
          Builtins.y2error("Can't find URL: %1", full_url)
          # autoyast tried to read a file but had no success.
          @GET_error = Builtins.sformat(
            _("Cannot find URL '%1' via protocol FTP. Server returned code %2."),
            full_url,
            Ops.get_integer(res, "code", 0)
          )
          return false
        end
      elsif _Scheme == "file"
        file = Builtins.sformat("%1/%2", Installation.sourcedir, _Path) # FIXME: I have doubts this will ever work. Too early.
        if Ops.greater_than(SCR.Read(path(".target.size"), file), 0)
          copy_local_file(file, _Localfile)
        else
          @GET_error = Ops.add(
            @GET_error,
            Builtins.sformat(
              _("Reading file on %1/%2 failed.\n"),
              Installation.sourcedir,
              _Path
            )
          )
          copy_local_file(_Path, _Localfile)
        end

        if File.exist?(_Localfile)
          @GET_error = ""
          ok = true
        else
          @GET_error = Ops.add(
            @GET_error,
            Builtins.sformat(_("Reading file on %1 failed.\n"), _Path)
          )
          Builtins.y2milestone(
            "Trying to find file on installation media: %1",
            Installation.boot
          )
          # The Cdrom entry in install.inf is obsolete. So we are using the
          # entry which is defined in InstUrl module. (bnc#908271)
          install_url = InstURL.installInf2Url("")
          # Builtins.regexpsub can also return nil (bnc#959723)
          cdrom_device = install_url ? (Builtins.regexpsub(install_url, "devices=(.*)$", "\\1") || "") : ""

          if Installation.boot == "cd" && !cdrom_device.empty?
            mtab =  File.read("/proc/mounts")
            m = mtab.match(/^#{cdrom_device}\s+(\S+)/)
            if m
              Builtins.y2milestone(
                "%1 is already mounted, trying to bind mount...",
                cdrom_device
              )
              am1 = Convert.to_map(
                SCR.Execute(path(".target.bash_output"),
                "/bin/mount -v --bind #{m[1]} #{mount_point}")
              )
              if Ops.get_integer(am1, "exit", -1) == 0
                ok = true
              else
                Builtins.y2warning(
                  "can't bind mount %1 failing...",
                  cdrom_device
                )
                ok = false
              end
            else
              try_again = 10
              while Ops.greater_than(try_again, 0)
                if !Convert.to_boolean(
                  WFM.Execute(
                    path(".local.mount"),
                    [cdrom_device, mount_point, Installation.mountlog]
                  )
                )
                  # autoyast tried to mount the CD but had no success.
                  @GET_error = Ops.add(
                    @GET_error,
                    Builtins.sformat(_("Mounting %1 failed."), cdrom_device)
                  )
                  Builtins.y2warning("Mount failed")
                  ok = false
                  try_again = Ops.subtract(try_again, 1)
                  Builtins.sleep(3000)
                else
                  ok = true
                  try_again = 0
                end
              end
            end
            if ok
              copy_local_file(File.join(mount_point, _Path), _Localfile)
              WFM.Execute(path(".local.umount"), mount_point)
              if File.exist?(_Localfile)
                @GET_error = ""
                return true
              end
            end
          end
          # autoyast tried to read a file but had no success.
          @GET_error = Ops.add(
            @GET_error,
            Builtins.sformat(
              _("Reading a file on CD failed. Path: %1/%2."),
              mount_point,
              _Path
            )
          )
          ok = false
        end
      elsif _Scheme == "nfs" # NFS
        nfs_host = find_nfs_host(_Host)
        if !Convert.to_boolean(
          SCR.Execute(
            path(".target.mount"),
            [Ops.add(Ops.add(nfs_host, ":"), dirname(_Path)), mount_point],
            "-o noatime,nolock"
          )
        ) &&
            !Convert.to_boolean(
              SCR.Execute(
                path(".target.mount"),
                [Ops.add(Ops.add(nfs_host, ":"), dirname(_Path)), mount_point],
                "-o noatime -t nfs4"
              )
            )
          Builtins.y2warning("Mount failed")
          # autoyast tried to mount a NFS directory which failed
          @GET_error = Builtins.sformat(
            _("Mounting %1 failed."),
            Ops.add(Ops.add(_Host, ":"), dirname(_Path))
          )
          return false
        end

        copyCmd = Ops.add(
          Ops.add(
            Ops.add(
              Ops.add(Ops.add("/bin/cp ", mp_in_local), "/"),
              basename(_Path)
            ),
            " "
          ),
          _Localfile
        )
        Builtins.y2milestone("Copy Command: %1", copyCmd)
        if WFM.Execute(path(".local.bash"), copyCmd) == 0
          @GET_error = ""
          ok = true
        else
          # autoyast tried to copy a file via NFS which failed
          @GET_error = Builtins.sformat(
            _("Remote file %1 cannot be retrieved"),
            Ops.add(Ops.add(mount_point, "/"), basename(_Path))
          )
          Builtins.y2error(
            "remote file %1 can't be retrieved",
            Ops.add(Ops.add(mount_point, "/"), basename(_Path))
          )
        end

        SCR.Execute(path(".target.umount"), mount_point)
      elsif _Scheme == "cifs" # CIFS
        if !Convert.to_boolean(
          SCR.Execute(
            path(".target.mount"),
            [Ops.add(Ops.add("//", _Host), dirname(_Path)), mount_point],
            "-t cifs -o guest,ro,noatime"
          )
        )
          Builtins.y2warning("Mount failed")
          # autoyast tried to mount a NFS directory which failed
          @GET_error = Builtins.sformat(
            _("Mounting %1 failed."),
            Ops.add(Ops.add("//", _Host), dirname(_Path))
          )
          return false
        end

        copyCmd = Ops.add(
          Ops.add(
            Ops.add(
              Ops.add(Ops.add("/bin/cp ", mp_in_local), "/"),
              basename(_Path)
            ),
            " "
          ),
          _Localfile
        )
        Builtins.y2milestone("Copy Command: %1", copyCmd)
        if WFM.Execute(path(".local.bash"), copyCmd) == 0
          @GET_error = ""
          ok = true
        else
          # autoyast tried to copy a file via NFS which failed
          @GET_error = Builtins.sformat(
            _("Remote file %1 cannot be retrieved"),
            Ops.add(Ops.add(mount_point, "/"), basename(_Path))
          )
          Builtins.y2error(
            "remote file %1 can't be retrieved",
            Ops.add(Ops.add(mount_point, "/"), basename(_Path))
          )
        end

        SCR.Execute(path(".target.umount"), mount_point)
      elsif _Scheme == "floppy"
        @GET_error = _("URLs starting with 'floppy:/' are not longer supported")
        ok = false
      elsif _Scheme == "device" || _Scheme == "usb" # Device or USB
        if _Path != ""
          deviceList = []
          if _Host == ""
            disks = _Scheme == "device" ?
              Convert.convert(
                SCR.Read(path(".probe.disk")),
                from: "any",
                to:   "list <map>"
              ) :
              Convert.convert(
                SCR.Read(path(".probe.usb")),
                from: "any",
                to:   "list <map>"
              )
            Builtins.foreach(disks) do |m|
              if _Scheme == "usb" && Ops.get_string(m, "bus", "USB") != "SCSI"
                next
              end
              if Builtins.haskey(m, "dev_name")
                i = 0
                dev = Ops.get_string(m, "dev_name", "")
                deviceList = Builtins.add(
                  deviceList,
                  Builtins.substring(dev, 5)
                )
                begin
                  i = Ops.add(i, 1)
                  dev = Ops.add(
                    Ops.get_string(m, "dev_name", ""),
                    Builtins.sformat("%1", i)
                  )
                  if SCR.Read(path(".target.lstat"), dev) != {}
                    deviceList = Builtins.add(
                      deviceList,
                      Builtins.substring(dev, 5)
                    )
                  end
                end while SCR.Read(path(".target.lstat"), dev) != {} ||
                  Ops.less_than(i, 5) # not uncommon for USB sticks to have no partition
              end
            end
            Builtins.y2milestone("devices to look on: %1", deviceList)
          else
            #   sometimes we have devices like /dev/cciss/c1d0p5
            #   those "nested" devices will be catched here
            #   as long as we find a directory where we expect a device,
            #   we cut down the Path and enhance the Host (device name)
            while SCR.Read(path(".target.dir"), Ops.add("/dev/", _Host)) != nil
              Builtins.y2milestone("nested device found")
              l = Builtins.splitstring(_Path, "/")
              _Host = Ops.add(Ops.add(_Host, "/"), Ops.get(l, 0, ""))
              l = Builtins.remove(l, 0)
              _Path = Builtins.mergestring(l, "/")
              Builtins.y2milestone("Host=%1 Path=%2", _Host, _Path)
            end
            # catching nested devices done
            deviceList = [_Host]
          end
          Builtins.foreach(deviceList) do |_Host2|
            Builtins.y2milestone("looking for profile on %1", _Host2)
            # checking if device has already been mounted. Taking new mountpoint
            # if it has already been done.
            # storage-ng: This should be move to storage-ng
            findmnt = ["/usr/bin/findmnt", "--first-only", "--noheadings", "--output=target", "/dev/#{_Host2}"]
            mp = Yast::Execute.locally!.stdout(*findmnt).split.last
            already_mounted = !mp.nil?
            mount_point = mp if already_mounted
            Builtins.y2milestone(
              "already mounted=%1 mountpoint=%2 mp=%3",
              already_mounted,
              mount_point,
              mp
            )
            if !already_mounted &&
                !Convert.to_boolean(
                  SCR.Execute(
                    path(".target.mount"),
                    [Builtins.sformat("/dev/%1", _Host2), mount_point],
                    "-o noatime"
                  )
                )
              Builtins.y2milestone(
                "%1 is not mounted and mount failed",
                Builtins.sformat("/dev/%1", _Host2)
              )
              @GET_error = Builtins.sformat(
                _("%1 is not mounted and mount failed"),
                Builtins.sformat("/dev/%1", _Host2)
              )
              next
            end
            if WFM.Execute(
              path(".local.bash"),
              Ops.add(
                Ops.add(
                  Ops.add(
                    Ops.add(Ops.add("/bin/cp ", mount_point), "/"),
                    _Path
                  ),
                  " "
                ),
                _Localfile
              )
            ) != 0
              # autoyast tried to copy a file but that file can't be found
              @GET_error = Builtins.sformat(
                _("File %1 cannot be found"),
                Ops.add(mount_point, _Path)
              )
              Builtins.y2milestone(
                "file %1 can't be found",
                Ops.add(mount_point, _Path)
              )
            else
              @GET_error = ""
              ok = true
              Builtins.y2milestone("found")
            end
            WFM.Execute(path(".local.umount"), mount_point) if !already_mounted
            raise Break if ok == true
          end
        end
      elsif _Scheme == "tftp" # Device
        if TFTP.Get(_Host, _Path, _Localfile)
          @GET_error = ""
          ok = true
        else
          @GET_error = Builtins.sformat(
            _("Cannot find URL '%1' via protocol TFTP."),
            Ops.add(Ops.add(_Host, ":"), _Path)
          )
          Builtins.y2error("file %1 can't be found", _Path)
        end
      else
        # the user wanted autoyast to fetch it's profile via an unknown protocol
        @GET_error = Builtins.sformat(_("Unknown protocol %1."), _Scheme)
        Builtins.y2error("Protocol not supported")
        ok = false
      end
      if !Builtins.isempty(@GET_error)
        Builtins.y2warning("GET_error:%1", @GET_error)
      end
      ok
    end

  private

    # Copy a file
    #
    # @param source [String] Source file path
    # @param destination [String] Destination file path
    def copy_local_file(source, destination)
      log.info "Copying #{source} to #{destination}"
      ::FileUtils.cp(source, destination)
    rescue SystemCallError => e
      log.warn "Could not copy #{source} to #{destination}: #{e.inspect}"
    end

    # Replace password with 'PASSWORD', if one was set.
    #
    # This is used to keep logs clean.
    #
    # @param toks [Hash{String => String}]
    #
    # @return [Hash{String => String}]
    def hide_password(toks)
      tmp = toks.dup
      tmp["pass"] &&= "PASSWORD"
      tmp
    end

    # Determines the host to use when trying to mount an NFS volume.
    #
    # IPv6 addresses should be enclosed between square brackets.
    #
    # @param host [String] Hostname or IP address.
    def find_nfs_host(host)
      ip = IPAddr.new(host)
      ip.ipv6? ? "[#{host}]" : host
    rescue IPAddr::InvalidAddressError
      host
    end
  end
end

# ***************************************************************************
#
# Copyright (c) 2002 - 2012 Novell, Inc.
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
# File:  modules/Hostname.ycp
# Package:  yast2
# Summary:  Hostname manipulation routines
# Authors:  Michal Svec <msvec@suse.cz>
# Flags:  Stable
#
# $Id$
require "yast"

module Yast
  class HostnameClass < Module
    def main
      textdomain "base"

      Yast.import "IP"
      Yast.import "String"
      Yast.import "FileUtils"
      Yast.import "Stage"

      # i18n characters in domain names are still not allowed
      #
      # @note This is an unstable API function and may change in the future
      @ValidChars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-"
      @ValidCharsDomain = Ops.add(@ValidChars, ".")
      @ValidCharsFQ = @ValidCharsDomain
      @DefaultDomain = ""
    end

    # Check syntax of hostname entry
    # (that is a domain name component, unqualified, without dots)
    # @see rfc1123, rfc2396 and obsoleted rfc1034
    # @param [String] host hostname
    # @return true if correct
    def Check(host)
      return false if host.nil? || host == "" || Ops.greater_than(Builtins.size(host), 63)

      Builtins.regexpmatch(host, "^[[:alnum:]_]([[:alnum:]-]*[[:alnum:]])?$")
    end

    # Check syntax of domain entry
    # @param [String] domain domain name
    # @return true if correct
    def CheckDomain(domain)
      return false if domain.nil? || domain == ""

      # if "domain" contains "." character as last character remove it before validation (but it's valid)
      if Ops.greater_than(Builtins.size(domain), 1) && (Builtins.substring(domain, Ops.subtract(Builtins.size(domain), 1), 1) == ".")
        domain = Builtins.substring(
          domain,
          0,
          Ops.subtract(Builtins.size(domain), 1)
        )
      end
      l = Builtins.splitstring(domain, ".")
      return false if Builtins.contains(Builtins.maplist(l) { |h| Check(h) }, false)

      !Builtins.regexpmatch(domain, "\\.[[:digit:]][^.]*$")
    end

    # Check syntax of fully qualified hostname
    # @param [String] host hostname
    # @return true if correct
    def CheckFQ(host)
      CheckDomain(host)
    end

    # Split FQ hostname to hostname and domain name
    #
    # If domain is not defined, returns empty string.
    #
    # @param [String] fqhostname FQ hostname
    # @return [Array] of hostname and domain name or empty in case of error
    # @example Hostname::SplitFQ("ftp.suse.cz") -> ["ftp", "suse.cz"]
    # @example Hostname::SplitFQ("ftp") -> ["ftp", ""]
    def SplitFQ(fqhostname)
      if fqhostname == "" || fqhostname.nil?
        Builtins.y2error("Bad FQ hostname: %1", fqhostname)
        return []
      end

      hn = ""
      dn = ""

      dot = Builtins.findfirstof(fqhostname, ".")
      if dot.nil?
        hn = fqhostname
      else
        hn = Builtins.substring(fqhostname, 0, dot)
        dn = Builtins.substring(fqhostname, Ops.add(dot, 1))
      end

      [hn, dn]
    end

    # Retrieve currently set fully qualified hostname
    # (uses hostname --fqdn)
    # @return FQ hostname
    def CurrentFQ
      hostname_data = SCR.Execute(path(".target.bash_output"), "/usr/bin/hostname --fqdn")

      if hostname_data["exit"] == 0
        fqhostname = hostname_data["stdout"]
      else
        Builtins.y2warning("Using fallback hostname")

        fqhostname = SCR.Read(path(".target.string"), "/etc/hostname") || ""
        fqhostname = "linux.#{@DefaultDomain}" if fqhostname.empty?
      end

      fqhostname = String.FirstChunk(fqhostname, "\n")

      Builtins.y2milestone("Current FQDN: %1", fqhostname)
      fqhostname
    end

    # Retrieve currently set domain name
    # @return domain
    def CurrentDomain
      domain = ""
      fqhostname = CurrentFQ()

      # the same as above, if FQDN is IP address
      # let's claim domainname as empty (#415109)
      if !IP.Check(fqhostname)
        data = SplitFQ(fqhostname)

        domain = Ops.get(data, 1, "") if data != [] && Ops.greater_than(Builtins.size(data), 1)
      end

      Builtins.y2debug("Current domainname: %1", domain)
      domain
    end

    publish variable: :ValidChars, type: "string"
    publish variable: :ValidCharsDomain, type: "string"
    publish variable: :ValidCharsFQ, type: "string"
    publish variable: :DefaultDomain, type: "string"
    publish function: :Check, type: "boolean (string)"
    publish function: :CheckDomain, type: "boolean (string)"
    publish function: :CheckFQ, type: "boolean (string)"
    publish function: :SplitFQ, type: "list <string> (string)"
    publish function: :CurrentFQ, type: "string ()"
    publish function: :CurrentDomain, type: "string ()"
  end

  Hostname = HostnameClass.new
  Hostname.main
end

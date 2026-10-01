# File:  include/autoinstall/xml.ycp
# Package:  Autoinstallation Configuration System
# Summary:  XML handling
# Authors:  Anas Nashif<nashif@suse.de>
#
# $Id$
#
# Vendored from yast-autoyast2's autoinstallation/src/include/autoinstall/xml.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama. Loaded via `Yast.include`, which
# (like `Yast.import`) resolves through Y2DIR, hence living under YaST2/include/ here.
module Yast
  module AutoinstallXmlInclude
    def initialize_autoinstall_xml(_include_target)
      Yast.import "XML"
    end

    # Setup the profile tags
    # @return [void]
    def profileSetup
      doc = {}
      Ops.set(
        doc,
        "listEntries",
        "addons"                   => "addon",
        "aliases"                  => "alias",
        "allowed"                  => "allowed_clients",
        "allowed_interfaces"       => "allowed_interface",
        "allowusers"               => "allowuser",
        "archives"                 => "archive",
        "ask-list"                 => "ask",
        "authorized_keys"          => "authorized_key",
        "children"                 => "child",
        "chroot-scripts"           => "script",
        "classes"                  => "class",
        "crypt_pervasive_apqns"    => "crypt_pervasive_apqn",
        "denyusers"                => "denyuser",
        "device_map"               => "device_map_entry",
        "device_map_entry"         => "device",
        "device_order"             => "device",
        # services-manager -> (hash) services -> (list) enable/disable -> service
        "disable"                  => "service",
        "dont_merge"               => "element",
        # services-manager -> (hash) services -> (list) enable/disable -> service
        "enable"                   => "service",
        "fetchmail"                => "fetchmail_entry",
        "files"                    => "file",
        "global"                   => "global_entry",
        "groups"                   => "group",
        "hosts"                    => "hosts_entry",
        "inetd_services"           => "inetd_service",
        "init-scripts"             => "script",
        "initrd_modules"           => "initrd_module",
        "interfaces"               => "interface",
        "keys"                     => "keyid",
        "local_domains"            => "domains",
        "logical_volumes"          => "lv",
        "lvm"                      => "lvm_group",
        "maps_to_serve"            => "nis_map",
        "masquerade_other_domains" => "domain",
        "masquerade_users"         => "masquerade_user",
        "modules"                  => "module_entry",
        "modules_conf"             => "module_conf",
        "names"                    => "name",
        "nameservers"              => "nameserver",
        "net-udev"                 => "rule",
        "netd_conf"                => "conf",
        "nfs_entries"              => "nfs_entry",
        "nfs_exports"              => "nfs_export",
        "nis_other_domains"        => "nis_other_domain",
        "nis_servers"              => "nis_server",
        "ntp_servers"              => "ntp_server",
        "options"                  => "option",
        "packages"                 => "package",
        "param-list"               => "param",
        "partitioning"             => "drive",
        "partitions"               => "partition",
        "pathlist"                 => "path",
        "patterns"                 => "pattern",
        "ports"                    => "port",
        "post-modules"             => "module",
        "post-packages"            => "package",
        "post-patterns"            => "pattern",
        "post-scripts"             => "script",
        "postpartitioning-scripts" => "script",
        "ppd_options"              => "ppd_option",
        "pre-modules"              => "module",
        "pre-scripts"              => "script",
        "printcap"                 => "printcap_entry",
        "printers"                 => "printer",
        "products"                 => "product",
        "proposals"                => "proposal",
        "raid"                     => "device",
        "region"                   => "region_entry",
        "remove-packages"          => "package",
        "routes"                   => "route",
        "schemes"                  => "schema",
        "searchlist"               => "search",
        "section"                  => "section_entry",
        "sections"                 => "section",
        "securenets"               => "securenet",
        "selection"                => "entry",
        "selections"               => "selection",
        "semi-automatic"           => "module",
        "services"                 => "service",
        "settings"                 => "settings_entry",
        "shares"                   => "share",
        "slaves"                   => "slave",
        "smtp_auth"                => "smtp_auth_entry",
        "sources"                  => "source",
        "subvolumes"               => "subvolume",
        "sysconfig"                => "sysconfig_entry",
        "trusteddomains"           => "trusteddomain",
        "users"                    => "user",
        "virtual_users"            => "virtual_user",
        "volume_component"         => "volume_component_settings",
        "volume_entry"             => "volume_component",
        "volume_settings"          => "volume_entry",
        "zones"                    => "zone"
      )

      # media_url needed for ISO files on NFS
      Ops.set(
        doc,
        "cdataSections",
        [
          "source",
          "info_file",
          "file_contents",
          "pxelinux-config",
          "location",
          "script_source",
          "media_url",
          "subvolumes_prefix"
        ]
      )
      #            doc["systemID"] = "/usr/share/autoinstall/dtd/profile.dtd";
      Ops.set(doc, "rootElement", "profile")
      Ops.set(doc, "nameSpace", "http://www.suse.com/1.0/yast2ns")
      Ops.set(doc, "typeNamespace", "http://www.suse.com/1.0/configns")

      XML.xmlCreateDoc(:profile, doc)
      nil
    end

    # Setup XML for classes
    # @return void
    #
    def classSetup
      doc = {}
      Ops.set(doc, "listEntries", "classes" => "class")
      Ops.set(doc, "rootElement", "autoinstall")
      #            doc["systemID"] = "/usr/share/autoinstall/dtd/classes.dtd";
      Ops.set(doc, "nameSpace", "http://www.suse.com/1.0/yast2ns")
      Ops.set(doc, "typeNamespace", "http://www.suse.com/1.0/configns")
      XML.xmlCreateDoc(:class, doc)
      nil
    end
  end
end

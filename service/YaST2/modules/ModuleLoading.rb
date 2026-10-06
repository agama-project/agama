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
# Module:    ModuleLoading.ycp
#
# Authors:    Klaus Kaempf <kkaempf@suse.de> (initial)
#
# Purpose:
# This module does all module loading stuff.
#
# $Id$
require "yast"

module Yast
  class ModuleLoadingClass < Module
    def main
      Yast.import "UI"

      textdomain "base"

      Yast.import "Mode"
      Yast.import "Label"
      Yast.import "Icon"

      @vendor_name = ""
      @device_name = ""

      # Cache for MarkedAsBroken
      @broken_modules = nil
    end

    # @param [Hash] controller
    # @return [Array]  [string vendor, string device]
    # Convert internal probing data to user readable string
    # for module loading.
    # @see #ModuleLoading::Load

    def prepareVendorDeviceInfo(controller)
      controller = deep_copy(controller)
      # build up vendor/device information

      # if vendor not given, try sub_vendor

      controller_vendor = Ops.get_string(
        controller,
        "vendor",
        Ops.get_string(controller, "sub_vendor", "")
      )
      if controller_vendor != ""
        controller_sub_vendor = Ops.get_string(controller, "sub_vendor", "")
        if controller_sub_vendor != ""
          controller_vendor = Ops.add(
            Ops.add(Ops.add(controller_vendor, "\n("), controller_sub_vendor),
            ")"
          )
        end
      end

      # if device not given, try sub_device

      controller_device = Ops.get_string(
        controller,
        "device",
        Ops.get_string(controller, "sub_device", "")
      )
      if controller_device != ""
        controller_sub_device = Ops.get_string(controller, "sub_device", "")
        if controller_sub_device != ""
          controller_device = Ops.add(
            Ops.add(Ops.add(controller_device, "\n("), controller_sub_device),
            ")"
          )
        end
      end

      [controller_vendor, controller_device]
    end

    # Is the module marked as broken in install.inf? (BrokenModules)
    # #97655
    # @param [String] mod module
    # @return broken?
    def MarkedAsBroken(mod)
      if @broken_modules.nil?
        bms = Convert.to_string(
          SCR.Read(path(".etc.install_inf.BrokenModules"))
        )
        bms = "" if bms.nil?
        @broken_modules = Builtins.splitstring(bms, " ")
      end

      Builtins.contains(@broken_modules, mod)
    end

    # @param [String] modulename
    # @param [String] moduleargs
    # @param [String] vendorname
    # @param [String] devicename
    # @param [Boolean] ask_before_loading
    # @param [Boolean] with_modprobe
    #
    # @return [Symbol]:  `dont  user choose *not* to load module
    #      `ok  module loaded ok
    #      `fail  module loading failed
    #
    # load a module if not already loaded by linuxrc

    def Load(modulename, moduleargs, vendorname, devicename, ask_before_loading, with_modprobe)
      if modulename != "" &&
          # there is no reason for checking initrd, if I need the module to get loaded, I just  need to
          # check if it isn't already loaded
          #      && (!contains (Initrd::ListModules (), modulename))
          !Mode.test
        # always look whether the module is already loaded
        loaded_modules = Convert.to_map(SCR.Read(path(".proc.modules")))
        if Ops.greater_than(
          Builtins.size(Ops.get_map(loaded_modules, modulename, {})),
          0
        )
          # already loaded
          return :ok
        end

        # sformat( _("Loading module %1"), modulename);

        # #97655
        if MarkedAsBroken(modulename)
          Builtins.y2milestone("In BrokenModules, skipping: %1", modulename)
          return :dont
        end

        if ask_before_loading && !Mode.autoinst && !Mode.autoupgrade
          UI.OpenDialog(
            Opt(:decorated, :centered),
            HBox(
              HSpacing(1),
              HCenter(
                HSquash(
                  VBox(
                    HCenter(
                      HSquash(
                        VBox(
                          # Popup-Box for manual driver installation.
                          # If the user selects 'manual installation' when
                          # booting from CD, YaST2 does not load any modules
                          # automatically, but asks the user for confirmation
                          # about every module.
                          # The popup box informs the user about the detected
                          # hardware and suggests a module to load.
                          # The user can confirm the module or change
                          # the suggested load command
                          #
                          # This is the heading of the popup box
                          HBox(
                            # bnc #421002
                            Icon.Simple("question"),
                            Heading(_("Confirm driver activation")),
                            HStretch()
                          ),
                          VSpacing(0.2),
                          # This is in information message. Next come the
                          # vendor and device information strings as stored
                          # in the hardware-probing database.
                          Left(Label(_("YaST2 detected the following device"))),
                          Left(Label(vendorname)),
                          Left(Label(devicename)),
                          VSpacing(0.1),
                          Left(
                            # Caption for Textentry with module information
                            InputField(
                              Id(:mod_name),
                              Opt(:hstretch),
                              _("&Driver/Module to load"),
                              Ops.add(Ops.add(modulename, " "), moduleargs)
                            )
                          )
                        )
                      )
                    ),
                    ButtonBox(
                      PushButton(
                        Id(:ok_msg),
                        Opt(:default, :okButton, :key_F10),
                        Label.OKButton
                      ),
                      PushButton(
                        Id(:cancel_msg),
                        Opt(:cancelButton, :key_F9),
                        Label.CancelButton
                      )
                    ),
                    VSpacing(0.2)
                  )
                )
              ),
              HSpacing(1)
            )
          )
          UI.SetFocus(Id(:ok_msg))
          ret = Convert.to_symbol(UI.UserInput)
          if ret == :ok_msg
            module_data = Convert.to_string(
              UI.QueryWidget(Id(:mod_name), :Value)
            )
            if Ops.greater_than(Builtins.size(module_data), 0)
              # skip leading spaces
              firstspace = Builtins.findfirstnotof(module_data, " ")
              module_data = Builtins.substring(module_data, firstspace) if !firstspace.nil?

              # split name and args
              firstspace = Builtins.findfirstof(module_data, " ")

              if firstspace.nil?
                modulename = module_data
                moduleargs = ""
              else
                modulename = Builtins.substring(module_data, 0, firstspace)
                moduleargs = Builtins.substring(
                  module_data,
                  Ops.add(firstspace, 1)
                )
              end
            end
          end
          UI.CloseDialog

          if ret == :cancel_msg
            Builtins.y2milestone(
              "NOT loaded module %1 %2",
              modulename,
              moduleargs
            )
            return :dont
          end
        end
      end

      load_success = if with_modprobe
        Convert.to_boolean(
          SCR.Execute(path(".target.modprobe"), modulename, moduleargs)
        )
      else
        Convert.to_boolean(
          SCR.Execute(path(".target.insmod"), modulename, moduleargs)
        )
      end
      load_success = false if load_success.nil?

      Builtins.y2milestone(
        "Loaded module %1 %2 %3",
        modulename,
        moduleargs,
        load_success ? "Ok" : "Failed"
      )

      load_success ? :ok : :fail
    end

    publish function: :prepareVendorDeviceInfo, type: "list (map)"
    publish function: :Load, type: "symbol (string, string, string, string, boolean, boolean)"
  end

  ModuleLoading = ModuleLoadingClass.new
  ModuleLoading.main
end

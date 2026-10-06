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
# File:        modules/Icon.ycp
# Package:     YaST2
# Authors:     Lukas Ocilka <lukas.ocilka@suse.cz>
# Summary:     Transparent access to Icons
# Flags:  Stable
#
# $Id$
require "yast"

module Yast
  class IconClass < Module
    def main
      Yast.import "UI"

      textdomain "base"

      @has_image_support = nil
      @icons_map = {}
    end

    def LazyInit
      return if !@has_image_support.nil?

      display_info = UI.GetDisplayInfo
      @has_image_support = Ops.get_boolean(
        display_info,
        "HasImageSupport",
        false
      )

      @icons_map = {
        "warning"  => "dialog-warning",
        "info"     => "dialog-information",
        "error"    => "dialog-error",
        "question" => "dialog-question"
      }

      nil
    end

    # Returns `Image() term defined by parameters. Returns `Empty() if the current
    # UI doesn't support images.
    #
    # @param [String] icon_type (one of known types or just an image name without a 'png' suffix)
    #        Known icon types are "warning", "info", and "error"
    #
    # @param [Hash{String => Object}] options
    #
    #
    # **Structure:**
    #
    #     options = $[
    #        "id" : any_icon_id,
    #        "label" : (string) icon_label, // (used if icon is missing)
    #        "margin_left" : 0,  // HSpacing on the left
    #        "margin_right" : 5, // HSpacing on the right
    #      ]
    #
    # @example
    #  Icon::Image ("warning", $["id":`my_warning, "label":_("My Warning")])
    #    -> `Image (`id (`my_warning), "/usr/share/YaST2/theme/current/icons/32x32/apps/msg_warning.png", "My Warning")
    #  Icon::Image ("info", $["margin_left":1, "margin_right":2])
    #    -> `HBox (
    #      `HSpacing (1),
    #      `Image (`id ("icon_id_info"), "/usr/share/YaST2/theme/current/icons/32x32/apps/msg_info.png", "info"),
    #      `HSpacing (2)
    #    )
    def Image(icon_type, options)
      options = deep_copy(options)
      LazyInit()

      return Empty() if !@has_image_support

      icon_id = Ops.get(options, "id")
      icon_id = Builtins.sformat("icon_id_%1", icon_type) if icon_id.nil?

      icon_label = Ops.get_string(options, "label", icon_type)

      icon_name = Ops.get(@icons_map, icon_type) ? Ops.get(@icons_map, icon_type, "") : icon_type

      this_image = term(:Image, Id(icon_id), icon_name, icon_label)

      # left and/or right margin defined
      if Ops.get_integer(options, "margin_left", 0) != 0 ||
          Ops.get_integer(options, "margin_right", 0) != 0
        ret = HBox(
          HSpacing(Ops.get_integer(options, "margin_left", 0)),
          this_image,
          HSpacing(Ops.get_integer(options, "margin_right", 0))
        )

        deep_copy(ret)
        # no margin defined
      else
        deep_copy(this_image)
      end
    end

    # Function calls Icon::Image with default options
    #
    # @param [String] icon_type
    #
    # @see Icon for more information
    def Simple(icon_type)
      Image(icon_type, {})
    end

    # Returns UI term `Image() widget with a warning-icon.
    #
    # @return [Yast::Term] warning icon
    def Warning
      Image("warning", {})
    end

    # Returns UI term `Image() widget with an error-icon.
    #
    # @return [Yast::Term] error-icon
    def Error
      Image("error", {})
    end

    # Returns UI term `Image() widget with an info-icon.
    #
    # @return [Yast::Term] info icon
    def Info
      Image("info", {})
    end

    publish function: :Image, type: "term (string, map <string, any>)"
    publish function: :Simple, type: "term (string)"
    publish function: :Warning, type: "term ()"
    publish function: :Error, type: "term ()"
    publish function: :Info, type: "term ()"
  end

  Icon = IconClass.new
  Icon.main
end

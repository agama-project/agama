module Yast2
  module Systemd
    # A Unit Property Map is a plain Hash(Symbol => String).
    #
    # It
    #   1. enumerates the properties we're interested in
    #   2. maps their Ruby names (snake_case) to systemd names (CamelCase)
    class UnitPropMap < Hash
      # @return [Yast2::Systemd::UniPropMap]
      DEFAULT = UnitPropMap[{
        id:               "Id",
        pid:              "MainPID",
        description:      "Description",
        load_state:       "LoadState",
        active_state:     "ActiveState",
        sub_state:        "SubState",
        unit_file_state:  "UnitFileState",
        unit_file_preset: "UnitFilePreset",
        path:             "FragmentPath",
        can_reload:       "CanReload"
      }].freeze
    end
  end
end

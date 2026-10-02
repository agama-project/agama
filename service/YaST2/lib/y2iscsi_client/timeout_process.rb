# Vendored from yast2-iscsi-client's src/lib/y2iscsi_client/timeout_process.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-iscsi-client`
# RPM is no longer a runtime dependency of Agama.

require "yast"
require "yast2/execute"

Yast.import "Popup"

# Namespace for the YaST2 iSCSI client
module Y2IscsiClient
  # Runner class that execute command with given timeout
  module TimeoutProcess
    include Yast::I18n
    extend Yast::I18n

    # @param [Array<String>] command as list of arguments
    # @param [Integer] seconds timeout for command
    # @param silent [Boolean] whether interaction with the user must be avoided
    # @return [Array(Boolean, Array<String>)] return pair of boolean if command
    #   succeed and stdout lines without ending newline
    def self.run(command, seconds: 10, silent: false)
      textdomain "iscsi-client"

      # pass kill-after to ensure that command really dies even if ignore TERM
      stdout, stderr, exit_status = Yast::Execute.on_target!(
        "timeout", "--kill-after=5s", "#{seconds}s",
        *command, stdout: :capture, stderr: :capture,
        allowed_exitstatus: 0..255, env: { "LC_ALL" => "POSIX" }
      )

      output = stdout.split("\n")
      case exit_status
      when 0 then [true, output]
      when 124, (128 + 9)
        Yast::Popup.Error(_("Command timed out")) unless silent
        [false, output]
      else
        Yast::Popup.Error(stderr) unless silent
        [false, output]
      end
    end
  end
end

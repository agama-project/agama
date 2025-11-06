# this is a shared configuration for the live-self-update script, the
# live-self-update-parser.sh dracut hook script and the Kiwi config.sh

RUN_DIR="/run/live-self-update"
REPO_FILE="$RUN_DIR/repositories"
SERVER_FILE="$RUN_DIR/server"
SKIP_FILE="$RUN_DIR/skip"
RESULT_FILE="$RUN_DIR/result"

CONFIG_DIR="/etc/live-self-update"
# file with fallback repositories (template URLs)
CONFIG_FALLBACK_FILE="$CONFIG_DIR/fallback_url"
# default registration server URL (SCC in SLE, undefined in openSUSE)
CONFIG_DEFAULT_REG_SERVER_FILE="$CONFIG_DIR/default_reg_server_url"

# fallback repositories with expanded variables
FALLBACK_REPOS_FILE="${CONFIG_FALLBACK_FILE}_expanded"

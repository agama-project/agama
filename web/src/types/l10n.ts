type Keymap = {
  /**
   * Keyboard id (e.g., "us").
   */
  id: string;
  /**
   * Keyboard name (e.g., "English (US)").
   */
  name: string;
};

type Locale = {
  /**
   * Language id (e.g., "en_US.UTF-8").
   */
  id: string;
  /**
   * Language name (e.g., "English").
   */
  name: string;
  /**
   * Territory name (e.g., "United States").
   */
  territory: string;
};

type Timezone = {
  /**
   * Timezone id (e.g., "Atlantic/Canary").
   */
  id: string;
  /**
   * Name of the timezone parts (e.g., ["Atlantic", "Canary"]).
   */
  parts: string[];
  /**
   * Name of the country associated to the zone or empty string (e.g., "Spain").
   */
  country: string;
  /**
   * UTC offset.
   */
  utcOffset: number;
};

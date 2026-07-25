export class TimeManager {
  /**
   * @param {Object} ui = Instance of UI Manager (defaults to window.ui)
   */
  constructor(ui = window.ui) {
    this.ui = ui;
    this.currentMinutes = 480; // Defaults to 08:00 AM
    this.currentSeason = "Spring";
    this.clockInterval = null;
  }

  /**
   * Starts the 1-second ticker that advances in-game time by 1 minute per second.
   */
  start() {
    this.stop(); // Ensure no duplicate intervals are running
    this.clockInterval = setInterval(() => {
      this.currentMinutes = (this.currentMinutes + 1) % 1440;
      this.ui.updateClockFromMinutes(this.currentMinutes, this.currentSeason);
    }, 1000);
  }

  /**
   * Stops the clock timer interval.
   */
  stop() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  /**
   * Synchronizes the internal clock with incoming server time and season data.
   * @param {string} [timeStr] = Server time formatted as "HH:MM"
   * @param {string} [seasonStr] = Current server season (e.g., "Winter")
   */
  sync(timeStr, seasonStr) {
    if (timeStr) {
      const parts = timeStr.split(":");
      if (parts.length === 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m)) {
          this.currentMinutes = h * 60 + m;
        }
      }
    }

    if (seasonStr) {
      this.currentSeason = seasonStr;
    }

    this.ui.updateClockFromMinutes(this.currentMinutes, this.currentSeason);
  }
}

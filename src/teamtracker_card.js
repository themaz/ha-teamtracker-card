import { LitElement, css } from "lit";
import { Translator } from "./localize/translator.js";
import { VERSION } from "./const.js";
import { renderBye } from "./render_bye.js";
import {
  renderMissingConfig,
  renderMissingObj,
  renderStateInvalid,
  renderStateUnavailable,
} from "./render_error.js";
import { renderIn } from "./render_in.js";
import { renderNotFound } from "./render_not_found.js";
import { renderPost } from "./render_post.js";
import { renderPre } from "./render_pre.js";
import {
  initCardData,
  setCardFormat,
  setDefaults,
  setStartInfo,
} from "./set_defaults.js";
import { setSportData } from "./set_sports.js";
import { cardStyles } from "./styles.js";

export class TeamTrackerCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  static get styles() {
    return css`
      ${cardStyles}
    `;
  }

  setConfig(config) {
    this._config = config;
    this._actionConfig = {
      entity: this._config.entity,
      //            tap_action: {
      //                action: "more-info",
      //            },
      dblclick_action: {
        action: "more-info",
      },
      //            hold_action: {
      //                action: "more-info",
      //                start_listening: true,
      //            },
    };
  }

  getCardSize() {
    const stateObj = this.hass.states[this._config.entity];

    switch (stateObj.state) {
      case "PRE":
        return 7;
      case "IN":
        return 10;
      case "POST":
        return 5;
      case "BYE":
        return 4;
      case "NOT_FOUND":
        return 4;
      default:
        return 4;
    }
  }

  render() {
    var o = {}; // o is the object that holds the card options from the configuration
    var c = {}; // c is the object that holds the card data used to render the HTML

    //
    //  Render error message if missing configuration, entity, or state
    //
    if (!this.hass || !this._config) {
      return renderMissingConfig();
    }
    const stateObj = this.hass.states[this._config.entity];
    if (!stateObj) {
      return renderMissingObj(this._config.entity);
    }
    if (stateObj.state == "unavailable") {
      return renderStateUnavailable(this._config.entity);
    }

    //
    //  Set card options based on configuration
    //
    o.cardTitle = this._config.card_title || "";
    o.outline = this._config.outline;
    o.outlineColor = this._config.outline_color || "#ffffff";
    o.showLeague = this._config.show_league;
    o.homeSide = String(this._config.home_side).toUpperCase();
    o.teamURL = this._config.team_url;
    o.opponentURL = this._config.opponent_url;
    o.bottomURL = this._config.bottom_url;
    o.show_timeouts = true;
    o.show_venue = true;
    if (this._config.show_timeouts == false) {
      o.show_timeouts = false;
    }
    if (this._config.show_venue == false) {
      o.show_venue = false;
    }
    o.show_rank = true;
    if (this._config.show_rank == false) {
      o.show_rank = false;
    }
    o.debug = this._config.debug;
    o.darkMode = this.hass.themes.darkMode;

    //
    //  Set sport, team, and oppo
    //
    var team = 1;
    var oppo = 2;
    if (
      (o.homeSide == "RIGHT" && stateObj.attributes.team_homeaway == "home") ||
      (o.homeSide == "LEFT" && stateObj.attributes.opponent_homeaway == "home")
    ) {
      team = 2;
      oppo = 1;
    }

    //
    // Set language, time_format (12hr or 24hr), and translator
    //
    var lang =
      this.hass.selectedLanguage ||
      this.hass.language ||
      navigator.language ||
      "en";
    var time_format = "language";
    try {
      time_format = this.hass.locale["time_format"] || "language";
    } catch (e) {
      time_format = "language";
    }
    var t = new Translator(lang);

    var sport = stateObj.attributes.sport || "default";
    if (t.translate(sport + ".startTerm") == "{" + sport + ".startTerm" + "}") {
      sport = "default";
    }

    var server_time_zone = null;
    if (this.hass.locale.time_zone == "server") {
      server_time_zone = this.hass.config.time_zone;
    }
    //
    //  Set card data
    //
    initCardData(c);
    setStartInfo(c, stateObj, t, lang, time_format, server_time_zone);
    setCardFormat(o, c);
    setDefaults(t, lang, stateObj, c, o, sport, team, oppo);
    setSportData(sport, t, stateObj, c, team, oppo);

    //
    //  NCAA Specific Changes
    //
    if (stateObj.attributes.league) {
      if (stateObj.attributes.league.includes("NCAA")) {
        c.notFoundLogo = "https://a.espncdn.com/i/espn/misc_logos/500/ncaa.png";
      }
    }

    //
    //  Reduce score font size if needed
    //

    if (Math.max(String(c.score[1]).length, String(c.score[2]).length) > 4) {
      c.scoreSize = "2em";
    }

    //
    //  Add info to title if debug mode is turned on
    //

    if (o.debug) {
      var lastUpdate = new Date(stateObj.attributes.last_update);
      var updateTime = lastUpdate.toLocaleTimeString(lang, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      if (server_time_zone) {
        updateTime = lastUpdate.toLocaleTimeString(lang, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: server_time_zone,
        });
      }
      c.title = this._config.entity + " " + c.title + "(";
      if (stateObj.attributes.api_message) {
        c.title = c.title + stateObj.attributes.api_message[0];
      }
      c.title = c.title + updateTime + ") " + VERSION;
    }

    //
    //  Render the card based on the state
    //
    switch (stateObj.state) {
      case "PRE":
        return renderPre(c);
      case "IN":
        return renderIn(c);
      case "POST":
        return renderPost(c);
      case "BYE":
        return renderBye(c);
      case "NOT_FOUND":
        return renderNotFound(c);
      default:
        return renderStateInvalid(c);
    }
  }

  firstUpdated() {
    // Add the double-click event listener to the card
    this.shadowRoot
      .querySelector("ha-card")
      .addEventListener("dblclick", () => this._handleDoubleClick());
  }

  _handleDoubleClick() {
    const event = new Event("hass-action", {
      bubbles: true,
      composed: true,
    });
    event.detail = {
      config: this._actionConfig,
      action: "dblclick",
    };
    this.dispatchEvent(event);
  }

  //
  // Trigger the UI Card Editor from Card Picker
  //    Uncomment to enable visual editor
  //
  static getConfigElement() {
    // Create and return an editor element
    return document.createElement("teamtracker-card-editor");
  }
  //
  //  static getStubConfig() {
  //    // Return a minimal configuration that will result in a working card configuration
  //    return { entity: "" };
  //  }
}

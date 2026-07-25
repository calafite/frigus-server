import { Utils } from "../utilities/utils.js";
import { TimeManager } from "./TimeManager.js";
import { EventDispatcher } from "./EventDispatcher.js";

export class GameEngine {
  /**
   * @param {Object} ui - Reference to UI Manager (defaults to window.ui)
   * @param {Object} auth - Reference to Auth Manager (defaults to window.auth)
   */
  constructor(ui = window.ui, auth = window.auth) {
    this.ui = ui;
    this.auth = auth;

    this.ws = null;
    this.currentActor = "";
    this.authPayload = null;
    this.respawnTimer = null;

    // Sub-modules (located in /classes)
    this.timeManager = new TimeManager(this.ui);
    this.dispatcher = new EventDispatcher(this, this.ui, this.auth);

    // Initialize clock ticker
    this.timeManager.start();
  }

  /**
   * Delegates clock synchronization to the TimeManager.
   * @param {string} timeStr - Time string formatted as "HH:MM"
   * @param {string} seasonStr - Current season name
   */
  syncClock(timeStr, seasonStr) {
    this.timeManager.sync(timeStr, seasonStr);
  }

  /**
   * Establishes WebSocket connection and sets up message handlers.
   */
  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.ws.onopen = () => {
      this.ui.log("Connected to Frigus Realm.", "msg-system");
      if (this.authPayload) {
        this.send(this.authPayload);
        this.sendCommand("look");
        this.sendCommand("status");
      }
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.events) {
          data.events.forEach((ev) => this.dispatcher.dispatch(ev));
        } else if (data.status === "error" || data.status === "exception") {
          this.ui.log(`[SYSTEM EXCEPTION] ${data.error}`, "msg-error");
        }
      } catch (err) {
        console.error("Parse Error:", err, e.data);
      }
    };

    this.ws.onclose = () => {
      this.ui.log("Connection lost. Refresh to reconnect.", "msg-error");
      this.ui.showOverlay();
    };
  }

  /**
   * Transmits JSON object payload across active WebSocket connection.
   * @param {Object} payload
   */
  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Polymorphic command handler.
   * Supports both DOM submit events (`e.preventDefault()`) and raw string commands (`"look"`).
   * @param {Event|string} param - DOM submit event OR command text string
   */
  sendCommand(param) {
    if (param && typeof param === "object" && typeof param.preventDefault === "function") {
      param.preventDefault();
      const input = document.getElementById("cmd-input");
      if (!input) return;

      const txt = input.value.trim();
      if (!txt) return;

      this.ui.log(`&gt; ${Utils.escapeHtml(txt)}`, "msg-echo");
      this.send({ type: "cmd", text: txt });
      input.value = "";
      return;
    }

    if (typeof param === "string" && param.trim().length > 0) {
      this.send({ type: "cmd", text: param.trim() });
    }
  }

  /**
   * Authenticates actor identity and connects socket.
   * Sends initial 'look' and 'status' commands upon authentication.
   * @param {Object} payload
   */
  authenticate(payload) {
    this.currentActor = payload.actor;
    this.authPayload = payload;

    const identElem = document.getElementById("header-identity");
    if (identElem) {
      identElem.innerText = `${payload.actor} (Synchronizing...)`;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send(payload);
      setTimeout(() => {
        this.sendCommand("status");
        this.sendCommand("look");
      }, 100);
    } else {
      this.connect();
    }

    this.ui.hideOverlay();
  }
}

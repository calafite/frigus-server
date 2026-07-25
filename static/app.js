import { onDOMReady } from './utilities/utils.js';
import { UIManager } from './classes/UIManager.js';
import { AuthManager } from './classes/AuthManager.js';
import { GameEngine } from './classes/GameEngine.js';

window.ui = new UIManager();
window.auth = new AuthManager();
window.game = new GameEngine();

onDOMReady(() => {
  window.game.connect();
});

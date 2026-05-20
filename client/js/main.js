// Phaser 游戏入口
import GameScene from './scenes/GameScene.js';
import ForestScene from './scenes/ForestScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 640,
    height: 480,
  },
  scene: [GameScene, ForestScene],
};

const game = new Phaser.Game(config);

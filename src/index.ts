import Phaser from 'phaser';
import scenes from '../scenes';
const config: Phaser.Types.Core.GameConfig = {
	type: Phaser.AUTO,
	pixelArt: true,
	scene: scenes,
	scale: {
		mode: Phaser.Scale.FIT,
		expandParent: true,
		width: '83%',
		height: '83%',
		zoom: 1.2,
	},
	physics: {
		default: 'arcade',
		arcade: {
			gravity: {
				y: 0,
			},
		},
	},
};

const game = new Phaser.Game(config);

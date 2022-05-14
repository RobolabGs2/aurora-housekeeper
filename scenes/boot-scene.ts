/// <reference path='./module_types.d.ts'/>
import auroraSpriteSheet from '../assets/sprites/characters/aurora.png';
import punkSpriteSheet from '../assets/sprites/characters/punk.png';
import blueSpriteSheet from '../assets/sprites/characters/blue.png';
import yellowSpriteSheet from '../assets/sprites/characters/yellow.png';
import greenSpriteSheet from '../assets/sprites/characters/green.png';
import slimeSpriteSheet from '../assets/sprites/characters/slime.png';
import { loadSettingsFromURL } from '../src/utils/url-parser';

// Из урла берём следующую для открытия сцену
const { openScene } = loadSettingsFromURL({ openScene: 'MainMenu' });

export class BootScene extends Phaser.Scene {
	preload() {
		this.setupLoader();

		const characterFrameConfig = { frameWidth: 31, frameHeight: 31 };
		const slimeFrameConfig = { frameWidth: 32, frameHeight: 32 };

		//loading spitesheets
		this.load.spritesheet('aurora', auroraSpriteSheet, characterFrameConfig);
		this.load.spritesheet('blue', blueSpriteSheet, characterFrameConfig);
		this.load.spritesheet('green', greenSpriteSheet, characterFrameConfig);
		this.load.spritesheet('yellow', yellowSpriteSheet, characterFrameConfig);
		this.load.spritesheet('punk', punkSpriteSheet, characterFrameConfig);
		this.load.spritesheet('slime', slimeSpriteSheet, slimeFrameConfig);

		this.load.on('complete', () => {
			if (this.scene.manager.keys[openScene] === undefined) {
				alert(`Not found scene with key ${openScene}, load MainMenu`);
				this.scene.start('MainMenu');
			} else {
				this.scene.start(openScene);
			}
		});
	}

	private setupLoader() {
		const halfWidth = this.game.scale.width * 0.5;
		const halfHeight = this.game.scale.height * 0.5;

		const progressBarHeight = 100;
		const progressBarWidth = 400;

		const progressBarContainer = this.add.rectangle(
			halfWidth,
			halfHeight,
			progressBarWidth,
			progressBarHeight,
			0x000000
		);
		const progressBar = this.add.rectangle(
			halfWidth + 20 - progressBarContainer.width * 0.5,
			halfHeight,
			10,
			progressBarHeight - 20,
			0x888888
		);

		const loadingText = this.add
			.text(halfWidth - 75, halfHeight - 100, 'Loading...')
			.setFontSize(24);
		const percentText = this.add.text(halfWidth - 25, halfHeight, '0%').setFontSize(24);
		const assetText = this.add.text(halfWidth - 25, halfHeight + 100, '').setFontSize(24);

		this.load.on('progress', (value: number) => {
			progressBar.width = (progressBarWidth - 30) * value;

			const percent = value * 100;
			percentText.setText(`${percent}%`);
		});

		this.load.on('fileprogress', (file: { key: string }) => {
			assetText.setText(file.key);
		});

		this.load.on('complete', () => {
			loadingText.destroy();
			percentText.destroy();
			assetText.destroy();
			progressBar.destroy();
			progressBarContainer.destroy();
		});
	}
}

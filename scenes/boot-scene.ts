/// <reference path='./module_types.d.ts'/>
import auroraSpriteSheet from '../assets/sprites/characters/aurora.png';
import punkSpriteSheet from '../assets/sprites/characters/punk.png';
import blueSpriteSheet from '../assets/sprites/characters/blue.png';
import yellowSpriteSheet from '../assets/sprites/characters/yellow.png';
import greenSpriteSheet from '../assets/sprites/characters/green.png';
import slimeSpriteSheet from '../assets/sprites/characters/slime.png';
import cactusPng from '../assets/sprites/characters/cactus.png';
import snakePng from '../assets/sprites/characters/snake.png';
import { loadSettingsFromURL } from '../src/utils/url-parser';

// Из урла берём следующую для открытия сцену
const { openScene } = loadSettingsFromURL({ openScene: 'MainMenu' });

class SpritesGenerator {
	ctx: Phaser.GameObjects.Graphics;
	constructor(readonly scene: Phaser.Scene, x = 0, y = 0) {
		this.ctx = scene.add.graphics({ x, y });
	}
	snake(name: string, origin: number[][], debug = false) {
		const spacing = 4;
		const frames = 32;
		const frameWidth = origin.length;
		const frameWithSpacing = frameWidth + spacing;
		const ctx = this.ctx;
		if (debug) {
			ctx.lineStyle(1, 0xff0000);
			for (let x = 0; x < frames; x++) {
				for (let y = 0; y < 8; y++) {
					ctx.strokeRect(
						x * frameWithSpacing - 1,
						y * frameWithSpacing - 1,
						frameWidth + spacing / 2,
						frameWidth + spacing / 2
					);
				}
			}
		}
		for (let frame = 0; frame < frames; frame++) {
			for (let x = 0; x < frameWidth; x++) {
				const dy = 8 * Math.cos(((x + frame) / frameWidth) * 2 * Math.PI); // +-8
				for (let y = 0; y < frameWidth; y++) {
					const color = origin[x % 32 | 0][y];
					if (color <= 0) continue;
					ctx.fillStyle(color);
					const frameY = y + dy - 8;
					let i = 0;
					const pixelSize = 1 + Math.abs(dy % 1);
					const frameX = frameWithSpacing * frame;
					ctx.fillPoint(frameX + x, frameWithSpacing * i++ + frameY, pixelSize);
					ctx.fillPoint(frameX + (frameWidth - x), frameWithSpacing * i++ + frameY, pixelSize);
					ctx.fillPoint(frameX + frameY, frameWithSpacing * i++ + x, pixelSize);
					ctx.fillPoint(frameX + frameY, frameWithSpacing * i++ + (frameWidth - x), pixelSize);
					const cx = frameWidth / 2;
					const cy = frameWidth / 2;
					let r = Phaser.Math.RotateAround({ x, y: frameY }, cx, cy, -45);
					ctx.fillPoint(frameX + r.x, frameWithSpacing * i++ + r.y, pixelSizeByVector(r));
					r = Phaser.Math.RotateAround({ x, y: frameY }, cx, cy, -(90 + 45));
					ctx.fillPoint(frameX + r.x, frameWithSpacing * i++ + r.y, pixelSizeByVector(r));
					r = Phaser.Math.RotateAround({ x, y: frameY }, cx, cy, 45);
					ctx.fillPoint(frameX + r.x, frameWithSpacing * i++ + r.y, pixelSizeByVector(r));
					r = Phaser.Math.RotateAround({ x, y: frameY }, cx, cy, 90);
					ctx.fillPoint(frameX + r.x, frameWithSpacing * i++ + r.y, pixelSizeByVector(r));
				}
			}
		}
		const textureName = `${name}_snake_texture`;
		const spriteSheetName = `${name}_snake_spritesheet`;
		ctx.generateTexture(textureName, frameWithSpacing * frames, frameWithSpacing * 8);
		if (!debug) ctx.clear();
		this.scene.textures.addSpriteSheet(
			spriteSheetName,
			this.scene.textures.get(textureName).getSourceImage() as HTMLImageElement,
			{
				frameWidth: frameWidth,
				frameHeight: frameWidth,
				spacing,
			}
		);
		['right', 'left', 'down', 'up', 'right_up', 'left_up', 'right_down', 'left_down'].forEach(
			(dir, shift) => {
				this.scene.anims.create({
					key: `${name}_${dir}`,
					frames: this.scene.anims.generateFrameNumbers(spriteSheetName, {
						start: 0 + shift * frames,
						end: frames - 1 + shift * frames,
					}),
					frameRate: frames,
					repeat: -1,
				});
			}
		);
		function pixelSizeByVector(r: { x: number; y: number }): number | undefined {
			return 1 + ((r.x % 1) + (r.y % 1)) / 2;
		}
	}
}

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
		this.load.image('cactus', cactusPng);
		this.load.spritesheet('snake', snakePng, { frameWidth: 32, frameHeight: 16 });

		this.load.on('complete', () => {
			const spritesGenerator = new SpritesGenerator(this);
			for (let i = 0; i < 5; i++) {
				const origin = textureFrameToArray(
					32,
					(x, y) => this.textures.getPixel(x, y, 'slime', i * 9).color
				);
				spritesGenerator.snake(`slime_${i}`, origin);
			}
			for (const name of ['aurora', 'blue', 'green', 'yellow', 'punk']) {
				spritesGenerator.snake(
					name,
					textureFrameToArray(32, (x, y) => this.textures.getPixel(x, 16 - y, name, 0)?.color || -1)
				);
			}
			spritesGenerator.snake(
				'cactus',
				textureFrameToArray(
					32,
					(x, y) => this.textures.getPixel(x, y - 16, 'snake', 3)?.color || -1
				)
			);

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
function textureFrameToArray(size: number, getPixel: (x: number, y: number) => number) {
	const origin = new Array(size).fill(0).map(size => new Array<number>(size).fill(-1));
	for (let x = 0; x < size; x++) {
		for (let y = 0; y < size; y++) {
			origin[x][y] = getPixel(x, y);
		}
	}
	return origin;
}

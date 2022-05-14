/// <reference path='./module_types.d.ts'/>
import EasyStar from 'easystarjs';

import tilemapPng from '../assets/tileset/Green_Meadow_Tileset.png';
import cactusPng from '../assets/sprites/characters/cactus.png';
import { Wander } from '../src/ai/steerings/wander';
import CharacterFactory from '../src/characters/character_factory';
import { Scene } from '../src/characters/scene';
import { loadSettingsFromURL } from '../src/utils/url-parser';
import { GenerateGraph } from './generation';
import {
	renderGraph,
	renderMinimap,
	renderTileGroups,
	tileIndexByConnectivity,
	TileType,
} from './render';

import Vector2 = Phaser.Math.Vector2;

const { randomState, defaultZoom, playerMode } = loadSettingsFromURL({
	randomState: `!rnd,1,${Math.random()},${Math.random()},${Math.random()}`,
	defaultZoom: 1,
	playerMode: false,
});

export class RoomDebug extends Phaser.Scene implements Scene {
	public readonly finder = new EasyStar.js();

	tileSize = 32;
	constructor() {
		super({ key: 'RoomDebug' });
	}

	width = 0;
	height = 0;
	characterFactory?: CharacterFactory;

	getSize() {
		return new Vector2(this.width, this.height);
	}

	preload() {
		this.load.image('tiles', tilemapPng);
		this.load.image('cactus', cactusPng);
	}

	objects = new Array<{ update: (dt: number) => void }>();
	create() {
		const width = 500;
		const height = 500;
		this.width = width * this.tileSize;
		this.height = height * this.tileSize;
		(() => {
			const frames = 32;
			const ctx = this.add.graphics({ x: -width });
			ctx.lineStyle(1, 0xfffff0);
			ctx.strokeRect(-1, -1, 36 * frames, 36 * 4);
			const igles = new Array<number>(32);
			for (let x = 0; x < 32; x++) {
				igles[x] = Phaser.Math.RND.between(-6, 6);
			}
			const cactus = new Array(32).fill(16).map(size => new Array<number>(size).fill(-1));
			for (let x = 0; x < 32; x++) {
				for (let y = 0; y < 16; y++) {
					cactus[x][y] = this.textures.getPixel(x, y, 'cactus').color;
				}
			}
			for (let frame = 0; frame < frames; frame++) {
				for (let x = 0; x < 32; x++) {
					const dy = Math.round(8 * Math.cos(((x + frame) / 32) * 2 * Math.PI)); // +-8
					for (let y = 0; y < 16; y++) {
						const color = cactus[x % 32 | 0][y];
						if (color <= 0) continue;
						ctx.fillStyle(color);
						const frameY = 8 + y + dy;
						ctx.fillPoint(32 * frame + x, frameY);
						ctx.fillPoint(32 * frame + (32 - x), 32 + frameY);
						ctx.fillPoint(32 * frame + frameY, 32 * 2 + x);
						ctx.fillPoint(32 * frame + frameY, 32 * 3 + (32 - x));
					}
				}
			}
			ctx.generateTexture('graphics', 32 * frames, 32 * 4);
			ctx.destroy();
			this.textures.addSpriteSheet(
				'graphics_s',
				this.textures.get('graphics').getSourceImage() as any,
				{
					frameWidth: 32,
					frameHeight: 32,
				}
			);
		})();
		const range = new Array(32).fill(0).map((_, i) => i);
		this.anims.create({
			key: 'cactus_right',
			frames: this.anims.generateFrameNumbers('graphics_s', { frames: range }),
			frameRate: 32,
			repeat: -1,
		});
		this.anims.create({
			key: 'cactus_left',
			frames: this.anims.generateFrameNumbers('graphics_s', { frames: range.map(i => i + 32) }),
			frameRate: 32,
			repeat: -1,
		});
		this.anims.create({
			key: 'cactus_down',
			frames: this.anims.generateFrameNumbers('graphics_s', { frames: range.map(i => i + 32 * 2) }),
			frameRate: 32,
			repeat: -1,
		});
		this.anims.create({
			key: 'cactus_up',
			frames: this.anims.generateFrameNumbers('graphics_s', { frames: range.map(i => i + 32 * 3) }),
			frameRate: 32,
			repeat: -1,
		});
		const mainCamera = this.cameras.main;
		mainCamera.setRoundPixels(false);
		// const debugCamera2 = this.cameras.add(this.game.canvas.width - width, 0, width, height);
		// debugCamera2.centerOn(this.width / 2, this.height / 2);
		// debugCamera2.setZoom(1 / this.tileSize);
		const debugCamera = this.cameras.add(this.game.canvas.width - width, 0, width, height);
		debugCamera.centerOn(-width / 2, height / 2);

		const graph = GenerateGraph({ width, height, rndState: randomState, roomsCount: 15 });
		console.log('Graph generated');
		const renderedGraph = renderGraph(graph, width, height);
		console.log('Graph rendered');
		// const rawMap = debugRoom(width, height);
		const typeToTileGroup = {
			[TileType.Wall]: 2712, //1560, //1368, 1944
			[TileType.Desert]: 216,
			[TileType.Swamp]: 1752, //1168,
			[TileType.Land]: 976,
			[TileType.Road]: 24,
		} as Record<number, number>;
		const rawMap = renderTileGroups(renderedGraph.tiles, typeToTileGroup, 2128);
		const map = this.make.tilemap({
			tileHeight: 32,
			tileWidth: 32,
			data: rawMap,
		});
		const tileset = map.addTilesetImage('main', 'tiles', 32, 32, 2, 6);
		const backgroundLayer = map.createBlankLayer('test', tileset, 0, 0);
		// backgroundLayer.fill(54);
		backgroundLayer.fill(638);

		const layer = map.createLayer(0, tileset);
		const minimapGroup = this.add.group();
		const g = this.add.graphics({ x: -width });
		minimapGroup.add(g);
		this.textures.addCanvas('minimap', renderMinimap(renderedGraph.tiles));
		minimapGroup.add(this.add.image(-width / 2, height / 2, 'minimap'));
		g.lineStyle(2, 0x000000);
		g.strokeRect(0, 0, width, height);
		g.lineStyle(2, 0xff0000);
		graph.vertexes.forEach((circle, i) => {
			minimapGroup.add(
				this.add.text(circle.x + g.x - 5, circle.y + g.y - 5, i.toString(), {
					align: 'center',
					color: '#0000ff',
				})
			);
			g.strokeCircleShape(circle);
		});
		g.lineStyle(2, 0x00ffff);
		graph.roads.forEach(g.strokeLineShape.bind(g));
		const factory = (this.characterFactory = new CharacterFactory(this));
		if (playerMode) {
			const startedRoom = Phaser.Math.RND.pick(renderedGraph.rooms);
			const cell = startedRoom.emptySpace.randomCell();
			const p = this.tilesToPixelsCenter({
				x: cell.x + startedRoom.vertex.left,
				y: cell.y + startedRoom.vertex.top,
			});
			this.characterFactory.buildPlayerCharacter('punk', p.x, p.y);
		} //else {
		renderedGraph.rooms.forEach(room => {
			const count = Phaser.Math.RND.between(
				Math.max(1, Math.sqrt(room.emptySpace.size) / 4),
				Math.max(4, Math.sqrt(room.emptySpace.size) / 2)
			);
			for (let i = 0; i < count; i++) {
				const pos = room.emptySpace.randomCell();
				pos.x += room.vertex.left;
				pos.y += room.vertex.top;
				const { x, y } = this.tilesToPixelsCenter(pos);
				const npc = factory.buildTestCharacter('blue', x, y);
				npc.addSteering(new Wander(npc, 0.1));
			}
		});
		mainCamera.centerOn(this.width / 4, this.height / 4);
		mainCamera.setZoom(defaultZoom, defaultZoom);
		this.objects.push(
			new Phaser.Cameras.Controls.FixedKeyControl({
				camera: mainCamera,
				left: this.input.keyboard.addKey('A'),
				right: this.input.keyboard.addKey('D'),
				up: this.input.keyboard.addKey('W'),
				down: this.input.keyboard.addKey('S'),
				zoomIn: this.input.keyboard.addKey('E'),
				zoomOut: this.input.keyboard.addKey('Q'),
				speed: 0.0009,
			})
		);
		this.input.keyboard.on('keydown-M', () => {
			debugCamera.setVisible(!debugCamera.visible);
		});
		layer.setCollision(tileIndexByConnectivity.allIndexes(typeToTileGroup[TileType.Wall]));
		this.physics.add.collider(factory.dynamicGroup, layer);
		mainCamera.ignore(minimapGroup);
		// debugCamera.ignore(minimapGroup);
	}

	update(dt: number) {
		if (this.characterFactory) {
			this.characterFactory.gameObjects.forEach(function (element) {
				element.update();
			});
		}
		this.objects.forEach(o => o.update(dt));
	}

	tilesToPixels(tile: { x: number; y: number }): Phaser.Math.Vector2 {
		return new Phaser.Math.Vector2(tile.x * this.tileSize, tile.y * this.tileSize);
	}

	tilesToPixelsCenter(tile: { x: number; y: number }): Phaser.Math.Vector2 {
		return new Phaser.Math.Vector2(
			tile.x * this.tileSize + this.tileSize / 2,
			tile.y * this.tileSize + this.tileSize / 2
		);
	}

	pixelsToTiles(pixels: { x: number; y: number }): Phaser.Math.Vector2 {
		return new Phaser.Math.Vector2(
			Math.floor(pixels.x / this.tileSize),
			Math.floor(pixels.y / this.tileSize)
		);
	}
}

// (() => {
// 	console.log(
// 		JSON.stringify(
// 			Object.fromEntries(
// 				Object.entries({
// 					Left: [8, 9, 10, 11],
// 					Right: [16, 17, 18, 19],
// 					Up: [24, 25, 26, 27],
// 					Down: [0, 1, 2, 3],
// 				}).map(([k, arr]) => [k, arr.map(x => x + 32*3)])
// 			),
// 			null
// 		)
// 	);
// })();

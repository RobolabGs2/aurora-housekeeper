/// <reference path='./module_types.d.ts'/>
import EasyStar from 'easystarjs';

import tilemapPng from '../assets/tileset/Green_Meadow_Tileset.png';
import cactusPng from '../assets/sprites/characters/cactus.png';
import uiTilesetPng from '../assets/sprites/ui/ui.png';
import { Wander } from '../src/ai/steerings/wander';
import CharacterFactory, { HumanSpriteSheetName } from '../src/characters/character_factory';
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
import { Pursuit } from '../src/ai/steerings/pursuit';

const { randomState, defaultZoom, playerMode } = loadSettingsFromURL({
	randomState: `!rnd,1,${Math.random()},${Math.random()},${Math.random()}`,
	defaultZoom: 1,
	playerMode: true,
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
		this.load.image('ui', uiTilesetPng);
	}

	objects = new Array<{ update: (dt: number) => void }>();
	create() {
		const width = 500;
		const height = 500;
		this.width = width * this.tileSize;
		this.height = height * this.tileSize;
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
			[TileType.Land]: 1360, //976,
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
			this.characterFactory.buildPlayerCharacter('aurora', p.x, p.y);
		}
		renderedGraph.rooms.forEach(room => {
			const countSlimes = Phaser.Math.RND.between(
				Math.max(1, Math.sqrt(room.emptySpace.size) / 4),
				Math.max(4, Math.sqrt(room.emptySpace.size) / 3)
			);
			const countVizards = Phaser.Math.RND.between(
				Math.max(1, Math.sqrt(room.emptySpace.size) / 5),
				Math.max(2, Math.sqrt(room.emptySpace.size) / 4)
			);
			for (let i = 0; i < countSlimes; i++) {
				const pos = room.emptySpace.randomCell();
				pos.x += room.vertex.left;
				pos.y += room.vertex.top;
				const { x, y } = this.tilesToPixelsCenter(pos);
				const npc = factory.buildTestCharacter(x, y);
				npc.addSteering(new Wander(npc, 0.1));
				if (factory.player) npc.addSteering(new Pursuit(npc, factory.player, 0.25));
			}
			if (factory.player) {
				for (let i = 0; i < countVizards; i++) {
					const skin = Phaser.Math.RND.pick([
						'blue',
						'yellow',
						'green',
						'punk',
					] as HumanSpriteSheetName[]);
					const pos = room.emptySpace.randomCell();
					pos.x += room.vertex.left;
					pos.y += room.vertex.top;
					const { x, y } = this.tilesToPixelsCenter(pos);
					factory.buildVizardCharacter(skin, x, y);
				}
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
		this.physics.add.collider(factory.dynamicGroup, factory.dynamicGroup);
		mainCamera.ignore(minimapGroup);
		debugCamera.ignore(minimapGroup);

		(() => {
			const uiMap = this.make.tilemap({ tileWidth: 32, tileHeight: 32, width: 10, height: 1 });
			const tileset = uiMap.addTilesetImage('ui', 'ui', 32, 32, 0, 2);
			const ui = uiMap.createBlankLayer('hp', tileset);
			ui.putTilesAt([0, 1, 2, 3, 0], 0, 0);
			ui.getTilesWithin().forEach(tile => (tile.tint = 0xff0f0f));
			ui.setPosition(0, this.height);
			const uiCam = this.cameras.add(0, 0, uiMap.widthInPixels, uiMap.heightInPixels);
			uiCam.setBounds(ui.x, ui.y, uiMap.widthInPixels, uiMap.heightInPixels, true);

			const player = this.characterFactory?.player;
			if (player) {
				const hp = new Array(player.hp / 2).fill(2);
				ui.putTilesAt(hp, 0, 0);
				player.addListener('hp', (newHP: number) => {
					for (let i = 0; i < hp.length; i++) {
						hp[i] = newHP < 1 ? 0 : Math.min(newHP, 2);
						newHP -= 2;
					}
					ui.putTilesAt(hp, 0, 0);
				});
			}
		})();
	}

	update(dt: number) {
		if (this.characterFactory) {
			const count = this.characterFactory.gameObjects.length;
			for (let i = 0; i < count; i++) this.characterFactory.gameObjects[i].update(dt);
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

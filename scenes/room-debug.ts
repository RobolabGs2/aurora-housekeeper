/// <reference path='./module_types.d.ts'/>
import EasyStar from 'easystarjs';

import tilemapPng from '../assets/tileset/Green_Meadow_Tileset.png';
import cactusPng from '../assets/sprites/characters/cactus.png';
import uiTilesetPng from '../assets/sprites/ui/ui.png';
import { Wander } from '../src/ai/steerings/wander';
import CharacterFactory, { HumanSpriteSheetName } from '../src/characters/character_factory';
import { Scene } from '../src/characters/scene';
import { loadSettingsFromURL } from '../src/utils/url-parser';
import { Biom, GenerateGraph, MapGraph } from './generation';
import {
	renderGraph,
	renderMinimap,
	renderTileGroups,
	tileIndexByConnectivity,
	TileType,
} from './render';

import Vector2 = Phaser.Math.Vector2;
import { Pursuit } from '../src/ai/steerings/pursuit';
import { EvilWizard, FireballConfig } from '../src/characters/player';

const { randomState, defaultZoom, playerMode } = loadSettingsFromURL({
	randomState: `!rnd,1,${Math.random()},${Math.random()},${Math.random()}`,
	defaultZoom: 1,
	playerMode: true,
});

interface MobConfig {
	hp: number;
	maxSpeed: number;
	skin: string[];
	count: number;
	type: 'Wizard' | 'Snake';
	fireball?: FireballConfig;
}

export interface BiomDescription {
	// [TileType.Wall]: 2712, //1560, //1368, 1944
	// [TileType.Desert]: 216,
	// [TileType.Swamp]: 1752, //1168,
	// [TileType.Land]: 1360, //976,
	landscapeTileGroup: number;
	mobs: MobConfig[];
}

const biomsConfig: Record<Biom, BiomDescription> = {
	[Biom.Desert]: {
		landscapeTileGroup: 216,
		mobs: [
			{
				hp: 3,
				maxSpeed: 50,
				skin: ['snake_1', 'cactus', 'aurora', 'yellow'],
				count: 15,
				type: 'Snake',
			},
			{
				hp: 5,
				maxSpeed: 90,
				skin: ['yellow'],
				count: 2,
				type: 'Wizard',
				fireball: {
					color: 0xffaf0f,
					cooldown: 1100,
					damage: 1,
					radius: 7,
				},
			},
		],
	},
	[Biom.Swamp]: {
		landscapeTileGroup: 1752,
		mobs: [
			{
				hp: 3,
				maxSpeed: 40,
				skin: ['snake_2', 'snake_3', 'green', 'slime_0', 'slime_1'],
				count: 15,
				type: 'Snake',
			},
			{
				hp: 5,
				maxSpeed: 70,
				skin: ['green', 'blue'],
				count: 2,
				type: 'Wizard',
				fireball: {
					color: 0x0edf1f,
					cooldown: 1100,
					damage: 1,
					radius: 7,
				},
			},
		],
	},
	[Biom.Land]: {
		landscapeTileGroup: 1360,
		mobs: [
			{
				hp: 2,
				maxSpeed: 60,
				skin: ['snake_0', 'snake_2', 'slime_2', 'slime_3', 'slime_4'],
				count: 15,
				type: 'Snake',
			},
			{
				hp: 6,
				maxSpeed: 110,
				skin: ['punk'],
				count: 2,
				type: 'Wizard',
				fireball: {
					color: 0xfa1f0f,
					cooldown: 800,
					damage: 1,
					radius: 4,
				},
			},
		],
	},
};

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
		const renderedGraph = renderGraph(graph, width, height, biomsConfig);
		console.log('Graph rendered');
		// const rawMap = debugRoom(width, height);
		const typeToTileGroup = {
			[TileType.Wall]: 2712, //1560, //1368, 1944
			[216]: 216,
			[1752]: 1752, //1168,
			[1360]: 1360, //976,
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
		const factory = (this.characterFactory = new CharacterFactory(this));
		const respwanPoints = new Array<Phaser.Tilemaps.Tile>();
		if (playerMode) {
			const startedRoom = Phaser.Math.RND.pick(renderedGraph.rooms);
			const cell = startedRoom.emptySpace.randomCell();
			const tile = {
				x: cell.x + startedRoom.vertex.left,
				y: cell.y + startedRoom.vertex.top,
			};
			const p = this.tilesToPixelsCenter(tile);
			const player = this.characterFactory.buildPlayerCharacter('aurora', p.x, p.y);
			player.addListener('die', (prevent: (hp: number) => void) => {
				prevent(player.maxHP);
				const closestRespawn = Phaser.Math.RND.pick(respwanPoints);
				const pos = this.tilesToPixelsCenter(closestRespawn);
				player.setPosition(pos.x, pos.y);
			});
		}
		const layerCaves = map.createBlankLayer('caves', tileset);
		const respawnLayer = map.createBlankLayer('respawn', tileset);
		renderedGraph.rooms.forEach(room => {
			const respawnPoint = room.emptySpace.randomCell();
			respawnPoint.x += room.vertex.left;
			respawnPoint.y += room.vertex.top;
			respwanPoints.push(respawnLayer.putTileAt(262, respawnPoint.x, respawnPoint.y));

			const config = biomsConfig[room.vertex.biom];
			for (const mobType of config.mobs) {
				for (let i = 0; i < mobType.count; i++) {
					const pos = room.emptySpace.randomCell();
					pos.x += room.vertex.left;
					pos.y += room.vertex.top;
					const { x, y } = this.tilesToPixelsCenter(pos);
					const skin = Phaser.Math.RND.pick(mobType.skin);
					switch (mobType.type) {
						case 'Snake':
							// eslint-disable-next-line no-case-declarations
							const npc = factory.buildTestCharacter(skin, mobType.maxSpeed, mobType.hp, x, y);
							npc.addSteering(new Wander(npc, 0.1));
							if (factory.player) npc.addSteering(new Pursuit(npc, factory.player, 0.25));
							break;
						case 'Wizard':
							if (factory.player) {
								factory
									.buildVizardCharacter(
										skin as HumanSpriteSheetName,
										mobType.maxSpeed,
										mobType.hp,
										x,
										y,
										mobType.fireball!
									)
									.on('destroy', function (this: EvilWizard) {
										const pos = (this.scene as RoomDebug).pixelsToTiles(this);
										layerCaves.putTileAt(2952, pos.x, pos.y);
									});
							}
					}
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

		const minimapGroup = this.add.group();
		this.addMinimap(width, minimapGroup, renderedGraph, height, graph);
		mainCamera.ignore(minimapGroup);
		debugCamera.setVisible(false);
		// debugCamera.ignore(minimapGroup);

		(() => {
			const uiMap = this.make.tilemap({ tileWidth: 32, tileHeight: 32, width: 10, height: 1 });
			const tileset = uiMap.addTilesetImage('ui', 'ui', 32, 32, 0, 2);
			const ui = uiMap.createBlankLayer('hp', tileset);
			ui.putTilesAt([0, 1, 2, 3, 0], 0, 0);
			ui.getTilesWithin().forEach(tile => (tile.tint = 0xff0f0f));
			ui.setPosition(0, this.height);
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

			const uiCam = this.cameras.add(
				20,
				this.scale.height - uiMap.heightInPixels - 20,
				uiMap.widthInPixels,
				uiMap.heightInPixels
			);
			uiCam.setBounds(ui.x, ui.y, uiMap.widthInPixels, uiMap.heightInPixels, true);
		})();
		let debugGraphic: undefined | Phaser.GameObjects.Graphics;
		this.input.keyboard.on('keydown-P', () => {
			if (debugGraphic) debugGraphic = (debugGraphic.destroy(), undefined);
			else debugGraphic = this.physics.world.createDebugGraphic();
		});
	}

	private addMinimap(
		width: number,
		minimapGroup: Phaser.GameObjects.Group,
		renderedGraph: ReturnType<typeof renderGraph>,
		height: number,
		graph: MapGraph
	) {
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

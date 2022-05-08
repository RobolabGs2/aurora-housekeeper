/// <reference path='./module_types.d.ts'/>
import EasyStar from 'easystarjs';

import tilemapPng from '../assets/tileset/Green_Meadow_Tileset.png';
import tilemapJson from '../assets/green_meadow.json';
import CharacterFactory from '../src/characters/character_factory';
import { Scene } from '../src/characters/scene';
import { Wander } from '../src/ai/steerings/wander';

type LayerDescription = {
	depth?: number;
	collide?: boolean;
};

const layersSettings = {
	/** Нижний слой с землёй и декором */
	Ground: {} as LayerDescription,
	/** Стены, вода */
	Walls: { collide: true } as LayerDescription,
	/** Одиночные препятствия (камни, пни) */
	Obstacles: { collide: true } as LayerDescription,
	/** Стены загона  - возможно, отдельный слой не нужен */
	'Corral.Walls': { collide: true } as LayerDescription,
	/** Двери загона  - возможно, отдельный слой не нужен */
	'Corral.Doors': {} as LayerDescription,
	/** Арбитр в загоне - возможно, отдельный слой не нужен */
	'Corral.Arbitrator': { depth: 10 } as LayerDescription,
	/** Арбитр снаружи - возможно, отдельный слой не нужен */
	Arbitrator: { depth: 10 } as LayerDescription,
	/** Декор сверху (кроны деревьев) */
	Transparent: { depth: 10 } as LayerDescription,
};

/**
 * Вспомогательная функция для создания слоёв по описанию в виде объекта,
 * потому что мне надоело хардкодить-копипастить
 */
function createLayers<T extends string>(
	map: Phaser.Tilemaps.Tilemap,
	tileset: Phaser.Tilemaps.Tileset,
	layersSettings: Record<T, LayerDescription>
): Record<T, Phaser.Tilemaps.TilemapLayer> {
	const layers = {} as Record<T, Phaser.Tilemaps.TilemapLayer>;
	for (const layerID in layersSettings) {
		layers[layerID] = map.createLayer(layerID, tileset, 0, 0);
		const depth = layersSettings[layerID].depth;
		if (depth !== undefined) layers[layerID].setDepth(depth);
	}
	return layers;
}

function setupFinder(
	finder: EasyStar.js,
	tilemap: Phaser.Tilemaps.Tilemap,
	collidesLayers: string[]
): void {
	const grid = [];
	for (let y = 0; y < tilemap.height; y++) {
		const col = [];
		for (let x = 0; x < tilemap.width; x++) {
			const tile = collidesLayers.reduce(
				(tile, layer) => tile || tilemap.getTileAt(x, y, false, layer)?.index,
				null as number | null
			);
			col.push(tile ? tile : 0);
		}
		grid.push(col);
	}
	finder.setGrid(grid);
	finder.setAcceptableTiles([0]);
}

export class GameScene extends Phaser.Scene implements Scene {
	public readonly finder = new EasyStar.js();

	tileSize = 36;
	constructor() {
		super({ key: 'Game' });
	}

	width = 0;
	height = 0;
	characterFactory?: CharacterFactory;

	getSize() {
		return new Phaser.Math.Vector2(this.width, this.height);
	}

	preload() {
		this.load.image('tiles', tilemapPng);
		this.load.tilemapTiledJSON('map', tilemapJson);
	}

	create() {
		const map = this.make.tilemap({ key: 'map' });

		const tileset = map.addTilesetImage('Green_Meadow_Tileset', 'tiles');

		const layers = createLayers(map, tileset, layersSettings);
		const collidesLayers = Object.entries<LayerDescription>(layersSettings)
			.filter(([, { collide: astar }]) => astar)
			.map(([key]) => key as keyof typeof layersSettings);
		setupFinder(this.finder, map, collidesLayers);

		this.width = map.widthInPixels;
		this.height = map.heightInPixels;

		this.physics.world.bounds.width = map.widthInPixels;
		this.physics.world.bounds.height = map.heightInPixels;

		// Creating characters

		const characterFactory = new CharacterFactory(this);
		this.characterFactory = characterFactory;
		const player = characterFactory.buildPlayerCharacter('aurora', 800, 300);
		const npc = characterFactory.buildTestCharacter('blue', 700, 200);
		npc.addSteering(new Wander(npc, 0.1));
		this.input.keyboard.on('keydown-D', () => {
			// Turn on physics debugging to show player's hitbox
			this.physics.world.createDebugGraphic();

			this.add.graphics().setAlpha(0.75).setDepth(20);
		});
		// Устанавливаем коллизии с окружением для игрока и npc
		collidesLayers.forEach(layerID => {
			layers[layerID].setCollisionBetween(1, 5000);
			this.physics.add.collider(characterFactory.dynamicGroup, layers[layerID]);
		});
		this.physics.add.collider(characterFactory.dynamicGroup, characterFactory.dynamicGroup);
	}

	update() {
		if (this.characterFactory) {
			this.characterFactory.gameObjects.forEach(function (element) {
				element.update();
			});
		}
	}

	tilesToPixels(tile: { x: number; y: number }): Phaser.Math.Vector2 {
		return new Phaser.Math.Vector2(tile.x * this.tileSize, tile.y * this.tileSize);
	}

	pixelsToTiles(pixels: { x: number; y: number }): Phaser.Math.Vector2 {
		return new Phaser.Math.Vector2(
			Math.floor(pixels.x / this.tileSize),
			Math.floor(pixels.y / this.tileSize)
		);
	}
}

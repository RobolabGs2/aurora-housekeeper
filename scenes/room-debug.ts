/// <reference path='./module_types.d.ts'/>
import EasyStar from 'easystarjs';

import tilemapPng from '../assets/tileset/Green_Meadow_Tileset.png';
import CharacterFactory from '../src/characters/character_factory';
import { Scene } from '../src/characters/scene';
import { loadSettingsFromURL } from '../src/utils/url-parser';
import { MapGraph, GenerateGraph, Vertex } from './generation';

import Vector2 = Phaser.Math.Vector2;

const { randomState, defaultZoom, playerMode } = loadSettingsFromURL({
	randomState: `!rnd,1,${Math.random()},${Math.random()},${Math.random()}`,
	defaultZoom: 1,
	playerMode: false,
});

enum TileType {
	Empty,
	Wall,
}

const TileMapping = {
	[TileType.Empty]: 0,
	[TileType.Wall]: 2727,
};

function generateRoom(vertex: Vertex, random = new Phaser.Math.RandomDataGenerator()) {
	const inputTile = 1231;
	const boardTile = 2735;
	const aliveTile = 1710;
	const deadTile = TileType.Wall;
	const size = vertex.radius * 2 + 1;
	let rawMap = new Array(size).fill(size).map(size => new Array(size).fill(deadTile));
	_fillcircle(vertex.radius, vertex.radius, vertex.radius, (x1, x2, y) => {
		rawMap[y][x1] = rawMap[y][x2] = boardTile;
	});
	_fillcircle(vertex.radius, vertex.radius, (vertex.radius / 2) | 0, (x1, x2, y) => {
		const lenght = x2 - x1;
		const cellsCount = random.between(lenght * 0.2, lenght * 0.8);
		for (let i = 0; i < cellsCount; i++) {
			rawMap[y][random.between(x1, x2)] = aliveTile;
		}
	});
	for (const road of vertex.roads.values()) {
		const point = road.from === vertex ? road.getPointA() : road.getPointB();
		rawMap[point.y - vertex.top][point.x - vertex.left] = inputTile;
	}
	let bufferMap = new Array(size).fill(0).map((_, __, arr) => new Array(arr.length).fill(0));
	for (let i = 0; i < 8; i++) {
		for (let y = 0; y < size; y++)
			for (let x = 0; x < size; x++) {
				bufferMap[y][x] = rawMap[y][x];
				const isAlive = rawMap[y][x] === aliveTile;
				if (!isAlive && rawMap[y][x] !== deadTile) continue;
				let alive = isAlive ? -1 : 0;
				for (let dx = -1; dx <= 1; dx++)
					for (let dy = -1; dy <= 1; dy++) {
						const neiborhood = rawMap[Math.max(0, Math.min(size - 1, y - dy))][x - dx];
						alive += +(neiborhood === aliveTile) + 2 * +(neiborhood == inputTile);
					}
				if (isAlive && (alive < 0 || alive > 7)) bufferMap[y][x] = deadTile;
				if (!isAlive && alive > 1) bufferMap[y][x] = aliveTile;
			}
		const tmp = bufferMap;
		bufferMap = rawMap;
		rawMap = tmp;
	}
	return rawMap;
}

function renderGraph(graph: MapGraph, width: number, height: number) {
	const rawMap = new Array(height).fill(width).map(size => new Array(size).fill(TileType.Wall));
	graph.roads.forEach(road =>
		line(road.x1, road.x2, road.y1, road.y2, (x, y) => (rawMap[y][x] = TileType.Empty))
	);
	graph.vertexes.forEach(circle => {
		const room = generateRoom(circle);
		_fillcircle(circle.x, circle.y, circle.radius, (x1, x2, y) => {
			for (let x = x1; x <= x2; x++) rawMap[y][x] = room[y - circle.top][x - circle.left]; //TileType.Empty;
			// for (let x = x1 + 1; x < x2; x++) rawMap[y][x] = TileType.Empty;
		});
	});
	return rawMap;
}

function line(
	x0: number,
	x1: number,
	y0: number,
	y1: number,
	plot: (x: number, y: number) => void
) {
	const L = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
	const dx = (x1 - x0) / L;
	const dy = (y1 - y0) / L;
	for (let i = 0; i < L; ++i) {
		plot(Math.round(x0 + i * dx), Math.round(y0 + i * dy));
		plot(Math.round(x0 + i * dx - 1), Math.round(y0 + i * dy));
		plot(Math.round(x0 + i * dx + 1), Math.round(y0 + i * dy));
	}
}

function _fillcircle(
	X1: number,
	Y1: number,
	R: number,
	drawline: (x1: number, x2: number, y: number) => void
) {
	let x = 0;
	let y = R;
	let delta = 1 - 2 * R;
	let error = 0;
	while (y >= x) {
		drawline(X1 - x, X1 + x, Y1 + y);
		drawline(X1 - x, X1 + x, Y1 - y);
		drawline(X1 - y, X1 + y, Y1 + x);
		drawline(X1 - y, X1 + y, Y1 - x);
		error = 2 * (delta + y) - 1;
		if (delta < 0 && error <= 0) {
			delta += 2 * ++x + 1;
			continue;
		}
		if (delta > 0 && error > 0) {
			delta -= 2 * --y + 1;
			continue;
		}
		delta += 2 * (++x - --y);
	}
}

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
	}

	objects = new Array<{ update: (dt: number) => void }>();
	create() {
		const width = 500;
		const height = 500;
		this.width = width * this.tileSize;
		this.height = height * this.tileSize;
		const mainCamera = this.cameras.main;
		mainCamera.setRoundPixels(false);
		const debugCamera = this.cameras.add(this.game.canvas.width - width, 0, width, height);
		debugCamera.centerOn(-width / 2, height / 2);
		if (playerMode) {
			this.characterFactory = new CharacterFactory(this);
			this.characterFactory.buildPlayerCharacter('aurora', 100, 100);
		} else {
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
			mainCamera.setScroll(width / defaultZoom, height / 2 / defaultZoom);
		}
		const g = this.add.graphics({ x: -width });
		mainCamera.ignore(g);
		g.setDepth(20);
		g.lineStyle(2, 0x000000);
		g.strokeRect(0, 0, width, height);
		g.lineStyle(2, 0xff0000);
		const graph = GenerateGraph({ width, height, rndState: randomState });
		graph.vertexes.forEach((circle, i) => {
			mainCamera.ignore(
				this.add.text(circle.x + g.x - 5, circle.y + g.y - 5, i.toString(), { align: 'center' })
			);
			g.strokeCircleShape(circle);
		});
		g.lineStyle(2, 0x00ffff);
		graph.roads.forEach(g.strokeLineShape.bind(g));
		console.log(this.objects);
		// const rawMap = generateRoom(30, 20);
		const rawMap = renderGraph(graph, width, height);
		const map = this.make.tilemap({
			tileHeight: 32,
			tileWidth: 32,
			data: rawMap,
		});
		const tileset = map.addTilesetImage('main', 'tiles', 32, 32, 2, 6);
		const layer = map.createLayer(0, tileset);
		for (const tileType in TileMapping) {
			layer.replaceByIndex(+tileType, TileMapping[tileType as unknown as keyof typeof TileMapping]);
		}
		// this.width = map.widthInPixels;
		// this.height = map.heightInPixels;
		// const graph
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

	pixelsToTiles(pixels: { x: number; y: number }): Phaser.Math.Vector2 {
		return new Phaser.Math.Vector2(
			Math.floor(pixels.x / this.tileSize),
			Math.floor(pixels.y / this.tileSize)
		);
	}
}

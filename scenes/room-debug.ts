/// <reference path='./module_types.d.ts'/>
import EasyStar from 'easystarjs';
import { Geom } from 'phaser';

import tilemapPng from '../assets/tileset/Green_Meadow_Tileset.png';
import CharacterFactory from '../src/characters/character_factory';
import { Scene } from '../src/characters/scene';
import { loadSettingsFromURL } from '../src/utils/url-parser';
import { MapGraph, GenerateGraph, Vertex } from './generation';

import Vector2 = Phaser.Math.Vector2;

const { randomState, defaultZoom, playerMode, fastMode } = loadSettingsFromURL({
	randomState: `!rnd,1,${Math.random()},${Math.random()},${Math.random()}`,
	defaultZoom: 1,
	playerMode: false,
	fastMode: false,
});

enum TileType {
	Empty,
	Wall,
	Road,
}

const TileMapping = {
	[TileType.Empty]: 0,
	[TileType.Wall]: 2727,
	[TileType.Road]: 830,
};
const inputTile = 1560;
const boardTile = 2735;
const aliveTile = 1710;
const deadTile = 1422; // TileType.Wall;

function generateRoom(vertex: Vertex, random = new Phaser.Math.RandomDataGenerator()) {
	const size = vertex.radius * 2 + 1;
	const rawMap = createMatrix(aliveTile, size);
	_fillcircle(vertex.radius, vertex.radius, vertex.radius, (x1, x2, y) => {
		rawMap[y][x1] = rawMap[y][x2] = boardTile;
	});
	_fillcircle(vertex.radius, vertex.radius, (vertex.radius * 0.9) | 0, (x1, x2, y) => {
		const lenght = x2 - x1;
		const cellsCount = random.between(lenght * 0.01, lenght * 0.25);
		for (let i = 0; i < cellsCount; i++) {
			rawMap[y][random.between(x1, x2)] = deadTile;
		}
	});
	let crossroads = new Vector2(
		random.between(2, vertex.radius - 2),
		random.between(2, vertex.radius - 2)
	);
	const roads = new Array<{ x: number; y: number }>();
	for (const road of vertex.roads.values()) {
		const point = road.from === vertex ? road.getPointA() : road.getPointB();
		const roadPoint = { x: point.x - vertex.left, y: point.y - vertex.top };
		crossroads.add(roadPoint);
		roads.push(roadPoint);
	}
	crossroads.scale(1 / (vertex.roads.size + 1));
	crossroads.set(crossroads.x | 0, crossroads.y | 0);
	crossroads = crossroads
		.subtract({ x: vertex.radius, y: vertex.radius })
		.scale(-1)
		.add({ x: vertex.radius, y: vertex.radius });
	for (const road of vertex.roads.values()) {
		const point = road.from === vertex ? road.getPointA() : road.getPointB();
		const y = point.y - vertex.top;
		const x = point.x - vertex.left;
		rawMap[y][x] = inputTile;
		// line(vertex.radius, x, vertex.radius, y, (x, y) => (rawMap[y][x] = inputTile));
		line(crossroads.x, x, crossroads.y, y, (x, y) => (rawMap[y][x] = inputTile));
	}
	const automated = cellcular(
		15 * Math.ceil(vertex.radius / 100),
		rawMap,
		deadTile,
		aliveTile,
		inputTile
	);
	return {
		tiles: automated,
		crossroads,
		roads,
		vertex,
	};
}

function cellcular(
	iteratoins: number,
	map: number[][],
	aliveTile: number,
	deadTile: number,
	immortalTile: number
) {
	const size = map.length;
	let bufferMap = createMatrix(0, size);
	for (let i = 0; i < iteratoins; i++) {
		for (let y = 0; y < size; y++)
			for (let x = 0; x < size; x++) {
				bufferMap[y][x] = map[y][x];
				const isAlive = map[y][x] === aliveTile;
				if (!isAlive && map[y][x] !== deadTile) continue;
				let alive = isAlive ? -1 : 0;
				for (let dx = -1; dx <= 1; dx++)
					for (let dy = -1; dy <= 1; dy++) {
						const neiborhood = map[Math.max(0, Math.min(size - 1, y - dy))][x - dx];
						alive += +(neiborhood === aliveTile) + +(neiborhood == immortalTile);
					}
				if (isAlive && (alive < 3 || alive > 6)) bufferMap[y][x] = deadTile;
				if (!isAlive && alive > 2) bufferMap[y][x] = aliveTile;
			}
		const tmp = bufferMap;
		bufferMap = map;
		map = tmp;
	}
	return map;
}

function createMatrix<T>(defaultValue: T, width: number, height = width): T[][] {
	return new Array(height).fill(0).map(() => new Array(width).fill(defaultValue));
}

function erode(
	map: number[][],
	// core: number[][],
	aliveTile: number[],
	deadTile: number[],
	predicate: (aliveCount: number) => boolean
) {
	const size = map.length;
	const bufferMap = createMatrix(0, size);
	for (let y = 0; y < size; y++)
		for (let x = 0; x < size; x++) {
			bufferMap[y][x] = map[y][x];
			const isAlive = aliveTile.includes(map[y][x]);
			if (!isAlive && !deadTile.includes(map[y][x])) continue;
			let alive = isAlive ? -1 : 0;
			for (let dx = -1; dx <= 1; dx++)
				for (let dy = -1; dy <= 1; dy++) {
					const neiborhood = map[Math.max(0, Math.min(size - 1, y - dy))][x - dx];
					alive += +aliveTile.includes(neiborhood);
				}
			bufferMap[y][x] = predicate(alive) ? deadTile[0] : aliveTile[0];
		}
	return bufferMap;
}

class CellSet {
	private cells = new Set<number>();
	constructor(readonly mapSize: number) {}
	has(p: { x: number; y: number }): boolean {
		return this.cells.has(this.toKey(p));
	}
	add(p: { x: number; y: number }) {
		this.cells.add(this.toKey(p));
	}
	forEach(action: (cell: { x: number; y: number }) => void) {
		this.cells.forEach(key => action(this.fromKey(key)));
	}
	get size() {
		return this.cells.size;
	}
	closest(p: { x: number; y: number }) {
		let minDist = this.mapSize * this.mapSize;
		let closest = p;
		this.forEach(cell => {
			const dist = Phaser.Math.Distance.Snake(cell.x, cell.y, p.x, p.y);
			if (dist < minDist) {
				closest = cell;
				minDist = dist;
			}
		});
		return closest;
	}
	randomCell(rnd = Phaser.Math.RND) {
		return this.fromKey(rnd.pick(Array.from(this.cells.values())));
	}
	private fromKey(key: number) {
		return {
			x: (key / this.mapSize) | 0,
			y: key % this.mapSize,
		};
	}
	private toKey({ x, y }: { x: number; y: number }) {
		return x * this.mapSize + y;
	}
}

function renderGraph(graph: MapGraph, width: number, height: number) {
	const rawMap = createMatrix(TileType.Wall, width, height);
	const rooms = graph.vertexes.map(v => {
		let room = roomPostprocessing(generateRoom(v));
		while (room.emptySpace.size < v.radius * v.radius * 1.25) {
			console.warn(room.emptySpace.size, v.radius * v.radius * 1.25, v.radius);
			room = roomPostprocessing(generateRoom(v));
		}
		return room;
	});
	rooms.forEach(room => {
		// _fillcircle(circle.x, circle.y, circle.radius, (x1, x2, y) => {
		// 	for (let x = x1; x <= x2; x++) {
		// 		const cell = room[y - circle.top][x - circle.left];
		// 		rawMap[y][x] = cell === boardTile ? TileType.Wall : cell; //TileType.Empty;
		// 	}
		// 	// for (let x = x1 + 1; x < x2; x++) rawMap[y][x] = TileType.Empty;
		// });
		room.emptySpace.forEach(cell => {
			rawMap[cell.y + room.vertex.top][cell.x + room.vertex.left] = TileType.Empty;
		});
	});
	graph.roads.forEach(road => {
		const startRoom = rooms.find(r => r.vertex === road.from)!;
		const finishRoom = rooms.find(r => r.vertex === road.to)!;
		const start = new Vector2(
			startRoom.emptySpace.closest(
				road.getPointA().subtract({ x: startRoom.vertex.left, y: startRoom.vertex.top })
			)
		).add({ x: startRoom.vertex.left, y: startRoom.vertex.top });
		const finish = new Vector2(
			finishRoom.emptySpace.closest(
				road.getPointB().subtract({ x: finishRoom.vertex.left, y: finishRoom.vertex.top })
			)
		).add({ x: finishRoom.vertex.left, y: finishRoom.vertex.top });
		drunkenLine(
			start.x,
			start.y,
			finish.x,
			finish.y,
			(x, y) => (rawMap[y][x] = TileType.Road),
			(x, y) => {
				// graph.vertexes.reduce((sum, vertex) => {
				// 	if (vertex === road.to) return sum;
				// 	const tmpLine = new Geom.Line(x, y, vertex.x, vertex.y);
				// 	const closestPoint = new Vector2();
				// 	Geom.Intersects.LineToCircle(tmpLine, vertex, closestPoint);
				// 	const rawDir = closestPoint.subtract({ x, y }).scale(-1);
				// 	const dist = rawDir.length();
				// 	const dir = rawDir.normalize().scale(10500 / (dist * dist * dist));
				// 	return sum.add(dir);
				// }, new Vector2());
				const closest = graph.vertexes.reduce((closest, vertex) => {
					if (vertex === road.to) return closest;
					const tmpLine = new Geom.Line(x, y, vertex.x, vertex.y);
					const closestPoint = new Vector2();
					Geom.Intersects.LineToCircle(tmpLine, vertex, closestPoint);
					const rawDir = closestPoint.subtract({ x, y }).scale(-1);
					const dist = rawDir.length();
					// const dir = rawDir.normalize().scale(10500 / (dist * dist * dist));
					// return sum.add(dir);
					return dist < closest.length() ? rawDir : closest;
				}, new Vector2(width, height));
				const dist = closest.length();
				return closest.normalize().scale(250 / (dist * dist));
			}
		);
	});
	return {
		graph,
		rooms,
		tiles: erode(rawMap, [TileType.Road], [TileType.Wall], alive => alive < 2),
	};
}

function drunkenLine(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	draw: (x: number, y: number) => void,
	gravitation?: (x: number, y: number) => Vector2
) {
	const start = new Vector2(x1, y1);
	const finish = new Vector2(x2, y2);
	const current = start.clone();
	const random = new Vector2();
	while (current.distance(finish) > 0.5) {
		const gravitationForce = gravitation?.(current.x, current.y) || Vector2.ZERO;
		Phaser.Math.RandomXY(
			random,
			Phaser.Math.RND.realInRange(0.01, Math.max(1, gravitationForce.length() * 2))
		);
		const dir = finish
			.clone()
			.subtract(current)
			.normalize()
			.add(random)
			.add(gravitationForce)
			.normalize();
		current.add(dir);
		draw(Math.round(current.x), Math.round(current.y));
		dir.normalizeLeftHand();
		draw(Math.round(current.x + dir.x), Math.round(current.y));
		draw(Math.round(current.x - dir.x), Math.round(current.y));
		draw(Math.round(current.x + dir.x), Math.round(current.y + dir.y));
		draw(Math.round(current.x - dir.x), Math.round(current.y + dir.y));
		draw(Math.round(current.x), Math.round(current.y + dir.y));
		draw(Math.round(current.x), Math.round(current.y - dir.y));
		draw(Math.round(current.x + dir.x), Math.round(current.y - dir.y));
		draw(Math.round(current.x - dir.x), Math.round(current.y - dir.y));
	}
}

function searchConnectivyComponents(
	tiles: number[][],
	emptyTile: number,
	flagTile?: number,
	maxSize = tiles.length * tiles.length
): [CellSet[], CellSet[]] {
	const components = new Array<CellSet>();
	const flagedComponents = new Array<CellSet>();
	const size = tiles.length;
	_fillcircle((size - 1) / 2, (size - 1) / 2, (size - 1) / 2, (x1, x2, j) => {
		for (let i = x1 + 1; i < x2; i++) {
			if (tiles[j][i] !== emptyTile) continue;
			if (components.find(c => c.has({ x: i, y: j }))) continue;
			const queue = [{ x: i, y: j }];
			const component = new CellSet(size);
			component.add(queue[0]);
			let flag = false;
			while (queue.length) {
				const current = queue.shift()!;
				for (const [dx, dy] of [
					[1, 0],
					[-1, 0],
					[0, 1],
					[0, -1],
				]) {
					const x = current.x + dx;
					const y = current.y + dy;
					const p = { x, y };
					if (x < 0 || x >= size || y < 0 || y >= size) continue;
					flag = flag || tiles[y][x] === flagTile;
					if (tiles[y][x] !== emptyTile || component.has(p)) continue;
					queue.push(p);
					component.add(p);
					if (component.size > maxSize) break;
				}
			}
			if (component.size > maxSize) continue;
			if (flag) flagedComponents.push(component);
			else components.push(component);
		}
	});
	/*
	for (let i = 0; i < size; i++) {
		for (let j = 0; j < size; j++) {
			if (tiles[j][i] !== emptyTile) continue;
			if (components.find(c => c.has(toKey({ x: i, y: j })))) continue;
			const queue = [{ x: i, y: j }];
			const component = new Set<number>();
			component.add(toKey(queue[0]));
			let flag = false;
			while (queue.length) {
				const current = queue.shift()!;
				for (const [dx, dy] of [
					[1, 0],
					[-1, 0],
					[0, 1],
					[0, -1],
				]) {
					const x = current.x + dx;
					const y = current.y + dy;
					const p = { x, y };
					if (x < 0 || x >= size || y < 0 || y >= size) continue;
					flag = flag || tiles[y][x] === flagTile;
					if (tiles[y][x] !== emptyTile || component.has(toKey(p))) continue;
					queue.push(p);
					component.add(toKey(p));
				}
			}
			if (flag) flagedComponents.push(component);
			else components.push(component);
		}
	}
	*/
	return [components, flagedComponents];
}

function roomPostprocessing(room: ReturnType<typeof generateRoom>) {
	let eroded = erode(room.tiles, [deadTile], [aliveTile], alive => alive > 4);
	eroded = erode(eroded, [deadTile], [aliveTile, inputTile], alive => alive > 6);
	eroded = erode(eroded, [deadTile], [aliveTile], alive => alive < 7);
	const tiles = erode(eroded, [deadTile], [aliveTile], alive => alive > 4);
	const components = searchConnectivyComponents(tiles, aliveTile)[0];
	const maxComponent = components.reduce((max, component) =>
		max.size > component.size ? max : component
	);
	components.forEach(component => {
		if (component === maxComponent) return;
		component.forEach(({ x, y }) => {
			tiles[y][x] = deadTile;
		});
	});
	if (!fastMode) {
		const wallsComponents = searchConnectivyComponents(tiles, deadTile, boardTile, 8);
		wallsComponents[0]
			.filter(set => set.size < 9)
			.forEach(component =>
				component.forEach(p => {
					tiles[p.y][p.x] = aliveTile;
					maxComponent.add(p);
				})
			);
	}
	return {
		...room,
		emptySpace: maxComponent,
	};
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
		// plot(Math.round(x0 + i * dx - 1), Math.round(y0 + i * dy));
		// plot(Math.round(x0 + i * dx + 1), Math.round(y0 + i * dy));
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
		const map = this.make.tilemap({
			tileHeight: 32,
			tileWidth: 32,
			data: renderedGraph.tiles,
		});
		const tileset = map.addTilesetImage('main', 'tiles', 32, 32, 2, 6);
		const layer = map.createLayer(0, tileset);
		for (const tileType in TileMapping) {
			layer.replaceByIndex(+tileType, TileMapping[tileType as unknown as keyof typeof TileMapping]);
			// layer.
		}

		const g = this.add.graphics({ x: -width });
		mainCamera.ignore(g);
		const colorMap = new Array<number>(deadTile, 666, aliveTile);
		const minimap = Phaser.Create.GenerateTexture({
			data: renderedGraph.tiles.map(line =>
				line
					.map(cell => {
						if (cell === TileType.Wall) return '.';
						let pallete = colorMap.findIndex(x => x === cell);
						if (pallete === -1) {
							pallete = colorMap.push(cell) - 1;
						}
						return (pallete + 1).toString(16);
					})
					.join('')
			),
		});
		this.textures.addCanvas('minimap', minimap);
		this.add.image(-width / 2, height / 2, 'minimap');
		// debugCamera.ignore(g);
		g.lineStyle(2, 0x000000);
		g.strokeRect(0, 0, width, height);
		g.lineStyle(2, 0xff0000);
		graph.vertexes.forEach((circle, i) => {
			mainCamera.ignore(
				this.add.text(circle.x + g.x - 5, circle.y + g.y - 5, i.toString(), {
					align: 'center',
					color: '#0000ff',
				})
			);
			g.strokeCircleShape(circle);
		});
		g.lineStyle(2, 0x00ffff);
		graph.roads.forEach(g.strokeLineShape.bind(g));
		console.log(this.objects);
		// const rawMap = generateRoom(30, 20);

		// this.width = map.widthInPixels;
		// this.height = map.heightInPixels;
		// const graph
		console.log(JSON.stringify(graph, undefined, '  '));
		if (playerMode) {
			this.characterFactory = new CharacterFactory(this);
			const startedRoom = Phaser.Math.RND.pick(renderedGraph.rooms);
			const cell = startedRoom.emptySpace.randomCell();
			const p = this.tilesToPixels({
				x: cell.x + startedRoom.vertex.left,
				y: cell.y + startedRoom.vertex.top,
			});
			const player = this.characterFactory.buildPlayerCharacter(
				'aurora',
				p.x + this.tileSize / 2,
				p.y + this.tileSize / 2
			);
			layer.setCollision([TileMapping[TileType.Wall]]);
			this.physics.add.collider(player, layer);
		} //else {
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
		// }
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

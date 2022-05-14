import { Geom } from 'phaser';
import { loadSettingsFromURL } from '../src/utils/url-parser';

import { MapGraph, GenerateGraph, Vertex } from './generation';

import Vector2 = Phaser.Math.Vector2;

enum Connectivity {
	NONE = 0,
	N = 1,
	E = 2,
	S = 4,
	W = 8,
	NE = 16,
	NW = 32,
	SE = 64,
	SW = 128,
}

const mask = [
	[Connectivity.NW, Connectivity.N, Connectivity.NE],
	[Connectivity.W, Connectivity.NONE, Connectivity.E],
	[Connectivity.SW, Connectivity.S, Connectivity.SE],
];

export function renderTileGroups(
	rawTiles: number[][],
	typeToTileGroup: Record<number, number>,
	defaultTile: number
) {
	const rawMap = rawTiles.map(line => line.map(x => x));
	const height = rawTiles.length;
	const width = rawTiles[0].length;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const tileType = rawTiles[y][x];
			let connectivity = Connectivity.NONE;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const ny = y + dy;
					const nx = x + dx;
					if (ny < 0 || nx < 0 || nx >= width || ny >= height) continue;
					if (rawTiles[ny][nx] === tileType) connectivity = connectivity | mask[1 + dy][1 + dx];
				}
			}
			rawMap[y][x] = tileIndexByConnectivity.get(
				typeToTileGroup[tileType] || defaultTile,
				connectivity
			);
		}
	}
	return rawMap;
}

export const tileIndexByConnectivity = (() => {
	const NONE = Connectivity.NONE;
	const N = Connectivity.N;
	const E = Connectivity.E;
	const S = Connectivity.S;
	const W = Connectivity.W;
	const NE = Connectivity.NE;
	const NW = Connectivity.NW;
	const SE = Connectivity.SE;
	const SW = Connectivity.SW;
	const desc = [
		[NONE, E, W | E, W, S, S | E | SE, W | E | S | SW | SE, W | S | SW],
		[
			E | S,
			W | S,
			N | E | S,
			W | E | S,
			N | S,
			N | NE | E | SE | S,
			N | E | S | W | NE | NW | SE | SW,
			N | S | SW | W | NW,
		],
		[N | E, W | N, N | E | W, N | S | W, N, N | NE | E, N | NE | E | W | NW, N | W | NW],
		[
			N | NE | E | S,
			N | S | W | NW,
			E | S | SW | W,
			E | SE | W | S,
			N | NE | E | S | SW | W | NW,
			N | NE | E | SE | S | W | NW,
			N | E | S | W | NW,
			N | NE | E | S | W,
		],
		[
			N | E | SE | S,
			N | S | SW | W,
			N | E | W | NW,
			N | NE | E | W,
			N | E | SE | S | SW | W | NW,
			N | NE | E | SE | S | SW | W,
			N | E | S | SW | W,
			N | E | SE | S | W,
		],
		[
			N | E | SE | S | SW | W,
			N | NE | E | S | W | NW,
			N | E | S | SW | W | NW,
			N | NE | E | SE | W | S,
			N | E | SE | S | W | NW,
			N | NE | E | S | SW | W,
			N | E | S | W,
			256,
		],
	];
	if (desc.find(l => l.length !== 8)) {
		throw new Error('Dimentions mismatch');
	}
	const connectivityToXY = {} as Record<number, Vector2>;
	for (let i1 = 0; i1 < desc.length; i1++) {
		for (let j1 = 0; j1 < 8; j1++) {
			const value = desc[i1][j1];
			const dup = connectivityToXY[value];
			if (dup !== undefined)
				throw new Error(`Duplicated decriptions for ${i1};${j1} and ${dup.y};${dup.x}: ${value}`);
			connectivityToXY[value] = new Vector2(j1, i1);
		}
	}
	return {
		get: (firstTileIndex: number, connectivity: number) => {
			if ((connectivity & E) === 0) connectivity = connectivity & ~(SE | NE);
			if ((connectivity & W) === 0) connectivity = connectivity & ~(SW | NW);
			if ((connectivity & N) === 0) connectivity = connectivity & ~(NW | NE);
			if ((connectivity & S) === 0) connectivity = connectivity & ~(SW | SE);

			const notShifted = connectivityToXY[connectivity];
			if (notShifted === undefined) {
				console.error(`Unknown connectivity: ${connectivity.toString(2)}`);
				return 3040;
			}
			return firstTileIndex + notShifted.y * 32 + notShifted.x;
		},
		allIndexes: (firstTileIndex: number) => {
			return desc.flatMap((line, j) => line.map((_, i) => firstTileIndex + j * 32 + i));
		},
	};
})();

export enum TileType {
	Empty,
	Wall,
	Road,
	Swamp,
	Desert,
	Land,
}

export const TileMapping = {
	[TileType.Empty]: 0,
	[TileType.Wall]: 2727,
	[TileType.Road]: 830,
};
const inputTile = 1560;
const boardTile = 2735;
const aliveTile = 1710;
const deadTile = 1422; // TileType.Wall;

export function renderMinimap(tiles: number[][]) {
	const colorMap = new Array<number>(deadTile, 666, aliveTile);
	return Phaser.Create.GenerateTexture({
		data: tiles.map(line =>
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
}

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

export function renderGraph(graph: MapGraph, width: number, height: number) {
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
		const biom = Phaser.Math.RND.pick([TileType.Desert, TileType.Land, TileType.Swamp]);
		room.emptySpace.forEach(cell => {
			rawMap[cell.y + room.vertex.top][cell.x + room.vertex.left] = biom;
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
				const closest = graph.vertexes.reduce((closest, vertex) => {
					if (vertex === road.to) return closest;
					const tmpLine = new Geom.Line(x, y, vertex.x, vertex.y);
					const closestPoint = new Vector2();
					Geom.Intersects.LineToCircle(tmpLine, vertex, closestPoint);
					const rawDir = closestPoint.subtract({ x, y }).scale(-1);
					const dist = rawDir.length();
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
	return [components, flagedComponents];
}

const { fastMode } = loadSettingsFromURL({
	fastMode: false,
});

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

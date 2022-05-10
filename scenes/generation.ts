import Geom = Phaser.Geom;

export class Vertex extends Geom.Circle {
	constructor(x: number, y: number, r: number) {
		super(x, y, r);
	}
	roads: Map<Vertex, Road> = new Map();
}

export class Road extends Geom.Line {
	constructor(
		readonly from: Vertex,
		readonly to: Vertex,
		p1: { x: number; y: number } = from,
		p2: { x: number; y: number } = to
	) {
		super(Math.round(p1.x), Math.round(p1.y), Math.round(p2.x), Math.round(p2.y));
	}
	belongs(v: Geom.Circle) {
		return v === this.from || v === this.to;
	}
}

export type MapGraph = ReturnType<typeof GenerateGraph>;

function toJSON(this: MapGraph) {
	const { vertexes, roads } = this;
	return {
		vertexes: vertexes.map(v => ({ x: v.x, y: v.y, r: v.radius })),
		roads: roads.map(r => ({
			from: vertexes.findIndex(v => v === r.from),
			to: vertexes.findIndex(v => v === r.to),
			p1: r.getPointA(),
			p2: r.getPointB(),
		})),
	};
}

export function GenerateGraph({
	width,
	height,
	rndState,
}: {
	width: number;
	height: number;
	rndState?: string;
}) {
	const vertexes = new Array<Vertex>();
	const RND = new Phaser.Math.RandomDataGenerator();
	if (rndState) {
		RND.state(rndState);
	}
	console.debug(RND.state()); //'!rnd,1,0.7053001527674496,0.2902482398785651,0.3079300969839096'
	const borders = new Geom.Rectangle(0, 0, width, height);
	for (let i = 0; i < 15; i++) {
		for (let j = 0; j < 100; j++) {
			const circle = new Vertex(
				RND.between(0, width),
				RND.between(0, height),
				RND.between(10, 100)
			);
			if (Geom.Intersects.GetCircleToRectangle(circle, borders).length) continue;
			if (vertexes.find(Geom.Intersects.CircleToCircle.bind(null, circle))) continue;
			vertexes.push(circle);
			break;
		}
	}
	const roads = new Array<Road>();
	for (let i = 0; i < vertexes.length; i++) {
		const from = vertexes[i];
		for (let k = 0; k < RND.between(1, 4); k++) {
			for (let k = 0; k < 10; k++) {
				const to = RND.pick(vertexes);
				if (from === to || from.roads.has(to)) {
					--k;
					continue;
				}
				// const to = RND.pick(points.slice(i + 1));
				const angle1 = RND.rotation();
				const angle2 = RND.rotation();
				const shift1 = from.radius / 2;
				const shift2 = to.radius / 2;
				const draftLine = new Geom.Line(
					from.x + Math.cos(angle1) * shift1,
					from.y + Math.sin(angle1) * shift1,
					to.x + Math.cos(angle2) * shift2,
					to.y + Math.sin(angle2) * shift2
				);
				const road = new Road(
					from,
					to,
					Geom.Intersects.GetLineToCircle(draftLine, from)[0],
					Geom.Intersects.GetLineToCircle(draftLine, to)[0]
				);
				if (
					vertexes.find(
						circle => circle !== from && circle !== to && Geom.Intersects.LineToCircle(road, circle)
					) ||
					roads.find(line => Geom.Intersects.LineToLine(road, line))
				)
					continue;
				roads.push(road);
				from.roads.set(to, road);
				to.roads.set(from, road);
				break;
			}
		}
	}
	return { vertexes, roads, toJSON };
}

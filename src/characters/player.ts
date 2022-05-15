import { StateTable } from '../ai/behaviour/state';
import { Escape } from '../ai/steerings/escape';
import { Pursuit } from '../ai/steerings/pursuit';
import Steering from '../ai/steerings/steering';
import { Wander } from '../ai/steerings/wander';
import CharacterFactory from './character_factory';
import { Scene } from './scene';
import Vector2 = Phaser.Math.Vector2;

export class SnakeAnimation {
	private static dirs = [
		[new Vector2(1, 0).normalize(), 'up'],
		[new Vector2(1, 1).normalize(), 'right_up'],
		[new Vector2(0, 1).normalize(), 'right'],
		[new Vector2(-1, 1).normalize(), 'right_down'],
		[new Vector2(-1, 0).normalize(), 'down'],
		[new Vector2(-1, -1).normalize(), 'left_down'],
		[new Vector2(0, -1).normalize(), 'left'],
		[new Vector2(1, -1).normalize(), 'left_up'],
	] as [Vector2, string][];
	constructor(readonly name: string) {}
	updateAnimation(sprite: Phaser.Physics.Arcade.Sprite) {
		const [c, dir] = SnakeAnimation.dirs.reduce(
			([max, a], [dir, da]) => {
				const delta = sprite.body.velocity.cross(dir);
				if (max < delta) {
					return [delta, da] as [number, string];
				}
				return [max, a] as [number, string];
			},
			[-2, 'down'] as [number, string]
		);
		const anim = `${this.name}_${dir}`;
		if (c > 0.1) {
			if (sprite.anims.currentAnim?.key === anim) sprite.anims.resume();
			else sprite.anims.play(anim, true);
		} else {
			if (sprite.anims.currentAnim) sprite.anims.pause();
		}
	}
}

export class Biota extends Phaser.Physics.Arcade.Sprite {
	private _hp = this.maxHP;
	set hp(value: number) {
		if (value > this.maxHP) return;
		const oldHP = this._hp;
		this._hp = value;
		this.emit('hp', value, oldHP);
		if (value <= 0) {
			let changeValue = 0;
			this.emit('die', (x: number) => (changeValue = x));
			if (changeValue > 0) this.hp = changeValue;
			else this.destroy();
		}
	}
	get hp(): number {
		return this._hp;
	}
	constructor(scene: Scene, x: number, y: number, name: string, readonly maxHP = 10) {
		super(scene, x, y, name);
		scene.physics.world.enable(this);
		scene.add.existing(this);
		this.addListener('damage', (value: number) => {
			this.hp -= value;
		});
	}
}

export class Vizard extends Biota {
	static dirs = [
		[new Vector2(1, 0), 'Up'],
		[new Vector2(0, 1), 'Right'],
		[new Vector2(-1, 0), 'Down'],
		[new Vector2(0, -1), 'Left'],
	] as [Vector2, 'Up' | 'Right' | 'Down' | 'Left'][];
	dir = 2;
	idle = true;
	updateDir() {
		const [c, newDir] = Player.dirs.reduce(
			([max, a], [dir], i) => {
				const delta = this.body.velocity.cross(dir);
				if (max < delta) {
					return [delta, i] as [number, number];
				}
				return [max, a] as [number, number];
			},
			[-2, this.dir] as [number, number]
		);
		this.dir = c > 0.1 ? newDir : this.dir;
		this.idle = c < 0.1;
	}
	movingTable = new StateTable<typeof this['movingState']>(this);
	lastAttack = 0;
	movingState: 'Walk' | 'Run' | 'Attack' = 'Walk';
	speed = this.maxSpeed;

	constructor(
		scene: Scene,
		x: number,
		y: number,
		name: string,
		readonly factory: CharacterFactory,
		readonly maxSpeed: number,
		maxHP: number
	) {
		super(scene, x, y, name, maxHP);
		this.movingTable.addState('Attack', () => scene.time.now - this.lastAttack > 1000, 'Walk');
	}

	spawnFireball(dirV: Vector2) {
		const scene = this.scene;
		this.lastAttack = scene.time.now;
		const fireball = scene.add.circle(0, 0, 8, 0xfff000);
		scene.physics.add.existing(fireball);
		fireball.setDepth(4);
		fireball.setPosition(this.x, this.y);
		dirV.normalize().scale(256);
		(fireball.body as Phaser.Physics.Arcade.Body).setVelocity(dirV.x, dirV.y);
		scene.physics.add.collider(this.factory.dynamicGroup, fireball, (b1, b2) => {
			if (b1 == this || b2 == this) return;
			b1.emit('damage', 1);
			b2.emit('damage', 1);
			fireball.destroy();
		});
		scene.time.addEvent({
			delay: 2000,
			callback: fireball.destroy,
			callbackScope: fireball,
		});
	}
	update() {
		const body = this.body as Phaser.Physics.Arcade.Body;
		body.velocity.normalize().scale(this.speed);
		this.updateAnimation();
		this.movingState = this.movingTable.getNextState(this.movingState);
	}
	updateAnimation() {
		this.updateDir();
		this.anims.play(
			`${this.texture.key}${this.movingState}${this.idle ? 'Idle' : ''}${Vizard.dirs[this.dir][1]}`,
			true
		);
	}
}

export default class Player extends Vizard {
	constructor(
		scene: Scene,
		x: number,
		y: number,
		name: string,
		factory: CharacterFactory,
		maxSpeed: number,
		readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys,
		maxHP = 10
	) {
		super(scene, x, y, name, factory, maxSpeed, maxHP);
		this.addListener('die', (prevent: (hp: number) => void) => prevent(3));
		const camera = scene.cameras.main;
		camera.zoom = 1.5; // если нужно приблизить камеру к авроре, чтобы увидеть перемещение камеры
		camera.useBounds = true;
		const size = scene.getSize();
		camera.setBounds(0, 0, size.x, size.y);
		camera.startFollow(this);

		const a = this.movingTable;
		a.addState('Walk', () => cursors.space.isDown, 'Attack', this.spawnFireball);
		a.addState(
			'Walk',
			() => cursors.shift.isDown,
			'Run',
			() => (this.speed = 2 * this.maxSpeed)
		);
		a.addState(
			'Run',
			() => cursors.shift.isUp || this.idle,
			'Walk',
			() => (this.speed = this.maxSpeed)
		);
	}

	spawnFireball() {
		const dirV = this.idle
			? Player.dirs[this.dir][0].clone().rotate(-Phaser.Math.TAU)
			: this.body.velocity.clone();
		super.spawnFireball(dirV);
	}
	update() {
		const body = this.body as Phaser.Physics.Arcade.Body;
		body.setVelocity(0);
		const speed = this.speed;
		const cursors = this.cursors;

		if (cursors.left.isDown) {
			body.velocity.x -= speed;
		} else if (cursors.right.isDown) {
			body.velocity.x += speed;
		}

		// Vertical movement
		if (cursors.up.isDown) {
			body.setVelocityY(-speed);
		} else if (cursors.down.isDown) {
			body.setVelocityY(speed);
		}

		super.update();
	}
}

export class EvilVizard extends Vizard {
	behaivorState: 'Idle' | 'Fire' | 'Escape' | 'Search' = 'Idle';
	behaivorTable = new StateTable<typeof this['behaivorState']>(this);
	constructor(
		scene: Scene,
		x: number,
		y: number,
		name: string,
		factory: CharacterFactory,
		maxSpeed: number,
		maxHP = 10
	) {
		super(scene, x, y, name, factory, maxSpeed, maxHP);
		const a = this.movingTable;
		a.addState('Walk', () => this.behaivorState === 'Fire', 'Attack', this.spawnFireball);
		a.addState(
			'Walk',
			() => this.behaivorState === 'Escape',
			'Run',
			() => (this.speed = 2 * this.maxSpeed)
		);
		a.addState(
			'Run',
			() => this.idle,
			'Walk',
			() => (this.speed = this.maxSpeed)
		);

		const b = this.behaivorTable;
		const not = (p: () => undefined | boolean) => () => !p();
		const playerInDistance = (dist: number) => () =>
			factory.player && Phaser.Math.Distance.BetweenPoints(factory.player, this) < dist;
		b.addState('Idle', playerInDistance(1024), 'Search', () => {
			this.activeSteering = new Wander(this, 0.1);
		});
		b.addState(
			'Search',
			not(playerInDistance(1024)),
			'Idle',
			() => (this.activeSteering = undefined)
		);
		b.addState(
			'Search',
			playerInDistance(400),
			'Fire',
			() => (this.activeSteering = new Pursuit(this, factory.player!, 0.2))
		);
		b.addState('Fire', not(playerInDistance(500)), 'Idle');
		b.addState('Escape', not(playerInDistance(800)), 'Idle');
		b.addStates(
			['Fire'],
			() => this.hp / this.maxHP < 0.4,
			'Escape',
			() => (this.activeSteering = new Escape(this, factory.player!, 0.4))
		);
	}
	activeSteering?: Steering;
	spawnFireball() {
		super.spawnFireball(
			new Vector2(this.factory.player!.x - this.x, this.factory.player!.y - this.y)
		);
	}
	update() {
		if (this.activeSteering) {
			const body = this.body as Phaser.Physics.Arcade.Body;
			body.velocity.normalize();
			const imp = this.activeSteering.calculateImpulse();
			body.velocity.x += imp.x * this.activeSteering.force;
			body.velocity.y += imp.y * this.activeSteering.force;
		}
		const nextBehaivor = this.behaivorTable.getNextState(this.behaivorState);
		if (nextBehaivor !== this.behaivorState) {
			console.log(this.behaivorState, nextBehaivor);
			this.behaivorState = nextBehaivor;
		}
		super.update();
	}
}

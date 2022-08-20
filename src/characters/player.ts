import { StateTable } from '../ai/behaviour/state';
import { SaveDistance } from '../ai/steerings/save-distance';
import { Wander } from '../ai/steerings/wander';
import CharacterFactory from './character_factory';
import { FireballConfig } from './fireball_system';
import { Scene } from './scene';
import Vector2 = Phaser.Math.Vector2;

export class SnakeAnimation {
	private static dirs = [
		[new Vector2(0, -1).normalize(), 'up'],
		[new Vector2(1, -1).normalize(), 'right_up'],
		[new Vector2(1, 0).normalize(), 'right'],
		[new Vector2(1, 1).normalize(), 'right_down'],
		[new Vector2(0, 1).normalize(), 'down'],
		[new Vector2(-1, 1).normalize(), 'left_down'],
		[new Vector2(-1, 0).normalize(), 'left'],
		[new Vector2(-1, -1).normalize(), 'left_up'],
	] as [Vector2, string][];
	constructor(readonly name: string) { }
	updateAnimation(sprite: Phaser.Physics.Arcade.Sprite) {
		const [c, dir] = SnakeAnimation.dirs.reduce(
			([max, a], [dir, da]) => {
				const delta = sprite.body.velocity.dot(dir);
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
			else sprite.anims.play({ key: anim, startFrame: Phaser.Math.RND.between(0, 30) }, true);
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
		const resetTintConfig: Phaser.Types.Time.TimerEventConfig = {
			delay: 500,
			callback: this.clearTint,
			callbackScope: this,
		};
		let resetTintTimer: Phaser.Time.TimerEvent | undefined;
		this.addListener('damage', (value: number) => {
			this.tint = value > 0 ? 0xff7777 : 0xee00ff;
			resetTintTimer?.destroy();
			resetTintTimer = this.scene.time.addEvent(resetTintConfig);
			this.hp -= value;
		});
	}
}


export class Wizard extends Biota {
	static dirs = [
		[new Vector2(0, -1), 'Up'],
		[new Vector2(1, 0), 'Right'],
		[new Vector2(0, 1), 'Down'],
		[new Vector2(-1, 0), 'Left'],
	] as [Vector2, 'Up' | 'Right' | 'Down' | 'Left'][];
	dir = 2;
	idle = true;
	updateDir() {
		const [c, newDir] = Player.dirs.reduce(
			([max, a], [dir], i) => {
				const delta = this.body.velocity.dot(dir);
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
	movingTable = new StateTable<typeof this['movingState'], this>(this);
	lastAttack = 0;
	movingState: 'Walk' | 'Run' | 'Attack' = 'Walk';
	speed = this.maxSpeed;

	public get canAttack(): boolean {
		return this.scene.time.now - this.lastAttack > this.fireball.cooldown;
	}

	constructor(
		scene: Scene,
		x: number,
		y: number,
		name: string,
		readonly factory: CharacterFactory,
		readonly maxSpeed: number,
		maxHP: number,
		readonly fireball: FireballConfig
	) {
		super(scene, x, y, name, maxHP);
		this.movingTable.addState('Attack', () => this.canAttack, 'Walk');
		this.movingTable.onStateChanged('Run', function () {
			this.speed = 2 * this.maxSpeed;
		});
		this.movingTable.onStateChanged('Walk', function () {
			this.speed = this.maxSpeed;
		});
		this.movingTable.onStateChanged('Attack', function () {
			this.speed = 0.9 * this.maxSpeed;
		});
	}

	spawnFireball(dirV: Vector2) {
		const scene = this.scene;
		this.lastAttack = scene.time.now;
		const fireball = this.factory.fireballSystem.spawnFireball(this.fireball, this, dirV);
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
			`${this.texture.key}${this.movingState}${this.idle ? 'Idle' : ''}${Wizard.dirs[this.dir][1]}`,
			true
		);
	}
}

class Cursor extends Phaser.GameObjects.Sprite {
	constructor(scene: Phaser.Scene, texture: string | Phaser.Textures.Texture, frame?: string | number) {
		super(scene, 0, 0, texture);
		scene.input.setDefaultCursor(`none`)
		scene.add.existing(this);
		this.setDepth(1000);
		// const sound = scene.sound.add("fireballSound", {loop: true})
        // sound.play();
		// this.sound = sound as Phaser.Sound.HTML5AudioSound;
	}
	// private sound: Phaser.Sound.HTML5AudioSound;

	update(): void {
		this.scene.input.activePointer.updateWorldPoint(this.scene.cameras.main);
		this.setX(this.scene.input.activePointer.worldX);
		this.setY(this.scene.input.activePointer.worldY);
		this.displayWidth = 32 / this.scene.cameras.main.zoom;
		this.displayHeight = 32 / this.scene.cameras.main.zoom;
		// const pan = -(this.scene.cameras.main.displayWidth/2 - this.scene.input.activePointer.x)/(this.scene.cameras.main.displayWidth/2);
		// this.sound.pan = pan;
	}
}

export default class Player extends Wizard {
	mouse = new Vector2()
	cursor: Cursor
	constructor(
		scene: Scene,
		x: number,
		y: number,
		name: string,
		factory: CharacterFactory,
		maxSpeed: number,
		readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys,
		maxHP: number,
		fireball: FireballConfig
	) {
		super(scene, x, y, name, factory, maxSpeed, maxHP, fireball);
		const cursor = this.cursor = new Cursor(scene, 'cursor', 0);
		const camera = scene.cameras.main;
		camera.useBounds = true;
		const size = scene.getSize();
		camera.setBounds(0, 0, size.x, size.y);
		camera.startFollow(this);

		const a = this.movingTable;
		a.addState('Walk', () => scene.input.activePointer.isDown, 'Attack', this.spawnFireball);
		a.addState('Walk', () => cursors.shift.isDown, 'Run');
		a.addState('Run', () => cursors.shift.isUp || this.idle, 'Walk');
		a.onStateChanged('Attack', () => cursor.setFrame(2))
		a.onStateChanged('Walk', () => cursor.setFrame(0))
		a.onStateChanged('Run', () => cursor.setFrame(1))


	}
	spawnFireball() {
		const eyeDir = this.getEyeDir();
		super.spawnFireball(eyeDir);
	}
	private getEyeDir() {
		const dx = this.scene.input.activePointer.worldX - this.x;
		const dy = this.scene.input.activePointer.worldY - this.y;
		const eyeDir = new Vector2(dx, dy).normalize();
		return eyeDir;
	}

	update() {
		this.cursor.update();
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
	updateDir() {
		const eyeDir = this.getEyeDir();
		const [c, newDir] = Player.dirs.reduce(
			([max, a], [dir], i) => {
				const delta = eyeDir.dot(dir);
				if (max < delta) {
					return [delta, i] as [number, number];
				}
				return [max, a] as [number, number];
			},
			[-2, this.dir] as [number, number]
		);
		this.dir = c > 0.1 ? newDir : this.dir;
		this.idle = this.body.velocity.length() < 0.1;
		this.anims.reverse()
	}
}

export class EvilWizard extends Wizard {
	behaivorState: 'Idle' | 'Fire' | 'Escape' | 'Search' = 'Idle';
	behaivorTable = new StateTable<typeof this['behaivorState']>(this);
	constructor(
		scene: Scene,
		x: number,
		y: number,
		name: string,
		factory: CharacterFactory,
		maxSpeed: number,
		maxHP: number,
		fireball: FireballConfig
	) {
		super(scene, x, y, name, factory, maxSpeed, maxHP, fireball);
		const a = this.movingTable;
		a.addState('Walk', () => this.behaivorState === 'Fire', 'Attack', this.spawnFireball);
		a.addState('Walk', () => this.behaivorState === 'Escape', 'Run');
		a.addState('Run', () => this.idle, 'Walk');

		const b = this.behaivorTable;
		const not = (p: () => undefined | boolean) => () => !p();
		const playerInDistance = (dist: number) => () =>
			factory.player && Phaser.Math.Distance.BetweenPoints(factory.player, this) < dist;
		b.onStateChanged('Idle', () => {
			this.activeSteerings.forEach(s => (s.force = 0));
		});
		b.addState('Idle', playerInDistance(1024), 'Search', () => {
			this.activeSteerings[0].force = 0.2;
			this.activeSteerings[1].force = 0.0;
		});
		b.addState('Search', not(playerInDistance(1024)), 'Idle');
		b.addState('Search', playerInDistance(400), 'Fire', () => {
			this.activeSteerings[0].force = 0.01;
			this.activeSteerings[1].minDistance = 100;
			this.activeSteerings[1].maxDistance = 350;
			this.activeSteerings[1].force = 0.2;
		});
		b.addState('Fire', not(playerInDistance(500)), 'Idle');
		b.addState('Escape', not(playerInDistance(800)), 'Idle');
		b.addState(
			'Fire',
			() => this.hp / this.maxHP < 0.4,
			'Escape',
			() => (this.activeSteerings[1].minDistance = Infinity)
		);
	}
	activeSteerings = [
		new Wander(this, 0),
		new SaveDistance(this, this.factory.player!, 200, 500, 0),
	] as const;
	spawnFireball() {
		super.spawnFireball(
			new Vector2(this.factory.player!.x - this.x, this.factory.player!.y - this.y).rotate(
				(Phaser.Math.RND.normal() * Math.PI) / 6
			)
		);
	}
	update() {
		const nextBehaivor = this.behaivorTable.getNextState(this.behaivorState);
		if (nextBehaivor !== this.behaivorState) {
			console.log(this.behaivorState, nextBehaivor);
			this.behaivorState = nextBehaivor;
		}

		const body = this.body as Phaser.Physics.Arcade.Body;
		body.velocity.normalize();
		if (this.behaivorState !== 'Idle') {
			for (const steer of this.activeSteerings) {
				const imp = steer.calculateImpulse();
				body.velocity.x += imp.x * steer.force;
				body.velocity.y += imp.y * steer.force;
			}
		}
		super.update();
	}
}

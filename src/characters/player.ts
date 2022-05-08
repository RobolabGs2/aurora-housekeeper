import CharacterFactory from './character_factory';
import { Scene } from './scene';

export default class Player extends Phaser.Physics.Arcade.Sprite {
	constructor(
		scene: Scene,
		x: number,
		y: number,
		name: string,
		frame: string | number,
		readonly factory: CharacterFactory,
		readonly maxSpeed: number,
		readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys,
		readonly animationSets: Map<string, string[]>
	) {
		super(scene, x, y, name, frame);
		scene.physics.world.enable(this);
		scene.add.existing(this);

		const camera = scene.cameras.main;
		camera.zoom = 1.5; // если нужно приблизить камеру к авроре, чтобы увидеть перемещение камеры
		camera.useBounds = true;
		const size = scene.getSize();
		camera.setBounds(0, 0, size.x, size.y);
		camera.startFollow(this);
	}

	update() {
		const body = this.body as Phaser.Physics.Arcade.Body;
		body.setVelocity(0);
		const speed = this.maxSpeed;
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

		body.velocity.normalize().scale(speed);
		this.updateAnimation();
	}
	updateAnimation() {
		const animations = this.animationSets.get('Walk')!;
		const animsController = this.anims;
		const x = this.body.velocity.x;
		const y = this.body.velocity.y;
		if (x < 0) {
			animsController.play(animations[0], true);
		} else if (x > 0) {
			animsController.play(animations[1], true);
		} else if (y < 0) {
			animsController.play(animations[2], true);
		} else if (y > 0) {
			animsController.play(animations[3], true);
		} else {
			const currentAnimation = animsController.currentAnim;
			if (currentAnimation) {
				const frame = currentAnimation.getLastFrame();
				this.setTexture(frame.textureKey, frame.textureFrame);
			}
		}
	}
}

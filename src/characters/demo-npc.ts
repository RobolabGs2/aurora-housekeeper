import Steering from '../ai/steerings/steering';
import { Biota, SnakeAnimation } from './player';
import { Scene } from './scene';

export default class DemoNPC extends Biota {
	constructor(
		scene: Scene,
		x: number,
		y: number,
		readonly snakeName: string,
		readonly maxSpeed: number
	) {
		super(scene, x, y, 'cactus', 2);
		this.setVelocity(1);
	}

	protected steerings: Steering[] = [];
	protected last = Date.now();

	addSteering(steering: Steering) {
		this.steerings.push(steering);
	}

	update() {
		const body = this.body as Phaser.Physics.Arcade.Body;
		body.velocity.normalize();
		this.steerings.forEach(st => {
			const imp = st.calculateImpulse();
			body.velocity.x += imp.x * st.force;
			body.velocity.y += imp.y * st.force;
		});
		body.velocity.normalize().scale(this.maxSpeed);
		//ограничиваем частоту обновления анимаций
		if (Date.now() - this.last > 600) {
			this.updateAnimation();
			this.last = Date.now();
		}
	}
	animCtrl = new SnakeAnimation(this.snakeName);
	updateAnimation() {
		this.animCtrl.updateAnimation(this);
	}
}

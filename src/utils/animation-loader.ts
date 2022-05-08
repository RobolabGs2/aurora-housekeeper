const defaultFrameRate = 5;
const defaultRepeat = -1;
export default class AnimationLoader {
	// params: Phaser scene,
	// loaded phaser spritesheet,
	// config - json with animation names and frames
	// config format as in /assets/animations/cyberpunk.json
	// prefix - optional animation name prefix

	constructor(
		readonly scene: Phaser.Scene,
		readonly spritesheet: string,
		readonly config: Record<string, Record<string, number[]>>,
		readonly prefix = '',
		readonly frameRate = defaultFrameRate,
		readonly repeat = defaultRepeat
	) {}
	createAnimations() {
		const animationGroups = new Map<string, string[]>();
		for (const key of Object.keys(this.config)) {
			animationGroups.set(key, this.parseAnimationsGroup(this.prefix, key, this.config[key]));
		}
		return animationGroups;
	}

	parseAnimationsGroup(prefix: string, groupName: string, animations: Record<string, number[]>) {
		const animationsNames = [];
		for (const key of Object.keys(animations)) {
			const name = prefix + groupName + key;
			animationsNames.push(name);
			const frames = animations[key];
			this.createAnimation(name, frames, this.frameRate, this.repeat);
		}
		return animationsNames;
	}
	// Can be used to create single animation with modified properties
	createAnimation(name: string, frames: number[], frameRate: number, repeat: number) {
		this.scene.anims.create({
			key: name,
			frames: this.scene.anims.generateFrameNumbers(this.spritesheet, {
				frames,
			}),
			frameRate,
			repeat,
		});
	}
}

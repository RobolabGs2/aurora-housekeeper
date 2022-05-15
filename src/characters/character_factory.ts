import Player, { EvilVizard } from './player';
import cyberpunkConfigJson from '../../assets/animations/cyberpunk.json';
import slimeConfigJson from '../../assets/animations/slime.json';
import AnimationLoader from '../utils/animation-loader';
import { Scene } from './scene';
import DemoNPC from './demo-npc';
import Sprite = Phaser.Physics.Arcade.Sprite;

export interface BuildSlimeOptions {
	slimeType?: number;
}

const cyberSpritesheets = ['aurora', 'blue', 'yellow', 'green', 'punk'] as const;
const slimeSpriteSheet = 'slime' as const;

enum DepthLayers {
	Stuff = 1,
	Characters = 2,
}

export type HumanSpriteSheetName = typeof cyberSpritesheets[number];
export type SpriteSheetName = typeof slimeSpriteSheet | HumanSpriteSheetName;
// на самом деле SpriteFactory, но переименовывать пока не будем
export default class CharacterFactory {
	animationLibrary = {} as Record<SpriteSheetName, Map<string, string[]>>;
	readonly gameObjects = new Array<Sprite>();
	readonly dynamicGroup: Phaser.Physics.Arcade.Group;
	player?: Player;
	constructor(public scene: Scene) {
		cyberSpritesheets.forEach(element => {
			this.animationLibrary[element] = new AnimationLoader(
				scene,
				element,
				cyberpunkConfigJson,
				element
			).createAnimations();
		});
		this.animationLibrary[slimeSpriteSheet] = new AnimationLoader(
			scene,
			slimeSpriteSheet,
			slimeConfigJson,
			slimeSpriteSheet
		).createAnimations();
		this.dynamicGroup = scene.physics.add.group();
	}

	addSprite(
		sprite: Sprite,
		dynamic = true,
		depth: DepthLayers = dynamic ? DepthLayers.Characters : DepthLayers.Stuff
	) {
		if (dynamic) {
			this.dynamicGroup.add(sprite);
			// sprite.setCollideWorldBounds(true);
		}
		sprite.setDepth(depth);
		this.gameObjects.push(sprite);
		sprite.on('destroy', () => {
			const i = this.gameObjects.findIndex(entity => entity === sprite);
			if (i != -1) {
				this.gameObjects[i] = this.gameObjects[this.gameObjects.length - 1];
				this.gameObjects.pop();
			}
		});
		return sprite;
	}

	buildPlayerCharacter(spriteSheetName: HumanSpriteSheetName, x: number, y: number) {
		const maxSpeed = 128;
		const cursors = this.scene.input.keyboard.createCursorKeys();
		if (this.player) throw new Error(`Game does not support two players`);
		const character = new Player(this.scene, x, y, spriteSheetName, this, maxSpeed, cursors);
		this.player = character;
		this.addSprite(character);
		return character;
	}

	buildVizardCharacter(spriteSheetName: HumanSpriteSheetName, x: number, y: number) {
		const maxSpeed = 100;
		const character = new EvilVizard(this.scene, x, y, spriteSheetName, this, maxSpeed);
		this.addSprite(character);
		return character;
	}

	buildTestCharacter(spriteSheetName: HumanSpriteSheetName, x: number, y: number) {
		const maxSpeed = 50;
		const animationSets = this.animationLibrary[spriteSheetName];
		if (animationSets === undefined) throw new Error(`Not found animations for test`);
		const character = new DemoNPC(this.scene, x, y, maxSpeed);
		this.addSprite(character);
		return character;
	}

	slimeNumberToName(n: number): string {
		switch (n) {
			case 0:
				return 'Blue';
			case 1:
				return 'Green';
			case 2:
				return 'Orange';
			case 3:
				return 'Pink';
			case 4:
				return 'Violet';
		}
		throw new Error(`Unknown slime with number ${n}`);
	}
}

import Player, { EvilWizard } from './player';
import cyberpunkConfigJson from '../../assets/animations/cyberpunk.json';
import slimeConfigJson from '../../assets/animations/slime.json';
import AnimationLoader from '../utils/animation-loader';
import { Scene } from './scene';
import DemoNPC from './demo-npc';
import Sprite = Phaser.Physics.Arcade.Sprite;
import { Loot } from './loot';
import { FireballSystem, FireballConfig } from './fireball_system';

export interface BuildSlimeOptions {
	slimeType?: number;
}

const cyberSpritesheets = ['aurora', 'blue', 'yellow', 'green', 'punk'] as const;
const slimeSpriteSheet = 'slime' as const;

enum DepthLayers {
	Stuff = 1,
	Characters = 2,
}
function addKeys<T extends string>(
	keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
	mapping: Record<T, number>
): Record<T, Phaser.Input.Keyboard.Key> {
	const keys = {} as Record<T, Phaser.Input.Keyboard.Key>;
	for (const key in mapping) keys[key] = keyboard.addKey(mapping[key]);
	return keys;
}

export type HumanSpriteSheetName = typeof cyberSpritesheets[number];
export type SpriteSheetName = typeof slimeSpriteSheet | HumanSpriteSheetName;
// на самом деле SpriteFactory, но переименовывать пока не будем
export default class CharacterFactory {
	animationLibrary = {} as Record<SpriteSheetName, Map<string, string[]>>;
	readonly gameObjects = new Array<Sprite>();
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
	}
	readonly dynamicGroup = this.scene.physics.add.group();
	readonly staticGroup = this.scene.physics.add.staticGroup();
	readonly fireballSystem = new FireballSystem(this.scene, this);

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
		if (this.player) throw new Error(`Game does not support two players`);
		const cursors = addKeys(this.scene.input.keyboard, {
			up: Phaser.Input.Keyboard.KeyCodes.W,
			down: Phaser.Input.Keyboard.KeyCodes.S,
			left: Phaser.Input.Keyboard.KeyCodes.A,
			right: Phaser.Input.Keyboard.KeyCodes.D,
			space: Phaser.Input.Keyboard.KeyCodes.SPACE,
			shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
		});
		const character = new Player(this.scene, x, y, spriteSheetName, this, maxSpeed, cursors, 20, {
			color: 0xaf0faa,
			cooldown: 900,
			damage: 1,
			radius: 6,
		});
		this.player = character;
		this.addSprite(character);
		return character;
	}

	buildVizardCharacter(
		spriteSheetName: HumanSpriteSheetName,
		maxSpeed: number,
		hp: number,
		x: number,
		y: number,
		fireball: FireballConfig
	) {
		const character = new EvilWizard(
			this.scene,
			x,
			y,
			spriteSheetName,
			this,
			maxSpeed,
			hp,
			fireball
		);
		this.addSprite(character);
		return character;
	}

	buildTestCharacter(skin: string, maxSpeed: number, hp: number, x: number, y: number) {
		const character = new DemoNPC(this.scene, x, y, skin, maxSpeed, hp, this);
		this.addSprite(character);
		return character;
	}

	buildMedicineChest(x: number, y: number) {
		const chest = new Loot(this.scene, x, y, 'cursor', 3);
		chest.width = 32;
		chest.height = 32;
		this.staticGroup.add(chest);
		this.addSprite(chest, false);
		this.scene.physics.add.overlap(chest, this.player!, () => {
			console.log('OVERLAP');
			this.player!.emit('damage', -1);
			chest.destroy();
		});
		chest.setDepth(10);
		return chest;
	}

	static slimeNumberToName(n: number): string {
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

"use strict";

const devices = require("../../data/devices.json");
const { getRealmData, getRealmAddress } = require("../../common/realms.js");
const { createBot, parseKickMessage } = require("../../common/bp-dp.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

const check = "<:success:1170321325886287882>";
const cross = "<:error:1170321352587219024>";
const loading = "<a:loading:1170321149759074355>";
const none = ":black_circle:";

const reply = "<:reply:1171524464761126942>";
const end = "<:end:1171524397840990269>";

module.exports = {
	name: "tp",
	description: "Teleport to a custom location on a realm. (Requires linked account)",
	options: [
		{
			type: 3,
			name: "code",
			description: "the realm code to join",
			required: true,
			min_length: 11,
			max_length: 11
		},
		{
			type: 4,
			name: "x",
			description: "x coordinate to teleport to",
			required: true,
			min_value: -30000000,
			max_value: 30000000
		},
		{
			type: 4,
			name: "y",
			description: "y coordinate to teleport to",
			required: true,
			min_value: -30000000,
			max_value: 30000000
		},
		{
			type: 4,
			name: "z",
			description: "z coordinate to teleport to",
			required: true,
			min_value: -30000000,
			max_value: 30000000
		},
		{
			type: 5,
			name: "relative",
			description: "Whever or not to teleport the player relative to the current position."
		},
		{
			type: 4,
			name: "dimension",
			description: "Which dimension to teleport to",
			choices: [
				{
					name: "minecraft:overworld",
					value: 0
				}
			]
		},
		{
			type: 4,
			name: "device_os",
			description: "the device to spoof as",
			choices: devices
		}
	],
	requireLink: true,
	execute: async (interaction, args, dbUser) => {
		const { accountID, user } = interaction;
		const { code: realmCode, device_os, relative, dimension } = args;

		const embed = {
			title: "Player Teleport",
			description: `${reply} ${loading} Connecting to realm\n${reply} ${none} Starting teleport`,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/tp | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		const msg = await interaction.createFollowup({ embed: embed });

		const realmData = await getRealmData(realmCode, accountID);

		if (realmData.errorMsg) {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Starting teleport\n${end} Error Log: ${realmData.errorMsg}`;

			return msg.edit({ embed: embed });
		}

		let realm = await realmModel.findOne({ id: realmData.id });

		if (!realm) {
			realm = createRealmDefaults({
				id: realmData.id,
				name: realmData.name,
				realmCode: realmCode
			});
			realm.save();
		}

		if (realm.realmCode !== realmCode && !realmCode.startsWith("=")) {
			realm.realmCode = realmCode;
			realm.save();
		}

		if (realm.whitelisted) {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Starting teleport\n${end} Error Log: Realm is whitelisted.`;

			return msg.edit({ embed: embed });
		}

		const address = await getRealmAddress(realmData.id, accountID);

		if (address.errorMsg) {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Starting teleport\n${end} Error Log:\n${address.errorMsg}`;

			return msg.edit({ embed: embed });
		}

		const client = createBot(address, device_os, dbUser);

		client.on("start_game", (packet) => {
			const { runtime_entity_id, rotation, player_position } = packet;
			let { x, y, z } = args;

			if (relative) {
				if (x < 0) x = player_position.x - Math.abs(x);
				else x = player_position.x + x;

				if (y < 0) y = player_position.y - Math.abs(y);
				else y = player_position.y + y;

				if (z < 0) z = player_position.z - Math.abs(z);
				else z = player_position.z + z;
			}

			if (dimension === 0) {
				client.write("show_credits", {
					runtime_entity_id: runtime_entity_id,
					status: 1
				});
			}

			setTimeout(() => {
				client.write("player_auth_input", {
					pitch: rotation.x,
					yaw: rotation.z,
					position: {
						x: x,
						// player y position seem to be shifted by 2
						y: y + 2,
						z: z
					},
					move_vector: {
						x: 0,
						z: 0
					},
					head_yaw: 0,
					input_data: {
						_value: 0n,
						ascend: false,
						descend: false,
						north_jump: false,
						jump_down: false,
						sprint_down: false,
						change_height: false,
						jumping: false,
						auto_jumping_in_water: false,
						sneaking: false,
						sneak_down: false,
						up: false,
						down: false,
						left: false,
						right: false,
						up_left: false,
						up_right: false,
						want_up: false,
						want_down: false,
						want_down_slow: false,
						want_up_slow: false,
						sprinting: false,
						ascend_block: false,
						descend_block: false,
						sneak_toggle_down: false,
						persist_sneak: false,
						start_sprinting: false,
						stop_sprinting: false,
						start_sneaking: false,
						stop_sneaking: false,
						start_swimming: false,
						stop_swimming: false,
						start_jumping: false,
						start_gliding: false,
						stop_gliding: false,
						item_interact: false,
						block_action: false,
						item_stack_request: false,
						handled_teleport: false,
						emoting: false
					},
					input_mode: client.options.skinData.CurrentInputMode,
					play_mode: 0,
					interaction_model: "touch",
					tick: 0n,
					delta: {
						x: 0,
						y: -0.07840000092983246,
						z: 0
					},
					analogue_move_vector: {
						x: 0,
						z: 0
					}
				});

				setTimeout(() => {
					client.disconnect();
					embed.description = `${reply} ${check} Connecting to realm\n${reply} ${check} Teleported!\n${end} Operation Finished.`;
					msg.edit({ embed: embed });
				}, 3000);
			}, 5000);
		});

		client.on("kick", (reason) => {
			embed.color = 16729871;
			embed.description = `${reply} ${check} Connecting to realm\n${reply} ${cross} Teleporting...\n${end} Error Log: ${parseKickMessage(reason.message)}`;

			msg.edit({ embed: embed });
		});
	}
};

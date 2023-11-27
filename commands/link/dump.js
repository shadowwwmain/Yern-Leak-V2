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
	name: "dump",
	description: "Find information regarding a world, such as resource packs and default spawn position.",
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
			name: "device_os",
			description: "the device to spoof as",
			choices: devices
		}
	],
	requireLink: true,
	execute: async (interaction, args, dbUser) => {
		const { accountID, user } = interaction;
		const { code: realmCode, device_os } = args;

		const embed = {
			title: "World Dump",
			description: `${reply} ${loading} Connecting to realm\n${end} ${none} Finding world data`,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/dump | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		const msg = await interaction.createFollowup({ embed: embed });

		const realmData = await getRealmData(realmCode, accountID);

		if (realmData.errorMsg) {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Finding world data\n${end} Error Log: ${realmData.errorMsg}`;

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
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Finding world data\n${end} Error Log: Realm is whitelisted.`;

			return msg.edit({ embed: embed });
		}

		const address = await getRealmAddress(realmData.id, accountID);

		if (!address || address.errorMsg) {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Finding world data\n${end} Error Log: ${address.errorMsg}`;

			return msg.edit({ embed: embed });
		}

		const client = createBot(address, device_os, dbUser);

		const resourcePacks = [];
		let startGameData;

		client.on("resource_packs_info", (packet) => {
			const resources = packet.texture_packs;

			for (const pack of resources) {
				const data = {
					uuid: pack.uuid,
					version: pack.version,
					name: pack.sub_pack_name,
					content_key: pack.content_key === "" ? undefined : pack.content_key
				};

				resourcePacks.push(data);
			}

			embed.description = `${reply} ${check} Connecting to realm\n${end} ${loading} Finding world data`;
			msg.edit({ embed: embed });
		});

		client.on("start_game", (packet) => {
			startGameData = packet;
		});

		client.on("available_commands", (packet) => {
			client.disconnect();

			embed.description = `${reply} ${check} Connecting to realm\n${end} ${check} Finding world data`;

			const enums = packet.dynamic_enums;

			const worldData = {
				seed: String(startGameData.seed),
				default_gamemode: startGameData.world_gamemode,
				default_spawn_position: startGameData.spawn_position,
				achievements_disabled: startGameData.achievements_disabled,
				bonus_chest_enabled: startGameData.bonus_chest,
				map_enabled: startGameData.map_enabled,
				level_id: startGameData.level_id,
				world_name: startGameData.world_name,
				multiplayer_correlation_id: startGameData.multiplayer_correlation_id
			};
			startGameData.experiments = startGameData.experiments.map(experiment => experiment.name);

			for (const gamerule of startGameData.gamerules) {
				delete gamerule.editable;
				delete gamerule.type;
			}

			const data = {
				resource_packs: resourcePacks,
				scoreboard_objectives: enums.find(({ name }) => name === "ScoreboardObjectives").values,
				tags: enums.find(({ name }) => name === "TagValues").values,
				functions: enums.find(({ name }) => name === "FunctionName").values,
				customItems: startGameData.itemstates.filter(item => !item.name.startsWith("minecraft:")),
				world_data: worldData,
				enabled_experiements: startGameData.experiments,
				gamerules: startGameData.gamerules
			};

			msg.edit({
				embed: embed,
				file: {
					file: Buffer.from(JSON.stringify(data, null, 2)),
					name: "dump.txt"
				}
			});
		});

		client.on("kick", (reason) => {
			embed.color = 16729871;
			embed.description = `${reply} ${check} Connecting to realm\n${reply} ${cross} Finding world data\n${end} Error Log: ${parseKickMessage(reason.message)}`;

			msg.edit({ embed: embed });
		});
	}
};
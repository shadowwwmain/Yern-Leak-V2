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
	name: "seed",
	description: "find the seed of the realm.",
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
			title: "Seed Finder",
			description: `${reply} ${loading} Connecting to realm\n${end} ${none} Finding seed`,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/seed | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		const msg = await interaction.createFollowup({ embed: embed });

		const realmData = await getRealmData(realmCode, accountID);

		if (realmData.errorMsg) {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Finding seed\n${end} Error Log: ${realmData.errorMsg}`;

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
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Finding seed\n${end} Error Log: Realm is whitelisted.`;

			return msg.edit({ embed: embed });
		}

		const address = await getRealmAddress(realmData.id, accountID);

		if (address.errorMsg) {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Finding seed\n${end} Error Log:\n${address.errorMsg}`;

			return msg.edit({ embed: embed });
		}

		const client = createBot(address, device_os, dbUser);

		client.on("start_game", (packet) => {
			const seed = packet.seed;

			client.disconnect();

			embed.description = `${reply} ${check} Connecting to realm\n${reply} ${check} Finding seed\n${reply} Operation Finished. \n${end} Seed: ${seed}`;

			msg.edit({
				embed: embed,
				components: [{
					type: 1,
					components: [
						{
							type: 2,
							label: "Chunkbase",
							style: 5,
							url: `https://www.chunkbase.com/apps/seed-map#${seed}`
						}
					]
				}]
			});
		});

		client.on("kick", (reason) => {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Finding seed\n${end} Error Log: ${parseKickMessage(reason.message)}`;

			msg.edit({ embed: embed });
		});
	}
};
"use strict";

const devices = require("../../data/devices.json");
const { translateKey } = require("../../translations/translate.js");
const { getRealmData, getRealmAddress } = require("../../common/realms.js");
const { createBot, parseKickMessage } = require("../../common/bp-dp.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

const check = "<:success:1170321325886287882>";
const cross = "<:error:1170321352587219024>";
const loading = "<a:loading:1170321149759074355>";
const none = ":black_circle:";

// has to be done on a later date or someone else
const reply = "<:reply:1171524464761126942>";
const end = "<:end:1171524397840990269>";

module.exports = {
	name: "coords",
	description: "find your current coordinates on a realm.",
	options: [
		{
			type: 3,
			name: "code",
			description: "The realm to join",
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
			title: translateKey(dbUser.locale, "coordsFinder"),
			description: translateKey(dbUser.locale, "coordsFinderStatus", {
				status1: loading,
				status2: none,
				status3: none,
				log: ""
			}),
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/coords | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		const msg = await interaction.createFollowup({ embed: embed });

		const realmData = await getRealmData(realmCode, accountID);

		if (realmData.errorMsg) {
			embed.color = 16729871;
			translateKey(dbUser.locale, "coordsFinderStatus", {
				status1: cross,
				status2: none,
				status3: none,
				log: `${translateKey(dbUser.locale, "errorLog")}:\n\n${realmData.errorMsg}`
			});

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
			embed.description = translateKey(dbUser.locale, "coordsFinderStatus", {
				status1: cross,
				status2: none,
				status3: none,
				log: `${translateKey(dbUser.locale, "errorLog")}:\n\nRealm is whitelisted.`
			});

			return msg.edit({ embed: embed });
		}

		const address = await getRealmAddress(realmData.id, accountID);

		if (address.errorMsg) {
			embed.color = 16729871;
			embed.description = translateKey(dbUser.locale, "coordsFinderStatus", {
				status1: check,
				status2: cross,
				status3: none,
				log: `${translateKey(dbUser.locale, "errorLog")}:\n\n${address.errorMsg}.`
			});

			return msg.edit({ embed: embed });
		}

		embed.description = translateKey(dbUser.locale, "coordsFinderStatus", {
			status1: check,
			status2: check,
			status3: loading,
			log: ""
		});
		msg.edit({ embed: embed });

		const client = createBot(address, device_os, dbUser);

		client.on("start_game", (packet) => {
			const { x, y, z } = packet.player_position;

			client.disconnect();
			embed.description = translateKey(dbUser.locale, "coordsFinderStatus", {
				status1: check,
				status2: check,
				status3: check,
				log: `__**Coordinates:**__\nX: ||${x.toFixed(2)}||\nY: ||${y.toFixed(2)}||\nZ: ||${z.toFixed(2)}||\nDimension: ${packet.dimension}`
			});
			msg.edit({ embed: embed });
		});

		client.on("kick", (reason) => {
			embed.color = 16729871;
			
			embed.description = translateKey(dbUser.locale, "coordsFinderStatus", {
				status1: check,
				status2: check,
				status3: cross,
				log: `${translateKey(dbUser.locale, "errorLog")}:\n\n${parseKickMessage(reason.message)}`
			});

			msg.edit({ embed: embed });
		});
	}
};